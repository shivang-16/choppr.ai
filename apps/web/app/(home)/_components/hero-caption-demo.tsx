"use client";

import { GTA_LAUNCH_MODE, gtaOr, GLASS_BG } from "@/lib/gta-launch";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Bebas+Neue&family=Montserrat:wght@900&family=Oswald:wght@400;700;900&family=Permanent+Marker&family=Poppins:wght@800&family=Press+Start+2P&family=Space+Grotesk:wght@400;700;900&display=swap";

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
const PF_MONT = "'Montserrat', sans-serif";
const PF_POPPINS = "'Poppins', sans-serif";

const OUTLINE =
  "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, -2px 0 0 #000, 2px 0 0 #000, 0 -2px 0 #000, 0 2px 0 #000";
const OUTLINE_HEAVY =
  "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, -3px 0 0 #000, 3px 0 0 #000, 0 -3px 0 #000, 0 3px 0 #000";
const PRO_STROKE =
  "-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000";

const SMOOTH_EASE = [0.22, 1, 0.36, 1] as const;

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

type ProCaptionId =
  | "pro-spring"
  | "pro-slide-box"
  | "pro-liquid"
  | "pro-focus"
  | "pro-rise"
  | "pro-tilt"
  | "pro-chroma"
  | "pro-shimmer"
  | "pro-depth"
  | "pro-glass";

type LegacyCaptionId =
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

type CaptionId = ProCaptionId | LegacyCaptionId;

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

/** Mirrors caption-renderer.tsx CFG for legacy demo styles */
const STYLE_CFG: Record<LegacyCaptionId, StyleCfg> = {
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
    font: PF_SPACE, activeColor: "#fff", inactiveColor: "rgba(255,255,255,0.8)",
    bg: null, showAll: true, glow: null, outline: OUTLINE_HEAVY, activeScale: 1,
  },
  glitch: {
    font: PF_PIXEL, activeColor: "#ff00ff", inactiveColor: "rgba(255,255,255,0.25)",
    bg: null, showAll: true, glow: "#ff00ff", outline: "none", activeScale: 1, glitch: true,
  },
};

function isProCaptionId(id: CaptionId): id is ProCaptionId {
  return id.startsWith("pro-");
}

type CaptionPreset = {
  id: CaptionId;
  label: string;
  preview: ReactNode;
};

const PRO_PRESETS: CaptionPreset[] = [
  {
    id: "pro-spring",
    label: "Spring Pop",
    preview: (
      <div className="flex flex-col items-center gap-0.5" style={{ fontFamily: PF_MONT }}>
        <span className="text-white font-black text-[13px] leading-none" style={{ textShadow: PRO_STROKE }}>SPRING</span>
        <div className="h-[3px] w-7 rounded-full bg-[#FFE900]" />
      </div>
    ),
  },
  {
    id: "pro-slide-box",
    label: "Slide Box",
    preview: (
      <div className="flex items-center gap-1" style={{ fontFamily: PF_POPPINS }}>
        <span className="text-white/90 font-extrabold text-[9px]">the</span>
        <span className="bg-[#C6FF00] text-black font-extrabold text-[10px] px-1 py-0.5 rounded-md">box</span>
      </div>
    ),
  },
  {
    id: "pro-liquid",
    label: "Liquid Fill",
    preview: (
      <span
        className="font-black text-[13px] bg-clip-text text-transparent"
        style={{
          fontFamily: PF_MONT,
          backgroundImage: "linear-gradient(90deg,#22D3EE 0%,#A5F3FC 52%,rgba(255,255,255,0.4) 52%)",
          textShadow: PRO_STROKE,
        }}
      >LIQUID</span>
    ),
  },
  {
    id: "pro-focus",
    label: "Focus Blur",
    preview: (
      <div className="flex items-center gap-1" style={{ fontFamily: PF_POPPINS }}>
        <span className="text-white/50 font-extrabold text-[10px] blur-[1.5px]">into</span>
        <span className="text-white font-extrabold text-[12px] drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">focus</span>
      </div>
    ),
  },
  {
    id: "pro-rise",
    label: "Rise Mask",
    preview: (
      <div className="flex items-stretch gap-1" style={{ fontFamily: PF_MONT }}>
        <div className="w-[3px] rounded-full bg-[#4ADE80]" />
        <span className="text-white font-black text-[12px]" style={{ textShadow: PRO_STROKE }}>RISE</span>
      </div>
    ),
  },
  {
    id: "pro-tilt",
    label: "Tilt Drop",
    preview: (
      <div className="flex items-center gap-1" style={{ fontFamily: PF_POPPINS }}>
        <span className="text-[#FFD166] font-extrabold text-[13px] rotate-6 inline-block" style={{ textShadow: PRO_STROKE }}>TILT</span>
      </div>
    ),
  },
  {
    id: "pro-chroma",
    label: "Chroma Split",
    preview: (
      <span className="relative inline-block font-black text-[13px]" style={{ fontFamily: PF_MONT }}>
        <span className="absolute inset-0 text-[#FF0033] -translate-x-[2px]">SPLIT</span>
        <span className="absolute inset-0 text-[#00E5FF] translate-x-[2px]">SPLIT</span>
        <span className="relative text-white" style={{ textShadow: PRO_STROKE }}>SPLIT</span>
      </span>
    ),
  },
  {
    id: "pro-shimmer",
    label: "Shimmer",
    preview: (
      <span
        className="font-black text-[13px] bg-clip-text text-transparent drop-shadow-[0_0_8px_#A7F3FF]"
        style={{
          fontFamily: PF_MONT,
          backgroundImage: "linear-gradient(100deg,#FFFFFF 20%,#67E8F9 40%,#FFFFFF 50%,#F472B6 60%,#FFFFFF 80%)",
        }}
      >SHINE</span>
    ),
  },
  {
    id: "pro-depth",
    label: "Depth Pop",
    preview: (
      <span
        className="font-black text-[13px] text-white"
        style={{
          fontFamily: PF_POPPINS,
          textShadow: "1px 1px 0 #7C3AED,2px 2px 0 #6D28D9,3px 3px 0 #5B21B6,4px 4px 0 #4C1D95",
        }}
      >DEPTH</span>
    ),
  },
  {
    id: "pro-glass",
    label: "Glass Panel",
    preview: (
      <div className="rounded-md border border-white/35 bg-white/12 px-1.5 py-0.5">
        <span className="text-white font-extrabold text-[9px]" style={{ fontFamily: PF_POPPINS }}>glass</span>
      </div>
    ),
  },
];

const LEGACY_PRESETS: CaptionPreset[] = [
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

/** Pro styles first (top of the left rail), then the classic presets. */
const PRESETS: CaptionPreset[] = [...PRO_PRESETS, ...LEGACY_PRESETS];

function LiveProCaptionLine({
  words,
  activeWord,
  styleId,
}: {
  words: string[];
  activeWord: number;
  styleId: ProCaptionId;
}) {
  const upper = !["pro-slide-box", "pro-focus", "pro-glass"].includes(styleId);
  const display = words.map(w => (upper ? w.toUpperCase() : w));
  const font = ["pro-slide-box", "pro-focus", "pro-tilt", "pro-depth", "pro-glass"].includes(styleId)
    ? PF_POPPINS
    : PF_MONT;

  if (styleId === "pro-glass") {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={`glass-${words.join("-")}`}
          className="mx-auto rounded-2xl border border-white/35 bg-black/45 px-5 py-3 backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4, ease: SMOOTH_EASE }}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1" style={{ fontFamily: font }}>
            {display.map((word, i) => {
              const on = i === activeWord;
              return (
                <motion.span
                  key={`${word}-${i}`}
                  className="font-extrabold leading-none"
                  animate={{
                    fontSize: on ? 24 : 20,
                    color: on ? "#fff" : "rgba(255,255,255,0.55)",
                  }}
                  transition={{ duration: 0.4, ease: SMOOTH_EASE }}
                >
                  {word}
                </motion.span>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (styleId === "pro-rise") {
    return (
      <motion.div
        key={`rise-${words.join("-")}`}
        className="flex items-stretch gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: SMOOTH_EASE }}
      >
        <motion.div
          className="w-[4px] rounded-full bg-[#4ADE80] origin-top"
          animate={{ scaleY: (activeWord + 1) / Math.max(display.length, 1) }}
          transition={{ duration: 0.45, ease: SMOOTH_EASE }}
        />
        <div className="flex flex-col items-start gap-1" style={{ fontFamily: font }}>
          {display.map((word, i) => {
            const on = i === activeWord;
            const past = i < activeWord;
            if (i > activeWord) return null;
            return (
              <motion.span
                key={`${word}-${i}`}
                className="font-black uppercase leading-none"
                initial={{ y: 14, opacity: 0 }}
                animate={{
                  y: past ? -2 : 0,
                  opacity: past ? 0.4 : 1,
                  fontSize: on ? 32 : 18,
                }}
                transition={{ duration: 0.45, ease: SMOOTH_EASE }}
                style={{
                  color: "#fff",
                  textShadow: PRO_STROKE,
                }}
              >
                {word}
              </motion.span>
            );
          })}
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${styleId}-${words.join("-")}`}
        className="flex flex-wrap items-end justify-center gap-x-2.5 gap-y-1 px-1"
        style={{ fontFamily: font }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.38, ease: SMOOTH_EASE }}
      >
        {display.map((word, i) => {
          const on = i === activeWord;
          const past = i < activeWord;

          if (styleId === "pro-spring") {
            return (
              <motion.span
                key={`${word}-${i}`}
                className="relative inline-flex flex-col items-center font-black uppercase leading-none"
                animate={{
                  scale: on ? 1.06 : 1,
                  fontSize: on ? 30 : 22,
                }}
                transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.7 }}
                style={{
                  color: "#fff",
                  textShadow: PRO_STROKE,
                }}
              >
                {word}
                <motion.span
                  className="mt-1 h-[4px] rounded-full bg-[#FFE900]"
                  initial={false}
                  animate={{ width: on ? "100%" : 0, opacity: on ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: SMOOTH_EASE }}
                />
              </motion.span>
            );
          }

          if (styleId === "pro-slide-box") {
            return (
              <motion.span
                key={`${word}-${i}`}
                className="font-extrabold leading-none inline-block rounded-lg"
                layout
                animate={{
                  fontSize: on ? 26 : 20,
                  color: on ? "#0A0A0A" : "rgba(255,255,255,0.9)",
                  backgroundColor: on ? "#C6FF00" : "rgba(0,0,0,0)",
                  paddingLeft: on ? 10 : 0,
                  paddingRight: on ? 10 : 0,
                  paddingTop: on ? 4 : 0,
                  paddingBottom: on ? 4 : 0,
                }}
                transition={{ duration: 0.42, ease: SMOOTH_EASE }}
              >
                {word}
              </motion.span>
            );
          }

          if (styleId === "pro-liquid") {
            const fill = past || on;
            return (
              <motion.span
                key={`${word}-${i}`}
                className="font-black uppercase leading-none"
                animate={{
                  color: fill ? "#22D3EE" : "rgba(255,255,255,0.35)",
                  opacity: fill ? 1 : 0.7,
                }}
                transition={{ duration: 0.45, ease: SMOOTH_EASE }}
                style={{
                  fontSize: 24,
                  textShadow: PRO_STROKE,
                }}
              >
                {word}
              </motion.span>
            );
          }

          if (styleId === "pro-focus") {
            // CSS filter transition (not framer filter tween) — much smoother
            return (
              <motion.span
                key={`${word}-${i}`}
                className="font-extrabold leading-none will-change-[filter,opacity,transform]"
                animate={{
                  opacity: on ? 1 : 0.42,
                  scale: on ? 1.1 : 1,
                }}
                transition={{ duration: 0.5, ease: SMOOTH_EASE }}
                style={{
                  fontSize: 24,
                  color: "#fff",
                  filter: on ? "blur(0px)" : "blur(3.5px)",
                  transition: "filter 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
                  textShadow: on
                    ? "0 4px 20px rgba(0,0,0,0.85)"
                    : "0 2px 12px rgba(0,0,0,0.45)",
                }}
              >
                {word}
              </motion.span>
            );
          }

          if (styleId === "pro-tilt") {
            return (
              <motion.span
                key={`${word}-${i}`}
                className="font-extrabold uppercase leading-none inline-block"
                animate={{
                  rotate: on ? 0 : i % 2 === 0 ? -4 : 4,
                  y: on ? 0 : 0,
                  scale: on ? 1.08 : 1,
                  fontSize: on ? 30 : 20,
                  color: on ? "#FFD166" : "rgba(255,255,255,0.55)",
                }}
                transition={{ type: "spring", stiffness: 220, damping: 18, mass: 0.8 }}
                style={{
                  textShadow: PRO_STROKE,
                }}
              >
                {word}
              </motion.span>
            );
          }

          if (styleId === "pro-chroma") {
            return (
              <motion.span
                key={`${word}-${i}`}
                className="relative font-black uppercase leading-none inline-block"
                animate={{
                  scale: on ? 1.06 : 1,
                  fontSize: on ? 32 : 20,
                  color: on ? "#fff" : "rgba(255,255,255,0.45)",
                }}
                transition={{ duration: 0.42, ease: SMOOTH_EASE }}
                style={{
                  textShadow: PRO_STROKE,
                }}
              >
                <motion.span
                  className="absolute inset-0 text-[#FF0033]"
                  aria-hidden
                  animate={{
                    opacity: on ? 0.75 : 0,
                    x: on ? -3 : 0,
                  }}
                  transition={{ duration: 0.45, ease: SMOOTH_EASE }}
                >
                  {word}
                </motion.span>
                <motion.span
                  className="absolute inset-0 text-[#00E5FF]"
                  aria-hidden
                  animate={{
                    opacity: on ? 0.75 : 0,
                    x: on ? 3 : 0,
                  }}
                  transition={{ duration: 0.45, ease: SMOOTH_EASE }}
                >
                  {word}
                </motion.span>
                <span className="relative">{word}</span>
              </motion.span>
            );
          }

          if (styleId === "pro-shimmer") {
            return (
              <motion.span
                key={`${word}-${i}`}
                className="font-black uppercase leading-none bg-clip-text text-transparent"
                animate={{
                  fontSize: on ? 28 : 20,
                  opacity: on ? 1 : 0.5,
                }}
                transition={{ duration: 0.45, ease: SMOOTH_EASE }}
                style={{
                  backgroundImage: on
                    ? "linear-gradient(100deg,#FFFFFF 15%,#67E8F9 40%,#FFFFFF 50%,#F472B6 65%,#FFFFFF 85%)"
                    : "linear-gradient(#fff,#fff)",
                  WebkitTextStroke: "1px rgba(0,0,0,0.7)",
                  filter: on ? "drop-shadow(0 0 10px #A7F3FF)" : undefined,
                  transition: "filter 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                {word}
              </motion.span>
            );
          }

          if (styleId === "pro-depth") {
            return (
              <motion.span
                key={`${word}-${i}`}
                className="font-extrabold uppercase leading-none"
                animate={{
                  y: on ? 0 : 0,
                  scale: on ? 1.06 : 1,
                  fontSize: on ? 32 : 20,
                  opacity: on ? 1 : 0.55,
                }}
                transition={{ type: "spring", stiffness: 240, damping: 20 }}
                style={{
                  color: "#fff",
                  textShadow: on
                    ? "2px 2px 0 #7C3AED,4px 4px 0 #6D28D9,6px 6px 0 #5B21B6,8px 8px 0 #4C1D95"
                    : "1px 1px 0 #4C1D95",
                }}
              >
                {word}
              </motion.span>
            );
          }

          return (
            <span key={`${word}-${i}`} className="font-black text-white" style={{ fontSize: 22, textShadow: PRO_STROKE }}>
              {word}
            </span>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}

function LiveCaptionLine({
  words,
  activeWord,
  styleId,
}: {
  words: string[];
  activeWord: number;
  styleId: CaptionId;
}) {
  if (isProCaptionId(styleId)) {
    return <LiveProCaptionLine words={words} activeWord={activeWord} styleId={styleId} />;
  }

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
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.38, ease: SMOOTH_EASE }}
        >
          <span className="uppercase font-black text-[11px] text-white/35" style={{ textShadow: cfg.outline }}>
            {prev ?? "\u00A0"}
          </span>
          <motion.span
            className="uppercase font-black leading-none"
            initial={{ scale: 0.92, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: SMOOTH_EASE }}
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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.38, ease: SMOOTH_EASE }}
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
                    ? { y: [0, -10, 0], scale: 1 }
                    : cfg.shake && on
                      ? { x: [0, -2, 2, -1, 1, 0], scale: 1 }
                      : cfg.glitch && on
                        ? { x: [0, 2, -2, 1, 0], y: [0, -1, 1, 0], scale: 1 }
                        : {
                            y: 0,
                            x: 0,
                            scale: on && cfg.activeScale > 1 ? Math.min(cfg.activeScale, 1.35) : 1,
                          }
              }
              transition={
                cfg.bounce && on
                  ? { duration: 0.5, ease: SMOOTH_EASE }
                  : cfg.shake && on
                    ? { duration: 0.35, ease: "easeInOut" }
                    : cfg.glitch && on
                      ? { duration: 0.25, repeat: 1 }
                      : { duration: 0.42, ease: SMOOTH_EASE }
              }
              style={{
                fontSize: on ? activeSize : baseSize,
                color: gradientStyle ? undefined : color,
                textShadow,
                background: on && cfg.bg ? cfg.bg : undefined,
                borderRadius: on && cfg.bg ? (styleId === "comic" || styleId === "solo-box" ? 4 : 8) : undefined,
                padding: on && cfg.bg ? "2px 8px" : undefined,
                transform: cfg.wave ? `translateY(${Math.sin(i * 0.9 + activeWord) * 6}px)` : undefined,
                transition: "font-size 0.42s cubic-bezier(0.22, 1, 0.36, 1), color 0.42s cubic-bezier(0.22, 1, 0.36, 1)",
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

const ORIGINAL_DEMO_CLIPS = [
  {
    src: "/demo/pod-women-studio.mp4",
    poster: gtaOr("/demo/pod-women-studio-poster.jpg", 0),
  },
  {
    src: "/demo/pod-mic-conversation.mp4",
    poster: gtaOr("/demo/pod-mic-conversation-poster.jpg", 1),
  },
  {
    src: "/demo/pod-talking-mic.mp4",
    poster: gtaOr("/demo/pod-talking-mic-poster.jpg", 2),
  },
  {
    src: "/demo/pod-alt-2.mp4",
    poster: gtaOr("/demo/pod-alt-2-poster.jpg", 3),
  },
] as const;

// GTA VI launch trailer streamed straight from S3, looped between 0:10 and 1:18.
const GTA_VIDEO_URL = "https://general-storage-shivang.s3.ap-south-1.amazonaws.com/choppr/gta6/GTAVI_Launch_Trailer_720p.mp4";
const GTA_START = 10;
const GTA_END = 78;

// GTA 6 launch promo: use the GTA trailer as the only caption-demo video.
const DEMO_CLIPS = GTA_LAUNCH_MODE
  ? ([{ src: GTA_VIDEO_URL, poster: gtaOr("", 0) }] as const)
  : ORIGINAL_DEMO_CLIPS;

// Timed transcript of the trailer: [text, startSec, endSec] in trailer time.
type TW = [string, number, number];
const GTA_TIMED: TW[][] = [
  [["This",10.92,11.16],["is",11.16,11.52],["a",11.52,11.8],["free",11.8,12.12],["call",12.12,12.76],["from",12.76,13.28],["Lucia",13.28,13.56],["Caminos.",13.56,14.24]],
  [["I",30.78,31.02],["ain't",31.02,31.22],["gonna",31.22,31.46],["slow",31.46,32],["the",32,32.22],["law",32.22,32.82],["again",32.82,33.64],["I",33.7,33.9]],
  [["will",33.84,34.14],["die",34.14,34.7],["before",34.7,35.2],["I",35.2,35.4],["walk",35.32,35.8],["away,",35.8,36.22],["walk",36.28,36.68],["away",36.68,37.4]],
  [["Let's",38.36,38.66],["take",38.66,38.86],["it",38.86,39.2],["back,",39.2,39.56],["just",39.78,40.06],["make",40.06,40.26],["it",40.26,40.64],["flash",40.64,40.84]],
  [["And",41.32,41.52],["it'll",41.5,42.1],["only",42.1,42.48],["go",42.48,43.42],["like",43.42,43.62],["a",43.62,43.9],["second",43.9,44.42],["chance",44.42,44.8]],
  [["You",45.38,45.58],["and",45.54,45.9],["me,",45.9,46.3],["we",46.3,46.5],["know",46.48,46.7],["that",46.7,46.96],["this",46.96,47.2],["life",47.2,47.46]],
  [["will",47.46,47.72],["rush",47.72,47.92],["you",47.92,48.26],["out",48.26,48.46],["So",48.82,49.1],["I'm",49.1,49.52],["gonna",49.52,50.24],["get",50.24,50.62]],
  [["to",50.62,51.02],["the",51.02,51.22],["very",51.16,51.9],["last",51.9,52.54],["break",52.54,53.74],["Are",63.22,63.42],["we",63.3,63.5],["gonna",63.42,63.62]],
  [["be",63.6,63.82],["okay?",63.82,64.2],["We",65.26,65.52],["stuck",65.52,65.86],["together",65.86,66.14],["through",66.14,66.42],["everything",66.42,67],["Just",67.3,67.5]],
  [["gotta",67.44,67.64],["get",67.58,67.78],["through",67.76,68.64]],
];
const GTA_LINES: string[][] = GTA_TIMED.map((l) => l.map((w) => w[0]));
const LINES = GTA_LAUNCH_MODE ? GTA_LINES : CAPTION_LINES;

const WORD_MS = 560; // advance active word — slower for smoother read
const STYLE_MS = 3400; // switch caption style — dwell longer so motion settles
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

  const [capVisible, setCapVisible] = useState(true);
  const [soundOn, setSoundOn] = useState(true); // sound is on by default
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  // Browsers block unmuted autoplay until a user gesture. If that happened,
  // turn sound on at the visitor's first click / tap / keypress anywhere.
  useEffect(() => {
    if (!autoplayBlocked || !active) return;
    const enable = (e: Event) => {
      // The sound button handles its own click
      if ((e.target as Element | null)?.closest?.("[data-sound-toggle]")) return;
      setAutoplayBlocked(false);
      setSoundOn(true);
      const v = videoRef.current;
      if (v) {
        v.muted = false;
        void v.play().catch(() => {});
      }
    };
    const evts = ["pointerdown", "mousedown", "click", "touchend", "keydown"] as const;
    evts.forEach((e) => window.addEventListener(e, enable, { once: true, passive: true }));
    return () => evts.forEach((e) => window.removeEventListener(e, enable));
  }, [autoplayBlocked, active]);
  const clip = DEMO_CLIPS[clipIdx]!;

  // Browsers only allow audio after a user click, so start muted + offer a toggle.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !soundOn || !active;
  }, [soundOn, active, clip.src]);

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
      // Try with sound first (only while this slide is active); browsers that
      // block it fall back to muted + the "Tap for sound" button.
      video.muted = !soundRef.current;
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          window.setTimeout(() => {
            video.muted = true;
            setSoundOn(false);
            setAutoplayBlocked(true);
            void video.play().catch(() => {});
          }, 50);
        });
      }
    };

    try {
      video.currentTime = GTA_LAUNCH_MODE ? GTA_START : 0;
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

  // GTA mode: captions follow the video's playback time (real word timings)
  useEffect(() => {
    if (!active || !GTA_LAUNCH_MODE) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        if (v.currentTime >= GTA_END || v.currentTime < GTA_START - 0.5) v.currentTime = GTA_START;
        const t = v.currentTime;
        let li = -1;
        for (let i = 0; i < GTA_TIMED.length; i++) {
          const L = GTA_TIMED[i]!;
          if (t >= L[0]![1] - 0.15 && t <= L[L.length - 1]![2] + 0.7) { li = i; break; }
        }
        if (li === -1) {
          setCapVisible(false);
        } else {
          const L = GTA_TIMED[li]!;
          let wi = 0;
          for (let i = 0; i < L.length; i++) if (t >= L[i]![1]) wi = i;
          setCapVisible(true);
          setLineIdx(li);
          setWordIdx(wi);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  // Word-by-word caption progress through full lines
  useEffect(() => {
    if (!active || GTA_LAUNCH_MODE) return;
    const t = setInterval(() => {
      setWordIdx((w) => w + 1);
    }, WORD_MS);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    if (GTA_LAUNCH_MODE) return;
    const line = LINES[lineIdx]!;
    if (wordIdx < line.length) return;
    setLineIdx((l) => (l + 1) % LINES.length);
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
  const words = LINES[lineIdx]!;

  return (
    <div className="relative h-full w-full select-none">
      <div className={`relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/8 ${GLASS_BG || "bg-[#0d0d0d]"}`}>
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
              preload={GTA_LAUNCH_MODE ? "metadata" : "auto"}
              disablePictureInPicture
            >
              <source src={GTA_LAUNCH_MODE ? `${clip.src}#t=${GTA_START}` : clip.src} type="video/mp4" />
            </video>
            {/* Thumbnail shown until this slide is active, then the video + captions start */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={clip.poster}
              alt=""
              aria-hidden
              className={`pointer-events-none absolute inset-0 z-[5] h-full w-full object-cover transition-opacity duration-500 ${active ? "opacity-0" : "opacity-100"}`}
            />
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            {/* Muted: big centered tap-to-unmute button. Sound on: small mute icon bottom-right. */}
            {!soundOn ? (
              <button
                type="button"
                data-sound-toggle
                onClick={() => {
                  setAutoplayBlocked(false);
                  setSoundOn(true);
                }}
                aria-label="Unmute video"
                className={`absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 ${active ? "" : "pointer-events-none opacity-0"} flex h-20 w-20 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white shadow-2xl shadow-black/50 backdrop-blur-md transition-transform hover:scale-105 hover:bg-black/75 active:scale-95`}
              >
                <VolumeX className="h-9 w-9" />
              </button>
            ) : (
              <button
                type="button"
                data-sound-toggle
                onClick={() => {
                  setAutoplayBlocked(false);
                  setSoundOn(false);
                }}
                aria-label="Mute video"
                className={`absolute bottom-2 right-2 z-20 ${active ? "" : "pointer-events-none opacity-0"} flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75`}
              >
                <Volume2 className="h-4 w-4" />
              </button>
            )}

            {/* Moving full-line caption */}
            <div className={`absolute inset-x-2 bottom-[14%] z-10 flex justify-center px-2 transition-opacity duration-200 ${capVisible && active ? "opacity-100" : "opacity-0"}`}>
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
