"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const u = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&q=80`;

type FaceBox = { top: string; left: string; w: string; h: string };

type ReframeScene = {
  id: string;
  label: string;
  before: string;
  faces: FaceBox[];
  // Portrait crops derived from the same scene (object-position focus)
  after: { img: string; pos: string }[];
  caption: string;
};

const SCENES: ReframeScene[] = [
  {
    id: "meeting",
    label: "Three-person layout",
    before: u("photo-1600880292203-757bb62b4baf", 960, 540),
    faces: [
      { top: "18%", left: "8%", w: "26%", h: "58%" },
      { top: "20%", left: "37%", w: "26%", h: "55%" },
      { top: "16%", left: "66%", w: "26%", h: "60%" },
    ],
    after: [
      { img: u("photo-1600880292203-757bb62b4baf", 400, 500), pos: "18% 30%" },
      { img: u("photo-1600880292203-757bb62b4baf", 400, 500), pos: "50% 35%" },
      { img: u("photo-1600880292203-757bb62b4baf", 400, 500), pos: "82% 30%" },
    ],
    caption: "OF SOFTWARE FOR YOU",
  },
  {
    id: "podcast",
    label: "Speaker focus",
    before: u("photo-1556761175-5973dc0f32e7", 960, 540),
    faces: [
      { top: "14%", left: "10%", w: "28%", h: "62%" },
      { top: "18%", left: "48%", w: "30%", h: "58%" },
    ],
    after: [
      { img: u("photo-1556761175-5973dc0f32e7", 400, 500), pos: "22% 25%" },
      { img: u("photo-1556761175-5973dc0f32e7", 400, 500), pos: "70% 30%" },
    ],
    caption: "JUST START NOW",
  },
  {
    id: "studio",
    label: "Dual split",
    before: u("photo-1557804506-669a67965ba0", 960, 540),
    faces: [
      { top: "16%", left: "12%", w: "30%", h: "60%" },
      { top: "20%", left: "55%", w: "30%", h: "56%" },
    ],
    after: [
      { img: u("photo-1557804506-669a67965ba0", 400, 500), pos: "25% 28%" },
      { img: u("photo-1557804506-669a67965ba0", 400, 500), pos: "75% 32%" },
    ],
    caption: "BREAK THROUGH",
  },
];

const SCENE_MS = 4200;

function AiFaceBox({ box, delay }: { box: FaceBox; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-md border-2 border-yellow-400/90"
      style={{ top: box.top, left: box.left, width: box.w, height: box.h }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="absolute -top-0.5 -right-0.5 translate-x-1/4 -translate-y-1/4 rounded bg-yellow-400 px-1 py-[1px] text-[8px] font-bold leading-none text-black shadow">
        AI
      </span>
    </motion.div>
  );
}

type Props = { active?: boolean };

export default function HeroReframeDemo({ active = true }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % SCENES.length);
    }, SCENE_MS);
    return () => clearInterval(t);
  }, [active]);

  const scene = SCENES[idx]!;
  const isTriple = scene.after.length >= 3;

  return (
    <div className="relative h-full w-full select-none">
      <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/8 bg-[#0d0d0d]">
        <div className="relative min-h-0 flex-1 overflow-hidden">

          {/* Ambient glow from current scene */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <AnimatePresence>
              <motion.img
                key={`ambient-${scene.id}`}
                src={scene.before}
                alt=""
                aria-hidden
                className="absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 object-cover"
                style={{ filter: "blur(100px) saturate(1.6) brightness(0.75)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3, ease: "easeInOut" }}
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d0d]/55 via-[#0d0d0d]/15 to-[#0d0d0d]/70" />
          </div>

          {/* Before / After stage */}
          <div className="relative z-10 flex h-full items-center justify-center gap-5 px-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={scene.id}
                className="flex w-full max-w-[860px] items-center justify-center gap-5"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* BEFORE — landscape with face boxes */}
                <div className="flex flex-1 flex-col gap-2 min-w-0">
                  <p className="text-[11px] font-medium text-white/40 px-0.5">Before</p>
                  <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 aspect-video bg-[#111]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={scene.before}
                      alt="Before reframe"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/10" />
                    {scene.faces.map((box, i) => (
                      <AiFaceBox key={i} box={box} delay={0.2 + i * 0.12} />
                    ))}
                  </div>
                </div>

                {/* Progress dots */}
                <div className="hidden sm:flex flex-col items-center gap-1.5 shrink-0">
                  {SCENES.map((_, i) => (
                    <div
                      key={i}
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: i === idx ? 14 : 6,
                        backgroundColor: i === idx ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.15)",
                      }}
                    />
                  ))}
                </div>

                {/* AFTER — vertical reframe collage */}
                <div className="flex flex-col gap-2 shrink-0" style={{ width: 168 }}>
                  <p className="text-[11px] font-medium text-white/40 px-0.5 truncate">
                    {scene.label}
                  </p>
                  <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 bg-[#111]"
                    style={{ aspectRatio: "9 / 16" }}
                  >
                    {isTriple ? (
                      <div className="absolute inset-0 flex flex-col">
                        <div className="relative flex-[1.15] overflow-hidden border-b border-white/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={scene.after[0]!.img}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{ objectPosition: scene.after[0]!.pos }}
                          />
                        </div>
                        <div className="relative flex-1 flex">
                          {scene.after.slice(1, 3).map((a, i) => (
                            <div
                              key={i}
                              className={`relative flex-1 overflow-hidden ${i === 0 ? "border-r border-white/10" : ""}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={a.img}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                                style={{ objectPosition: a.pos }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col">
                        {scene.after.map((a, i) => (
                          <div
                            key={i}
                            className={`relative flex-1 overflow-hidden ${i === 0 ? "border-b border-white/10" : ""}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={a.img}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                              style={{ objectPosition: a.pos }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Caption overlay on reframed output */}
                    <div className="absolute inset-x-2 bottom-[18%] z-10 text-center pointer-events-none">
                      <span
                        className="inline-block font-black uppercase leading-tight text-white"
                        style={{
                          fontFamily: "'Anton', Impact, sans-serif",
                          fontSize: 15,
                          textShadow:
                            "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, -2px 0 0 #000, 2px 0 0 #000",
                        }}
                      >
                        {scene.caption}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/6 py-3">
          <div className="flex gap-2.5 px-5">
            <span className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/18 bg-white/8 px-3.5 py-1.5 text-[12px] text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-white/50 shrink-0" />
              AI reframe
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
