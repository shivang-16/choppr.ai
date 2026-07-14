import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { UserCredits } from "../model/user-credits.model.js";
import { CreditLedger } from "../model/credit-ledger.model.js";
import { grantSubscriptionCredits } from "../services/credits.service.js";
import { logger } from "../utils/logger.js";
import User from "../model/user.model.js";

// ── Signature verification ───────────────────────────────────────────────────
// Standard Webhooks spec: HMAC-SHA256 over "<webhook-id>.<webhook-timestamp>.<raw-body>"
// Key must be base64-decoded from the DODO_WEBHOOK_KEY env var.

function verifyDodoSignature(
  rawBody: string,
  webhookId: string,
  webhookTimestamp: string,
  webhookSignature: string,
): boolean {
  const secret = process.env.DODO_WEBHOOK_KEY ?? "";
  if (!secret) {
    logger.warn("DODO_WEBHOOK_KEY not set — skipping signature verification");
    return true; // don't block in dev if not configured yet
  }

  try {
    // Dodo key format: "whsec_<base64>" — strip prefix before decoding
    const keyBase64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const keyBytes  = Buffer.from(keyBase64, "base64");
    const message   = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const expected  = crypto
      .createHmac("sha256", keyBytes)
      .update(message)
      .digest("base64");

    // Dodo sends comma-separated list of "v1,<sig>" — check any of them
    const signatures = webhookSignature.split(" ");
    return signatures.some((s) => {
      const parts = s.split(",");
      const sig   = parts[parts.length - 1];
      return !!sig && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    });
  } catch (err) {
    logger.error(`Signature verification error: ${err}`);
    return false;
  }
}

// ── Idempotency helper ───────────────────────────────────────────────────────
// Idempotency key = "webhook:<webhookId>" for delivery-level dedup (catches exact
// re-deliveries) AND "sub-event:<subscriptionId>:<eventType>" for subscription
// lifecycle dedup (prevents duplicate grants when Dodo retries a failed payment
// and fires a new subscription.active with a brand-new webhookId).

async function isAlreadyProcessed(idempotencyKey: string): Promise<boolean> {
  const existing = await CreditLedger.findOne({ note: idempotencyKey }).lean();
  return !!existing;
}

/**
 * Build the idempotency key to use for a subscription lifecycle event.
 * Keyed on subscriptionId + eventType so that multiple deliveries of the
 * same lifecycle transition (e.g. subscription.active on payment retries)
 * are all treated as duplicates of the first successful grant.
 */
function subscriptionIdempotencyKey(subscriptionId: string | undefined, eventType: string): string {
  return subscriptionId
    ? `sub-event:${subscriptionId}:${eventType}`
    : `webhook-event:${eventType}:${Date.now()}`; // fallback — should never happen
}

// ── Plan mapping ─────────────────────────────────────────────────────────────
// Map Dodo product IDs back to our internal plan IDs.
// Populated at runtime from the Plan collection.

import { Plan } from "../model/plan.model.js";

async function planIdFromProductId(dodoProductId: string): Promise<string | null> {
  const plan = await Plan.findOne({
    $or: [
      { dodoProductIdMonthly: dodoProductId },
      { dodoProductIdYearly:  dodoProductId },
    ],
  }).lean();
  return plan?.slug ?? null;
}

// ── Main webhook handler ─────────────────────────────────────────────────────

/**
 * POST /api/webhooks/dodo
 *
 * Handles all Dodo webhook events.
 * Must receive the raw body (not JSON-parsed) for signature verification.
 */
export async function handleDodoWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const webhookId        = req.headers["webhook-id"] as string;
    const webhookTimestamp = req.headers["webhook-timestamp"] as string;
    const webhookSignature = req.headers["webhook-signature"] as string;

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      res.status(400).json({ error: "Missing webhook headers" });
      return;
    }

    // Raw body is attached by the express.raw() middleware on this route
    const rawBody = (req as any).rawBody as string;
    if (!rawBody) {
      res.status(400).json({ error: "Empty body" });
      return;
    }

    // 1. Verify signature
    if (!verifyDodoSignature(rawBody, webhookId, webhookTimestamp, webhookSignature)) {
      logger.warn(`Dodo webhook signature verification failed for ${webhookId}`);
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // 2. Parse event
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }

    const eventType: string = event.type ?? event.event_type ?? "";
    logger.info(`Dodo webhook received: ${eventType} (id=${webhookId})`);

    // 3. Delivery-level idempotency — skip exact re-deliveries of the same webhook
    if (await isAlreadyProcessed(`webhook:${webhookId}`)) {
      logger.info(`Duplicate webhook delivery ${webhookId} — skipping`);
      res.json({ ok: true, skipped: true });
      return;
    }

    // 4. Handle events
    await routeWebhookEvent(eventType, event, webhookId);

    res.json({ ok: true });
  } catch (err) {
    logger.error(`Webhook handler error: ${err}`);
    next(err);
  }
}

// ── Event routing ─────────────────────────────────────────────────────────────

async function routeWebhookEvent(eventType: string, event: any, webhookId: string) {
  switch (eventType) {

    // ── Subscription becomes active (new sub or reactivation) ───────────────
    case "subscription.active": {
      const sub            = event.data ?? event;
      const userId         = sub.metadata?.userId ?? sub.customer?.metadata?.userId;
      const productId      = sub.product_id ?? sub.items?.[0]?.price?.product;
      const subscriptionId = sub.subscription_id ?? sub.id;

      if (!userId || !productId) {
        logger.warn(`subscription.active missing userId or productId`, { sub });
        break;
      }

      // Subscription-level idempotency: skip if this subscription already had credits granted
      const subKey = subscriptionIdempotencyKey(subscriptionId, eventType);
      if (await isAlreadyProcessed(subKey)) {
        logger.info(`Duplicate subscription.active for sub ${subscriptionId} (user ${userId}) — skipping`);
        // Still record the delivery-level webhook so re-delivery check works too
        await CreditLedger.create({
          userId, amount: 0, bucket: "subscription", type: "grant_subscription",
          balanceAfter: (await UserCredits.findById(userId).lean())?.totalCredits ?? 0,
          note: `webhook:${webhookId}`,
        });
        break;
      }

      const planId = await planIdFromProductId(productId);
      if (!planId || planId === "free") {
        logger.warn(`Could not map productId=${productId} to a paid plan`);
        break;
      }

      await grantSubscriptionCredits(userId, planId as any, "add");

      await User.updateOne(
        { _id: userId },
        {
          $set: {
            subscriptionStatus:    "active",
            subscriptionStartDate: new Date(),
          },
        }
      );

      // Mark processed with BOTH the subscription-level key and the delivery-level key
      const balance = (await UserCredits.findById(userId).lean())?.totalCredits ?? 0;
      await CreditLedger.insertMany([
        {
          userId, amount: 0, bucket: "subscription", type: "grant_subscription",
          balanceAfter: balance, note: subKey,
        },
        {
          userId, amount: 0, bucket: "subscription", type: "grant_subscription",
          balanceAfter: balance, note: `webhook:${webhookId}`,
        },
      ]);

      logger.info(`subscription.active: granted ${planId} credits to user ${userId} (sub=${subscriptionId})`);
      break;
    }

    // ── Subscription renewed (recurring billing cycle) ──────────────────────
    case "subscription.renewed": {
      const sub            = event.data ?? event;
      const userId         = sub.metadata?.userId ?? sub.customer?.metadata?.userId;
      const productId      = sub.product_id ?? sub.items?.[0]?.price?.product;
      const subscriptionId = sub.subscription_id ?? sub.id;

      if (!userId || !productId) break;

      // Each renewal cycle should be keyed on the subscription + a period marker
      // so that retries within the same billing cycle are deduped but next month's
      // renewal is still processed. Use the webhook timestamp's year-month as the period.
      const period = new Date().toISOString().slice(0, 7); // "2026-07"
      const subKey = subscriptionIdempotencyKey(subscriptionId, `${eventType}:${period}`);
      if (await isAlreadyProcessed(subKey)) {
        logger.info(`Duplicate subscription.renewed for sub ${subscriptionId} period ${period} — skipping`);
        await CreditLedger.create({
          userId, amount: 0, bucket: "subscription", type: "grant_subscription",
          balanceAfter: (await UserCredits.findById(userId).lean())?.totalCredits ?? 0,
          note: `webhook:${webhookId}`,
        });
        break;
      }

      const planId = await planIdFromProductId(productId);
      if (!planId || planId === "free") break;

      await grantSubscriptionCredits(userId, planId as any, "reset");

      const balance = (await UserCredits.findById(userId).lean())?.totalCredits ?? 0;
      await CreditLedger.insertMany([
        {
          userId, amount: 0, bucket: "subscription", type: "grant_subscription",
          balanceAfter: balance, note: subKey,
        },
        {
          userId, amount: 0, bucket: "subscription", type: "grant_subscription",
          balanceAfter: balance, note: `webhook:${webhookId}`,
        },
      ]);

      logger.info(`subscription.renewed: reset ${planId} credits for user ${userId} (sub=${subscriptionId})`);
      break;
    }

    // ── Subscription cancelled ───────────────────────────────────────────────
    case "subscription.cancelled":
    case "subscription.expired": {
      const sub    = event.data ?? event;
      const userId = sub.metadata?.userId ?? sub.customer?.metadata?.userId;
      if (!userId) break;

      await UserCredits.updateOne(
        { _id: userId },
        { $set: { plan: "free" } }
      );
      await User.updateOne(
        { _id: userId },
        { $set: { subscriptionStatus: "cancelled" } }
      );

      await CreditLedger.create({
        userId, amount: 0, bucket: "subscription", type: "grant_subscription",
        balanceAfter: (await UserCredits.findById(userId).lean())?.totalCredits ?? 0,
        note: `webhook:${webhookId}`,
      });

      logger.info(`${eventType}: downgraded user ${userId} to free`);
      break;
    }

    // ── Subscription on hold (failed payment) ───────────────────────────────
    case "subscription.on_hold": {
      const sub    = event.data ?? event;
      const userId = sub.metadata?.userId ?? sub.customer?.metadata?.userId;
      if (!userId) break;

      await User.updateOne(
        { _id: userId },
        { $set: { subscriptionStatus: "inactive" } }
      );

      await CreditLedger.create({
        userId, amount: 0, bucket: "subscription", type: "grant_subscription",
        balanceAfter: 0, note: `webhook:${webhookId}`,
      });

      logger.info(`subscription.on_hold: user ${userId} payment failed`);
      break;
    }

    // ── Plan changed (upgrade / downgrade) ──────────────────────────────────
    case "subscription.plan_changed": {
      const sub            = event.data ?? event;
      const userId         = sub.metadata?.userId ?? sub.customer?.metadata?.userId;
      const productId      = sub.product_id ?? sub.items?.[0]?.price?.product;
      const subscriptionId = sub.subscription_id ?? sub.id;
      if (!userId || !productId) break;

      const subKey = subscriptionIdempotencyKey(subscriptionId, `${eventType}:${productId}`);
      if (await isAlreadyProcessed(subKey)) {
        logger.info(`Duplicate subscription.plan_changed for sub ${subscriptionId} → product ${productId} — skipping`);
        await CreditLedger.create({
          userId, amount: 0, bucket: "subscription", type: "grant_subscription",
          balanceAfter: (await UserCredits.findById(userId).lean())?.totalCredits ?? 0,
          note: `webhook:${webhookId}`,
        });
        break;
      }

      const planId = await planIdFromProductId(productId);
      if (!planId || planId === "free") break;

      await grantSubscriptionCredits(userId, planId as any, "reset");
      await User.updateOne({ _id: userId }, { $set: { subscriptionStatus: "active" } });

      const balance = (await UserCredits.findById(userId).lean())?.totalCredits ?? 0;
      await CreditLedger.insertMany([
        {
          userId, amount: 0, bucket: "subscription", type: "grant_subscription",
          balanceAfter: balance, note: subKey,
        },
        {
          userId, amount: 0, bucket: "subscription", type: "grant_subscription",
          balanceAfter: balance, note: `webhook:${webhookId}`,
        },
      ]);

      logger.info(`subscription.plan_changed: updated user ${userId} to plan ${planId} (sub=${subscriptionId})`);
      break;
    }

    // ── Payment succeeded (one-time top-ups handled here) ───────────────────
    case "payment.succeeded": {
      // Subscription payments are covered by subscription.active / renewed.
      // This handler is for one-time top-up purchases only.
      const payment  = event.data ?? event;
      const userId   = payment.metadata?.userId;
      const topupAmt = payment.metadata?.topupCredits;

      if (userId && topupAmt) {
        // Payment-level idempotency — key on the Dodo payment_id
        const payKey = `payment:${payment.payment_id ?? webhookId}`;
        if (await isAlreadyProcessed(payKey)) {
          logger.info(`Duplicate payment.succeeded for payment ${payment.payment_id} — skipping`);
          break;
        }

        const { grantTopupCredits } = await import("../services/credits.service.js");
        await grantTopupCredits(userId, Number(topupAmt), `Top-up via payment ${payment.payment_id}`);

        const balance = (await UserCredits.findById(userId).lean())?.totalCredits ?? 0;
        await CreditLedger.insertMany([
          {
            userId, amount: 0, bucket: "topup", type: "grant_topup",
            balanceAfter: balance, note: payKey,
          },
          {
            userId, amount: 0, bucket: "topup", type: "grant_topup",
            balanceAfter: balance, note: `webhook:${webhookId}`,
          },
        ]);

        logger.info(`payment.succeeded: granted ${topupAmt} topup credits to user ${userId}`);
      }
      break;
    }

    default:
      logger.debug(`Unhandled Dodo event type: ${eventType}`);
  }
}
