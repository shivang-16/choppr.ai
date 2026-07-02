"use client";

import { useEffect, useRef } from "react";

// Google Fonts loaded via a <link> injected once — provides the display fonts
// that match the server-side TTFs in assets/fonts/.
const GFONTS_URL =
  "https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Bebas+Neue&family=Nunito:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&family=Oswald:wght@400;700;900&family=Permanent+Marker&family=Press+Start+2P&family=Space+Grotesk:wght@400;700;900&family=UnifrakturCook:wght@700&display=swap";

function ensureGFontsLoaded() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-choppr-fonts]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = GFONTS_URL;
  link.setAttribute("data-choppr-fonts", "1");
  document.head.appendChild(link);
}

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
  | "stack-gold" | "stack-sunny";

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
}

// ── Per-style font families (match server-side assets/fonts TTFs) ─────────────
const F_DEFAULT = `system-ui,-apple-system,sans-serif`;       // Noto on server
const F_ANTON   = `"Anton",${F_DEFAULT}`;                      // condensed impact
const F_BANGERS = `"Bangers",${F_DEFAULT}`;                    // comic-book
const F_OSWALD  = `"Oswald",${F_DEFAULT}`;                     // condensed grotesque
const F_BEBAS   = `"Bebas Neue",${F_DEFAULT}`;                 // tall condensed
const F_MARKER  = `"Permanent Marker",${F_DEFAULT}`;           // hand-written
const F_PIXEL   = `"Press Start 2P",${F_DEFAULT}`;             // retro pixel
const F_SPACE   = `"Space Grotesk",${F_DEFAULT}`;              // geometric modern
const F_GOTHIC  = `"UnifrakturCook",${F_DEFAULT}`;             // gothic blackletter
const F_NUNITO  = `"Nunito",${F_DEFAULT}`;                     // rounded bold

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
  none:            { weight:"900", font:F_DEFAULT, activeColor:"#fff",      inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.80, glow:null,        outline:null },
  subtitle:        { weight:"bold",font:F_DEFAULT, activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.6)",  bg:"rgba(0,0,0,0.7)",   showAll:true,  yRatio:0.88, glow:null,        outline:null },
  "full-line":     { weight:"600", font:F_DEFAULT, activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.45)", bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:2} },
  shadow:          { weight:"900", font:F_DEFAULT, activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.4)",  bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:null },
  "clean-mid":     { weight:"900", font:F_SPACE,   activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.5)",  bg:"rgba(0,0,0,0.5)",   showAll:true,  yRatio:0.50, glow:null,        outline:null },

  // ── Anton (condensed impact) ──────────────────────────────────────────────
  "word-pop":      { weight:"900", font:F_ANTON,   activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.35)", bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:3} },
  "bold-center":   { weight:"900", font:F_ANTON,   activeColor:"#fff",      inactiveColor:"transparent",           bg:"rgba(0,0,0,0.65)",  showAll:false, yRatio:0.76, glow:null,        outline:null },
  bounce:          { weight:"900", font:F_ANTON,   activeColor:"#fff",      inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.78, glow:null,        outline:{color:"#000",width:3} },
  "solo-pop":      { weight:"900", font:F_ANTON,   activeColor:"#fff",      inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.50, glow:null,        outline:{color:"#000",width:5} },
  "solo-red":      { weight:"900", font:F_ANTON,   activeColor:"#FF2D2D",   inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.50, glow:"#FF2D2D",   outline:{color:"#000",width:5} },

  // ── Oswald (condensed grotesque) ──────────────────────────────────────────
  "mr-beast":      { weight:"900", font:F_OSWALD,  activeColor:"#FF0000",   inactiveColor:"rgba(255,255,255,1.0)",  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:6} },
  "stack-reveal":  { weight:"900", font:F_OSWALD,  activeColor:"#fff",      inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.45, glow:null,        outline:{color:"#000",width:4} },
  shake:           { weight:"900", font:F_OSWALD,  activeColor:"#FF3333",   inactiveColor:"rgba(255,255,255,0.8)",  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:4} },
  "solo-shake":    { weight:"900", font:F_OSWALD,  activeColor:"#fff",      inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.50, glow:null,        outline:{color:"#FF0000",width:5} },
  fire:            { weight:"900", font:F_OSWALD,  activeColor:"#FF4500",   inactiveColor:"rgba(255,165,0,0.5)",    bg:null,                showAll:true,  yRatio:0.80, glow:"#FF4500",   outline:{color:"#000",width:2} },
  "gradient-gold": { weight:"900", font:F_OSWALD,  activeColor:"gradient",  inactiveColor:"rgba(255,215,0,0.3)",    bg:null,                showAll:true,  yRatio:0.80, glow:"#FFD700",   outline:{color:"#000",width:2} },

  // ── Bangers (comic-book) ──────────────────────────────────────────────────
  comic:           { weight:"900", font:F_BANGERS, activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.4)",  bg:"rgba(30,30,200,0.85)",showAll:false,yRatio:0.78, glow:null,       outline:{color:"#000",width:4} },
  rainbow:         { weight:"900", font:F_BANGERS, activeColor:"gradient",  inactiveColor:"rgba(255,255,255,0.35)", bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:2} },
  "highlight-box": { weight:"900", font:F_BANGERS, activeColor:"#000",      inactiveColor:"rgba(255,255,255,0.5)",  bg:"#FFE600",           showAll:true,  yRatio:0.80, glow:null,        outline:null },

  // ── Bebas Neue (tall condensed / glow) ────────────────────────────────────
  neon:            { weight:"900", font:F_BEBAS,   activeColor:"#00ff88",   inactiveColor:"rgba(255,255,255,0.3)",  bg:null,                showAll:true,  yRatio:0.80, glow:"#00ff88",   outline:null },
  "electric-blue": { weight:"900", font:F_BEBAS,   activeColor:"#00D4FF",   inactiveColor:"rgba(255,255,255,0.4)",  bg:null,                showAll:true,  yRatio:0.50, glow:"#00D4FF",   outline:{color:"#000",width:3} },
  "solo-glow":     { weight:"900", font:F_BEBAS,   activeColor:"#00FF88",   inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.50, glow:"#00FF88",   outline:{color:"#000",width:4} },
  "gradient-pop":  { weight:"900", font:F_BEBAS,   activeColor:"gradient",  inactiveColor:"rgba(255,255,255,0.3)",  bg:null,                showAll:true,  yRatio:0.50, glow:"#A855F7",   outline:{color:"#000",width:3} },
  "solo-gradient": { weight:"900", font:F_BEBAS,   activeColor:"gradient",  inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.50, glow:"#A855F7",   outline:{color:"#000",width:4} },

  // ── Permanent Marker (hand-written) ───────────────────────────────────────
  karaoke:         { weight:"900", font:F_MARKER,  activeColor:"#FFE600",   inactiveColor:"rgba(255,255,255,0.5)",  bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:3} },
  wave:            { weight:"900", font:F_MARKER,  activeColor:"#ffffff",   inactiveColor:"rgba(255,255,255,0.3)",  bg:null,                showAll:true,  yRatio:0.82, glow:null,        outline:{color:"#000",width:3} },

  // ── Press Start 2P (pixel / retro) ────────────────────────────────────────
  typewriter:      { weight:"900", font:F_PIXEL,   activeColor:"#00FF41",   inactiveColor:"rgba(0,255,65,0.3)",     bg:"rgba(0,0,0,0.85)",  showAll:true,  yRatio:0.80, glow:"#00FF41",   outline:null },
  glitch:          { weight:"900", font:F_PIXEL,   activeColor:"#ff00ff",   inactiveColor:"rgba(255,255,255,0.25)", bg:null,                showAll:true,  yRatio:0.80, glow:"#ff00ff",   outline:{color:"#00ffff",width:2} },

  // ── Space Grotesk (geometric modern) ─────────────────────────────────────
  "outline-white": { weight:"900", font:F_SPACE,   activeColor:"transparent",inactiveColor:"transparent",          bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#fff",width:2} },
  "outline-black": { weight:"900", font:F_SPACE,   activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.3)",  bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:4} },
  "solo-box":      { weight:"900", font:F_SPACE,   activeColor:"#000",      inactiveColor:"transparent",           bg:"#FFE600",           showAll:false, yRatio:0.50, glow:null,        outline:null },

  // ── UnifrakturCook (gothic blackletter — stacked) ─────────────────────────
  gothic:          { weight:"900", font:F_GOTHIC,  activeColor:"#fff",      inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:3} },

  // ── Nunito (rounded bold — vertical word-stack) ───────────────────────────
  "word-stack":    { weight:"900", font:F_NUNITO,  activeColor:"#fff",      inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:4} },

  // ── Display stack variants (animated 3-row) ───────────────────────────────
  "stack-shake":   { weight:"900", font:F_OSWALD,  activeColor:"#FF3333",   inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:5} },
  "stack-wave":    { weight:"900", font:F_MARKER,  activeColor:"#fff",      inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:3} },
  "stack-neon":    { weight:"900", font:F_BEBAS,   activeColor:"#00FF88",   inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:"#00FF88",   outline:null },
  "stack-fire":    { weight:"900", font:F_ANTON,   activeColor:"#FF4500",   inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:"#FF4500",   outline:{color:"#000",width:3} },
  "stack-comic":   { weight:"900", font:F_BANGERS, activeColor:"#fff",      inactiveColor:"#fff",                  bg:"rgba(20,20,200,0.9)",showAll:true, yRatio:0.50, glow:null,        outline:{color:"#000",width:3} },
  "stack-gold":    { weight:"900", font:F_OSWALD,  activeColor:"#FFD700",   inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:"#FFD700",   outline:{color:"#000",width:3} },
  "stack-sunny":   { weight:"900", font:F_ANTON,   activeColor:"#FFE600",   inactiveColor:"#fff",                  bg:null,                showAll:true,  yRatio:0.50, glow:null,        outline:{color:"#000",width:5} },
};

// Rainbow colors cycle
const RAINBOW = ["#FF0000","#FF7F00","#FFFF00","#00FF00","#0000FF","#8B00FF"];
// Gold gradient stops
const GOLD    = ["#FFD700","#FFA500","#FFD700","#FFFACD","#FFD700"];
// Purple-pink gradient for gradient-pop
const PURPLE_POP = ["#A855F7","#EC4899","#F97316","#EAB308","#A855F7"];

export default function CaptionRenderer({ videoRef, words, style, fontSize = 50, aspectRatio = "9:16", posOffset = 0, hOffset = 0 }: Props) {
  ensureGFontsLoaded();
  const canvasW = aspectRatio === "16:9" ? 1920 : 1080;
  const canvasH = aspectRatio === "16:9" ? 1080 : aspectRatio === "1:1" ? 1080 : 1920;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef(0);
  const bounceRef = useRef<Record<string, number>>({});
  const waveRef   = useRef<Record<string, number>>({});

  useEffect(() => {
    if (style === "none") return;
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cfg = CFG[style];

    const draw = () => {
      const t  = video.currentTime;
      const cw = canvas.width;
      const ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);

      const activeIdx = words.findIndex(w => t >= w.start && t < w.end);
      if (activeIdx === -1) { rafRef.current = requestAnimationFrame(draw); return; }

      const active = words[activeIdx]!;
      // Scale font relative to canvas width — 9:16 reference is 1080px, 16:9 is 1920px
      const baseRef  = aspectRatio === "16:9" ? 1920 : 1080;
      const fs       = fontSize * (cw / baseRef);
      // hOffset is normalized -100..100: 0 = centered, -100 = full left safe edge, +100 = full right safe edge.
      const SAFE_H   = 0.85;
      const cx       = cw / 2 + (hOffset / 100) * (cw / 2) * SAFE_H;
      // posOffset is normalized -100..100: 0 = style default, -100 = top, +100 = bottom.
      // Interpolate across the full safe area, asymmetrically around the default.
      const SAFE_TOP = 0.06, SAFE_BOTTOM = 0.96;
      const base     = cfg.yRatio;
      const frac     = posOffset >= 0
        ? base + (posOffset / 100) * (SAFE_BOTTOM - base)
        : base + (posOffset / 100) * (base - SAFE_TOP);
      const cy       = ch * frac;

      // Window of words to display
      const windowWords = cfg.showAll
        ? style === "full-line"
          // Full-line: scan blocks from the start to find the one containing activeIdx
          ? (() => {
              const GAP   = 0.5;
              const MAX_W = 7;
              let s = 0;
              while (s < words.length) {
                let e = s;
                while (
                  e < words.length - 1 &&
                  (e - s) < MAX_W - 1 &&
                  (words[e + 1]!.start - words[e]!.end) < GAP
                ) e++;
                if (activeIdx >= s && activeIdx <= e) return words.slice(s, e + 1);
                s = e + 1;
              }
              return [active];
            })()
          : words.slice(Math.max(0, activeIdx - 2), Math.min(words.length, activeIdx + 3))
        : [active];

      // Measure each word at the font size it will actually be rendered at so the
      // layout is pixel-accurate. Active words on some styles are scaled up.
      const measured = windowWords.map((w, wi) => {
        const isActive = w.start === active.start;
        let wfs = fs;
        if (style === "word-pop"      && isActive) wfs = fs * 1.5;
        if (style === "comic"         && isActive) wfs = fs * 1.2;
        if (style === "mr-beast"      && isActive) wfs = fs * 1.6;
        if (style === "stack-reveal"  && isActive) wfs = fs * 1.3;
        if (style === "shake"         && isActive) wfs = fs * 1.3;
        if (style === "gradient-pop"  && isActive) wfs = fs * 1.4;
        if (style === "solo-pop"      && isActive) wfs = fs * 1.8;
        if (style === "solo-red"      && isActive) wfs = fs * 1.8;
        if (style === "solo-glow"     && isActive) wfs = fs * 1.7;
        if (style === "solo-box"      && isActive) wfs = fs * 1.6;
        if (style === "solo-gradient" && isActive) wfs = fs * 1.8;
        if (style === "solo-shake"    && isActive) wfs = fs * 1.8;
        ctx.font = `${cfg.weight} ${wfs}px ${cfg.font}`;
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
      if (style === "full-line") {
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
            if (cfg.outline) {
              ctx.strokeStyle = cfg.outline.color;
              ctx.lineWidth   = cfg.outline.width;
              ctx.lineJoin    = "round";
              ctx.strokeText(m.word, rx, ry);
            }
            ctx.fillStyle = cfg.activeColor as string;
            ctx.fillText(m.word, rx, ry);
            rx += m.width;
          });
        });

        rafRef.current = requestAnimationFrame(draw);
        return;
      }


      // ── All display-stack styles (3-row unified layout) ──────────────────
      if (DISPLAY_STACK_STYLES.has(style)) {
        const prevWords = windowWords.filter(w => w.end   <= active.start);
        const nextWords = windowWords.filter(w => w.start >= active.end);
        const activeFs  = style === "gothic" ? fs * 2.4 : fs * 2.8;
        const contextFs = style === "gothic" ? fs * 1.0 : fs * 1.1;
        const rowGap    = fs * 0.2;

        let shakeX = 0, activeYOffset = 0, upYOffset = 0, downYOffset = 0;
        const t = Date.now();
        if (style === "stack-shake") {
          shakeX        = Math.sin(t / 30) * 6;
          activeYOffset = Math.cos(t / 40) * 3;
        }
        if (style === "stack-wave") {
          activeYOffset = Math.sin(t / 220) * 10;
          upYOffset     = Math.sin(t / 220 + 1.0) * 6;
          downYOffset   = Math.sin(t / 220 - 1.0) * 6;
        }

        drawThreeRowStack(ctx, cfg, prevWords, active.word, nextWords, cx, cy, fs, {
          activeFs, contextFs, rowGap,
          shakeX, activeYOffset, upYOffset, downYOffset,
          contextItalic: style === "word-stack",
        });
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const totalW = measured.reduce((s, m) => s + m.width, 0);
      let x = cx - totalW / 2;

      measured.forEach((m) => {
        const isA = m.isActive;

        // wfs is pre-computed during measurement so layout and render use the same size
        const wfs = m.wfs;
        ctx.font = `${cfg.weight} ${wfs}px ${cfg.font}`;

        // Y animation
        let drawY = cy;

        // Bounce
        if (style === "bounce" && isA) {
          const key = String(m.start);
          if (!bounceRef.current[key]) bounceRef.current[key] = Date.now();
          const el = (Date.now() - bounceRef.current[key]!) / 1000;
          drawY    = cy - Math.max(0, Math.sin(el * 14) * 24 * Math.exp(-el * 7));
        }

        // Wave — each word oscillates at slightly different phase
        if (style === "wave") {
          const phase = m.wi * 0.6;
          drawY = cy + Math.sin(Date.now() / 200 + phase) * (isA ? 12 : 6);
        }

        // Shake — rapid horizontal vibration on active word
        if ((style === "shake" || style === "solo-shake") && isA) {
          const shakeAmt = Math.sin(Date.now() / 30) * 4;
          drawY += Math.cos(Date.now() / 40) * 2;
          x += shakeAmt;
        }

        // Glitch offset
        let glitchX = 0;
        if (style === "glitch" && isA) {
          glitchX = Math.random() > 0.85 ? (Math.random() - 0.5) * 8 : 0;
        }

        const color = isA ? cfg.activeColor : cfg.inactiveColor;
        if (color === "transparent" && !cfg.outline) { x += m.width; return; }

        // Background pill
        if (cfg.bg && isA) {
          const pad = 14;
          const bw  = ctx.measureText(m.word).width + pad * 2;
          const bh  = wfs * 1.35;
          ctx.fillStyle = cfg.bg;
          roundRect(ctx, x - pad, drawY - wfs, bw, bh, style === "comic" ? 4 : 10);
          ctx.fill();
        }

        // Shadow (shadow style)
        if (style === "shadow") {
          ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
        }

        // Glow
        if (cfg.glow && isA) {
          ctx.shadowColor = cfg.glow; ctx.shadowBlur = 24;
        }

        // Typewriter cursor blink
        if (style === "typewriter" && isA) {
          ctx.shadowColor = "#00FF41"; ctx.shadowBlur = 16;
        }

        // Outline / stroke
        if (cfg.outline) {
          ctx.strokeStyle   = cfg.outline.color;
          ctx.lineWidth     = cfg.outline.width;
          ctx.lineJoin      = "round";
          ctx.strokeText(m.word, x + glitchX, drawY);
        }

        // Glitch second layer (cyan offset)
        if (style === "glitch" && isA) {
          ctx.fillStyle = "rgba(0,255,255,0.6)";
          ctx.fillText(m.word, x + 3, drawY - 2);
        }

        // Fill color
        if (color === "gradient") {
          // Gradient per word
          const pal   = style === "gradient-gold" ? GOLD : (style === "gradient-pop" || style === "solo-gradient") ? PURPLE_POP : RAINBOW;
          const grd   = ctx.createLinearGradient(x, drawY - wfs, x + ctx.measureText(m.word).width, drawY);
          pal.forEach((c, i) => grd.addColorStop(i / (pal.length - 1), c));
          ctx.fillStyle = isA ? grd : cfg.inactiveColor;
        } else if (style === "outline-white" && isA) {
          // Outline-only — no fill, just stroke was applied above
          ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
          x += m.width; return;
        } else {
          ctx.fillStyle = isA ? color : cfg.inactiveColor;
        }

        ctx.fillText(m.word, x + glitchX, drawY);

        // Reset
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

        x += m.width;
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef, words, style, fontSize, posOffset, hOffset, aspectRatio]);

  if (style === "none") return null;

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
