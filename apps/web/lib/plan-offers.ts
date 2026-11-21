export type PlanOffer = {
  planSlug: "core" | "growth";
  planName: string;
  /** Whole-number percent shown to users ("14% off"). */
  discountPercent: number;
  /**
   * Exact percent configured on the Dodo discount code. Used for the discounted
   * price shown on the page, so it must match Dodo: 14.29% off $7 = $6.00,
   * 16.67% off $12 = $10.00.
   */
  effectivePercent: number;
  code: string;
  features: string[];
};

/** Limited-time coupon offers shown in the discount popup + pricing pages */
export const PLAN_OFFERS: PlanOffer[] = [
  {
    planSlug: "core",
    planName: "Core Plan",
    discountPercent: 14,
    effectivePercent: 14.29,
    code: "CORE14",
    features: [
      "500 credits per month",
      "Up to 2-hour video length per upload",
      "Around 4 hours of AI clipping every month",
    ],
  },
  {
    planSlug: "growth",
    planName: "Growth Plan",
    discountPercent: 17,
    effectivePercent: 16.67,
    code: "GROWTH17",
    features: [
      "1,500 credits per month",
      "Unlimited video length processing",
      "Around 12 hours of AI clipping every month",
    ],
  },
];

/** Largest whole-number discount, for "up to X% off" banners. */
export const MAX_OFFER_PERCENT = Math.max(...PLAN_OFFERS.map((o) => o.discountPercent));

/** Price after the offer, rounded to cents. */
export function discountedPrice(price: number, offer: PlanOffer): number {
  return Math.round(price * (1 - offer.effectivePercent / 100) * 100) / 100;
}

export function getOfferForPlan(slug: string): PlanOffer | undefined {
  return PLAN_OFFERS.find((o) => o.planSlug === slug);
}
