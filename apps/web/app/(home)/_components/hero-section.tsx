"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Link2, Upload, Scissors, Zap, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import HeroVideoDemo from "./hero-video-demo";

const PLACEHOLDERS = [
  "Drop a YouTube link...",
  "Drop an Instagram reel...",
  "Drop a Twitter/X video...",
  "Drop a TikTok link...",
  "Drop a video link...",
];

const BADGES = [
  { icon: Zap, label: "10x faster editing" },
  { icon: Scissors, label: "AI-powered clips" },
  { icon: Play, label: "Auto captions" },
];

export default function HeroSection() {
  const [url, setUrl] = useState("");
  const [focused, setFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const handleUploadClick = () => {
    if (isSignedIn) {
      router.push("/dashboard?upload=1");
    } else {
      router.push("/sign-up?redirect_url=/dashboard?upload=1");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    const destination = trimmed
      ? `/dashboard?url=${encodeURIComponent(trimmed)}`
      : "/dashboard";

    if (isSignedIn) {
      router.push(destination);
    } else {
      // After sign-up, Clerk will redirect back to this URL
      const signUpUrl = trimmed
        ? `/sign-up?redirect_url=${encodeURIComponent(destination)}`
        : "/sign-up";
      router.push(signUpUrl);
    }
  };

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#080808] px-4 pt-24 pb-12">
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.03] blur-[120px]" />
      </div>

      {/* Noise texture */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-8 mt-10">
        {/* Badge row */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {BADGES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-medium text-white/50"
            >
              <Icon className="h-3 w-3 text-white/70" strokeWidth={2.5} />
              {label}
            </span>
          ))}
        </div>

        {/* Headline */}
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="max-w-4xl text-[clamp(1.8rem,4vw,4rem)] font-semibold leading-[1.1] tracking-[-0.04em] text-white text-center">
            Your best moments deserve<br />
            <span className="text-white">to go viral.</span>
          </h2>

          <p className="max-w-xl text-balance text-[clamp(0.95rem,2vw,1.1rem)] font-normal leading-relaxed text-white/60">
            Drop a video. Choppr's AI finds the hooks, cuts the clips, adds captions —
            and hands you content that actually stops the scroll.
          </p>
        </div>

        {/* Input + CTA */}
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-2xl flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3"
        >
          {/* URL input — full width on mobile */}
          <div
            className={cn(
              "flex w-full items-center gap-2 rounded-2xl border px-4 py-3.5 transition-all duration-200 cursor-text",
              focused
                ? "border-white/30 bg-white/8"
                : "border-white/10 bg-white/5"
            )}
            onClick={() => inputRef.current?.focus()}
          >
            <Link2 className="h-4 w-4 shrink-0 text-white/30" />
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={PLACEHOLDERS[placeholderIndex]}
              className="w-full bg-transparent text-[14px] text-white placeholder:text-white/25 outline-none"
            />
          </div>

          {/* Buttons row — side by side on both mobile and desktop */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="submit"
              className="cursor-pointer flex-1 sm:flex-none rounded-2xl bg-white px-4 py-2.5 sm:px-5 sm:py-3.5 text-[13px] sm:text-[14px] font-semibold text-black transition-all hover:bg-white/90 active:scale-95 whitespace-nowrap"
            >
              Get free clips
            </button>
            <span className="text-[12px] sm:text-[13px] text-white/40 shrink-0">or</span>
            <button
              type="button"
              onClick={handleUploadClick}
              className="cursor-pointer flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 rounded-2xl border border-white/12 bg-white/6 px-4 py-2.5 sm:px-5 sm:py-3.5 text-[13px] sm:text-[14px] font-medium text-white/55 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white/80 active:scale-95 whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Upload files
            </button>
          </div>
        </form>

        {/* Social proof */}
        <p className="text-[12.5px] text-white/45">
          No credit card required &nbsp;·&nbsp; Start creating in seconds
        </p>

        {/* Video showcase */}
        <HeroVideoDemo />
      </div>
    </section>
  );
}
