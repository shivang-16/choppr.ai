"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import ChopprLogo from "@/components/choppr-logo";

const FEATURES = [
  { label: "AI Clipping", description: "Auto-find viral moments" },
  { label: "AI Captioning", description: "Accurate captions in seconds" },
  { label: "AI Reframe", description: "Smart crop for any aspect ratio" },
];

export default function Navbar() {
  const [showFeatures, setShowFeatures] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-4">
      <nav className="flex items-center justify-between w-full max-w-6xl rounded-2xl border border-white/8 bg-white/4 px-5 py-3 backdrop-blur-xl">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <ChopprLogo size={32} />
          <span className="text-[15px] font-semibold tracking-tight text-white">
            choppr
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {/* Features dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setShowFeatures(true)}
            onMouseLeave={() => setShowFeatures(false)}
          >
            <button
              className={cn(
                "cursor-pointer flex items-center gap-1 rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors",
                "text-white/60 hover:text-white hover:bg-white/6"
              )}
            >
              Features
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  showFeatures && "rotate-180"
                )}
              />
            </button>
            {showFeatures && (
              <div className="absolute top-full left-0 mt-1 w-56 rounded-xl border border-white/10 bg-[#1a1a1a]/95 backdrop-blur-xl p-2 shadow-xl">
                {FEATURES.map((f) => (
                  <div
                    key={f.label}
                    className="rounded-lg px-3 py-2 hover:bg-white/6 transition-colors cursor-default"
                  >
                    <p className="text-[13px] font-medium text-white/80">{f.label}</p>
                    <p className="text-[11px] text-white/40">{f.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* How It Works */}
          <a
            href="#how-it-works"
            className={cn(
              "flex items-center gap-1 rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors",
              "text-white/60 hover:text-white hover:bg-white/6"
            )}
          >
            How It Works
          </a>

          {/* Pricing */}
          <Link
            href="/dashboard/billing"
            className={cn(
              "flex items-center gap-1 rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors",
              "text-white/60 hover:text-white hover:bg-white/6"
            )}
          >
            Pricing
          </Link>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="rounded-lg px-4 py-2 text-[13.5px] font-medium text-white/60 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="cursor-pointer rounded-xl bg-white px-4 py-2 text-[13.5px] font-semibold text-black transition-all hover:bg-white/90 active:scale-95"
          >
            Get started free
          </Link>
        </div>
      </nav>
    </header>
  );
}
