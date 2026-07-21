"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanOffer } from "@/lib/plan-offers";

type Props = {
  offer: PlanOffer;
  /** Compact chip for plan cards; full for popup; inline for price hint */
  variant?: "chip" | "card" | "inline";
  className?: string;
};

export function CouponBadge({ offer, variant = "chip", className }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked */
    }
  }

  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={copyCode}
        title="Copy code"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-left transition-colors hover:bg-indigo-500/15",
          className
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300/90">
          {offer.discountPercent}% off
        </span>
        <span className="h-3 w-px bg-indigo-500/30" />
        <span className="font-mono text-[11px] font-bold tracking-wider text-indigo-200">
          {offer.code}
        </span>
        {copied ? (
          <Check className="h-3 w-3 shrink-0 text-indigo-300" strokeWidth={2.5} />
        ) : (
          <Copy className="h-3 w-3 shrink-0 text-indigo-300" />
        )}
      </button>
    );
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={copyCode}
        title="Copy code"
        className={cn(
          "inline-flex items-center gap-1.5 text-[12px] text-indigo-300 transition-colors hover:text-indigo-200",
          className
        )}
      >
        <span>
          {offer.discountPercent}% off with{" "}
          <span className="font-mono font-semibold tracking-wider">{offer.code}</span>
        </span>
        {copied ? (
          <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} />
        ) : (
          <Copy className="h-3 w-3 shrink-0 opacity-80" />
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-white/10 bg-[#121212] p-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-[14px] font-semibold text-white">{offer.planName}</p>
          <p className="text-[12px] font-medium text-indigo-300">
            {offer.discountPercent}% Off
          </p>
        </div>
        <button
          type="button"
          onClick={copyCode}
          title="Copy code"
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1.5 font-mono text-[12px] font-bold tracking-wider text-indigo-200 transition-colors hover:bg-indigo-500/20"
        >
          {offer.code}
          {copied ? (
            <Check className="h-3 w-3" strokeWidth={2.5} />
          ) : (
            <Copy className="h-3 w-3 opacity-80" />
          )}
        </button>
      </div>

      <p className="text-[11.5px] text-white/40">
        Use code <span className="font-semibold text-white/60">{offer.code}</span> at checkout.
      </p>

      <ul className="flex flex-col gap-1.5">
        {offer.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-indigo-400" strokeWidth={2.5} />
            <span className="text-[12px] leading-snug text-white/50">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
