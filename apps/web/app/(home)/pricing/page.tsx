import type { Metadata } from "next";
import { PricingClient } from "./_components/pricing-client";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple credit-based pricing for Choppr AI. Start free, upgrade when you need more clips. No credit card required on the free plan.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Choppr AI Pricing - Start Free, Clip More",
    description:
      "Simple credit-based pricing. AI video clipping, captions, and reframe. Start for free — no credit card required.",
    url: "/pricing",
    type: "website",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
