"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { Gift, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { PLAN_OFFERS } from "@/lib/plan-offers";
import { CouponBadge } from "@/components/coupon-badge";
import { useApiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function fireConfetti() {
  const end = Date.now() + 900;
  const colors = ["#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe", "#e0e7ff"];

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
      zIndex: 200,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
      zIndex: 200,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };

  confetti({
    particleCount: 70,
    spread: 90,
    origin: { y: 0.55 },
    colors,
    zIndex: 200,
  });
  frame();
}

/**
 * Fetches popup eligibility for the signed-in user and shows the
 * limited-time discount offer when the API says so.
 * Mount once under the authenticated dashboard shell.
 */
export function DiscountOfferPopup() {
  const apiFetch = useApiFetch();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"complete" | "later" | null>(null);
  const confettiFired = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/users/me/popups`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.discount?.show) {
          setTimeout(() => {
            if (!cancelled) setOpen(true);
          }, 800);
        }
      } catch {
        /* ignore — popup is non-critical */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  useEffect(() => {
    if (!open || confettiFired.current) return;
    confettiFired.current = true;
    const t = setTimeout(fireConfetti, 200);
    return () => clearTimeout(t);
  }, [open]);

  async function respond(action: "complete" | "later") {
    setBusy(action);
    try {
      await apiFetch(`${API_URL}/api/users/me/popups/discount`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
    } catch {
      /* still close locally */
    } finally {
      setOpen(false);
      setBusy(null);
      if (action === "complete") {
        router.push("/dashboard/billing");
      }
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Dismiss overlay"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={() => respond("later")}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="discount-offer-title"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-[420px] rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl"
          >
            <button
              type="button"
              onClick={() => respond("later")}
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col gap-5 p-6 pt-7">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15">
                  <Gift className="h-5 w-5 text-indigo-400" />
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
                  <Sparkles className="h-3 w-3" />
                  Limited time offer
                </div>

                <div className="flex flex-col gap-1.5">
                  <h2
                    id="discount-offer-title"
                    className="text-[22px] font-bold tracking-tight text-white"
                  >
                    Save on Core & Growth
                  </h2>
                  <p className="text-[13px] leading-relaxed text-white/40">
                    Exclusive launch codes - copy one and use it at checkout.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {PLAN_OFFERS.map((offer) => (
                  <CouponBadge key={offer.code} offer={offer} variant="card" />
                ))}
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => respond("complete")}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-400",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  {busy === "complete" ? "Opening billing…" : "Claim offer"}
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => respond("later")}
                  className="w-full rounded-xl py-2 text-[12.5px] font-medium text-white/40 transition-colors hover:text-white/65 disabled:opacity-50"
                >
                  {busy === "later" ? "Saving…" : "Ask me later"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
