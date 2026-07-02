/**
 * Server-side caption renderer.
 * Ports the exact draw logic from caption-renderer.tsx so export frames
 * are pixel-identical to the browser preview.
 *
 * Uses @napi-rs/canvas which exposes the same Canvas 2D API as the browser.
 */

import {
  CAPTION_FONT_STACK,
  FONT_ANTON,
  FONT_BANGERS,
  FONT_OSWALD,
  FONT_BEBAS,
  FONT_MARKER,
  FONT_PIXEL,
  FONT_SPACE,
  FONT_GOTHIC,
  FONT_NUNITO,
} from "../utils/fonts.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CaptionStyle =
  | "none" | "full-line" | "word-pop" | "karaoke" | "bold-center" | "neon"
  | "bounce" | "subtitle" | "shadow" | "fire" | "typewriter"
  | "glitch" | "rainbow" | "outline-white" | "outline-black"
  | "highlight-box" | "wave" | "gradient-gold" | "comic"
  | "mr-beast" | "stack-reveal" | "shake" | "gradient-pop" | "clean-mid"
  | "electric-blue" | "solo-pop" | "solo-red" | "solo-glow"
  | "solo-box" | "solo-gradient" | "solo-shake"
  | "gothic" | "word-stack"
  | "stack-shake" | "stack-wave" | "stack-neon" | "stack-fire" | "stack-comic"
  | "stack-gold" | "stack-sunny";

export interface CaptionWord {
  word:  string;
  start: number; // seconds
  end:   number; // seconds
}

// Styles that need per-frame re-render (motion animations driven by time)
export const MOTION_STYLES = new Set<CaptionStyle>([
  "bounce", "wave", "shake", "solo-shake", "glitch", "stack-shake", "stack-wave",
]);

// ── Style config (mirror of CFG in caption-renderer.tsx) ─────────────────────

interface StyleCfg {
  weight:        string;
  font:          string; // CSS font-family stack for this style
  activeColor:   string | "gradient";
  inactiveColor: string;
  bg:            string | null;
  showAll:       boolean;
  yRatio:        number;
  glow:          string | null;
  outline:       { color: string; width: number } | null;
}

const CFG: Record<CaptionStyle, StyleCfg> = {
  // ── Font: default Noto Sans ────────────────────────────────────────────────
  none:             { weight:"900", font:CAPTION_FONT_STACK, activeColor:"#fff",       inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.80, glow:null,       outline:null },
  subtitle:         { weight:"bold",font:CAPTION_FONT_STACK, activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.6)",   bg:"rgba(0,0,0,0.7)",    showAll:true,  yRatio:0.88, glow:null,       outline:null },
  "full-line":      { weight:"600", font:CAPTION_FONT_STACK, activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.45)",  bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:{color:"#000",width:2} },
  shadow:           { weight:"900", font:CAPTION_FONT_STACK, activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.4)",   bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:null },
  "clean-mid":      { weight:"900", font:FONT_SPACE,         activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.5)",   bg:"rgba(0,0,0,0.5)",    showAll:true,  yRatio:0.50, glow:null,       outline:null },

  // ── Font: Anton (condensed impact) ────────────────────────────────────────
  "word-pop":       { weight:"900", font:FONT_ANTON,         activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.35)",  bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:{color:"#000",width:3} },
  "bold-center":    { weight:"900", font:FONT_ANTON,         activeColor:"#fff",       inactiveColor:"transparent",            bg:"rgba(0,0,0,0.65)",   showAll:false, yRatio:0.76, glow:null,       outline:null },
  bounce:           { weight:"900", font:FONT_ANTON,         activeColor:"#fff",       inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.78, glow:null,       outline:{color:"#000",width:3} },
  "solo-pop":       { weight:"900", font:FONT_ANTON,         activeColor:"#fff",       inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.50, glow:null,       outline:{color:"#000",width:5} },
  "solo-red":       { weight:"900", font:FONT_ANTON,         activeColor:"#FF2D2D",    inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.50, glow:"#FF2D2D",  outline:{color:"#000",width:5} },

  // ── Font: Oswald (condensed grotesque — Mr Beast / stack styles) ──────────
  "mr-beast":       { weight:"900", font:FONT_OSWALD,        activeColor:"#FF0000",    inactiveColor:"rgba(255,255,255,1.0)",   bg:null,                 showAll:true,  yRatio:0.50, glow:null,       outline:{color:"#000",width:6} },
  "stack-reveal":   { weight:"900", font:FONT_OSWALD,        activeColor:"#fff",       inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.45, glow:null,       outline:{color:"#000",width:4} },
  shake:            { weight:"900", font:FONT_OSWALD,        activeColor:"#FF3333",    inactiveColor:"rgba(255,255,255,0.8)",   bg:null,                 showAll:true,  yRatio:0.50, glow:null,       outline:{color:"#000",width:4} },
  "solo-shake":     { weight:"900", font:FONT_OSWALD,        activeColor:"#fff",       inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.50, glow:null,       outline:{color:"#FF0000",width:5} },

  // ── Font: Bangers (comic-book) ─────────────────────────────────────────────
  comic:            { weight:"900", font:FONT_BANGERS,       activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.4)",   bg:"rgba(30,30,200,0.85)",showAll:false, yRatio:0.78, glow:null,       outline:{color:"#000",width:4} },
  rainbow:          { weight:"900", font:FONT_BANGERS,       activeColor:"gradient",   inactiveColor:"rgba(255,255,255,0.35)",  bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:{color:"#000",width:2} },
  "highlight-box":  { weight:"900", font:FONT_BANGERS,       activeColor:"#000",       inactiveColor:"rgba(255,255,255,0.5)",   bg:"#FFE600",            showAll:true,  yRatio:0.80, glow:null,       outline:null },

  // ── Font: Bebas Neue (tall condensed — neon / glow styles) ────────────────
  neon:             { weight:"900", font:FONT_BEBAS,         activeColor:"#00ff88",    inactiveColor:"rgba(255,255,255,0.3)",   bg:null,                 showAll:true,  yRatio:0.80, glow:"#00ff88",  outline:null },
  "electric-blue":  { weight:"900", font:FONT_BEBAS,         activeColor:"#00D4FF",    inactiveColor:"rgba(255,255,255,0.4)",   bg:null,                 showAll:true,  yRatio:0.50, glow:"#00D4FF",  outline:{color:"#000",width:3} },
  "solo-glow":      { weight:"900", font:FONT_BEBAS,         activeColor:"#00FF88",    inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.50, glow:"#00FF88",  outline:{color:"#000",width:4} },
  "gradient-pop":   { weight:"900", font:FONT_BEBAS,         activeColor:"gradient",   inactiveColor:"rgba(255,255,255,0.3)",   bg:null,                 showAll:true,  yRatio:0.50, glow:"#A855F7",  outline:{color:"#000",width:3} },
  "solo-gradient":  { weight:"900", font:FONT_BEBAS,         activeColor:"gradient",   inactiveColor:"transparent",            bg:null,                 showAll:false, yRatio:0.50, glow:"#A855F7",  outline:{color:"#000",width:4} },

  // ── Font: Permanent Marker (hand-written) ─────────────────────────────────
  karaoke:          { weight:"900", font:FONT_MARKER,        activeColor:"#FFE600",    inactiveColor:"rgba(255,255,255,0.5)",   bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:{color:"#000",width:3} },
  wave:             { weight:"900", font:FONT_MARKER,        activeColor:"#ffffff",    inactiveColor:"rgba(255,255,255,0.3)",   bg:null,                 showAll:true,  yRatio:0.82, glow:null,       outline:{color:"#000",width:3} },

  // ── Font: Press Start 2P (pixel / retro) ──────────────────────────────────
  typewriter:       { weight:"900", font:FONT_PIXEL,         activeColor:"#00FF41",    inactiveColor:"rgba(0,255,65,0.3)",      bg:"rgba(0,0,0,0.85)",   showAll:true,  yRatio:0.80, glow:"#00FF41",  outline:null },
  glitch:           { weight:"900", font:FONT_PIXEL,         activeColor:"#ff00ff",    inactiveColor:"rgba(255,255,255,0.25)",  bg:null,                 showAll:true,  yRatio:0.80, glow:"#ff00ff",  outline:{color:"#00ffff",width:2} },

  // ── Font: Oswald / Space Grotesk (fire / gold / box styles) ───────────────
  fire:             { weight:"900", font:FONT_OSWALD,        activeColor:"#FF4500",    inactiveColor:"rgba(255,165,0,0.5)",     bg:null,                 showAll:true,  yRatio:0.80, glow:"#FF4500",  outline:{color:"#000",width:2} },
  "gradient-gold":  { weight:"900", font:FONT_OSWALD,        activeColor:"gradient",   inactiveColor:"rgba(255,215,0,0.3)",     bg:null,                 showAll:true,  yRatio:0.80, glow:"#FFD700",  outline:{color:"#000",width:2} },
  "outline-white":  { weight:"900", font:FONT_SPACE,         activeColor:"transparent",inactiveColor:"transparent",            bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:{color:"#fff",width:2} },
  "outline-black":  { weight:"900", font:FONT_SPACE,         activeColor:"#fff",       inactiveColor:"rgba(255,255,255,0.3)",   bg:null,                 showAll:true,  yRatio:0.80, glow:null,       outline:{color:"#000",width:4} },
  "solo-box":       { weight:"900", font:FONT_SPACE,         activeColor:"#000",       inactiveColor:"transparent",            bg:"#FFE600",            showAll:false, yRatio:0.50, glow:null,       outline:null },

  // ── Font: UnifrakturCook (gothic blackletter — stacked style) ─────────────
  gothic:           { weight:"900", font:FONT_GOTHIC,        activeColor:"#fff",       inactiveColor:"#fff",                   bg:null,                 showAll:true,  yRatio:0.50, glow:null,       outline:{color:"#000",width:3} },

  // ── Font: Nunito (rounded bold — vertical word-stack) ─────────────────────
  "word-stack":     { weight:"900", font:FONT_NUNITO,        activeColor:"#fff",       inactiveColor:"#fff",                   bg:null,                 showAll:true,  yRatio:0.50, glow:null,       outline:{color:"#000",width:4} },

  // ── Display stack variants (all 3-row animated) ────────────────────────────
  "stack-shake":    { weight:"900", font:FONT_OSWALD,        activeColor:"#FF3333",    inactiveColor:"#fff",                   bg:null,                 showAll:true,  yRatio:0.50, glow:null,       outline:{color:"#000",width:5} },
  "stack-wave":     { weight:"900", font:FONT_MARKER,        activeColor:"#fff",       inactiveColor:"#fff",                   bg:null,                 showAll:true,  yRatio:0.50, glow:null,       outline:{color:"#000",width:3} },
  "stack-neon":     { weight:"900", font:FONT_BEBAS,         activeColor:"#00FF88",    inactiveColor:"#fff",                   bg:null,                 showAll:true,  yRatio:0.50, glow:"#00FF88",  outline:null },
  "stack-fire":     { weight:"900", font:FONT_ANTON,         activeColor:"#FF4500",    inactiveColor:"#fff",                   bg:null,                 showAll:true,  yRatio:0.50, glow:"#FF4500",  outline:{color:"#000",width:3} },
  "stack-comic":    { weight:"900", font:FONT_BANGERS,       activeColor:"#fff",       inactiveColor:"#fff",                   bg:"rgba(20,20,200,0.9)",showAll:true,  yRatio:0.50, glow:null,       outline:{color:"#000",width:3} },
  "stack-gold":     { weight:"900", font:FONT_OSWALD,        activeColor:"#FFD700",    inactiveColor:"#fff",                   bg:null,                 showAll:true,  yRatio:0.50, glow:"#FFD700",  outline:{color:"#000",width:3} },
  "stack-sunny":    { weight:"900", font:FONT_ANTON,         activeColor:"#FFE600",    inactiveColor:"#fff",                   bg:null,                 showAll:true,  yRatio:0.50, glow:null,       outline:{color:"#000",width:5} },
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

/** Shared 3-row display-stack renderer used by gothic, word-stack, and all stack-* variants. */
function drawThreeRowStack(
  ctx:         any,
  cfg:         StyleCfg,
  prevWords:   { word: string }[],
  activeWord:  string,
  nextWords:   { word: string }[],
  cx: number, cy: number, fs: number,
  opts: {
    activeFs?:      number;
    contextFs?:     number;
    rowGap?:        number;
    shakeX?:        number;
    activeYOffset?: number;
    upYOffset?:     number;
    downYOffset?:   number;
    contextItalic?: boolean;
  } = {},
): void {
  const activeFs  = opts.activeFs      ?? fs * 2.6;
  const contextFs = opts.contextFs     ?? fs * 1.0;
  const rowGap    = opts.rowGap        ?? fs * 0.2;
  const shakeX    = opts.shakeX        ?? 0;
  const activeY   = cy + (opts.activeYOffset ?? 0);
  const upYOff    = opts.upYOffset     ?? 0;
  const downYOff  = opts.downYOffset   ?? 0;
  const italic    = opts.contextItalic ? "italic " : "";

  // Glow on active word
  if (cfg.glow) { ctx.shadowColor = cfg.glow; ctx.shadowBlur = 28; }

  // Background pill behind active word
  if (cfg.bg) {
    ctx.font = `${cfg.weight} ${activeFs}px ${cfg.font}`;
    const pw  = ctx.measureText(activeWord).width;
    const pad = 18;
    ctx.fillStyle = cfg.bg;
    roundRect(ctx, cx - pw / 2 - pad + shakeX, activeY - activeFs, pw + pad * 2, activeFs * 1.35, 8);
    ctx.fill();
  }

  // Active word
  ctx.font = `${cfg.weight} ${activeFs}px ${cfg.font}`;
  const atw = ctx.measureText(activeWord).width;
  if (cfg.outline) {
    ctx.strokeStyle = cfg.outline.color;
    ctx.lineWidth   = cfg.outline.width * 1.5;
    ctx.lineJoin    = "round";
    ctx.strokeText(activeWord, cx - atw / 2 + shakeX, activeY);
  }
  ctx.fillStyle = cfg.activeColor as string;
  ctx.fillText(activeWord, cx - atw / 2 + shakeX, activeY);
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;

  // Previous words — joined on one line above
  if (prevWords.length > 0) {
    const line = prevWords.map(w => w.word).join(" ");
    ctx.font = `${italic}${cfg.weight} ${contextFs}px ${cfg.font}`;
    const tw  = ctx.measureText(line).width;
    const upY = activeY - activeFs - rowGap + upYOff;
    if (cfg.outline) {
      ctx.strokeStyle = cfg.outline.color;
      ctx.lineWidth   = cfg.outline.width * 0.7;
      ctx.lineJoin    = "round";
      ctx.strokeText(line, cx - tw / 2, upY);
    }
    ctx.fillStyle = cfg.inactiveColor;
    ctx.fillText(line, cx - tw / 2, upY);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
  }

  // Next words — joined on one line below
  if (nextWords.length > 0) {
    const line  = nextWords.map(w => w.word).join(" ");
    ctx.font = `${italic}${cfg.weight} ${contextFs}px ${cfg.font}`;
    const tw    = ctx.measureText(line).width;
    const downY = activeY + rowGap + contextFs + downYOff;
    if (cfg.outline) {
      ctx.strokeStyle = cfg.outline.color;
      ctx.lineWidth   = cfg.outline.width * 0.7;
      ctx.lineJoin    = "round";
      ctx.strokeText(line, cx - tw / 2, downY);
    }
    ctx.fillStyle = cfg.inactiveColor;
    ctx.fillText(line, cx - tw / 2, downY);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
  }
}

// All styles that use the 3-row display-stack layout
const DISPLAY_STACK_STYLES = new Set<CaptionStyle>([
  "gothic", "word-stack", "stack-shake", "stack-wave", "stack-neon", "stack-fire", "stack-comic",
  "stack-gold", "stack-sunny",
]);

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
  hOffset:     number = 0,    // horizontal offset in % of width (- = left, + = right)
): void {
  if (style === "none" || words.length === 0) return;

  const cfg = CFG[style] ?? CFG["bold-center"];
  const t   = timeMs / 1000; // seconds

  const activeIdx = words.findIndex(w => t >= w.start && t < w.end);
  if (activeIdx === -1) return;

  const active  = words[activeIdx]!;
  // Match the browser preview exactly: baseRef is 1920 for 16:9, else 1080.
  // This keeps fs == fontSize for every supported aspect ratio.
  const baseRef  = canvasW >= 1920 ? 1920 : 1080;
  const fs       = fontSize * (canvasW / baseRef);
  // hOffset is normalized -100..100: 0 = centered, -100 = full left safe edge, +100 = full right safe edge.
  const SAFE_H   = 0.85; // fraction of half-width available for shift
  const cx       = canvasW / 2 + (hOffset / 100) * (canvasW / 2) * SAFE_H;
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

  // ── All display-stack styles (3-row layout) ──────────────────────────────
  if (DISPLAY_STACK_STYLES.has(style)) {
    const prevWords = windowWords.filter(w => w.end   <= active.start);
    const nextWords = windowWords.filter(w => w.start >= active.end);

    // Per-style sizing
    const activeFs  = style === "gothic" ? fs * 2.4 : fs * 2.8;
    const contextFs = style === "gothic" ? fs * 1.0 : fs * 1.1;
    const rowGap    = fs * 0.2;

    // Per-style animation (only for motion styles — timeMs is always present)
    let shakeX = 0, activeYOffset = 0, upYOffset = 0, downYOffset = 0;
    if (style === "stack-shake") {
      shakeX       = Math.sin(timeMs / 30) * 6;
      activeYOffset = Math.cos(timeMs / 40) * 3;
    }
    if (style === "stack-wave") {
      activeYOffset = Math.sin(timeMs / 220) * 10;
      upYOffset     = Math.sin(timeMs / 220 + 1.0) * 6;
      downYOffset   = Math.sin(timeMs / 220 - 1.0) * 6;
    }

    drawThreeRowStack(ctx, cfg, prevWords, active.word, nextWords, cx, cy, fs, {
      activeFs,
      contextFs,
      rowGap,
      shakeX,
      activeYOffset,
      upYOffset,
      downYOffset,
      contextItalic: style === "word-stack",
    });
    return;
  }

  const totalW = measured.reduce((s, m) => s + m.width, 0);
  let x = cx - totalW / 2;

  for (const m of measured) {
    const isA = m.isActive;

    // wfs is pre-computed during measurement so layout and render use the same size
    const wfs = m.wfs;
    ctx.font = `${cfg.weight} ${wfs}px ${cfg.font}`;

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
