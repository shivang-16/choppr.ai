export type PlanOffer = {
  planSlug: "core" | "growth";
  planName: string;
  discountPercent: number;
  code: string;
  features: string[];
};

/** Limited-time coupon offers shown in the discount popup + pricing pages */
export const PLAN_OFFERS: PlanOffer[] = [
  {
    planSlug: "core",
    planName: "Core Plan",
    discountPercent: 15,
    code: "CORE15",
    features: [
      "500 credits per month",
      "Up to 2-hour video length per upload",
      "Around 4 hours of AI clipping every month",
    ],
  },
  {
    planSlug: "growth",
    planName: "Growth Plan",
    discountPercent: 25,
    code: "GROWTH25",
    features: [
      "1,500 credits per month",
      "Unlimited video length processing",
      "Around 12 hours of AI clipping every month",
    ],
  },
];

export function getOfferForPlan(slug: string): PlanOffer | undefined {
  return PLAN_OFFERS.find((o) => o.planSlug === slug);
}
