"use client";

import Link from "next/link";
import ChopprLogo from "@/components/choppr-logo";

const LINKS = {
  Product: [
    { label: "AI Clipping", href: "/dashboard" },
    { label: "AI Captioning", href: "/dashboard" },
    { label: "AI Reframe", href: "/dashboard" },
  ],
  Navigation: [
    { label: "Features", href: "/" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Pricing", href: "/pricing" },
  ],
  Contact: [
    { label: "Support", href: "mailto:shivang@choppr.pro" },
    { label: "Pricing", href: "/pricing" },
  ],
};

const SOCIALS = [
  {
    label: "X",
    href: "https://x.com/choppr_pro",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.732-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/choppr.pro",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@choppr-pro",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="relative w-full overflow-hidden bg-[#080808] border-t border-white/6">
      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-16">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
          {/* Brand — below lists on mobile */}
          <div className="order-2 md:order-1 flex flex-col gap-4 shrink-0 max-w-[240px]">
            <div className="flex items-center gap-2">
              <ChopprLogo size={28} />
              <span className="text-[15px] font-semibold text-white tracking-tight">choppr</span>
            </div>
            <p className="text-[13px] text-white/60 leading-relaxed">
              Turn long videos into viral short-form clips in one click.
            </p>
            {/* Socials */}
            <div className="flex items-center gap-3">
              {SOCIALS.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center text-white/55 hover:text-white transition-colors"
                >
                  {s.icon}
                </Link>
              ))}
            </div>
          </div>
          {/* Link columns — first on mobile */}
          <div className="order-1 md:order-2 flex flex-wrap justify-between sm:justify-start gap-8 sm:gap-16 lg:gap-24 w-full md:w-auto">
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
            <Link href="/terms-of-service" className="text-[12px] text-white/50 hover:text-white/80 transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy-policy" className="text-[12px] text-white/50 hover:text-white/80 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-[12px] text-white/35">
              Choppr, Inc. © 2026
            </span>
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
              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="45%" stopColor="rgba(255,255,255,0.06)" />
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
