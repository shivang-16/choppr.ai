"use client";

import { useEffect, useRef } from "react";
import type { CaptionSegment } from "./timeline-caption-bridge";

// Google Fonts loaded via a <link> injected once — provides the display fonts
// that match the server-side TTFs in assets/fonts/.
const GFONTS_URL =
  "https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Bebas+Neue&family=Nunito:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&family=Oswald:wght@400;700;900&family=Permanent+Marker&family=Press+Start+2P&family=Space+Grotesk:wght@400;700;900&family=UnifrakturCook:wght@700&family=Noto+Sans+Devanagari:wght@100;300;400;500;700;900&display=swap";

function ensureGFontsLoaded() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-choppr-fonts]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = GFONTS_URL;
  link.setAttribute("data-choppr-fonts", "1");
  document.head.appendChild(link);
}

// Detect if a string contains Devanagari (Hindi/Marathi/etc.) characters
function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

// Check if the active word set contains Devanagari script
function wordsHaveDevanagari(words: { word: string }[]): boolean {
  return words.some(w => hasDevanagari(w.word));
}

// Devanagari font family — Noto Sans Devanagari supports all weights 100–900
const F_DEVA = `"Noto Sans Devanagari",system-ui,sans-serif`;

// Per-style Devanagari overrides: map each style to a weight that visually
// differentiates it since Devanagari fonts can't replicate Latin glyph shapes.
const DEVA_WEIGHT: Partial<Record<CaptionStyle, string>> = {
  // Ultra-bold / condensed styles → heaviest weight
  "word-pop":      "900",
  "bold-center":   "900",
  bounce:          "900",
  "solo-pop":      "900",
  "solo-red":      "900",
  "stack-fire":    "900",
  "stack-sunny":   "900",
  gothic:          "900",
  "word-stack":    "900",
  "font-cycle":  "400",
  // Semi-bold styles
  "mr-beast":      "700",
  "stack-reveal":  "700",
  shake:           "700",
  "solo-shake":    "700",
  fire:            "700",
  "gradient-gold": "700",
  "stack-shake":   "700",
  "stack-gold":    "700",
  // Normal weight but styled
  comic:           "500",
  rainbow:         "500",
  "highlight-box": "500",
  neon:            "500",
  "electric-blue": "500",
  "solo-glow":     "500",
  "gradient-pop":  "500",
  "solo-gradient": "500",
  "stack-neon":    "500",
  "stack-comic":   "500",
  karaoke:         "400",
  wave:            "400",
  "stack-wave":    "400",
  // Light styles
  typewriter:      "300",
  glitch:          "300",
};

export type CaptionStyle =
  | "none"
  | "full-line"
  | "word-pop"
  | "karaoke"
  | "bold-center"
  | "neon"
  | "bounce"
  | "subtitle"
  | "shadow"
  | "fire"
  | "typewriter"
  | "glitch"
  | "rainbow"
  | "outline-white"
  | "outline-black"
  | "highlight-box"
  | "wave"
  | "gradient-gold"
  | "comic"
  | "mr-beast"
  | "stack-reveal"
  | "shake"
  | "gradient-pop"
  | "clean-mid"
  | "electric-blue"
  | "solo-pop"
  | "solo-red"
  | "solo-glow"
  | "solo-box"
  | "solo-gradient"
  | "solo-shake"
  | "gothic"
  | "word-stack"
  | "stack-shake" | "stack-wave" | "stack-neon" | "stack-fire" | "stack-comic"
  | "stack-gold" | "stack-sunny"
  | "font-cycle";

export interface CaptionWord {
  word:  string;
  start: number;
  end:   number;
}

interface Props {
  videoRef:    React.RefObject<HTMLVideoElement | null>;
  words:       CaptionWord[];
  style:       CaptionStyle;
  fontSize?:   number;
  aspectRatio?: string;
  posOffset?:  number; // vertical offset in % of height (- = up, + = down)
  hOffset?:    number; // horizontal offset in % of width (- = left, + = right)
  language?:   string; // BCP-47 language code, e.g. "hi", "mr", "en"
  /** When provided, the renderer picks the active segment at each frame instead of using `words`+`style`. */
  segments?: CaptionSegment[];
  currentTime?: number;
}

// ── Per-style font families (match server-side assets/fonts TTFs) ─────────────
const F_DEFAULT = `system-ui,-apple-system,sans-serif`;       // Noto on server
const F_ANTON   = `"Anton",${F_DEFAULT}`;                      // condensed impact     — single-weight 400
const F_BANGERS = `"Bangers",${F_DEFAULT}`;                    // comic-book           — single-weight 400
const F_OSWALD  = `"Oswald",${F_DEFAULT}`;                     // condensed grotesque  — single-weight 400
const F_BEBAS   = `"Bebas Neue",${F_DEFAULT}`;                 // tall condensed       — single-weight 400
const F_MARKER  = `"Permanent Marker",${F_DEFAULT}`;           // hand-written         — single-weight 400
const F_PIXEL   = `"Press Start 2P",${F_DEFAULT}`;             // retro pixel          — single-weight 400
const F_SPACE   = `"Space Grotesk",${F_DEFAULT}`;              // geometric modern     — variable (use 700)
const F_GOTHIC  = `"UnifrakturCook",${F_DEFAULT}`;             // gothic blackletter   — registered at 700
const F_NUNITO  = `"Nunito",${F_DEFAULT}`;                     // rounded black (900)

// Registered CSS weight per font — must match what the TTF reports on server
const W: Record<string, string> = {
  [F_DEFAULT]: "bold",
  [F_ANTON]:   "400",
  [F_BANGERS]: "400",
  [F_OSWALD]:  "400",
  [F_BEBAS]:   "400",
  [F_MARKER]:  "400",
  [F_PIXEL]:   "400",
  [F_SPACE]:   "700",
  [F_GOTHIC]:  "bold",
  [F_NUNITO]:  "900",
};
const fw = (f: string): string => W[f] ?? "bold";

const CFG: Record<CaptionStyle, {
  weight: string;
  font: string;
  activeColor: string | "gradient";
  inactiveColor: string;
  bg: string | null;
  showAll: boolean;
  yRatio: number;
  glow: string | null;
  outline: { color: string; width: number } | null;
}> = {
  // ── Noto / system default ─────────────────────────────────────────────────
  none:            { weight:fw(F_DEFAULT), font:F_DEFAULT, activeColor:"#fff",      inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.80, glow:null,        outline:null },
  subtitle:        { weight:fw(F_DEFAULT), font:F_DEFAULT, activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.6)",  bg:"rgba(0,0,0,0.7)",   showAll:true,  yRatio:0.88, glow:null,        outline:null },
  "full-line":     { weight:fw(F_DEFAULT), font:F_DEFAULT, activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.45)", bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:2} },
  shadow:          { weight:fw(F_DEFAULT), font:F_DEFAULT, activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.4)",  bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:null },
  "clean-mid":     { weight:fw(F_SPACE),   font:F_SPACE,   activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.5)",  bg:"rgba(0,0,0,0.5)",   showAll:true,  yRatio:0.50, glow:null,        outline:null },

  // ── Anton (condensed impact — single-weight 400, inherently bold) ─────────
  "word-pop":      { weight:fw(F_ANTON),   font:F_ANTON,   activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.35)", bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:3} },
  "bold-center":   { weight:fw(F_ANTON),   font:F_ANTON,   activeColor:"#fff",      inactiveColor:"transparent",           bg:"rgba(0,0,0,0.65)",  showAll:false, yRatio:0.76, glow:null,        outline:null },
  bounce:          { weight:fw(F_ANTON),   font:F_ANTON,   activeColor:"#fff",      inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.78, glow:null,        outline:{color:"#000",width:3} },
  "solo-pop":      { weight:fw(F_ANTON),   font:F_ANTON,   activeColor:"#fff",      inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.50, glow:null,        outline:{color:"#000",width:5} },
  "solo-red":      { weight:fw(F_ANTON),   font:F_ANTON,   activeColor:"#FF2D2D",   inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.50, glow:"#FF2D2D",   outline:{color:"#000",width:5} },

  // ── Oswald (condensed grotesque — single-weight 400) ─────────────────────
  "mr-beast":      { weight:fw(F_OSWALD),  font:F_OSWALD,  activeColor:"#FF0000",   inactiveColor:"rgba(255,255,255,1.0)",  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:6} },
  "stack-reveal":  { weight:fw(F_OSWALD),  font:F_OSWALD,  activeColor:"#fff",      inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.45, glow:null,        outline:{color:"#000",width:4} },
  shake:           { weight:fw(F_OSWALD),  font:F_OSWALD,  activeColor:"#FF3333",   inactiveColor:"rgba(255,255,255,0.8)",  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:4} },
  "solo-shake":    { weight:fw(F_OSWALD),  font:F_OSWALD,  activeColor:"#fff",      inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.50, glow:null,        outline:{color:"#FF0000",width:5} },
  fire:            { weight:fw(F_OSWALD),  font:F_OSWALD,  activeColor:"#FF4500",   inactiveColor:"rgba(255,165,0,0.5)",    bg:null,                showAll:true,  yRatio:0.80, glow:"#FF4500",   outline:{color:"#000",width:2} },
  "gradient-gold": { weight:fw(F_OSWALD),  font:F_OSWALD,  activeColor:"gradient",  inactiveColor:"rgba(255,215,0,0.3)",    bg:null,                showAll:true,  yRatio:0.80, glow:"#FFD700",   outline:{color:"#000",width:2} },

  // ── Bangers (comic-book — single-weight 400) ──────────────────────────────
  comic:           { weight:fw(F_BANGERS), font:F_BANGERS, activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.4)",  bg:"rgba(30,30,200,0.85)",showAll:false,yRatio:0.78, glow:null,       outline:{color:"#000",width:4} },
  rainbow:         { weight:fw(F_BANGERS), font:F_BANGERS, activeColor:"gradient",  inactiveColor:"rgba(255,255,255,0.35)", bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:2} },
  "highlight-box": { weight:fw(F_BANGERS), font:F_BANGERS, activeColor:"#000",      inactiveColor:"rgba(255,255,255,0.5)",  bg:"#FFE600",           showAll:true,  yRatio:0.80, glow:null,        outline:null },

  // ── Bebas Neue (tall condensed — single-weight 400) ───────────────────────
  neon:            { weight:fw(F_BEBAS),   font:F_BEBAS,   activeColor:"#00ff88",   inactiveColor:"rgba(255,255,255,0.3)",  bg:null,                showAll:true,  yRatio:0.80, glow:"#00ff88",   outline:null },
  "electric-blue": { weight:fw(F_BEBAS),   font:F_BEBAS,   activeColor:"#00D4FF",   inactiveColor:"rgba(255,255,255,0.4)",  bg:null,                showAll:true,  yRatio:0.50, glow:"#00D4FF",   outline:{color:"#000",width:3} },
  "solo-glow":     { weight:fw(F_BEBAS),   font:F_BEBAS,   activeColor:"#00FF88",   inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.50, glow:"#00FF88",   outline:{color:"#000",width:4} },
  "gradient-pop":  { weight:fw(F_BEBAS),   font:F_BEBAS,   activeColor:"gradient",  inactiveColor:"rgba(255,255,255,0.3)",  bg:null,                showAll:true,  yRatio:0.50, glow:"#A855F7",   outline:{color:"#000",width:3} },
  "solo-gradient": { weight:fw(F_BEBAS),   font:F_BEBAS,   activeColor:"gradient",  inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.50, glow:"#A855F7",   outline:{color:"#000",width:4} },

  // ── Permanent Marker (hand-written — single-weight 400) ───────────────────
  karaoke:         { weight:fw(F_MARKER),  font:F_MARKER,  activeColor:"#FFE600",   inactiveColor:"rgba(255,255,255,0.5)",  bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:3} },
  wave:            { weight:fw(F_MARKER),  font:F_MARKER,  activeColor:"#ffffff",   inactiveColor:"rgba(255,255,255,0.3)",  bg:null,                showAll:true,  yRatio:0.82, glow:null,        outline:{color:"#000",width:3} },

  // ── Press Start 2P (pixel — single-weight 400) ────────────────────────────
  typewriter:      { weight:fw(F_PIXEL),   font:F_PIXEL,   activeColor:"#00FF41",   inactiveColor:"rgba(0,255,65,0.3)",     bg:"rgba(0,0,0,0.85)",  showAll:true,  yRatio:0.80, glow:"#00FF41",   outline:null },
  glitch:          { weight:fw(F_PIXEL),   font:F_PIXEL,   activeColor:"#ff00ff",   inactiveColor:"rgba(255,255,255,0.25)", bg:null,                showAll:true,  yRatio:0.80, glow:"#ff00ff",   outline:{color:"#00ffff",width:2} },

  // ── Space Grotesk (geometric modern) ─────────────────────────────────────
  "outline-white": { weight:fw(F_SPACE),   font:F_SPACE,   activeColor:"transparent",inactiveColor:"transparent",          bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#fff",width:2} },
  "outline-black": { weight:fw(F_SPACE),   font:F_SPACE,   activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.3)",  bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:4} },
  "solo-box":      { weight:fw(F_SPACE),   font:F_SPACE,   activeColor:"#000",      inactiveColor:"transparent",           bg:"#FFE600",           showAll:false, yRatio:0.50, glow:null,        outline:null },

  // ── UnifrakturCook (gothic blackletter — weight 700) ──────────────────────
  gothic:          { weight:fw(F_GOTHIC),  font:F_GOTHIC,  activeColor:"#fff",      inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:3} },

  // ── Nunito (rounded black — weight 900) ───────────────────────────────────
  "word-stack":    { weight:fw(F_NUNITO),  font:F_NUNITO,  activeColor:"#fff",      inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:4} },

  // ── Display stack variants (animated 3-row) ───────────────────────────────
  "stack-shake":   { weight:fw(F_OSWALD),  font:F_OSWALD,  activeColor:"#FF3333",   inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:5} },
  "stack-wave":    { weight:fw(F_MARKER),  font:F_MARKER,  activeColor:"#fff",      inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:3} },
  "stack-neon":    { weight:fw(F_BEBAS),   font:F_BEBAS,   activeColor:"#00FF88",   inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:"#00FF88",   outline:null },
  "stack-fire":    { weight:fw(F_ANTON),   font:F_ANTON,   activeColor:"#FF4500",   inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:"#FF4500",   outline:{color:"#000",width:3} },
  "stack-comic":   { weight:fw(F_BANGERS), font:F_BANGERS, activeColor:"#fff",      inactiveColor:"#fff",                  bg:"rgba(20,20,200,0.9)",showAll:true, yRatio:0.50, glow:null,        outline:{color:"#000",width:3} },
  "stack-gold":    { weight:fw(F_OSWALD),  font:F_OSWALD,  activeColor:"#FFD700",   inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:"#FFD700",   outline:{color:"#000",width:3} },
  "stack-sunny":   { weight:fw(F_ANTON),   font:F_ANTON,   activeColor:"#FFE600",   inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:5} },

  // ── Font Cycle (solo word + cycling font/color) ─────────────────────────
  "font-cycle":  { weight:"400",         font:F_ANTON,   activeColor:"#FFFFFF",   inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.50, glow:null,        outline:{color:"#000",width:5} },
};

// Rainbow colors cycle
const RAINBOW = ["#FF0000","#FF7F00","#FFFF00","#00FF00","#0000FF","#8B00FF"];
// Gold gradient stops
const GOLD    = ["#FFD700","#FFA500","#FFD700","#FFFACD","#FFD700"];
// Purple-pink gradient for gradient-pop
const PURPLE_POP = ["#A855F7","#EC4899","#F97316","#EAB308","#A855F7"];

// ── Font Cycle: font rotation only — white text, regular weight ─────────────
const ST_FONTS = [
  { font: F_ANTON,   weight: "400" },
  { font: F_BANGERS, weight: "400" },
  { font: F_MARKER,  weight: "400" },
  { font: F_BEBAS,   weight: "400" },
  { font: F_OSWALD,  weight: "400" },
  { font: F_NUNITO,  weight: "400" },
  { font: F_SPACE,   weight: "400" },
  { font: F_DEFAULT, weight: "400" },
];

export default function CaptionRenderer({
  videoRef, words, style, fontSize = 50, aspectRatio = "9:16", posOffset = 0, hOffset = 0, language,
  segments, currentTime,
}: Props) {
  ensureGFontsLoaded();

  // When segments are provided, resolve active segment per frame using video.currentTime
  const resolveActive = (): {
    activeWords: CaptionWord[];
    activeStyle: CaptionStyle;
    posX: number;
    posY: number;
  } => {
    if (segments && segments.length > 0) {
      const t = currentTime ?? videoRef.current?.currentTime ?? 0;
      const seg = segments.find(s => t >= s.start - 0.001 && t < s.end + 0.001);
      if (seg) {
        return {
          activeWords: seg.words,
          activeStyle: seg.style,
          posX: seg.posX ?? hOffset,
          posY: seg.posY ?? posOffset,
        };
      }
      return { activeWords: [], activeStyle: "none", posX: hOffset, posY: posOffset };
    }
    return { activeWords: words, activeStyle: style, posX: hOffset, posY: posOffset };
  };

  const {
    activeWords: resolvedWords,
    activeStyle: resolvedStyle,
    posX: resolvedPosX,
    posY: resolvedPosY,
  } = resolveActive();

  const canvasW = aspectRatio === "16:9" ? 1920 : 1080;
  const canvasH = aspectRatio === "16:9" ? 1080 : aspectRatio === "1:1" ? 1080 : 1920;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef(0);
  const bounceRef = useRef<Record<string, number>>({});
  const waveRef   = useRef<Record<string, number>>({});

  // Detect Devanagari script either from the language code or from the words themselves
  const isDevanagari = language
    ? ["hi", "mr", "ne", "kok", "bho", "mai", "dgo"].some(l => language.startsWith(l))
    : wordsHaveDevanagari(resolvedWords);

  useEffect(() => {
    if (resolvedStyle === "none") return;
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const baseCfg = CFG[resolvedStyle];
    // When rendering Devanagari script, override the font to Noto Sans Devanagari
    // and use a differentiated font weight so each style still looks visually distinct.
    const cfg = isDevanagari
      ? { ...baseCfg, font: F_DEVA, weight: DEVA_WEIGHT[resolvedStyle] ?? "700" }
      : baseCfg;

    // If segments mode: words change per-frame based on currentTime, so re-resolve on each draw
    const getWords = (): CaptionWord[] => {
      if (segments && segments.length > 0) {
        const t = video.currentTime;
        const seg = segments.find(s => t >= s.start - 0.001 && t < s.end + 0.001);
        return seg?.words ?? [];
      }
      return resolvedWords;
    };

    const getStyle = (): CaptionStyle => {
      if (segments && segments.length > 0) {
        const t = video.currentTime;
        const seg = segments.find(s => t >= s.start - 0.001 && t < s.end + 0.001);
        return seg?.style ?? "none";
      }
      return resolvedStyle;
    };

    const getPos = (): { h: number; v: number } => {
      if (segments && segments.length > 0) {
        const t = video.currentTime;
        const seg = segments.find(s => t >= s.start - 0.001 && t < s.end + 0.001);
        if (seg) return { h: seg.posX ?? 0, v: seg.posY ?? 0 };
      }
      return { h: resolvedPosX, v: resolvedPosY };
    };

    const draw = () => {
      const t  = video.currentTime;
      const cw = canvas.width;
      const ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);

      // In segments mode, resolve the active segment at this frame
      const frameWords = getWords();
      const frameStyle = getStyle();
      if (frameStyle === "none" || frameWords.length === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Resolve cfg for this frame's style (may differ in segment mode)
      const frameCfgBase = CFG[frameStyle] ?? cfg;
      const frameCfg = isDevanagari
        ? { ...frameCfgBase, font: F_DEVA, weight: DEVA_WEIGHT[frameStyle] ?? "700" }
        : frameCfgBase;

      const activeIdx = frameWords.findIndex(w => t >= w.start && t < w.end);
      if (activeIdx === -1) { rafRef.current = requestAnimationFrame(draw); return; }

      const active = frameWords[activeIdx]!;
      // Scale font relative to canvas width — 9:16 reference is 1080px, 16:9 is 1920px
      const baseRef  = aspectRatio === "16:9" ? 1920 : 1080;
      const fs       = fontSize * (cw / baseRef);
      const { h: frameHOffset, v: framePosOffset } = getPos();
      // hOffset is normalized -100..100: 0 = centered, -100 = full left safe edge, +100 = full right safe edge.
      const SAFE_H   = 0.85;
      const cx       = cw / 2 + (frameHOffset / 100) * (cw / 2) * SAFE_H;
      // posOffset is normalized -100..100: 0 = style default, -100 = top, +100 = bottom.
      // Interpolate across the full safe area, asymmetrically around the default.
      const SAFE_TOP = 0.06, SAFE_BOTTOM = 0.96;
      const base     = frameCfg.yRatio;
      const frac     = framePosOffset >= 0
        ? base + (framePosOffset / 100) * (SAFE_BOTTOM - base)
        : base + (framePosOffset / 100) * (base - SAFE_TOP);
      const cy       = ch * frac;

      // Window of words to display
      const windowWords = frameCfg.showAll
        ? frameStyle === "full-line"
          // Full-line: scan blocks from the start to find the one containing activeIdx
          ? (() => {
              const GAP   = 0.5;
              const MAX_W = 7;
              let s = 0;
              while (s < frameWords.length) {
                let e = s;
                while (
                  e < frameWords.length - 1 &&
                  (e - s) < MAX_W - 1 &&
                  (frameWords[e + 1]!.start - frameWords[e]!.end) < GAP
                ) e++;
                if (activeIdx >= s && activeIdx <= e) return frameWords.slice(s, e + 1);
                s = e + 1;
              }
              return [active];
            })()
          : frameWords.slice(Math.max(0, activeIdx - 2), Math.min(frameWords.length, activeIdx + 3))
        : [active];

      // Measure each word at the font size it will actually be rendered at so the
      // layout is pixel-accurate. Active words on some styles are scaled up.
      const measured = windowWords.map((w, wi) => {
        const isActive = w.start === active.start;
        let wfs = fs;
        if (frameStyle === "word-pop"      && isActive) wfs = fs * 1.5;
        if (frameStyle === "comic"         && isActive) wfs = fs * 1.2;
        if (frameStyle === "mr-beast"      && isActive) wfs = fs * 1.6;
        if (frameStyle === "stack-reveal"  && isActive) wfs = fs * 1.3;
        if (frameStyle === "shake"         && isActive) wfs = fs * 1.3;
        if (frameStyle === "gradient-pop"  && isActive) wfs = fs * 1.4;
        if (frameStyle === "solo-pop"      && isActive) wfs = fs * 1.8;
        if (frameStyle === "solo-red"      && isActive) wfs = fs * 1.8;
        if (frameStyle === "solo-glow"     && isActive) wfs = fs * 1.7;
        if (frameStyle === "solo-box"      && isActive) wfs = fs * 1.6;
        if (frameStyle === "solo-gradient" && isActive) wfs = fs * 1.8;
        if (frameStyle === "solo-shake"    && isActive) wfs = fs * 1.8;
        ctx.font = `${frameCfg.weight} ${wfs}px ${frameCfg.font}`;
        return {
          ...w,
          isActive,
          wi,
          wfs,
          width: ctx.measureText(w.word + " ").width,
        };
      });

      // Full-line: wrap words into rows that fit within 88% of canvas width
      // All words in the block render at full brightness — no active/inactive distinction
      if (frameStyle === "full-line") {
        const maxLineW = cw * 0.88;
        const lineH    = fs * 1.5;
        // Split into rows
        const rows: typeof measured[] = [];
        let row: typeof measured = [];
        let rowW = 0;
        for (const m of measured) {
          if (row.length > 0 && rowW + m.width > maxLineW) {
            rows.push(row);
            row = [];
            rowW = 0;
          }
          row.push(m);
          rowW += m.width;
        }
        if (row.length > 0) rows.push(row);

        // Draw rows centered vertically around cy
        const totalH = rows.length * lineH;
        const startY = cy - totalH / 2 + fs;

        rows.forEach((rowWords, ri) => {
          const rowTotalW = rowWords.reduce((s, m) => s + m.width, 0);
          let rx = cx - rowTotalW / 2;
          const ry = startY + ri * lineH;

          rowWords.forEach((m) => {
            if (frameCfg.outline) {
              ctx.strokeStyle = frameCfg.outline.color;
              ctx.lineWidth   = frameCfg.outline.width;
              ctx.lineJoin    = "round";
              ctx.strokeText(m.word, rx, ry);
            }
            ctx.fillStyle = frameCfg.activeColor as string;
            ctx.fillText(m.word, rx, ry);
            rx += m.width;
          });
        });

        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // ── Font Cycle: solo word, cycling font per word index (white only) ─
      if (frameStyle === "font-cycle") {
        const stSlot = ST_FONTS[activeIdx % ST_FONTS.length]!;
        const stFont  = isDevanagari ? F_DEVA : stSlot.font;
        const stW     = isDevanagari ? "400" : stSlot.weight;
        const stFs    = fs * 1.6;

        ctx.font = `${stW} ${stFs}px ${stFont}`;
        const tw = ctx.measureText(active.word).width;

        ctx.strokeStyle = "#000";
        ctx.lineWidth   = 4;
        ctx.lineJoin    = "round";
        ctx.strokeText(active.word, cx - tw / 2, cy);

        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(active.word, cx - tw / 2, cy);

        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // ── All display-stack styles (3-row unified layout) ──────────────────
      if (DISPLAY_STACK_STYLES.has(frameStyle)) {
        const prevWords = windowWords.filter(w => w.end   <= active.start);
        const nextWords = windowWords.filter(w => w.start >= active.end);
        const activeFs  = frameStyle === "gothic" ? fs * 2.4 : fs * 2.8;
        const contextFs = frameStyle === "gothic" ? fs * 1.0 : fs * 1.1;
        const rowGap    = fs * 0.2;

        let shakeX = 0, activeYOffset = 0, upYOffset = 0, downYOffset = 0;
        const tNow = Date.now();
        if (frameStyle === "stack-shake") {
          shakeX        = Math.sin(tNow / 30) * 6;
          activeYOffset = Math.cos(tNow / 40) * 3;
        }
        if (frameStyle === "stack-wave") {
          activeYOffset = Math.sin(tNow / 220) * 10;
          upYOffset     = Math.sin(tNow / 220 + 1.0) * 6;
          downYOffset   = Math.sin(tNow / 220 - 1.0) * 6;
        }

        drawThreeRowStack(ctx, frameCfg, prevWords, active.word, nextWords, cx, cy, fs, {
          activeFs, contextFs, rowGap,
          shakeX, activeYOffset, upYOffset, downYOffset,
          contextItalic: frameStyle === "word-stack",
        });
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const totalW = measured.reduce((s, m) => s + m.width, 0);
      const maxRowW = canvasW * 0.92;
      const rowScale = totalW > maxRowW ? maxRowW / totalW : 1;
      let x = cx - (totalW * rowScale) / 2;

      measured.forEach((m) => {
        const isA = m.isActive;

        // Apply row scale to keep text within canvas bounds
        const wfs = m.wfs * rowScale;
        ctx.font = `${frameCfg.weight} ${wfs}px ${frameCfg.font}`;

        // Y animation
        let drawY = cy;

        // Bounce
        if (frameStyle === "bounce" && isA) {
          const key = String(m.start);
          if (!bounceRef.current[key]) bounceRef.current[key] = Date.now();
          const el = (Date.now() - bounceRef.current[key]!) / 1000;
          drawY    = cy - Math.max(0, Math.sin(el * 14) * 24 * Math.exp(-el * 7));
        }

        // Wave — each word oscillates at slightly different phase
        if (frameStyle === "wave") {
          const phase = m.wi * 0.6;
          drawY = cy + Math.sin(Date.now() / 200 + phase) * (isA ? 12 : 6);
        }

        // Shake — rapid horizontal vibration on active word
        if ((frameStyle === "shake" || frameStyle === "solo-shake") && isA) {
          const shakeAmt = Math.sin(Date.now() / 30) * 4;
          drawY += Math.cos(Date.now() / 40) * 2;
          x += shakeAmt;
        }

        // Glitch offset
        let glitchX = 0;
        if (frameStyle === "glitch" && isA) {
          glitchX = Math.random() > 0.85 ? (Math.random() - 0.5) * 8 : 0;
        }

        const color = isA ? frameCfg.activeColor : frameCfg.inactiveColor;
        if (color === "transparent" && !frameCfg.outline) { x += m.width * rowScale; return; }

        // Background pill
        if (frameCfg.bg && isA) {
          const pad = 14;
          const bw  = ctx.measureText(m.word).width + pad * 2;
          const bh  = wfs * 1.35;
          ctx.fillStyle = frameCfg.bg;
          roundRect(ctx, x - pad, drawY - wfs, bw, bh, frameStyle === "comic" ? 4 : 10);
          ctx.fill();
        }

        // Shadow (shadow style)
        if (frameStyle === "shadow") {
          ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
        }

        // Glow
        if (frameCfg.glow && isA) {
          ctx.shadowColor = frameCfg.glow; ctx.shadowBlur = 24;
        }

        // Typewriter cursor blink
        if (frameStyle === "typewriter" && isA) {
          ctx.shadowColor = "#00FF41"; ctx.shadowBlur = 16;
        }

        // Outline / stroke
        if (frameCfg.outline) {
          ctx.strokeStyle   = frameCfg.outline.color;
          ctx.lineWidth     = frameCfg.outline.width;
          ctx.lineJoin      = "round";
          ctx.strokeText(m.word, x + glitchX, drawY);
        }

        // Glitch second layer (cyan offset)
        if (frameStyle === "glitch" && isA) {
          ctx.fillStyle = "rgba(0,255,255,0.6)";
          ctx.fillText(m.word, x + 3, drawY - 2);
        }

        // Fill color
        if (color === "gradient") {
          // Gradient per word
          const pal   = frameStyle === "gradient-gold" ? GOLD : (frameStyle === "gradient-pop" || frameStyle === "solo-gradient") ? PURPLE_POP : RAINBOW;
          const grd   = ctx.createLinearGradient(x, drawY - wfs, x + ctx.measureText(m.word).width, drawY);
          pal.forEach((c, i) => grd.addColorStop(i / (pal.length - 1), c));
          ctx.fillStyle = isA ? grd : frameCfg.inactiveColor;
        } else if (frameStyle === "outline-white" && isA) {
          // Outline-only — no fill, just stroke was applied above
          ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
          x += m.width * rowScale; return;
        } else {
          ctx.fillStyle = isA ? color : frameCfg.inactiveColor;
        }

        ctx.fillText(m.word, x + glitchX, drawY);

        // Reset
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

        x += m.width * rowScale;
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef, words, style, fontSize, posOffset, hOffset, aspectRatio, isDevanagari, segments, resolvedPosX, resolvedPosY]);

  if (resolvedStyle === "none" && (!segments || segments.length === 0)) return null;

  return (
    <canvas
      ref={canvasRef}
      width={canvasW}
      height={canvasH}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ objectFit: "contain", zIndex: 2 }}
    />
  );
}

// ── Shared 3-row display-stack helper (used by gothic, word-stack, stack-*) ──

type StackOpts = {
  activeFs?:      number;
  contextFs?:     number;
  rowGap?:        number;
  shakeX?:        number;
  activeYOffset?: number;
  upYOffset?:     number;
  downYOffset?:   number;
  contextItalic?: boolean;
};

function drawThreeRowStack(
  ctx:        CanvasRenderingContext2D,
  cfg:        { weight: string; font: string; activeColor: string | "gradient"; inactiveColor: string;
                bg: string | null; glow: string | null; outline: { color: string; width: number } | null },
  prevWords:  { word: string }[],
  activeWord: string,
  nextWords:  { word: string }[],
  cx: number, cy: number, fs: number,
  opts: StackOpts = {},
): void {
  const activeFs  = opts.activeFs      ?? fs * 2.6;
  const contextFs = opts.contextFs     ?? fs * 1.0;
  const rowGap    = opts.rowGap        ?? fs * 0.2;
  const shakeX    = opts.shakeX        ?? 0;
  const activeY   = cy + (opts.activeYOffset ?? 0);
  const upYOff    = opts.upYOffset     ?? 0;
  const downYOff  = opts.downYOffset   ?? 0;
  const italic    = opts.contextItalic ? "italic " : "";

  if (cfg.glow) { ctx.shadowColor = cfg.glow; ctx.shadowBlur = 28; }

  if (cfg.bg) {
    ctx.font = `${cfg.weight} ${activeFs}px ${cfg.font}`;
    const pw  = ctx.measureText(activeWord).width;
    const pad = 18;
    ctx.fillStyle = cfg.bg;
    roundRect(ctx, cx - pw / 2 - pad + shakeX, activeY - activeFs, pw + pad * 2, activeFs * 1.35, 8);
    ctx.fill();
  }

  ctx.font = `${cfg.weight} ${activeFs}px ${cfg.font}`;
  const atw = ctx.measureText(activeWord).width;
  if (cfg.outline) {
    ctx.strokeStyle = cfg.outline.color; ctx.lineWidth = cfg.outline.width * 1.5; ctx.lineJoin = "round";
    ctx.strokeText(activeWord, cx - atw / 2 + shakeX, activeY);
  }
  ctx.fillStyle = cfg.activeColor as string;
  ctx.fillText(activeWord, cx - atw / 2 + shakeX, activeY);
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;

  if (prevWords.length > 0) {
    const line = prevWords.map(w => w.word).join(" ");
    ctx.font = `${italic}${cfg.weight} ${contextFs}px ${cfg.font}`;
    const tw  = ctx.measureText(line).width;
    const upY = activeY - activeFs - rowGap + upYOff;
    if (cfg.outline) {
      ctx.strokeStyle = cfg.outline.color; ctx.lineWidth = cfg.outline.width * 0.7; ctx.lineJoin = "round";
      ctx.strokeText(line, cx - tw / 2, upY);
    }
    ctx.fillStyle = cfg.inactiveColor;
    ctx.fillText(line, cx - tw / 2, upY);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
  }

  if (nextWords.length > 0) {
    const line  = nextWords.map(w => w.word).join(" ");
    ctx.font = `${italic}${cfg.weight} ${contextFs}px ${cfg.font}`;
    const tw    = ctx.measureText(line).width;
    const downY = activeY + rowGap + contextFs + downYOff;
    if (cfg.outline) {
      ctx.strokeStyle = cfg.outline.color; ctx.lineWidth = cfg.outline.width * 0.7; ctx.lineJoin = "round";
      ctx.strokeText(line, cx - tw / 2, downY);
    }
    ctx.fillStyle = cfg.inactiveColor;
    ctx.fillText(line, cx - tw / 2, downY);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
  }
}

const DISPLAY_STACK_STYLES = new Set<CaptionStyle>([
  "gothic", "word-stack", "stack-shake", "stack-wave", "stack-neon", "stack-fire", "stack-comic",
  "stack-gold", "stack-sunny",
]);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
