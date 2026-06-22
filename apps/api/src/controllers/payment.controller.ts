import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Plan } from "../model/plan.model.js";
import { TopupPack } from "../model/topup-pack.model.js";
import { UserCredits } from "../model/user-credits.model.js";
import { createSubscriptionCheckout, createOneTimeCheckout } from "../services/dodo.service.js";
import { logger } from "../utils/logger.js";

const CheckoutSchema = z.object({
  planId:          z.enum(["core", "growth", "scale"]),
  billingInterval: z.enum(["monthly", "yearly"]),
});

/**
 * POST /api/payments/checkout
 * Creates a Dodo subscription checkout session and returns the URL.
 * Frontend redirects the user to that URL.
 */
export async function createCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const { planId, billingInterval } = parsed.data;
    const user = req.user;
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    // Look up requested plan from DB
    const plan = await Plan.findOne({ slug: planId }).lean();
    if (!plan || !plan.active) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    // Block downgrades — look up the user's current plan and compare order
    const credits = await UserCredits.findById(user._id).lean();
    const currentPlanSlug = credits?.plan ?? "free";
    if (currentPlanSlug !== "free") {
      const currentPlan = await Plan.findOne({ slug: currentPlanSlug }).lean();
      if (currentPlan && plan.order < currentPlan.order) {
        res.status(400).json({
          error: "downgrade_not_supported",
          message: `You are already on the ${currentPlan.name} plan. Downgrades are not supported. Please contact support if you need to change plans.`,
        });
        return;
      }
    }

    // Pick the correct Dodo product ID based on billing interval
    const productId = billingInterval === "yearly"
      ? plan.dodoProductIdYearly
      : plan.dodoProductIdMonthly;

    if (!productId) {
      res.status(503).json({
        error: "payment_not_configured",
        message: `Payment for ${plan.name} (${billingInterval}) is not yet configured. Add the Dodo product ID to the plan.`,
      });
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

    const { checkoutUrl, sessionId } = await createSubscriptionCheckout({
      userId:          user._id,
      userEmail:       user.email,
      productId,
      planId,
      billingInterval,
      successUrl: `${frontendUrl}/dashboard?success=1&plan=${planId}`,
      cancelUrl:  `${frontendUrl}/dashboard/billing?cancelled=1`,
    });

    logger.info(`Checkout created for user ${user._id} plan=${planId} interval=${billingInterval}`);
    res.json({ checkoutUrl, sessionId });
  } catch (err: any) {
    logger.error("Checkout error:", err?.message ?? err);
    if (err?.status || err?.statusCode) {
      logger.error("Dodo API error body:", JSON.stringify(err?.body ?? err?.error ?? {}));
    }
    next(err);
  }
}

// ── GET /api/payments/topup-packs ───────────────────────────────────────────

/**
 * Returns all active credit top-up packs (publicly readable for authenticated users).
 */
export async function listTopupPacks(req: Request, res: Response, next: NextFunction) {
  try {
    const packs = await TopupPack.find({ active: true }).sort({ order: 1 }).lean();
    res.json(packs);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/payments/topup-checkout ───────────────────────────────────────

const TopupCheckoutSchema = z.object({
  packSlug: z.string(),
});

/**
 * Creates a Dodo one-time checkout session for a credit top-up pack.
 * Frontend redirects the user to the returned checkoutUrl.
 */
export async function createTopupCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = TopupCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const { packSlug } = parsed.data;
    const user = req.user;
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const pack = await TopupPack.findOne({ slug: packSlug, active: true }).lean();
    if (!pack) {
      res.status(404).json({ error: "Top-up pack not found" });
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

    const { checkoutUrl } = await createOneTimeCheckout({
      userId:       user._id,
      userEmail:    user.email,
      productId:    pack.dodoProductId,
      topupCredits: pack.credits,
      successUrl:   `${frontendUrl}/dashboard/billing?success=1&topup=${pack.slug}`,
      cancelUrl:    `${frontendUrl}/dashboard/billing?cancelled=1`,
    });

    logger.info(`Topup checkout created for user ${user._id} pack=${packSlug} credits=${pack.credits}`);
    res.json({ checkoutUrl });
  } catch (err: any) {
    logger.error("Topup checkout error:", err?.message ?? err);
    next(err);
  }
}
