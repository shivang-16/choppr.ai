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
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    });
  } catch (err) {
    logger.error(`Signature verification error: ${err}`);
    return false;
  }
}

// ── Idempotency helper ───────────────────────────────────────────────────────
// We use the webhook-id header as the idempotency key.
// Store processed webhook IDs in the CreditLedger note field isn't ideal,
// so we use a simple in-process Set for dedup within a process lifetime,
// plus a DB check for cross-restart safety.

async function isAlreadyProcessed(webhookId: string): Promise<boolean> {
  const existing = await CreditLedger.findOne({ note: `webhook:${webhookId}` }).lean();
  return !!existing;
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
  return plan?._id ?? null;
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

    // 3. Idempotency — skip if already processed
    if (await isAlreadyProcessed(webhookId)) {
      logger.info(`Duplicate webhook ${webhookId} — skipping`);
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
      const sub       = event.data ?? event;
      const userId    = sub.metadata?.userId ?? sub.customer?.metadata?.userId;
      const productId = sub.product_id ?? sub.items?.[0]?.price?.product;

      if (!userId || !productId) {
        logger.warn(`subscription.active missing userId or productId`, { sub });
        break;
      }

      const planId = await planIdFromProductId(productId);
      if (!planId || planId === "free") {
        logger.warn(`Could not map productId=${productId} to a paid plan`);
        break;
      }

      await grantSubscriptionCredits(userId, planId as any);

      // Update user subscription status
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            subscriptionStatus:    "active",
            subscriptionStartDate: new Date(),
          },
        }
      );

      // Mark as processed
      await CreditLedger.create({
        userId,
        amount:      0,
        bucket:      "subscription",
        type:        "grant_subscription",
        balanceAfter: (await UserCredits.findById(userId).lean())?.totalCredits ?? 0,
        note:        `webhook:${webhookId}`,
      });

      logger.info(`subscription.active: granted ${planId} credits to user ${userId}`);
      break;
    }

    // ── Subscription renewed (recurring billing cycle) ──────────────────────
    case "subscription.renewed": {
      const sub       = event.data ?? event;
      const userId    = sub.metadata?.userId ?? sub.customer?.metadata?.userId;
      const productId = sub.product_id ?? sub.items?.[0]?.price?.product;

      if (!userId || !productId) break;

      const planId = await planIdFromProductId(productId);
      if (!planId || planId === "free") break;

      await grantSubscriptionCredits(userId, planId as any);

      await CreditLedger.create({
        userId,
        amount:      0,
        bucket:      "subscription",
        type:        "grant_subscription",
        balanceAfter: (await UserCredits.findById(userId).lean())?.totalCredits ?? 0,
        note:        `webhook:${webhookId}`,
      });

      logger.info(`subscription.renewed: reset ${planId} credits for user ${userId}`);
      break;
    }

    // ── Subscription cancelled ───────────────────────────────────────────────
    case "subscription.cancelled":
    case "subscription.expired": {
      const sub    = event.data ?? event;
      const userId = sub.metadata?.userId ?? sub.customer?.metadata?.userId;
      if (!userId) break;

      // Downgrade to free — next cycle they'll get free plan credits
      await UserCredits.updateOne(
        { _id: userId },
        { $set: { plan: "free" } }
      );
      await User.updateOne(
        { _id: userId },
        { $set: { subscriptionStatus: "cancelled" } }
      );

      // Mark as processed
      await CreditLedger.create({
        userId,
        amount:      0,
        bucket:      "subscription",
        type:        "grant_subscription",
        balanceAfter: (await UserCredits.findById(userId).lean())?.totalCredits ?? 0,
        note:        `webhook:${webhookId}`,
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
        userId,
        amount: 0, bucket: "subscription", type: "grant_subscription",
        balanceAfter: 0,
        note: `webhook:${webhookId}`,
      });

      logger.info(`subscription.on_hold: user ${userId} payment failed`);
      break;
    }

    // ── Plan changed (upgrade / downgrade) ──────────────────────────────────
    case "subscription.plan_changed": {
      const sub       = event.data ?? event;
      const userId    = sub.metadata?.userId ?? sub.customer?.metadata?.userId;
      const productId = sub.product_id ?? sub.items?.[0]?.price?.product;
      if (!userId || !productId) break;

      const planId = await planIdFromProductId(productId);
      if (!planId || planId === "free") break;

      await grantSubscriptionCredits(userId, planId as any);
      await User.updateOne({ _id: userId }, { $set: { subscriptionStatus: "active" } });

      await CreditLedger.create({
        userId,
        amount: 0, bucket: "subscription", type: "grant_subscription",
        balanceAfter: (await UserCredits.findById(userId).lean())?.totalCredits ?? 0,
        note: `webhook:${webhookId}`,
      });

      logger.info(`subscription.plan_changed: updated user ${userId} to plan ${planId}`);
      break;
    }

    // ── Payment succeeded (one-time top-ups handled here) ───────────────────
    case "payment.succeeded": {
      // Subscription payments are covered by subscription.active / renewed.
      // This handler is primarily for one-time top-up purchases.
      const payment   = event.data ?? event;
      const userId    = payment.metadata?.userId;
      const topupAmt  = payment.metadata?.topupCredits;

      if (userId && topupAmt) {
        const { grantTopupCredits } = await import("../services/credits.service.js");
        await grantTopupCredits(userId, Number(topupAmt), `Top-up via payment ${payment.payment_id}`);

        await CreditLedger.create({
          userId,
          amount: 0, bucket: "topup", type: "grant_topup",
          balanceAfter: (await UserCredits.findById(userId).lean())?.totalCredits ?? 0,
          note: `webhook:${webhookId}`,
        });

        logger.info(`payment.succeeded: granted ${topupAmt} topup credits to user ${userId}`);
      }
      break;
    }

    default:
      logger.debug(`Unhandled Dodo event type: ${eventType}`);
  }
}
