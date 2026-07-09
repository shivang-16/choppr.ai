"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play } from "lucide-react";

// ── 3 source videos, each with their own clip set ──
const SOURCES = [
  {
    id: 1,
    img: "https://picsum.photos/seed/src1/800/450",
    duration: "49:50",
    title: "Young & Profiting",
    clips: [
      { id: 1, score: 98, platform: "YT", pColor: "#FF0000", img: "https://picsum.photos/seed/s1c1/200/356" },
      { id: 2, score: 99, platform: "IG", pColor: "#E1306C", img: "https://picsum.photos/seed/s1c2/200/356" },
      { id: 3, score: 97, platform: "LI", pColor: "#0A66C2", img: "https://picsum.photos/seed/s1c3/200/356" },
      { id: 4, score: 94, platform: "TK", pColor: "#69C9D0", img: "https://picsum.photos/seed/s1c4/200/356" },
      { id: 5, score: 98, platform: "FB", pColor: "#1877F2", img: "https://picsum.photos/seed/s1c5/200/356" },
      { id: 6, score: 97, platform: "X",  pColor: "#e5e5e5", img: "https://picsum.photos/seed/s1c6/200/356" },
    ],
  },
  {
    id: 2,
    img: "https://picsum.photos/seed/src2/800/450",
    duration: "1:24:33",
    title: "Impact Theory",
    clips: [
      { id: 1, score: 96, platform: "YT", pColor: "#FF0000", img: "https://picsum.photos/seed/s2c1/200/356" },
      { id: 2, score: 98, platform: "IG", pColor: "#E1306C", img: "https://picsum.photos/seed/s2c2/200/356" },
      { id: 3, score: 95, platform: "LI", pColor: "#0A66C2", img: "https://picsum.photos/seed/s2c3/200/356" },
      { id: 4, score: 99, platform: "TK", pColor: "#69C9D0", img: "https://picsum.photos/seed/s2c4/200/356" },
      { id: 5, score: 93, platform: "FB", pColor: "#1877F2", img: "https://picsum.photos/seed/s2c5/200/356" },
      { id: 6, score: 96, platform: "X",  pColor: "#e5e5e5", img: "https://picsum.photos/seed/s2c6/200/356" },
    ],
  },
  {
    id: 3,
    img: "https://picsum.photos/seed/src3/800/450",
    duration: "2:01:44",
    title: "Lex Fridman",
    clips: [
      { id: 1, score: 97, platform: "YT", pColor: "#FF0000", img: "https://picsum.photos/seed/s3c1/200/356" },
      { id: 2, score: 95, platform: "IG", pColor: "#E1306C", img: "https://picsum.photos/seed/s3c2/200/356" },
      { id: 3, score: 98, platform: "LI", pColor: "#0A66C2", img: "https://picsum.photos/seed/s3c3/200/356" },
      { id: 4, score: 96, platform: "TK", pColor: "#69C9D0", img: "https://picsum.photos/seed/s3c4/200/356" },
      { id: 5, score: 94, platform: "FB", pColor: "#1877F2", img: "https://picsum.photos/seed/s3c5/200/356" },
      { id: 6, score: 99, platform: "X",  pColor: "#e5e5e5", img: "https://picsum.photos/seed/s3c6/200/356" },
    ],
  },
];

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  YT: <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.8zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z"/></svg>,
  IG: <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
  LI: <span className="text-[9px] font-black text-white leading-none">in</span>,
  TK: <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.88a8.27 8.27 0 004.84 1.55V7a4.85 4.85 0 01-1.07-.31z"/></svg>,
  FB: <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  X:  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.732-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
};

const FEATURE_TAGS = [
  "AI clipping", "AI captioning", "AI reframe",
];

// ── Timing (ms) ──
const T = {
  ENTER_DONE:   700,   // video reaches "above bar" position
  HOLD_DONE:    1700,  // 1s hold above bar
  DROP_DONE:    2200,  // video exits below
  CLIPS_DONE:   2500,  // clips risen up
  SHOW_DONE:    3500,  // clips visible
  EXIT_DONE:    4100,  // clips slid right
  LOOP:         4400,  // advance to next source
};

type Phase = "enter" | "hold" | "drop" | "clips" | "clips-exit";

export default function HeroVideoDemo() {
  const [srcIdx, setSrcIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("enter");

  useEffect(() => {
    const timeouts = [
      setTimeout(() => setPhase("enter"),      0),
      setTimeout(() => setPhase("hold"),        T.ENTER_DONE),
      setTimeout(() => setPhase("drop"),        T.HOLD_DONE),
      setTimeout(() => setPhase("clips"),       T.DROP_DONE),
      setTimeout(() => setPhase("clips-exit"),  T.SHOW_DONE),
      setTimeout(() => {
        setSrcIdx((i) => (i + 1) % SOURCES.length);
      }, T.LOOP),
    ];
    return () => timeouts.forEach(clearTimeout);
  }, [srcIdx]);

  const src = SOURCES[srcIdx]!;

  // Video should be visible until "drop" completes
  const videoVisible = phase === "enter" || phase === "hold" || phase === "drop";
  // Clips visible during clips phases
  const clipsVisible = phase === "clips" || phase === "clips-exit";

  return (
    <div id="how-it-works" className="relative w-[calc(100%+2rem)] -mx-4 max-w-none sm:mx-0 sm:w-full sm:max-w-4xl select-none">
      <div className="relative overflow-hidden rounded-none sm:rounded-3xl border-t border-b border-white/8 flex flex-col">

        {/* ── Main animation stage ── */}
        <div className="relative h-[580px] overflow-hidden">

          {/* ── Source video (drops from top, passes bar, exits below) ── */}
          <AnimatePresence mode="wait">
            {videoVisible && (
              <motion.div
                key={`video-${srcIdx}`}
                className="absolute inset-x-0 flex justify-center px-0 sm:px-8 z-10"
                initial={{ y: -260, opacity: 0, scale: 0.94 }}
                animate={
                  phase === "drop"
                    ? { y: 620, opacity: 0, scale: 0.9,
                        transition: { duration: 0.55, ease: [0.55, 0, 1, 0.45] } }
                    : { y: 30, opacity: 1, scale: 1,
                        transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] } }
                }
                exit={{ y: 500, opacity: 0, transition: { duration: 0.4 } }}
              >
                <div className="relative w-full max-w-none sm:max-w-[420px] rounded-none sm:rounded-2xl overflow-hidden border-x-0 border-y sm:border border-white/10 shadow-2xl shadow-black/70">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src.img}
                    alt="Source video"
                    className="w-full aspect-video object-cover block"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/20" />
                  {/* Duration badge */}
                  <div className="absolute bottom-2 right-3 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-mono text-white/80">
                    {src.duration}
                  </div>
                  {/* Title */}
                  <div className="absolute bottom-2 left-3 text-[11px] text-white/60 font-medium">
                    {src.title}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── URL bar — static, sits in the middle, video passes through it ── */}
          <div className="absolute inset-x-0 top-[52%] -translate-y-1/2 z-20 flex justify-center px-4 sm:px-8 pointer-events-none">
            <div className="flex w-full max-w-[480px] items-center gap-2 rounded-full border border-white/12 bg-[#1a1a1a] px-5 py-3 shadow-lg shadow-black/40">
              <svg className="h-4 w-4 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
              </svg>
              <span className="flex-1 text-[13px] text-white/25 truncate">Drop a long video and …</span>

              {/* Get clips button with finger click animation */}
              <div className="relative">
                <motion.div
                  className="rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-black whitespace-nowrap"
                  animate={phase === "hold" ? { scale: [1, 0.92, 1] } : { scale: 1 }}
                  transition={{ duration: 0.25, delay: 0.55, ease: "easeInOut" }}
                >
                  Get clips
                </motion.div>

                {/* Finger cursor */}
                <AnimatePresence>
                  {phase === "hold" && (
                    <motion.div
                      className="absolute -bottom-7 -right-3 pointer-events-none z-30"
                      initial={{ y: 18, opacity: 0 }}
                      animate={{ y: [18, 0, 4, 0], opacity: [0, 1, 1, 1] }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.7, times: [0, 0.45, 0.7, 1], ease: "easeOut" }}
                    >
                      {/* Hand / pointer finger SVG */}
                      <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 14V5.5C10 4.12 11.12 3 12.5 3C13.88 3 15 4.12 15 5.5V14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                        <path d="M15 8.5C15 7.12 16.12 6 17.5 6C18.88 6 20 7.12 20 8.5V14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                        <path d="M20 10.5C20 9.12 21.12 8 22.5 8C23.88 8 25 9.12 25 10.5V19C25 24.52 20.52 29 15 29C9.48 29 5 24.52 5 19V14C5 12.62 6.12 11.5 7.5 11.5C8.88 11.5 10 12.62 10 14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                        <path d="M10 14C10 12.62 8.88 11.5 7.5 11.5C6.12 11.5 5 12.62 5 14V19" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ── Clip cards — rise from below bar, slide right to exit ── */}
          <AnimatePresence>
            {clipsVisible && (
              <motion.div
                key={`clips-${srcIdx}`}
                className="absolute bottom-8 inset-x-0 flex items-end justify-center gap-2.5 px-0 sm:px-4 z-10"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                {src.clips.map((clip, i) => {
                  // Distance from center (0-indexed, 6 cards → center between 2 and 3)
                  const center = (src.clips.length - 1) / 2;
                  const dist = i - center; // negative = left side, positive = right side
                  const distAbs = Math.abs(dist);

                  return (
                  <motion.div
                    key={clip.id}
                    className="relative shrink-0 group cursor-pointer"
                    style={{ width: 110 }}
                    // Start compressed toward center
                    initial={{ x: -dist * 120, opacity: 0, scale: 0.75 }}
                    animate={
                      phase === "clips-exit"
                        ? {
                            x: 600,
                            opacity: 0,
                            scale: 0.85,
                            transition: { delay: i * 0.045, duration: 0.45, ease: [0.55, 0, 1, 0.45] },
                          }
                        : {
                            x: 0,
                            opacity: 1,
                            scale: 1,
                            transition: {
                              delay: distAbs * 0.07, // center first, edges last
                              duration: 0.6,
                              ease: [0.22, 1, 0.36, 1],
                            },
                          }
                    }
                  >
                    {/* Platform badge */}
                    <div
                      className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 h-7 w-7 rounded-full border-2 border-[#0d0d0d] flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: clip.pColor }}
                    >
                      {PLATFORM_ICONS[clip.platform]}
                    </div>

                    {/* Thumbnail */}
                    <div className="relative aspect-[9/16] w-full rounded-2xl overflow-hidden border border-white/10 group-hover:border-white/25 transition-colors bg-[#111]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={clip.img}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {/* Score */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 pt-4 pb-2">
                        <div className="flex flex-col items-start">
                          <span className="text-[8px] uppercase tracking-widest text-white/40">Score</span>
                          <span className="text-[15px] font-bold text-white leading-none">{clip.score}</span>
                        </div>
                      </div>
                      {/* Play hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                          <Play className="h-3.5 w-3.5 fill-white text-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Feature tags ── */}
        <div className="border-t border-white/6 py-3">
          <div className="flex gap-2.5 px-5 overflow-x-auto no-scrollbar">
            {FEATURE_TAGS.map((tag) => (
              <button
                key={tag}
                className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-3.5 py-1.5 text-[12px] text-white/35 hover:border-white/18 hover:text-white/60 transition-colors whitespace-nowrap"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white/25 shrink-0" />
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Source dots */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        {SOURCES.map((_, i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === srcIdx ? 16 : 6,
              backgroundColor: i === srcIdx ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
