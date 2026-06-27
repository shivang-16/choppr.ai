/**
 * Server-side caption renderer.
 * Ports the exact draw logic from caption-renderer.tsx so export frames
 * are pixel-identical to the browser preview.
 *
 * Uses @napi-rs/canvas which exposes the same Canvas 2D API as the browser.
 */

import { CAPTION_FONT_STACK } from "../utils/fonts.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CaptionStyle =
  | "none" | "full-line" | "word-pop" | "karaoke" | "bold-center" | "neon"
  | "bounce" | "subtitle" | "shadow" | "fire" | "typewriter"
  | "glitch" | "rainbow" | "outline-white" | "outline-black"
  | "highlight-box" | "wave" | "gradient-gold" | "comic"
  | "mr-beast" | "stack-reveal" | "shake" | "gradient-pop" | "clean-mid"
  | "electric-blue" | "solo-pop" | "solo-red" | "solo-glow"
  | "solo-box" | "solo-gradient" | "solo-shake";

export interface CaptionWord {
  word:  string;
  start: number; // seconds
  end:   number; // seconds
}

// Styles that need per-frame re-render (motion animations driven by time)
export const MOTION_STYLES = new Set<CaptionStyle>([
  "bounce", "wave", "shake", "solo-shake", "glitch",
]);

// ── Style config (mirror of CFG in caption-renderer.tsx) ─────────────────────

interface StyleCfg {
  weight:        string;
  activeColor:   string | "gradient";
  inactiveColor: string;
  bg:            string | null;
  showAll:       boolean;
  yRatio:        number;
  glow:          string | null;
  outline:       { color: string; width: number } | null;
}

const CFG: Record<CaptionStyle, StyleCfg> = {
  none:             { weight:"900", activeColor:"#fff",       inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.80, glow:null,       outline:null },
  "full-line":      { weight:"600", activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.45)",  bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:{color:"#000",width:2} },
  "word-pop":       { weight:"900", activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.35)",  bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:{color:"#000",width:3} },
  karaoke:          { weight:"900", activeColor:"#FFE600",    inactiveColor:"rgba(255,255,255,0.5)",   bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:{color:"#000",width:3} },
  "bold-center":    { weight:"900", activeColor:"#fff",       inactiveColor:"transparent",            bg:"rgba(0,0,0,0.65)",   showAll:false, yRatio:0.76, glow:null,       outline:null },
  neon:             { weight:"900", activeColor:"#00ff88",    inactiveColor:"rgba(255,255,255,0.3)",   bg:null,                 showAll:true,  yRatio:0.80, glow:"#00ff88",  outline:null },
  bounce:           { weight:"900", activeColor:"#fff",       inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.78, glow:null,       outline:{color:"#000",width:3} },
  subtitle:         { weight:"bold",activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.6)",   bg:"rgba(0,0,0,0.7)",    showAll:true,  yRatio:0.88, glow:null,       outline:null },
  shadow:           { weight:"900", activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.4)",   bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:null },
  fire:             { weight:"900", activeColor:"#FF4500",    inactiveColor:"rgba(255,165,0,0.5)",     bg:null,                 showAll:true,  yRatio:0.80, glow:"#FF4500",  outline:{color:"#000",width:2} },
  typewriter:       { weight:"900", activeColor:"#00FF41",    inactiveColor:"rgba(0,255,65,0.3)",      bg:"rgba(0,0,0,0.85)",   showAll:true,  yRatio:0.80, glow:"#00FF41",  outline:null },
  glitch:           { weight:"900", activeColor:"#ff00ff",    inactiveColor:"rgba(255,255,255,0.25)",  bg:null,                 showAll:true,  yRatio:0.80, glow:"#ff00ff",  outline:{color:"#00ffff",width:2} },
  rainbow:          { weight:"900", activeColor:"gradient",   inactiveColor:"rgba(255,255,255,0.35)",  bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:{color:"#000",width:2} },
  "outline-white":  { weight:"900", activeColor:"transparent",inactiveColor:"transparent",            bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:{color:"#fff",width:2} },
  "outline-black":  { weight:"900", activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.3)",   bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:{color:"#000",width:4} },
  "highlight-box":  { weight:"900", activeColor:"#000",       inactiveColor:"rgba(255,255,255,0.5)",   bg:"#FFE600",            showAll:true,  yRatio:0.80, glow:null,       outline:null },
  wave:             { weight:"900", activeColor:"#ffffff",    inactiveColor:"rgba(255,255,255,0.3)",   bg:null,                 showAll:true,  yRatio:0.82, glow:null,       outline:{color:"#000",width:3} },
  "gradient-gold":  { weight:"900", activeColor:"gradient",   inactiveColor:"rgba(255,215,0,0.3)",     bg:null,                 showAll:true,  yRatio:0.80, glow:"#FFD700",  outline:{color:"#000",width:2} },
  comic:            { weight:"900", activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.4)",   bg:"rgba(30,30,200,0.85)",showAll:false, yRatio:0.78, glow:null,       outline:{color:"#000",width:4} },
  "mr-beast":       { weight:"900", activeColor:"#FF0000",    inactiveColor:"rgba(255,255,255,1.0)",   bg:null,                 showAll:true,  yRatio:0.50, glow:null,       outline:{color:"#000",width:6} },
  "stack-reveal":   { weight:"900", activeColor:"#fff",       inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.45, glow:null,       outline:{color:"#000",width:4} },
  shake:            { weight:"900", activeColor:"#FF3333",    inactiveColor:"rgba(255,255,255,0.8)",   bg:null,                 showAll:true,  yRatio:0.50, glow:null,       outline:{color:"#000",width:4} },
  "gradient-pop":   { weight:"900", activeColor:"gradient",   inactiveColor:"rgba(255,255,255,0.3)",   bg:null,                 showAll:true,  yRatio:0.50, glow:"#A855F7",  outline:{color:"#000",width:3} },
  "clean-mid":      { weight:"900", activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.5)",   bg:"rgba(0,0,0,0.5)",    showAll:true,  yRatio:0.50, glow:null,       outline:null },
  "electric-blue":  { weight:"900", activeColor:"#00D4FF",    inactiveColor:"rgba(255,255,255,0.4)",   bg:null,                 showAll:true,  yRatio:0.50, glow:"#00D4FF",  outline:{color:"#000",width:3} },
  "solo-pop":       { weight:"900", activeColor:"#fff",       inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.50, glow:null,       outline:{color:"#000",width:5} },
  "solo-red":       { weight:"900", activeColor:"#FF2D2D",    inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.50, glow:"#FF2D2D",  outline:{color:"#000",width:5} },
  "solo-glow":      { weight:"900", activeColor:"#00FF88",    inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.50, glow:"#00FF88",  outline:{color:"#000",width:4} },
  "solo-box":       { weight:"900", activeColor:"#000",       inactiveColor:"transparent",            bg:"#FFE600",            showAll:false, yRatio:0.50, glow:null,       outline:null },
  "solo-gradient":  { weight:"900", activeColor:"gradient",   inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.50, glow:"#A855F7",  outline:{color:"#000",width:4} },
  "solo-shake":     { weight:"900", activeColor:"#fff",       inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.50, glow:null,       outline:{color:"#FF0000",width:5} },
};

// Gradient palettes
const RAINBOW    = ["#FF0000","#FF7F00","#FFFF00","#00FF00","#0000FF","#8B00FF"];
const GOLD       = ["#FFD700","#FFA500","#FFD700","#FFFACD","#FFD700"];
const PURPLE_POP = ["#A855F7","#EC4899","#F97316","#EAB308","#A855F7"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
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

// ── Main render function ──────────────────────────────────────────────────────

/**
 * Render one caption frame onto `ctx` at `timeMs` milliseconds.
 *
 * `bounceStart` is a mutable map keyed by word start time (string) storing the
 * timestamp (ms) when the bounce animation began — persisted across frames.
 */
export function renderCaptionFrame(
  ctx:         any,           // SKRSContext2D from @napi-rs/canvas
  canvasW:     number,
  canvasH:     number,
  words:       CaptionWord[],
  style:       CaptionStyle,
  timeMs:      number,        // current time in milliseconds
  fontSize:    number,        // logical font size (default 28)
  bounceStart: Record<string, number>, // mutable, keyed by word.start string
  posOffset:   number = 0,    // vertical offset in % of height (- = up, + = down)
): void {
  if (style === "none" || words.length === 0) return;

  const cfg = CFG[style] ?? CFG["bold-center"];
  const t   = timeMs / 1000; // seconds

  const activeIdx = words.findIndex(w => t >= w.start && t < w.end);
  if (activeIdx === -1) return;

  const active  = words[activeIdx]!;
  // Match the browser preview exactly: baseRef is 1920 for 16:9, else 1080.
  // This keeps fs == fontSize for every supported aspect ratio.
  const baseRef = canvasW >= 1920 ? 1920 : 1080;
  const fs      = fontSize * (canvasW / baseRef);
  const cx      = canvasW / 2;
  // posOffset is normalized -100..100: 0 = style default, -100 = top, +100 = bottom.
  const SAFE_TOP = 0.06, SAFE_BOTTOM = 0.96;
  const base     = cfg.yRatio;
  const frac     = posOffset >= 0
    ? base + (posOffset / 100) * (SAFE_BOTTOM - base)
    : base + (posOffset / 100) * (base - SAFE_TOP);
  const cy       = canvasH * frac;

  const windowWords = cfg.showAll
    ? style === "full-line"
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

  ctx.font = `${cfg.weight} ${fs}px ${CAPTION_FONT_STACK}`;

  const measured = windowWords.map((w, wi) => ({
    ...w,
    isActive: w.start === active.start,
    wi,
    width: ctx.measureText(w.word + " ").width,
  }));

  // Full-line: wrap words into rows fitting within 88% of canvas width
  // All words in the block render at full brightness — no active/inactive distinction
  if (style === "full-line") {
    const maxLineW = canvasW * 0.88;
    const lineH    = fs * 1.5;
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

    const totalH = rows.length * lineH;
    const startY = cy - totalH / 2 + fs;

    for (let ri = 0; ri < rows.length; ri++) {
      const rowWords = rows[ri]!;
      const rowTotalW = rowWords.reduce((s, m) => s + m.width, 0);
      let rx = cx - rowTotalW / 2;
      const ry = startY + ri * lineH;

      for (const m of rowWords) {
        if (cfg.outline) {
          ctx.strokeStyle = cfg.outline.color;
          ctx.lineWidth   = cfg.outline.width;
          ctx.lineJoin    = "round";
          ctx.strokeText(m.word, rx, ry);
        }
        ctx.fillStyle = cfg.activeColor as string;
        ctx.fillText(m.word, rx, ry);
        ctx.shadowColor   = "transparent";
        ctx.shadowBlur    = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        rx += m.width;
      }
    }
    return;
  }

  const totalW = measured.reduce((s, m) => s + m.width, 0);
  let x = cx - totalW / 2;

  for (const m of measured) {
    const isA = m.isActive;

    // Per-style font size scale on active word
    let wfs = fs;
    if (style === "word-pop"      && isA) wfs = fs * 1.5;
    if (style === "comic"         && isA) wfs = fs * 1.2;
    if (style === "mr-beast"      && isA) wfs = fs * 1.6;
    if (style === "stack-reveal"  && isA) wfs = fs * 1.3;
    if (style === "shake"         && isA) wfs = fs * 1.3;
    if (style === "gradient-pop"  && isA) wfs = fs * 1.4;
    if (style === "solo-pop"      && isA) wfs = fs * 1.8;
    if (style === "solo-red"      && isA) wfs = fs * 1.8;
    if (style === "solo-glow"     && isA) wfs = fs * 1.7;
    if (style === "solo-box"      && isA) wfs = fs * 1.6;
    if (style === "solo-gradient" && isA) wfs = fs * 1.8;
    if (style === "solo-shake"    && isA) wfs = fs * 1.8;
    ctx.font = `${cfg.weight} ${wfs}px ${CAPTION_FONT_STACK}`;

    // Y animation
    let drawY = cy;

    // Bounce — spring decay from word start time
    if (style === "bounce" && isA) {
      const key = String(m.start);
      if (!bounceStart[key]) bounceStart[key] = timeMs;
      const el = (timeMs - bounceStart[key]!) / 1000;
      drawY = cy - Math.max(0, Math.sin(el * 14) * 24 * Math.exp(-el * 7));
    }

    // Wave — continuous oscillation per word position
    if (style === "wave") {
      const phase = m.wi * 0.6;
      drawY = cy + Math.sin(timeMs / 200 + phase) * (isA ? 12 : 6);
    }

    // Shake — rapid X/Y vibration on active word
    let shakeX = 0;
    if ((style === "shake" || style === "solo-shake") && isA) {
      shakeX = Math.sin(timeMs / 30) * 4;
      drawY  += Math.cos(timeMs / 40) * 2;
    }

    // Glitch — random horizontal jitter + cyan offset layer
    let glitchX = 0;
    if (style === "glitch" && isA) {
      glitchX = Math.random() > 0.85 ? (Math.random() - 0.5) * 8 : 0;
    }

    const color = isA ? cfg.activeColor : cfg.inactiveColor;
    if (color === "transparent" && !cfg.outline) { x += m.width; continue; }

    // Background pill (active word only)
    if (cfg.bg && isA) {
      const pad = 14;
      const bw  = ctx.measureText(m.word).width + pad * 2;
      const bh  = wfs * 1.35;
      ctx.fillStyle = cfg.bg;
      roundRect(ctx, x - pad, drawY - wfs, bw, bh, style === "comic" ? 4 : 10);
      ctx.fill();
    }

    // Shadow style: heavy drop shadow
    if (style === "shadow") {
      ctx.shadowColor   = "rgba(0,0,0,0.95)";
      ctx.shadowBlur    = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
    }

    // Glow
    if (cfg.glow && isA) {
      ctx.shadowColor = cfg.glow;
      ctx.shadowBlur  = 24;
    }

    // Typewriter cursor glow
    if (style === "typewriter" && isA) {
      ctx.shadowColor = "#00FF41";
      ctx.shadowBlur  = 16;
    }

    // Outline / stroke
    if (cfg.outline) {
      ctx.strokeStyle = cfg.outline.color;
      ctx.lineWidth   = cfg.outline.width;
      ctx.lineJoin    = "round";
      ctx.strokeText(m.word, x + shakeX + glitchX, drawY);
    }

    // Glitch: cyan offset layer
    if (style === "glitch" && isA) {
      ctx.fillStyle = "rgba(0,255,255,0.6)";
      ctx.fillText(m.word, x + shakeX + 3, drawY - 2);
    }

    // Fill
    if (color === "gradient") {
      const pal = style === "gradient-gold"
        ? GOLD
        : (style === "gradient-pop" || style === "solo-gradient")
        ? PURPLE_POP
        : RAINBOW;
      const grd = ctx.createLinearGradient(
        x, drawY - wfs,
        x + ctx.measureText(m.word).width, drawY,
      );
      pal.forEach((c, i) => grd.addColorStop(i / (pal.length - 1), c));
      ctx.fillStyle = isA ? grd : cfg.inactiveColor;
    } else if (style === "outline-white" && isA) {
      // Stroke-only: skip fill, reset shadow
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
      x += m.width;
      continue;
    } else {
      ctx.fillStyle = isA ? (color as string) : cfg.inactiveColor;
    }

    ctx.fillText(m.word, x + shakeX + glitchX, drawY);

    // Reset canvas shadow state for next word
    ctx.shadowColor   = "transparent";
    ctx.shadowBlur    = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    x += m.width;
  }
}
