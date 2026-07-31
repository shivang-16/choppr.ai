import type { Metadata } from "next";
import { PricingClient, type Plan } from "./_components/pricing-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
      "Simple credit-based pricing. AI video clipping, captions, and reframe. Start for free - no credit card required.",
    url: "/pricing",
    type: "website",
  },
};

async function getPlans(): Promise<Plan[]> {
  try {
    const res = await fetch(`${API_URL}/api/plans`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function PricingPage() {
  const plans = await getPlans();
  return <PricingClient initialPlans={plans} />;
}
