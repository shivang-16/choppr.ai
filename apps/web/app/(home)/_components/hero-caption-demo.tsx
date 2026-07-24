"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Bebas+Neue&family=Oswald:wght@400;700;900&family=Permanent+Marker&family=Press+Start+2P&family=Space+Grotesk:wght@400;700;900&display=swap";

function ensureFonts() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-choppr-fonts]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_URL;
  link.setAttribute("data-choppr-fonts", "1");
  document.head.appendChild(link);
}

const PF_ANTON = "'Anton', Impact, sans-serif";
const PF_BANGERS = "'Bangers', cursive";
const PF_OSWALD = "'Oswald', sans-serif";
const PF_BEBAS = "'Bebas Neue', 'Anton', sans-serif";
const PF_MARKER = "'Permanent Marker', cursive";
const PF_SPACE = "'Space Grotesk', sans-serif";
const PF_PIXEL = "'Press Start 2P', monospace";

const OUTLINE =
  "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, -2px 0 0 #000, 2px 0 0 #000, 0 -2px 0 #000, 0 2px 0 #000";
const OUTLINE_HEAVY =
  "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, -3px 0 0 #000, 3px 0 0 #000, 0 -3px 0 #000, 0 3px 0 #000";

const RAINBOW = ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#8B00FF"];

// Full spoken lines — captions advance word-by-word through these
const CAPTION_LINES: string[][] = [
  ["The", "biggest", "mistake", "people", "make"],
  ["is", "waiting", "for", "the", "perfect", "moment"],
  ["You", "just", "have", "to", "start", "right", "now"],
  ["That", "is", "how", "you", "break", "through"],
  ["Stop", "overthinking", "and", "ship", "the", "work"],
  ["Your", "story", "is", "what", "makes", "people", "care"],
];

type CaptionId =
  | "karaoke"
  | "mr-beast"
  | "word-pop"
  | "highlight-box"
  | "neon"
  | "bounce"
  | "comic"
  | "fire"
  | "shake"
  | "wave"
  | "stack-reveal"
  | "electric-blue"
  | "rainbow"
  | "gradient-pop"
  | "solo-red"
  | "solo-glow"
  | "solo-box"
  | "outline-black"
  | "glitch";

type StyleCfg = {
  font: string;
  activeColor: string;
  inactiveColor: string;
  bg: string | null;
  showAll: boolean;
  glow: string | null;
  outline: string;
  activeScale: number;
  bounce?: boolean;
  shake?: boolean;
  wave?: boolean;
  stack?: boolean;
  rainbow?: boolean;
  gradient?: boolean;
  glitch?: boolean;
};

/** Mirrors caption-renderer.tsx CFG for demo styles */
const STYLE_CFG: Record<CaptionId, StyleCfg> = {
  karaoke: {
    font: PF_MARKER, activeColor: "#FFE600", inactiveColor: "rgba(255,255,255,0.5)",
    bg: null, showAll: true, glow: null, outline: OUTLINE, activeScale: 1,
  },
  "mr-beast": {
    font: PF_OSWALD, activeColor: "#FF0000", inactiveColor: "rgba(255,255,255,1)",
    bg: null, showAll: true, glow: null, outline: OUTLINE_HEAVY, activeScale: 1.6,
  },
  "word-pop": {
    font: PF_ANTON, activeColor: "#fff", inactiveColor: "rgba(255,255,255,0.35)",
    bg: null, showAll: true, glow: null, outline: OUTLINE, activeScale: 1.5,
  },
  "highlight-box": {
    font: PF_BANGERS, activeColor: "#000", inactiveColor: "rgba(255,255,255,0.5)",
    bg: "#FFE600", showAll: true, glow: null, outline: "none", activeScale: 1,
  },
  neon: {
    font: PF_BEBAS, activeColor: "#00ff88", inactiveColor: "rgba(255,255,255,0.3)",
    bg: null, showAll: true, glow: "#00ff88", outline: "none", activeScale: 1,
  },
  bounce: {
    font: PF_ANTON, activeColor: "#fff", inactiveColor: "transparent",
    bg: null, showAll: false, glow: null, outline: OUTLINE, activeScale: 1, bounce: true,
  },
  comic: {
    font: PF_BANGERS, activeColor: "#fff", inactiveColor: "rgba(255,255,255,0.4)",
    bg: "rgba(30,30,200,0.85)", showAll: false, glow: null, outline: OUTLINE, activeScale: 1.2,
  },
  fire: {
    font: PF_OSWALD, activeColor: "#FF4500", inactiveColor: "rgba(255,165,0,0.5)",
    bg: null, showAll: true, glow: "#FF4500", outline: OUTLINE, activeScale: 1,
  },
  shake: {
    font: PF_OSWALD, activeColor: "#FF3333", inactiveColor: "rgba(255,255,255,0.8)",
    bg: null, showAll: true, glow: null, outline: OUTLINE, activeScale: 1.3, shake: true,
  },
  wave: {
    font: PF_MARKER, activeColor: "#ffffff", inactiveColor: "rgba(255,255,255,0.3)",
    bg: null, showAll: true, glow: null, outline: OUTLINE, activeScale: 1, wave: true,
  },
  "stack-reveal": {
    font: PF_OSWALD, activeColor: "#fff", inactiveColor: "transparent",
    bg: null, showAll: false, glow: null, outline: OUTLINE_HEAVY, activeScale: 1.3, stack: true,
  },
  "electric-blue": {
    font: PF_BEBAS, activeColor: "#00D4FF", inactiveColor: "rgba(255,255,255,0.4)",
    bg: null, showAll: true, glow: "#00D4FF", outline: OUTLINE, activeScale: 1,
  },
  rainbow: {
    font: PF_BANGERS, activeColor: "#FF0000", inactiveColor: "rgba(255,255,255,0.35)",
    bg: null, showAll: true, glow: null, outline: OUTLINE, activeScale: 1, rainbow: true,
  },
  "gradient-pop": {
    font: PF_BEBAS, activeColor: "#A855F7", inactiveColor: "rgba(255,255,255,0.3)",
    bg: null, showAll: true, glow: "#A855F7", outline: OUTLINE, activeScale: 1.4, gradient: true,
  },
  "solo-red": {
    font: PF_ANTON, activeColor: "#FF2D2D", inactiveColor: "transparent",
    bg: null, showAll: false, glow: "#FF2D2D", outline: OUTLINE_HEAVY, activeScale: 1.8,
  },
  "solo-glow": {
    font: PF_BEBAS, activeColor: "#00FF88", inactiveColor: "transparent",
    bg: null, showAll: false, glow: "#00FF88", outline: OUTLINE, activeScale: 1.7,
  },
  "solo-box": {
    font: PF_SPACE, activeColor: "#000", inactiveColor: "transparent",
    bg: "#FFE600", showAll: false, glow: null, outline: "none", activeScale: 1.6,
  },
  "outline-black": {
    font: PF_SPACE, activeColor: "#fff", inactiveColor: "rgba(255,255,255,0.3)",
    bg: null, showAll: true, glow: null, outline: OUTLINE_HEAVY, activeScale: 1,
  },
  glitch: {
    font: PF_PIXEL, activeColor: "#ff00ff", inactiveColor: "rgba(255,255,255,0.25)",
    bg: null, showAll: true, glow: "#ff00ff", outline: "none", activeScale: 1, glitch: true,
  },
};

type CaptionPreset = {
  id: CaptionId;
  label: string;
  preview: ReactNode;
};

const PRESETS: CaptionPreset[] = [
  {
    id: "karaoke",
    label: "Karaoke",
    preview: (
      <div className="flex items-center gap-1" style={{ fontFamily: PF_MARKER }}>
        <span className="text-white/50 font-black text-[8px]" style={{ textShadow: OUTLINE }}>just</span>
        <span className="text-yellow-400 font-black text-[12px]" style={{ textShadow: OUTLINE }}>BE</span>
        <span className="text-white/50 font-black text-[8px]" style={{ textShadow: OUTLINE }}>kind</span>
      </div>
    ),
  },
  {
    id: "mr-beast",
    label: "MrBeast",
    preview: (
      <div className="flex items-center gap-1" style={{ fontFamily: PF_OSWALD }}>
        <span className="text-white font-black text-[8px]" style={{ textShadow: OUTLINE }}>just</span>
        <span className="text-red-500 font-black text-[17px]" style={{ textShadow: OUTLINE }}>BE</span>
        <span className="text-white font-black text-[8px]" style={{ textShadow: OUTLINE }}>kind</span>
      </div>
    ),
  },
  {
    id: "word-pop",
    label: "Word Pop",
    preview: (
      <div className="flex items-center gap-1" style={{ fontFamily: PF_ANTON }}>
        <span className="text-white/40 font-black text-[8px]" style={{ textShadow: OUTLINE }}>just</span>
        <span className="text-white font-black text-[16px]" style={{ textShadow: OUTLINE }}>BE</span>
        <span className="text-white/40 font-black text-[8px]" style={{ textShadow: OUTLINE }}>kind</span>
      </div>
    ),
  },
  {
    id: "highlight-box",
    label: "Highlight",
    preview: (
      <div className="flex items-center gap-1" style={{ fontFamily: PF_BANGERS }}>
        <span className="text-white/50 font-black text-[8px]">just</span>
        <span className="bg-yellow-400 text-black font-black text-[11px] px-1 rounded">BE</span>
        <span className="text-white/50 font-black text-[8px]">kind</span>
      </div>
    ),
  },
  {
    id: "neon",
    label: "Neon",
    preview: (
      <span className="font-black text-[16px] text-[#00FF88]" style={{ fontFamily: PF_BEBAS, textShadow: "0 0 8px #00FF88, 0 0 16px #00FF88" }}>
        NEON
      </span>
    ),
  },
  {
    id: "bounce",
    label: "Bounce",
    preview: (
      <span className="text-white font-black text-[16px] -translate-y-1.5 inline-block" style={{ fontFamily: PF_ANTON, textShadow: OUTLINE }}>
        DROP
      </span>
    ),
  },
  {
    id: "comic",
    label: "Comic",
    preview: (
      <span className="bg-blue-800 text-white font-black text-[15px] px-2 py-0.5 rounded" style={{ fontFamily: PF_BANGERS, textShadow: OUTLINE }}>
        POW!
      </span>
    ),
  },
  {
    id: "fire",
    label: "Fire",
    preview: (
      <span className="font-black text-[16px] text-orange-400" style={{ fontFamily: PF_OSWALD, textShadow: "0 0 8px #FF4500, 0 0 20px #FF4500, -1px -1px 0 black" }}>
        FIRE
      </span>
    ),
  },
  {
    id: "shake",
    label: "Shake",
    preview: (
      <span className="text-red-400 font-black text-[16px] translate-x-0.5 inline-block" style={{ fontFamily: PF_OSWALD, textShadow: OUTLINE }}>
        SHAKE
      </span>
    ),
  },
  {
    id: "wave",
    label: "Wave",
    preview: (
      <div className="flex items-end gap-0.5" style={{ fontFamily: PF_MARKER }}>
        {"WAVE".split("").map((c, i) => (
          <span key={i} className={`text-white font-black text-[11px] ${i % 2 === 0 ? "-translate-y-1" : "translate-y-0.5"}`}>{c}</span>
        ))}
      </div>
    ),
  },
  {
    id: "stack-reveal",
    label: "Stack",
    preview: (
      <span className="text-white font-black text-[18px]" style={{ fontFamily: PF_OSWALD, textShadow: OUTLINE_HEAVY }}>
        KIND
      </span>
    ),
  },
  {
    id: "electric-blue",
    label: "Electric",
    preview: (
      <span className="font-black text-[15px] text-[#00D4FF]" style={{ fontFamily: PF_BEBAS, textShadow: "0 0 8px #00D4FF" }}>
        BLUE
      </span>
    ),
  },
  {
    id: "rainbow",
    label: "Rainbow",
    preview: (
      <div className="flex gap-0.5" style={{ fontFamily: PF_BANGERS }}>
        {["R", "A", "I", "N"].map((c, i) => (
          <span key={c} className="font-black text-[12px]" style={{ color: RAINBOW[i], textShadow: OUTLINE }}>{c}</span>
        ))}
      </div>
    ),
  },
  {
    id: "gradient-pop",
    label: "Grad Pop",
    preview: (
      <span
        className="font-black text-[14px] bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent"
        style={{ fontFamily: PF_BEBAS }}
      >
        POP
      </span>
    ),
  },
  {
    id: "solo-red",
    label: "Solo Red",
    preview: (
      <span className="font-black text-[18px] text-red-500" style={{ fontFamily: PF_ANTON, textShadow: "0 0 8px #FF2D2D, " + OUTLINE }}>
        RED
      </span>
    ),
  },
  {
    id: "solo-glow",
    label: "Solo Glow",
    preview: (
      <span className="font-black text-[15px] text-[#00FF88]" style={{ fontFamily: PF_BEBAS, textShadow: "0 0 10px #00FF88" }}>
        GLOW
      </span>
    ),
  },
  {
    id: "solo-box",
    label: "Solo Box",
    preview: (
      <span className="bg-yellow-400 text-black font-black text-[12px] px-1.5 py-0.5 rounded" style={{ fontFamily: PF_SPACE }}>
        BOX
      </span>
    ),
  },
  {
    id: "outline-black",
    label: "Impact",
    preview: (
      <span className="text-white font-black text-[14px]" style={{ fontFamily: PF_SPACE, textShadow: OUTLINE_HEAVY }}>
        IMPACT
      </span>
    ),
  },
  {
    id: "glitch",
    label: "Glitch",
    preview: (
      <span className="font-black text-[9px] text-[#ff00ff]" style={{ fontFamily: PF_PIXEL, textShadow: "1px 0 #00ffff, -1px 0 #ff00ff" }}>
        GLITCH
      </span>
    ),
  },
];

function LiveCaptionLine({
  words,
  activeWord,
  styleId,
}: {
  words: string[];
  activeWord: number;
  styleId: CaptionId;
}) {
  const cfg = STYLE_CFG[styleId];

  // Stack: prev / active / next (3-row), matching product stack-reveal feel
  if (cfg.stack) {
    const prev = words[activeWord - 1];
    const cur = words[activeWord]!;
    const next = words[activeWord + 1];
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={`stack-${activeWord}-${cur}`}
          className="flex flex-col items-center gap-0.5"
          style={{ fontFamily: cfg.font }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <span className="uppercase font-black text-[11px] text-white/35" style={{ textShadow: cfg.outline }}>
            {prev ?? "\u00A0"}
          </span>
          <motion.span
            className="uppercase font-black leading-none"
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            style={{ fontSize: 34, color: cfg.activeColor, textShadow: cfg.outline }}
          >
            {cur}
          </motion.span>
          <span className="uppercase font-black text-[11px] text-white/35" style={{ textShadow: cfg.outline }}>
            {next ?? "\u00A0"}
          </span>
        </motion.div>
      </AnimatePresence>
    );
  }

  const visible = cfg.showAll
    ? words.map((word, i) => ({ word, i }))
    : [{ word: words[activeWord]!, i: activeWord }];

  const baseSize = cfg.glitch ? 14 : 22;
  const activeSize = Math.round(baseSize * (cfg.activeScale > 1 ? cfg.activeScale : 1.35));

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={cfg.showAll ? `${styleId}-${words.join("-")}` : `${styleId}-${activeWord}-${words[activeWord]}`}
        className="flex flex-wrap items-end justify-center gap-x-2.5 gap-y-1 px-1"
        style={{ fontFamily: cfg.font }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {visible.map(({ word, i }) => {
          const on = i === activeWord;
          let color = on ? cfg.activeColor : cfg.inactiveColor;
          if (cfg.rainbow && on) color = RAINBOW[i % RAINBOW.length]!;
          if (color === "transparent" && !on) return null;

          const glowShadow = cfg.glow
            ? on
              ? `0 0 12px ${cfg.glow}, 0 0 24px ${cfg.glow}`
              : `0 0 4px ${cfg.glow}`
            : null;
          const glitchShadow = cfg.glitch && on ? "2px 0 #00ffff, -2px 0 #ff00ff" : null;
          const textShadow =
            cfg.outline === "none"
              ? glitchShadow ?? glowShadow ?? undefined
              : [glowShadow, glitchShadow, cfg.outline].filter(Boolean).join(", ");

          const gradientStyle =
            cfg.gradient && on
              ? {
                  backgroundImage: "linear-gradient(90deg,#A855F7,#EC4899,#F97316)",
                  WebkitBackgroundClip: "text" as const,
                  backgroundClip: "text" as const,
                  color: "transparent",
                }
              : null;

          return (
            <motion.span
              key={`${word}-${i}`}
              className="font-black uppercase leading-none inline-block"
              animate={
                cfg.wave
                  ? undefined
                  : cfg.bounce && on
                    ? { y: [0, -14, 0] }
                    : cfg.shake && on
                      ? { x: [0, -3, 3, -2, 2, 0] }
                      : cfg.glitch && on
                        ? { x: [0, 2, -2, 1, 0], y: [0, -1, 1, 0] }
                        : { y: 0, x: 0 }
              }
              transition={
                cfg.bounce && on
                  ? { duration: 0.4, ease: "easeOut" }
                  : cfg.shake && on
                    ? { duration: 0.28, ease: "easeInOut" }
                    : cfg.glitch && on
                      ? { duration: 0.2, repeat: 1 }
                      : { duration: 0.15 }
              }
              style={{
                fontSize: on ? activeSize : baseSize,
                color: gradientStyle ? undefined : color,
                textShadow,
                background: on && cfg.bg ? cfg.bg : undefined,
                borderRadius: on && cfg.bg ? (styleId === "comic" || styleId === "solo-box" ? 4 : 8) : undefined,
                padding: on && cfg.bg ? "2px 8px" : undefined,
                transform: cfg.wave ? `translateY(${Math.sin(i * 0.9 + activeWord) * 6}px)` : undefined,
                ...gradientStyle,
              }}
            >
              {word}
            </motion.span>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}

const DEMO_CLIPS = [
  {
    src: "/demo/pod-women-studio.mp4",
    poster: "/demo/pod-women-studio-poster.jpg",
  },
  {
    src: "/demo/pod-mic-conversation.mp4",
    poster: "/demo/pod-mic-conversation-poster.jpg",
  },
  {
    src: "/demo/pod-talking-mic.mp4",
    poster: "/demo/pod-talking-mic-poster.jpg",
  },
  {
    src: "/demo/pod-alt-2.mp4",
    poster: "/demo/pod-alt-2-poster.jpg",
  },
] as const;

const WORD_MS = 420; // advance active word
const STYLE_MS = 2400; // switch caption style
const VIDEO_MS = 8000; // rotate HD podcast clip

type Props = { active?: boolean };

export default function HeroCaptionDemo({ active = true }: Props) {
  const [styleIdx, setStyleIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [clipIdx, setClipIdx] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const clip = DEMO_CLIPS[clipIdx]!;

  useEffect(() => {
    ensureFonts();
  }, []);

  // Rotate HD podcast clips
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setClipIdx((i) => (i + 1) % DEMO_CLIPS.length);
    }, VIDEO_MS);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    if (!active) {
      video.pause();
      return;
    }

    const tryPlay = () => {
      video.muted = true;
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          window.setTimeout(() => {
            video.muted = true;
            void video.play().catch(() => {});
          }, 50);
        });
      }
    };

    try {
      video.currentTime = 0;
    } catch {
      /* ignore */
    }
    tryPlay();

    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    const t1 = window.setTimeout(tryPlay, 100);
    const t2 = window.setTimeout(tryPlay, 400);

    return () => {
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [active, clipIdx]);

  // Word-by-word caption progress through full lines
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setWordIdx((w) => w + 1);
    }, WORD_MS);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    const line = CAPTION_LINES[lineIdx]!;
    if (wordIdx < line.length) return;
    setLineIdx((l) => (l + 1) % CAPTION_LINES.length);
    setWordIdx(0);
  }, [wordIdx, lineIdx]);

  // Cycle caption styles
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setStyleIdx((i) => (i + 1) % PRESETS.length);
    }, STYLE_MS);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    const list = listRef.current;
    const el = itemRefs.current[styleIdx];
    if (!list || !el) return;
    const target = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
    list.scrollTo({
      top: Math.max(0, target),
      behavior: "smooth",
    });
  }, [styleIdx]);

  const preset = PRESETS[styleIdx]!;
  const words = CAPTION_LINES[lineIdx]!;

  return (
    <div className="relative h-full w-full select-none">
      <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/8 bg-[#0d0d0d]">
        <div className="relative flex min-h-0 flex-1 gap-3 overflow-hidden p-4">
          <div className="relative flex-1 min-w-0 rounded-2xl overflow-hidden border border-white/10 bg-[#111]">
            <video
              ref={videoRef}
              key={clip.src}
              className="absolute inset-0 h-full w-full object-cover"
              poster={clip.poster}
              autoPlay={active}
              muted
              loop
              playsInline
              preload="auto"
              disablePictureInPicture
            >
              <source src={clip.src} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />

            {/* Moving full-line caption */}
            <div className="absolute inset-x-2 bottom-[14%] z-10 flex justify-center px-2">
              <div className="w-full max-w-[520px]">
                <LiveCaptionLine
                  words={words}
                  activeWord={Math.min(wordIdx, words.length - 1)}
                  styleId={preset.id}
                />
              </div>
            </div>

            <div className="absolute top-3 left-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white/70 font-medium">
              AI captioning
            </div>
          </div>

          <div className="relative w-[132px] shrink-0 flex flex-col rounded-2xl border border-white/8 bg-[#121212] overflow-hidden">
            <div className="px-2.5 py-2 border-b border-white/6">
              <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider">Presets</p>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <div ref={listRef} className="absolute inset-0 overflow-y-auto no-scrollbar p-1.5 space-y-1.5">
                {PRESETS.map((p, i) => {
                  const selected = i === styleIdx;
                  return (
                    <div
                      key={p.id}
                      ref={(el) => { itemRefs.current[i] = el; }}
                      className={`relative rounded-xl border overflow-hidden transition-all duration-200 ${
                        selected
                          ? "border-white/50 ring-1 ring-white/20"
                          : "border-white/8 bg-white/[0.03]"
                      }`}
                    >
                      <div className="h-12 bg-[#0a0a0a] flex items-center justify-center px-1">
                        {p.preview}
                      </div>
                      <div className="px-1.5 py-1 bg-[#181818] flex items-center justify-between">
                        <span className="text-[9px] font-semibold text-white/55 truncate">
                          {p.label}
                        </span>
                        {selected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white/70 shrink-0" />
                        )}
                      </div>

                      {selected && (
                        <motion.div
                          className="absolute -right-1 top-1/2 -translate-y-1/2 z-20 pointer-events-none"
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0, scale: [1, 0.92, 1] }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                        >
                          <svg width="22" height="26" viewBox="0 0 28 32" fill="none">
                            <path d="M10 14V5.5C10 4.12 11.12 3 12.5 3C13.88 3 15 4.12 15 5.5V14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                            <path d="M15 8.5C15 7.12 16.12 6 17.5 6C18.88 6 20 7.12 20 8.5V14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                            <path d="M20 10.5C20 9.12 21.12 8 22.5 8C23.88 8 25 9.12 25 10.5V19C25 24.52 20.52 29 15 29C9.48 29 5 24.52 5 19V14C5 12.62 6.12 11.5 7.5 11.5C8.88 11.5 10 12.62 10 14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                            <path d="M10 14C10 12.62 8.88 11.5 7.5 11.5C6.12 11.5 5 12.62 5 14V19" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/6 py-3">
          <div className="flex gap-2.5 px-5">
            <span className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/18 bg-white/8 px-3.5 py-1.5 text-[12px] text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-white/50 shrink-0" />
              AI captioning
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
