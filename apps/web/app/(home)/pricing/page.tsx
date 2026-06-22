"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Navbar from "../_components/navbar";
import Footer from "../_components/footer";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Plan = {
  slug: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  credits: number;
  features: string[];
  cta: string;
  popular: boolean;
  order: number;
};

function formatPrice(cents: number) {
  return cents === 0 ? 0 : cents / 100;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/plans`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setPlans(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const freePlan  = plans.find((p) => p.slug === "free");
  const paidPlans = plans.filter((p) => p.slug !== "free");

  return (
    <main className="min-h-screen bg-[#080808]">
      <Navbar />

      <div className="relative min-h-screen w-full overflow-hidden pt-24">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(100,80,200,0.12),transparent)]" />

        <div className="relative z-10 flex flex-col items-center px-6 py-14 gap-12">
          <div className="flex flex-col items-center gap-5 text-center max-w-2xl">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[12px] text-white/50">
              <Zap className="h-3 w-3 text-yellow-400 fill-yellow-400" />
              <span>Simple credit-based pricing</span>
            </div>

            <h1 className="text-[38px] sm:text-[44px] font-bold text-white leading-[1.1] tracking-tight">
              The right plan for every<br />creator
            </h1>
            <p className="text-[15px] text-white/40 leading-relaxed max-w-md">
              Clip smarter, not harder. No credit card required on free plan.
            </p>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-white/30 text-[13px]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading plans…
            </div>
          )}

          {!loading && paidPlans.length > 0 && (
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4">
              {paidPlans.map((plan) => {
                const price = formatPrice(plan.monthlyPrice);

                return (
                  <div
                    key={plan.slug}
                    className={cn(
                      "relative flex flex-col rounded-2xl p-6 gap-5",
                      plan.popular
                        ? "bg-[#0d0d1a] border border-indigo-500/50"
                        : "bg-[#0d0d0d] border border-white/8"
                    )}
                    style={plan.popular ? {
                      boxShadow: "0 0 0 1px rgba(99,102,241,0.2), 0 0 40px -10px rgba(99,102,241,0.25)",
                    } : undefined}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-0.5 text-[11px] font-semibold text-white whitespace-nowrap">
                        Most popular
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <p className={cn("text-[16px] font-bold", plan.popular ? "text-white" : "text-white/80")}>
                        {plan.name}
                      </p>
                      <p className="text-[12.5px] text-white/35 leading-relaxed">{plan.description}</p>
                    </div>

                    <div className="border-t border-dashed border-white/8" />

                    {plan.slug === "scale" ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-[28px] font-bold text-white leading-none">Custom pricing</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-[38px] font-bold text-white leading-none">${price}</span>
                        <span className="text-[14px] text-white/35 font-medium">/ month</span>
                      </div>
                    )}

                    {plan.slug === "scale" ? (
                      <a
                        href="https://cal.com/shivang-yadav/choppr-demo"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full rounded-xl py-2.5 text-[13px] font-semibold transition-all flex items-center justify-center gap-2 border border-white/12 bg-white/5 hover:bg-white/10 text-white"
                      >
                        Book a call
                      </a>
                    ) : (
                      <Link
                        href="/sign-in"
                        className={cn(
                          "w-full rounded-xl py-2.5 text-[13px] font-semibold transition-all flex items-center justify-center gap-2",
                          plan.popular
                            ? "bg-indigo-500 hover:bg-indigo-400 text-white"
                            : "border border-white/12 bg-white/5 hover:bg-white/10 text-white"
                        )}
                      >
                        {plan.cta}
                      </Link>
                    )}

                    <ul className="flex flex-col gap-2.5 mt-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <Check
                            className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", plan.popular ? "text-indigo-400" : "text-white/40")}
                            strokeWidth={2.5}
                          />
                          <span className="text-[12.5px] text-white/50 leading-snug">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && freePlan && (
            <div className="w-full max-w-5xl rounded-2xl border border-white/6 bg-[#0d0d0d] px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-semibold text-white/70">{freePlan.name} plan</p>
                <p className="text-[12px] text-white/30 leading-relaxed">
                  {freePlan.features.join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[22px] font-bold text-white/50">$0</span>
                <Link
                  href="/sign-in"
                  className="rounded-lg border border-white/12 bg-white/6 px-3 py-1.5 text-[12px] font-medium text-white/70 hover:bg-white/10 transition-colors"
                >
                  Get started free
                </Link>
              </div>
            </div>
          )}

          <div className="w-full max-w-3xl flex flex-col gap-5 pb-10">
            <h2 className="text-[18px] font-semibold text-white text-center">Common questions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  q: "What counts as 1 credit?",
                  a: "AI clipping costs 2 credits per minute of source video. Exporting a clip costs 2 credits per export. Captions or reframe alone cost 1 credit/min.",
                },
                {
                  q: "Do unused credits roll over?",
                  a: "Subscription credits reset each billing cycle. One-time top-up credits never expire.",
                },
                {
                  q: "What happens if a job fails?",
                  a: "Failed jobs cost nothing — credits are automatically refunded in full.",
                },
                {
                  q: "Can I cancel anytime?",
                  a: "Yes. You keep your credits until end of the billing period, then you drop to the free plan.",
                },
              ].map(({ q, a }) => (
                <div key={q} className="rounded-xl border border-white/6 bg-[#0d0d0d] px-5 py-4 flex flex-col gap-1.5">
                  <p className="text-[13px] font-semibold text-white/80">{q}</p>
                  <p className="text-[12px] text-white/35 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
