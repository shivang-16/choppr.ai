import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Plan } from "../model/plan.model.js";
import { createSubscriptionCheckout } from "../services/dodo.service.js";
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

    // Look up plan from DB
    const plan = await Plan.findOne({ slug: planId }).lean();
    if (!plan || !plan.active) {
      res.status(404).json({ error: "Plan not found" });
      return;
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
