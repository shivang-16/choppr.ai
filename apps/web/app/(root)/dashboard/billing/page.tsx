"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useApiFetch } from "@/lib/apiFetch";
import { Check, Zap, Loader2, CheckCircle, XCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Shape returned by GET /api/plans/me
type Plan = {
  _id: string;
  slug: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  credits: number;
  maxVideoLengthMins: number | null;
  maxClipsPerJob: number | null;
  maxExportResolution: string;
  teamSeats: number;
  apiAccess: boolean;
  priorityQueue: boolean;
  features: string[];
  cta: string;
  popular: boolean;
  order: number;
};

type MyPlanResponse = {
  plans: Plan[];
  currentPlanId: string;
  balance: number;
  cycleEnd: string | null;
};

type TopupPack = {
  _id: string;
  slug: string;
  name: string;
  credits: number;
  price: number; // cents
  order: number;
};

function formatPrice(cents: number) {
  return cents === 0 ? 0 : cents / 100;
}

function BillingContent() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [data, setData] = useState<MyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [topupPacks, setTopupPacks] = useState<TopupPack[]>([]);
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get("success") === "1";
  const paymentCancelled = searchParams.get("cancelled") === "1";
  const topupSuccess = searchParams.get("topup");
  const apiFetch = useApiFetch();

  useEffect(() => {
    apiFetch(`${API_URL}/api/plans/me`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    apiFetch(`${API_URL}/api/payments/topup-packs`)
      .then((r) => r.ok ? r.json() : [])
      .then(setTopupPacks)
      .catch(() => {});
  }, []);

  async function handleUpgrade(planId: string) {
    setCheckingOut(planId);
    try {
      const res = await apiFetch(`${API_URL}/api/payments/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingInterval: billing }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.message ?? json.error ?? "Something went wrong");
        return;
      }
      // Redirect to Dodo hosted checkout
      window.location.href = json.checkoutUrl;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setCheckingOut(null);
    }
  }

  async function handleTopup(packSlug: string) {
    setCheckingOut(`topup-${packSlug}`);
    try {
      const res = await apiFetch(`${API_URL}/api/payments/topup-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packSlug }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.message ?? json.error ?? "Something went wrong");
        return;
      }
      window.location.href = json.checkoutUrl;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setCheckingOut(null);
    }
  }

  // Split free from paid plans
  const freePlan    = data?.plans.find((p) => p.slug === "free");
  const paidPlans   = data?.plans.filter((p) => p.slug !== "free") ?? [];
  const currentId   = data?.currentPlanId ?? "free";
  const currentPlan = data?.plans.find((p) => p.slug === currentId);
  const currentOrder = currentPlan?.order ?? 0;

  // Show topup section only when user is on Growth (highest paid subscription, order=2)
  const showTopups = currentId === "growth" && topupPacks.length > 0;

  return (
    <div className="relative min-h-screen w-full overflow-hidden">

      {/* Dot grid background */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(100,80,200,0.12),transparent)]" />

      <div className="relative z-10 flex flex-col items-center px-6 py-14 gap-12">

        {/* ── Payment result banners ── */}
        {paymentSuccess && (
          <div className="w-full max-w-2xl flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 px-5 py-4">
            <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-green-300">Payment successful!</p>
              <p className="text-[12px] text-green-400/70">
                {topupSuccess
                  ? `Your top-up credits have been added. It may take a moment to reflect.`
                  : `Your credits have been added. It may take a moment to reflect.`}
              </p>
            </div>
          </div>
        )}
        {paymentCancelled && (
          <div className="w-full max-w-2xl flex items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-5 py-4">
            <XCircle className="h-5 w-5 text-white/30 shrink-0" />
            <p className="text-[13px] text-white/40">Payment cancelled. No charges were made.</p>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex flex-col items-center gap-5 text-center max-w-2xl">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[12px] text-white/50">
            <Zap className="h-3 w-3 text-yellow-400 fill-yellow-400" />
            {loading
              ? <span>Loading…</span>
              : data
              ? <span>Your balance: <span className="text-white font-semibold">{data.balance.toLocaleString()} credits</span></span>
              : <span>Could not load balance</span>
            }
          </div>

          <h1 className="text-[38px] sm:text-[44px] font-bold text-white leading-[1.1] tracking-tight">
            The right plan for every<br />creator
          </h1>
          <p className="text-[15px] text-white/40 leading-relaxed max-w-md">
            Clip smarter, not harder. No credit card required on free plan.
          </p>

          {/* Billing toggle — hidden until yearly plans are re-enabled */}
          {/* <div className="flex items-center gap-3 text-[13px]">
            <span className={cn("transition-colors", billing === "monthly" ? "text-white" : "text-white/35")}>Monthly</span>
            <button
              onClick={() => setBilling(b => b === "monthly" ? "yearly" : "monthly")}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors duration-300",
                billing === "yearly" ? "bg-indigo-500" : "bg-white/15"
              )}
            >
              <span className={cn(
                "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300",
                billing === "yearly" ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
            <span className={cn("transition-colors", billing === "yearly" ? "text-white" : "text-white/35")}>Annually</span>
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-all",
              billing === "yearly"
                ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-300"
                : "border-white/8 bg-white/4 text-white/30"
            )}>
              20% off
            </span>
          </div> */}
        </div>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="flex items-center gap-2 text-white/30 text-[13px]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading plans…
          </div>
        )}

        {/* ── Credit top-up packs (shown only on Growth plan) ── */}
        {showTopups && (
          <div className="w-full max-w-5xl flex flex-col gap-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] text-indigo-300">
                <Sparkles className="h-3 w-3" /> One-time credit top-ups
              </div>
              <h2 className="text-[22px] font-bold text-white">Need more credits?</h2>
              <p className="text-[13px] text-white/40 max-w-sm">
                Top-up credits never expire and stack on top of your monthly subscription.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {topupPacks.map((pack) => {
                const isLoading = checkingOut === `topup-${pack.slug}`;
                const pricePerCredit = (pack.price / pack.credits / 100).toFixed(2);
                return (
                  <div
                    key={pack.slug}
                    className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-[#0d0d0d] p-5"
                  >
                    {/* Name + price row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[14px] font-bold text-white">{pack.name}</p>
                        <p className="text-[11px] text-white/35">{pack.credits.toLocaleString()} credits</p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-[20px] font-bold text-white leading-none">
                          ${formatPrice(pack.price)}
                        </span>
                        <span className="text-[10px] text-white/30">${pricePerCredit} / cr</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTopup(pack.slug)}
                      disabled={!!checkingOut}
                      className="w-full rounded-xl py-2 text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 border border-white/12 bg-white/5 hover:bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {isLoading ? "Redirecting…" : "Buy now"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Paid plan cards ── */}
        {!loading && paidPlans.length > 0 && (
          <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4">
            {paidPlans.map((plan) => {
              const price = billing === "yearly"
                ? formatPrice(plan.yearlyPrice)
                : formatPrice(plan.monthlyPrice);
              const monthlyPrice  = formatPrice(plan.monthlyPrice);
              const yearlyPrice   = formatPrice(plan.yearlyPrice);
              const current       = currentId === plan.slug;
              const isDowngrade   = plan.order < currentOrder;

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
                    boxShadow: "0 0 0 1px rgba(99,102,241,0.2), 0 0 40px -10px rgba(99,102,241,0.25)"
                  } : undefined}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-0.5 text-[11px] font-semibold text-white whitespace-nowrap">
                      Most popular
                    </div>
                  )}

                  {/* Name + desc */}
                  <div className="flex flex-col gap-2">
                    <p className={cn("text-[16px] font-bold", plan.popular ? "text-white" : "text-white/80")}>
                      {plan.name}
                    </p>
                    <p className="text-[12.5px] text-white/35 leading-relaxed">{plan.description}</p>
                  </div>

                  <div className="border-t border-dashed border-white/8" />

                  {/* Price */}
                  {plan.slug === "scale" ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-[28px] font-bold text-white leading-none">Custom pricing</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[38px] font-bold text-white leading-none">${price}</span>
                        <span className="text-[14px] text-white/35 font-medium">/ month</span>
                      </div>
                    </div>
                  )}

                  {/* CTA */}
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
                    <button
                      disabled={current || isDowngrade || checkingOut === plan.slug}
                      onClick={() => !current && !isDowngrade && handleUpgrade(plan.slug)}
                      className={cn(
                        "w-full rounded-xl py-2.5 text-[13px] font-semibold transition-all flex items-center justify-center gap-2",
                        current || isDowngrade
                          ? "border border-white/8 bg-transparent text-white/25 cursor-not-allowed"
                          : plan.popular
                          ? "bg-indigo-500 hover:bg-indigo-400 text-white"
                          : "border border-white/12 bg-white/5 hover:bg-white/10 text-white"
                      )}
                    >
                      {checkingOut === plan.slug && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {current
                        ? "Current plan"
                        : isDowngrade
                        ? "Not available"
                        : checkingOut === plan.slug
                        ? "Redirecting…"
                        : plan.cta}
                    </button>
                  )}

                  {/* Features */}
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

        {/* ── Free plan row ── */}
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
              <span className={cn(
                "rounded-lg border px-3 py-1.5 text-[12px] font-medium",
                currentId === "free"
                  ? "border-white/15 bg-white/6 text-white/50"
                  : "border-white/8 bg-transparent text-white/25"
              )}>
                {currentId === "free" ? "Current plan" : "Always free"}
              </span>
            </div>
          </div>
        )}

        {/* ── FAQ ── */}
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
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}
