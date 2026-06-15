"use client";

import Link from "next/link";
import ChopprLogo from "@/components/choppr-logo";

const LINKS = {
  Product: [
    { label: "AI Clipping", href: "#" },
    { label: "AI Captioning", href: "#" },
    { label: "AI Reframe", href: "#" },
  ],
  Navigation: [
    { label: "Features", href: "#" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "/dashboard/billing" },
  ],
  Contact: [
    { label: "Support", href: "#" },
    { label: "Pricing", href: "/dashboard/billing" },
  ],
};

const SOCIALS = [
  {
    label: "X / Twitter",
    href: "https://x.com/16_shivang",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.732-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/shivang-yadav-b83979257/",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/shivang_18",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="relative w-full overflow-hidden bg-[#080808] border-t border-white/6">
      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-16">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          {/* Brand col */}
          <div className="flex gap-4 justify-between shrink-0">
          <div className="flex flex-col gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <ChopprLogo size={28} />
              <span className="text-[15px] font-semibold text-white tracking-tight">choppr</span>
            </div>
            <p className="text-[13px] text-white/60 leading-relaxed max-w-[220px]">
              Turn long videos into viral short-form clips — in one click.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group} className="flex flex-col gap-3 shrink-0">
              <p className="text-[12px] font-semibold text-white/70 uppercase tracking-widest">
                {group}
              </p>
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-[13px] text-white/55 hover:text-white transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        </div>

        {/* Divider */}
        <div className="mt-12 mb-6 h-px bg-white/6" />

        {/* Bottom bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href="#" className="text-[12px] text-white/50 hover:text-white/80 transition-colors">
              Terms of Service
            </Link>
            <Link href="#" className="text-[12px] text-white/50 hover:text-white/80 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-[12px] text-white/35">
              Choppr, Inc. © 2026
            </span>
          </div>
          {/* Socials */}
          <div className="flex items-center gap-3">
            {SOCIALS.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-white/6 text-white/55 hover:border-white/25 hover:text-white transition-colors"
              >
                {s.icon}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Giant "choppr" outline wordmark ── */}
      <div className="relative w-full overflow-hidden select-none pointer-events-none -mt-14" style={{ height: "clamp(160px, 30vw, 360px)" }}>
        <svg
          viewBox="0 0 1000 260"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute bottom-0 left-0 w-full h-full"
          preserveAspectRatio="xMidYMax meet"
        >
          <defs>
            <linearGradient id="wordmark-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
              <stop offset="45%" stopColor="rgba(255,255,255,0.4)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
            </linearGradient>
          </defs>
          <text
            x="50%"
            y="100%"
            dominantBaseline="auto"
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
            fontWeight="900"
            fontSize="280"
            letterSpacing="-10"
            fill="none"
            stroke="url(#wordmark-grad)"
            strokeWidth="1"
          >
            choppr
          </text>
        </svg>
      </div>
    </footer>
  );
}
