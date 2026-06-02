"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Link2, Upload, Scissors, Zap, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import HeroVideoDemo from "./hero-video-demo";

const BADGES = [
  { icon: Zap, label: "10x faster editing" },
  { icon: Scissors, label: "AI-powered clips" },
  { icon: Play, label: "Auto captions" },
];

export default function HeroSection() {
  const [url, setUrl] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignedIn) {
      router.push("/dashboard");
    } else {
      router.push("/sign-up");
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
          <h2 className="max-w-4xl text-[clamp(2.4rem,6vw,4.5rem)] font-semibold leading-[1.1] tracking-[-0.04em] text-white text-center">
            1 long video, 10 viral clips.<br />
            <span className="text-white">Create 10x faster.</span>
          </h2>

          <p className="max-w-xl text-balance text-[clamp(0.95rem,2vw,1.1rem)] font-normal leading-relaxed text-white/60">
            Choppr turns your long videos into short-form viral content and
            publishes them to all social platforms — in one click.
          </p>
        </div>

        {/* Input + CTA + Upload all on one row */}
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-3xl items-center gap-3"
        >
          <div
            className={cn(
              "group relative flex flex-1 items-center gap-2 rounded-2xl border px-4 py-3.5 transition-all duration-200 cursor-text",
              focused
                ? "border-white/30 bg-white/8"
                : "border-white/10 bg-white/5 hover:border-white/18"
            )}
            onClick={() => inputRef.current?.focus()}
          >
            <Link2 className="h-4 w-4 shrink-0 text-white/25" />
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Drop a video link"
              className="w-full bg-transparent text-[14px] text-white placeholder:text-white/20 outline-none"
            />
          </div>
          <button
            type="submit"
            className="group flex shrink-0 items-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-[14px] font-semibold text-black transition-all hover:bg-white/90 active:scale-95 whitespace-nowrap"
          >
            Get free clips
          </button>
          <span className="text-[13px] text-white/50 shrink-0">or</span>
          <button
            type="button"
            className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-5 py-3.5 text-[14px] font-medium text-white/55 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white/80 active:scale-95 whitespace-nowrap"
          >
            <Upload className="h-4 w-4" />
            Upload files
          </button>
        </form>

        {/* Social proof */}
        <p className="text-[12.5px] text-white/45">
          Trusted by{" "}
          <span className="text-white/70 font-medium">50,000+</span> creators
          &nbsp;·&nbsp; No credit card required
        </p>

        {/* Video showcase */}
        <HeroVideoDemo />
      </div>
    </section>
  );
}
