import DodoPayments from "dodopayments";

// ── SDK client (singleton) ───────────────────────────────────────────────────

let _client: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
  if (!_client) {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) throw new Error("DODO_PAYMENTS_API_KEY is not set");

    _client = new DodoPayments({
      bearerToken: apiKey,
      environment: (process.env.DODO_ENV ?? "test") === "live"
        ? "live_mode"
        : "test_mode",
    });
  }
  return _client;
}

// ── Checkout sessions ────────────────────────────────────────────────────────

export type BillingInterval = "monthly" | "yearly";

/**
 * Create a Dodo Payments one-time checkout session (used for credit top-ups).
 * Returns the checkout URL to redirect the user to.
 */
export async function createOneTimeCheckout(opts: {
  userId: string;
  userEmail: string;
  productId: string;     // Dodo one-time product ID
  topupCredits: number;  // credits to grant on payment.succeeded webhook
  successUrl: string;
  cancelUrl: string;
}): Promise<{ checkoutUrl: string }> {
  const client = getDodoClient();

  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: opts.productId, quantity: 1 }],
    return_url: opts.successUrl,
    customer: { email: opts.userEmail },
    metadata: {
      userId:        opts.userId,
      topupCredits:  String(opts.topupCredits),
    },
  });

  if (!session.checkout_url) {
    throw new Error(`Dodo did not return a checkout URL. Session: ${JSON.stringify(session)}`);
  }

  return { checkoutUrl: session.checkout_url };
}

/**
 * Create a Dodo Payments subscription checkout session.
 * Returns the checkout URL to redirect the user to.
 */
export async function createSubscriptionCheckout(opts: {
  userId: string;
  userEmail: string;
  productId: string;       // Dodo product ID for this plan+interval
  planId: string;          // our plan _id, e.g. "pro"
  billingInterval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  /** Plan price in INR paise (1 INR = 100 paise). When provided, overrides the
   *  ₹15,000 mandate floor so the customer's bank sees the actual charge amount.
   *  A 20% buffer is added to cover GST / rounding on future renewals. */
  planPriceInrPaise?: number;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  const client = getDodoClient();

  // Add 50% buffer so GST / rounding never pushes a renewal above the mandate.
  // Falls back to Dodo system default (₹15,000) when no INR price is configured.
  const mandateOverride =
    opts.planPriceInrPaise && opts.planPriceInrPaise > 0
      ? Math.ceil(opts.planPriceInrPaise * 1.5)
      : undefined;

  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: opts.productId, quantity: 1 }],
    return_url: opts.successUrl,
    customer: {
      email: opts.userEmail,
    },
    ...(mandateOverride != null ? { mandate_min_amount_inr_paise: mandateOverride } : {}),
    metadata: {
      userId:          opts.userId,
      planId:          opts.planId,
      billingInterval: opts.billingInterval,
    },
  });

  if (!session.checkout_url) {
    throw new Error(`Dodo did not return a checkout URL. Session: ${JSON.stringify(session)}`);
  }

  return {
    checkoutUrl: session.checkout_url,
    sessionId:   session.payment_id ?? "",
  };
}
