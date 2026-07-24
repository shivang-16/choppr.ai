"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

/* Reliable muted autoplay for the small demo videos */
function useVideoPlay(ref: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const tryPlay = () => {
      v.muted = true;
      const p = v.play?.();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    tryPlay();
    v.addEventListener("loadeddata", tryPlay);
    v.addEventListener("canplay", tryPlay);
    const t1 = window.setTimeout(tryPlay, 200);
    const t2 = window.setTimeout(tryPlay, 600);
    return () => {
      v.removeEventListener("loadeddata", tryPlay);
      v.removeEventListener("canplay", tryPlay);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [ref]);
}

/* ------------------------------- ClipAnything visual ------------------------------- */

const CLIP_PROMPTS = [
  { prompt: "Moment most likely to go viral on social media", tags: ["Big laugh", "Plot twist", "Hot take"] },
  { prompt: "Find the most emotional part of this video", tags: ["Tearful", "Heartfelt", "Raw moment"] },
  { prompt: "Pull the strongest hook for a short", tags: ["Strong open", "Curiosity", "Punchy"] },
];

const PROMPT_MS = 3200;

function ClipVisual() {
  const centerRef = useRef<HTMLVideoElement | null>(null);
  const portraitRef = useRef<HTMLVideoElement | null>(null);
  const [idx, setIdx] = useState(0);
  useVideoPlay(centerRef);
  useVideoPlay(portraitRef);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % CLIP_PROMPTS.length), PROMPT_MS);
    return () => clearInterval(t);
  }, []);

  const current = CLIP_PROMPTS[idx]!;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 40% -10%, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 42%, transparent 70%)",
        }}
      />

      {/* Prompt block — text refactors slowly */}
      <div className="absolute left-6 top-6 z-20 w-[58%]">
        <span className="text-[11px] font-medium tracking-wide text-white/45">Prompt</span>
        <div className="mt-1.5 flex h-9 items-center overflow-hidden rounded-xl border border-white/12 bg-white/[0.06] px-3 backdrop-blur-sm">
          <AnimatePresence mode="wait">
            <motion.span
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="truncate text-[12px] text-white/75"
            >
              {current.prompt}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* Center landscape clip + detected tags */}
      <div className="absolute left-6 top-[40%] z-10 w-[52%]">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/12 shadow-lg shadow-black/40">
          <video
            ref={centerRef}
            className="h-full w-full object-cover"
            poster="/demo/pod-mic-conversation-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
          >
            <source src="/demo/pod-mic-conversation.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <AnimatePresence mode="popLayout">
            {current.tags.map((t, i) => (
              <motion.span
                key={t}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                className="rounded-md border border-white/12 bg-white/[0.08] px-2 py-1 text-[10.5px] font-medium text-white/70 backdrop-blur-sm"
              >
                {t}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Right portrait clip */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="absolute right-6 top-1/2 z-20 aspect-[9/16] w-[30%] -translate-y-1/2 overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-black/60"
      >
        <video
          ref={portraitRef}
          className="h-full w-full object-cover"
          poster="/demo/pod-talking-mic-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
        >
          <source src="/demo/pod-talking-mic.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
        <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-sm">
          Clip 01
        </span>
      </motion.div>
    </div>
  );
}

/* ------------------------------ ReframeAnything visual ----------------------------- */

const REFRAME_SRC = "/demo/pod-alt-2.mp4";
const REFRAME_POSTER = "/demo/pod-alt-2-poster.jpg";
const RATIOS = [
  { label: "16:9", ar: 16 / 9, focus: "50% 50%" },
  { label: "1:1", ar: 1, focus: "50% 45%" },
  { label: "9:16", ar: 9 / 16, focus: "50% 40%" },
];
const RATIO_MS = 2600;
const SRC_AR = 16 / 9; // the "before" frame aspect

function ReframeVisual() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const beforeRef = useRef<HTMLVideoElement | null>(null);
  const afterRef = useRef<HTMLVideoElement | null>(null);
  const bgRef = useRef<HTMLVideoElement | null>(null);
  const [cw, setCw] = useState(0);
  const [idx, setIdx] = useState(0);
  useVideoPlay(beforeRef);
  useVideoPlay(afterRef);
  useVideoPlay(bgRef);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const m = () => setCw(el.clientWidth);
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % RATIOS.length), RATIO_MS);
    return () => clearInterval(t);
  }, []);

  const ratio = RATIOS[idx]!;
  const H = Math.min(150, Math.max(74, cw * 0.21));
  const beforeH = H * 0.92;
  const beforeW = beforeH * SRC_AR;
  const afterH = H * 1.22; // output frame a bit bigger than the source
  const afterW = afterH * ratio.ar;

  // Crop region on the "before" frame that produces the current output ratio
  const cropFrac = Math.min(1, ratio.ar / SRC_AR);

  return (
    <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Ambient blurred video background */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <video
          ref={bgRef}
          className="h-full w-full scale-110 object-cover opacity-40 blur-2xl"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source src={REFRAME_SRC} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="relative z-10 flex items-center justify-center gap-3">
        {/* Before — wide source with tracking crop box */}
        <div
          className="relative overflow-hidden rounded-xl border border-white/12 shadow-lg shadow-black/40"
          style={{ width: beforeW, height: beforeH }}
        >
          <video
            ref={beforeRef}
            className="h-full w-full object-cover"
            poster={REFRAME_POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          >
            <source src={REFRAME_SRC} type="video/mp4" />
          </video>
          <motion.div
            className="absolute rounded-md border-2 border-emerald-400/90"
            animate={{
              width: `${cropFrac * 100}%`,
              left: `${((1 - cropFrac) / 2) * 100}%`,
              top: "8%",
              height: "84%",
              opacity: [0.75, 1, 0.75],
            }}
            transition={{
              width: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
              left: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <span className="absolute -top-0.5 -right-0.5 translate-x-1/4 -translate-y-1/4 rounded bg-emerald-400 px-1 py-[1px] text-[8px] font-bold leading-none text-black">
              Track
            </span>
          </motion.div>
        </div>

        {/* Progress dots */}
        <div className="flex flex-row items-center gap-1.5">
          {RATIOS.map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i === idx ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.25)",
                transform: i === idx ? "scale(1.25)" : "scale(1)",
              }}
            />
          ))}
        </div>

        {/* After — reframed output, morphs between ratios */}
        <div className="flex flex-col items-center gap-2">
          <motion.div
            className="relative overflow-hidden rounded-xl border border-white/20 shadow-2xl shadow-black/60"
            animate={{ width: afterW, height: afterH }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <video
              ref={afterRef}
              className="h-full w-full object-cover"
              style={{ objectPosition: ratio.focus }}
              poster={REFRAME_POSTER}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            >
              <source src={REFRAME_SRC} type="video/mp4" />
            </video>
          </motion.div>
          <AnimatePresence mode="wait">
            <motion.span
              key={ratio.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="rounded-md border border-white/12 bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold text-white/80"
            >
              {ratio.label}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Section shell ---------------------------------- */

type Model = {
  title: string;
  desc: string;
  visual: React.ReactNode;
};

const MODELS: Model[] = [
  {
    title: "Clip any video",
    desc: "Other tools only clip podcasts. ClipAnything finds the best moments in any footage - vlogs, gaming, sports, interviews, explainers - and turns them into ready-to-post shorts in one click.",
    visual: <ClipVisual />,
  },
  {
    title: "Reframe any ratio",
    desc: "Resize any video for any platform without losing the subject. AI tracking keeps faces and action centered as you move between 16:9, 1:1, and 9:16 - or take over and tell it exactly what to follow.",
    visual: <ReframeVisual />,
  },
];

export default function AiModelsSection() {
  return (
    <section className="relative overflow-hidden px-4 py-24 sm:py-32">
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col">
        {/* Header */}
        <motion.div {...reveal} className="flex flex-col items-center gap-5 text-center">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
            <Sparkles className="h-3 w-3 text-white/70" strokeWidth={2.5} />
            AI editing models
          </span>
          <h2 className="max-w-3xl text-[clamp(1.7rem,3.6vw,3.2rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-white">
            Models that read your footage frame by frame
          </h2>
          <p className="max-w-xl text-balance text-[clamp(0.95rem,2vw,1.05rem)] leading-relaxed text-white/55">
            Purpose-built editing models that run on any video - engineered for
            speed, precision, and complete creative control.
          </p>
        </motion.div>

        {/* Model cards */}
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {MODELS.map((m, i) => (
            <motion.div
              key={m.title}
              {...reveal}
              transition={{ ...reveal.transition, delay: i * 0.1 }}
              className="flex flex-col"
            >
              <div className="relative h-[300px] overflow-hidden rounded-3xl border border-white/8 bg-[#0e0e0f] sm:h-[320px]">
                {m.visual}
              </div>
              <h3 className="mt-6 text-[1.5rem] font-semibold tracking-[-0.03em] text-white sm:text-[1.65rem]">
                {m.title}
              </h3>
              <p className="mt-2.5 max-w-md text-[14.5px] leading-[1.65] text-white/55 sm:text-[15px]">
                {m.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
