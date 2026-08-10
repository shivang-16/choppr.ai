/**
 * Pro animated captions — shared drawing engine.
 *
 * These styles differ from the legacy ones in `caption-renderer` in one
 * fundamental way: every visual property is driven by the elapsed time since a
 * word's own onset, run through an easing or spring curve. Legacy styles only
 * ask "is this word active", which is why they pop into existence rather than
 * animating in.
 *
 * Everything here is a pure function of `t`. No mutable state, no Math.random —
 * the export renderer caches frames and the browser redraws on every rAF, so
 * two calls at the same timestamp must produce identical pixels.
 *
 * This file is duplicated verbatim in apps/web (same directory as the browser
 * caption renderer) apart from the `Ctx` type alias. Keep the two in sync.
 */

// The browser copy narrows this to CanvasRenderingContext2D; on the server it is
// a SKRSContext2D from @napi-rs/canvas, which exposes the same surface.
type Ctx = any;

// ── Styles ────────────────────────────────────────────────────────────────────

export type ProCaptionStyle =
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

export const PRO_CAPTION_STYLES: ProCaptionStyle[] = [
  "pro-spring", "pro-slide-box", "pro-liquid", "pro-focus", "pro-rise",
  "pro-tilt", "pro-chroma", "pro-shimmer", "pro-depth", "pro-glass",
];

const PRO_SET = new Set<string>(PRO_CAPTION_STYLES);

export function isProCaptionStyle(style: string): style is ProCaptionStyle {
  return PRO_SET.has(style);
}

export interface ProWord {
  word:  string;
  start: number;
  end:   number;
}

/**
 * Per-style knobs. `font` / `weight` are resolved by the caller so each app can
 * pass its own font stack (web uses Google Fonts names, server uses the
 * registered TTF families).
 */
export interface ProStyleCfg {
  /** Which of the two display faces this style uses. */
  face:      "montserrat" | "poppins";
  accent:    string;
  /** Uppercase the text — most viral styles do, the editorial ones don't. */
  upper:     boolean;
  /** Max words held on screen at once. */
  maxWords:  number;
  /** Max characters per page before forcing a break. */
  maxChars:  number;
  /**
   * Multiplier on the caller's base font size. The legacy styles scale only the
   * active word (1.5–2.8×) and leave context words at 1×; Pro styles size the
   * whole page up instead, so these sit in the same visual range.
   */
  fsScale:   number;
  /** Default vertical placement as a fraction of canvas height. */
  yRatio:    number;
  /** Rows are centred on each other, or left-aligned as an editorial block. */
  align:     "center" | "left";
}

export const PRO_CFG: Record<ProCaptionStyle, ProStyleCfg> = {
  "pro-spring":    { face:"montserrat", accent:"#FFE900", upper:true,  maxWords:3, maxChars:20, fsScale:2.00, yRatio:0.55, align:"center" },
  "pro-slide-box": { face:"poppins",    accent:"#C6FF00", upper:false, maxWords:4, maxChars:24, fsScale:1.70, yRatio:0.58, align:"center" },
  "pro-liquid":    { face:"montserrat", accent:"#22D3EE", upper:true,  maxWords:4, maxChars:22, fsScale:1.75, yRatio:0.55, align:"center" },
  "pro-focus":     { face:"poppins",    accent:"#FFFFFF", upper:false, maxWords:3, maxChars:22, fsScale:1.85, yRatio:0.62, align:"center" },
  "pro-rise":      { face:"montserrat", accent:"#FFFFFF", upper:true,  maxWords:3, maxChars:18, fsScale:1.95, yRatio:0.55, align:"left"   },
  "pro-tilt":      { face:"poppins",    accent:"#FFD166", upper:true,  maxWords:3, maxChars:20, fsScale:1.90, yRatio:0.55, align:"center" },
  "pro-chroma":    { face:"montserrat", accent:"#FF2D55", upper:true,  maxWords:2, maxChars:16, fsScale:2.30, yRatio:0.50, align:"center" },
  "pro-shimmer":   { face:"montserrat", accent:"#A7F3FF", upper:true,  maxWords:3, maxChars:20, fsScale:2.00, yRatio:0.55, align:"center" },
  "pro-depth":     { face:"poppins",    accent:"#7C3AED", upper:true,  maxWords:2, maxChars:16, fsScale:2.20, yRatio:0.52, align:"center" },
  "pro-glass":     { face:"poppins",    accent:"#FFFFFF", upper:false, maxWords:4, maxChars:26, fsScale:1.60, yRatio:0.78, align:"center" },
};

// ── Easing ────────────────────────────────────────────────────────────────────

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

const easeOutCubic = (p: number): number => 1 - Math.pow(1 - p, 3);

const easeOutExpo = (p: number): number => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));

/** Overshoots past 1 then settles — the "punch" curve. */
const easeOutBack = (p: number, s = 1.9): number => {
  const q = p - 1;
  return 1 + (s + 1) * q * q * q + s * q * q;
};

/** Damped oscillation. Lands on 1 with two decaying bounces. */
const elasticOut = (p: number): number => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return Math.pow(2, -9 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

// ── Word pages ────────────────────────────────────────────────────────────────

interface ProPage {
  words: ProWord[];
  start: number;
  /** When the page stops being shown — extends into the following gap. */
  end:   number;
}

/**
 * Group words into fixed pages that swap as a unit.
 *
 * The legacy renderer shows a sliding window of activeIdx ± 2, which makes the
 * whole line drift sideways on every word. Pages hold still, which is what
 * makes the professional styles readable at speed.
 */
function buildPages(words: ProWord[], maxWords: number, maxChars: number): ProPage[] {
  const GAP = 0.55;
  const pages: ProPage[] = [];
  let cur: ProWord[] = [];
  let chars = 0;

  const flush = () => {
    if (!cur.length) return;
    pages.push({ words: cur, start: cur[0]!.start, end: cur[cur.length - 1]!.end });
    cur = [];
    chars = 0;
  };

  for (const w of words) {
    if (cur.length) {
      const prev = cur[cur.length - 1]!;
      if (
        cur.length >= maxWords ||
        chars + w.word.length + 1 > maxChars ||
        w.start - prev.end > GAP
      ) flush();
    }
    cur.push(w);
    chars += w.word.length + 1;
  }
  flush();

  // Hold each page until the next one begins so text doesn't blink out during
  // short pauses, but never linger more than 0.4s past the last word.
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const next = pages[i + 1];
    page.end = next ? Math.min(next.start, page.end + 0.4) : page.end + 0.4;
  }
  return pages;
}

// ── Layout ────────────────────────────────────────────────────────────────────

interface LaidWord extends ProWord {
  text:  string;
  /** Left edge. */
  x:     number;
  /** Vertical centre — the engine draws with textBaseline "middle". */
  y:     number;
  width: number;
}

function layoutPage(
  ctx: Ctx,
  page: ProPage,
  font: string,
  weight: string,
  fs: number,
  upper: boolean,
  cx: number,
  cy: number,
  maxW: number,
  align: "center" | "left",
): { laid: LaidWord[]; lineH: number; lines: LaidWord[][] } {
  ctx.font = `${weight} ${fs}px ${font}`;
  const space = ctx.measureText(" ").width;

  const items = page.words.map(w => {
    const text = upper ? w.word.toUpperCase() : w.word;
    return { ...w, text, width: ctx.measureText(text).width, x: 0, y: 0 };
  });

  // Wrap into lines
  const lines: LaidWord[][] = [];
  let line: LaidWord[] = [];
  let lineW = 0;
  for (const it of items) {
    const add = line.length ? space + it.width : it.width;
    if (line.length && lineW + add > maxW) {
      lines.push(line);
      line = [];
      lineW = 0;
    }
    lineW += line.length ? space + it.width : it.width;
    line.push(it);
  }
  if (line.length) lines.push(line);

  const lineH = fs * 1.24;
  const firstY = cy - ((lines.length - 1) * lineH) / 2;

  const rowWidths = lines.map(
    row => row.reduce((s, it) => s + it.width, 0) + space * (row.length - 1),
  );
  // Left-aligned blocks share one origin derived from the widest row, so the
  // block as a whole still sits on `cx`.
  const blockLeft = cx - Math.max(...rowWidths, 0) / 2;

  for (let li = 0; li < lines.length; li++) {
    const row = lines[li]!;
    const rowW = rowWidths[li]!;
    let x = align === "left" ? blockLeft : cx - rowW / 2;
    const y = firstY + li * lineH;
    for (const it of row) {
      it.x = x;
      it.y = y;
      x += it.width + space;
    }
  }

  return { laid: items, lineH, lines };
}

// ── Draw helpers ──────────────────────────────────────────────────────────────

function strokeFillText(
  ctx: Ctx, text: string, x: number, y: number,
  fill: string | object, stroke: string | null, strokeW: number,
): void {
  if (stroke && strokeW > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = strokeW;
    ctx.lineJoin    = "round";
    ctx.miterLimit  = 2;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill as string;
  ctx.fillText(text, x, y);
}

/** Draw `fn` scaled about (ox, oy) and optionally rotated. */
function transformed(
  ctx: Ctx, ox: number, oy: number, scale: number, rotate: number, fn: () => void,
): void {
  ctx.save();
  ctx.translate(ox, oy);
  if (rotate) ctx.rotate(rotate);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.translate(-ox, -oy);
  fn();
  ctx.restore();
}

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function clearShadow(ctx: Ctx): void {
  ctx.shadowColor   = "transparent";
  ctx.shadowBlur    = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** Soft dark shadow that keeps light text legible over bright footage. */
function legibilityShadow(ctx: Ctx, fs: number): void {
  ctx.shadowColor   = "rgba(0,0,0,0.55)";
  ctx.shadowBlur    = fs * 0.22;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = fs * 0.05;
}

/** Entrance progress for a word, capped so very short words still complete. */
function entrance(t: number, w: ProWord, dur: number): number {
  const span = Math.max(0.06, Math.min(dur, (w.end - w.start) * 0.85));
  return clamp01((t - w.start) / span);
}

/** How far through its own duration a word is (0..1). */
function through(t: number, w: ProWord): number {
  return clamp01((t - w.start) / Math.max(0.04, w.end - w.start));
}

// ── Style renderers ───────────────────────────────────────────────────────────

interface DrawCtx {
  ctx:     Ctx;
  laid:    LaidWord[];
  lines:   LaidWord[][];
  t:       number;
  fs:      number;
  lineH:   number;
  cfg:     ProStyleCfg;
  font:    string;
  weight:  string;
  cx:      number;
  cy:      number;
  /** Index into `laid` of the word being spoken, or -1 between words. */
  activeIdx: number;
  page:    ProPage;
}

/**
 * Spring Pop — elastic scale entrance plus an accent bar that draws in beneath
 * the spoken word.
 */
function drawSpring(d: DrawCtx): void {
  const { ctx, laid, t, fs, cfg } = d;
  const strokeW = fs * 0.13;

  for (let i = 0; i < laid.length; i++) {
    const w = laid[i]!;
    if (t < w.start) continue;

    const p     = entrance(t, w, 0.2);
    const scale = 0.8 + (elasticOut(p) * 0.2);
    const isA   = i === d.activeIdx;
    const midX  = w.x + w.width / 2;

    transformed(ctx, midX, w.y, scale, 0, () => {
      if (isA) {
        const barP = easeOutCubic(clamp01((t - w.start) / 0.14));
        if (barP > 0) {
          const barH = fs * 0.13;
          const barY = w.y + fs * 0.52;
          ctx.fillStyle = cfg.accent;
          roundRectPath(ctx, w.x, barY, w.width * barP, barH, barH / 2);
          ctx.fill();
        }
      }
      legibilityShadow(ctx, fs);
      strokeFillText(ctx, w.text, w.x, w.y, "#FFFFFF", "#000000", strokeW);
      clearShadow(ctx);
    });
  }
}

/**
 * Slide Box — a single accent pill that tweens its position and width from the
 * previous word to the current one.
 */
function drawSlideBox(d: DrawCtx): void {
  const { ctx, laid, t, fs, cfg, activeIdx } = d;
  const padX = fs * 0.26;
  const padY = fs * 0.42;

  // Pill geometry, interpolated from the previous word's box.
  if (activeIdx >= 0) {
    const cur = laid[activeIdx]!;
    // Only slide from the previous word when it shares a line — travelling
    // diagonally across a line break reads as a glitch, so the pill scales in
    // at its new home instead.
    const before = activeIdx > 0 ? laid[activeIdx - 1]! : null;
    const prev = before && before.y === cur.y ? before : null;
    const p    = easeOutCubic(entrance(t, cur, 0.17));

    const fromX = prev ? prev.x - padX : cur.x - padX;
    const fromW = prev ? prev.width + padX * 2 : (cur.width + padX * 2) * 0.4;
    const fromY = prev ? prev.y : cur.y;
    const toX   = cur.x - padX;
    const toW   = cur.width + padX * 2;

    const boxX = fromX + (toX - fromX) * p;
    const boxW = fromW + (toW - fromW) * p;
    const boxY = fromY + (cur.y - fromY) * p;

    ctx.fillStyle = cfg.accent;
    roundRectPath(ctx, boxX, boxY - padY, boxW, padY * 2, fs * 0.22);
    ctx.fill();
  }

  for (let i = 0; i < laid.length; i++) {
    const w   = laid[i]!;
    const isA = i === activeIdx;
    if (!isA) legibilityShadow(ctx, fs);
    strokeFillText(
      ctx, w.text, w.x, w.y,
      isA ? "#0A0A0A" : "rgba(255,255,255,0.92)",
      null, 0,
    );
    clearShadow(ctx);
  }
}

/**
 * Liquid Fill — an accent fill sweeps through the line, including partway
 * through the word currently being spoken.
 */
function drawLiquid(d: DrawCtx): void {
  const { ctx, lines, t, fs, cfg, laid, activeIdx } = d;
  const strokeW = fs * 0.12;

  // Base pass: dim outline text
  for (const w of laid) {
    strokeFillText(ctx, w.text, w.x, w.y, "rgba(255,255,255,0.42)", "#000000", strokeW);
  }

  // Fill boundary — everything left of it on earlier lines is fully filled.
  let fillLine = -1;
  let fillX    = 0;
  if (activeIdx >= 0) {
    const cur = laid[activeIdx]!;
    fillLine  = lines.findIndex(row => row.includes(cur));
    fillX     = cur.x + cur.width * through(t, cur);
  } else {
    // Between words: hold the fill at the end of the last completed word.
    for (let i = laid.length - 1; i >= 0; i--) {
      if (t >= laid[i]!.end) {
        fillLine = lines.findIndex(row => row.includes(laid[i]!));
        fillX    = laid[i]!.x + laid[i]!.width;
        break;
      }
    }
  }
  if (fillLine < 0) return;

  for (let li = 0; li <= fillLine; li++) {
    const row = lines[li]!;
    if (!row.length) continue;
    const rowStart = row[0]!.x;
    const rowEnd   = row[row.length - 1]!.x + row[row.length - 1]!.width;
    const edge     = li < fillLine ? rowEnd : fillX;
    if (edge <= rowStart) continue;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rowStart - fs, row[0]!.y - fs, edge - rowStart + fs, fs * 2);
    ctx.clip();

    const grd = ctx.createLinearGradient(rowStart, 0, rowEnd, 0);
    grd.addColorStop(0, cfg.accent);
    grd.addColorStop(1, "#A5F3FC");

    for (const w of row) {
      strokeFillText(ctx, w.text, w.x, w.y, grd, "#000000", strokeW);
    }
    ctx.restore();
  }
}

/**
 * Focus Blur — the spoken word resolves from blurred to sharp while its
 * neighbours stay softly out of focus.
 */
function drawFocus(d: DrawCtx): void {
  const { ctx, laid, t, fs, activeIdx } = d;

  for (let i = 0; i < laid.length; i++) {
    const w    = laid[i]!;
    const isA  = i === activeIdx;
    const p    = easeOutExpo(entrance(t, w, 0.18));
    const blur = isA ? (1 - p) * fs * 0.16 : fs * 0.05;
    const scale = isA ? 1.18 - 0.18 * p : 1;
    const alpha = isA ? 0.55 + 0.45 * p : 0.5;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (blur > 0.4) ctx.filter = `blur(${blur.toFixed(2)}px)`;
    transformed(ctx, w.x + w.width / 2, w.y, scale, 0, () => {
      // No stroke on this style — a deep soft shadow keeps it clean but legible.
      ctx.shadowColor   = "rgba(0,0,0,0.85)";
      ctx.shadowBlur    = fs * (isA ? 0.42 : 0.3);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = fs * 0.04;
      // Two passes so the shadow builds enough density over bright footage.
      strokeFillText(ctx, w.text, w.x, w.y, "#FFFFFF", null, 0);
      strokeFillText(ctx, w.text, w.x, w.y, "#FFFFFF", null, 0);
      clearShadow(ctx);
    });
    ctx.filter = "none";
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/**
 * Rise Mask — an editorial left-aligned block. Each word slides up from behind
 * a mask as it is spoken, words already said drift up and dim, and an accent
 * rule tracks down the left edge as the block builds.
 */
function drawRise(d: DrawCtx): void {
  const { ctx, laid, lines, t, fs, lineH, activeIdx, cfg } = d;
  const strokeW = fs * 0.10;

  // Accent rule down the left edge, growing to the line being spoken.
  const left = Math.min(...laid.map(w => w.x)) - fs * 0.42;
  const top  = laid[0]!.y - fs * 0.62;
  const activeLine = activeIdx >= 0
    ? Math.max(0, lines.findIndex(row => row.includes(laid[activeIdx]!)))
    : lines.length - 1;
  const ruleH = (activeLine + 1) * lineH * easeOutCubic(
    clamp01((t - d.page.start) / 0.25),
  );
  ctx.fillStyle = cfg.accent === "#FFFFFF" ? "#4ADE80" : cfg.accent;
  roundRectPath(ctx, left - fs * 0.09, top, fs * 0.09, ruleH, fs * 0.045);
  ctx.fill();

  for (let i = 0; i < laid.length; i++) {
    const w = laid[i]!;
    if (t < w.start) continue;

    const p      = easeOutExpo(entrance(t, w, 0.22));
    const isPast = activeIdx >= 0 && i < activeIdx;
    const driftP = isPast ? easeOutCubic(clamp01((t - w.end) / 0.3)) : 0;
    const dy     = fs * 0.85 * (1 - p) - fs * 0.06 * driftP;
    const alpha  = isPast ? 1 - 0.55 * driftP : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    // Mask: only the band the word occupies, so it emerges from nothing.
    ctx.beginPath();
    ctx.rect(w.x - strokeW, w.y - fs * 0.78, w.width + strokeW * 2, fs * 1.56);
    ctx.clip();
    legibilityShadow(ctx, fs);
    strokeFillText(ctx, w.text, w.x, w.y + dy, "#FFFFFF", "#000000", strokeW);
    clearShadow(ctx);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/**
 * Tilt Drop — words fall in with a rotation that settles elastically, and keep
 * a slight alternating tilt and baseline offset so the page reads as
 * hand-placed rather than typeset.
 */
function drawTilt(d: DrawCtx): void {
  const { ctx, laid, t, fs, cfg, activeIdx } = d;
  const strokeW = fs * 0.12;

  for (let i = 0; i < laid.length; i++) {
    const w = laid[i]!;
    if (t < w.start) continue;

    const raw  = entrance(t, w, 0.32);
    const e    = elasticOut(raw);
    // Alternating resting pose, deterministic from the word's position.
    const sway = i % 2 === 0 ? -1 : 1;
    const restRot = sway * 4 * Math.PI / 180;
    const restDy  = sway * fs * 0.05;
    const rot   = restRot + (-16 * Math.PI / 180) * (1 - e);
    const dy    = restDy - fs * 0.55 * (1 - easeOutCubic(raw));
    const scale = 1.15 - 0.15 * easeOutCubic(raw);
    const isA   = i === activeIdx;

    ctx.save();
    ctx.globalAlpha = isA ? 1 : 0.62;
    const midX = w.x + w.width / 2;
    ctx.translate(midX, w.y + dy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.translate(-midX, -(w.y + dy));
    legibilityShadow(ctx, fs);
    strokeFillText(ctx, w.text, w.x, w.y + dy, isA ? cfg.accent : "#FFFFFF", "#000000", strokeW);
    clearShadow(ctx);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/**
 * Chroma Split — red and cyan ghosts converge onto the word on its onset.
 *
 * The ghosts are painted opaque rather than additively: "lighter" clips to
 * white over bright footage, which makes the effect vanish on exactly the
 * shots where it should be loudest.
 */
function drawChroma(d: DrawCtx): void {
  const { ctx, laid, t, fs, activeIdx } = d;
  const strokeW = fs * 0.13;

  for (let i = 0; i < laid.length; i++) {
    const w   = laid[i]!;
    if (t < w.start) continue;
    const isA = i === activeIdx;
    const p   = easeOutCubic(entrance(t, w, 0.2));
    const scale = isA ? 1 + 0.12 * (1 - p) : 1;

    ctx.save();
    ctx.globalAlpha = isA ? 1 : 0.5;
    transformed(ctx, w.x + w.width / 2, w.y, scale, 0, () => {
      if (isA && p < 1) {
        const off = fs * 0.34 * (1 - p);
        ctx.globalAlpha = 1 - p * 0.25;
        ctx.fillStyle = "#FF0033";
        ctx.fillText(w.text, w.x - off, w.y);
        ctx.fillStyle = "#00E5FF";
        ctx.fillText(w.text, w.x + off, w.y);
        ctx.globalAlpha = 1;
      }
      legibilityShadow(ctx, fs);
      strokeFillText(ctx, w.text, w.x, w.y, "#FFFFFF", "#000000", strokeW);
      clearShadow(ctx);
    });
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/**
 * Shimmer — an iridescent specular band travels across the spoken word once.
 *
 * The band is a clipped repaint of the glyphs rather than an additive pass, so
 * it stays visible on top of white text.
 */
function drawShimmer(d: DrawCtx): void {
  const { ctx, laid, t, fs, cfg, activeIdx } = d;
  const strokeW = fs * 0.12;

  for (let i = 0; i < laid.length; i++) {
    const w   = laid[i]!;
    const isA = i === activeIdx;

    if (isA) {
      ctx.shadowColor = cfg.accent;
      ctx.shadowBlur  = fs * 0.4;
    } else {
      legibilityShadow(ctx, fs);
    }

    // Brushed-metal base so the sweep has something to travel over.
    const base = ctx.createLinearGradient(0, w.y - fs * 0.6, 0, w.y + fs * 0.6);
    base.addColorStop(0,    "#FFFFFF");
    base.addColorStop(0.5,  "#F2F6FC");
    base.addColorStop(0.52, "#CBD5E4");
    base.addColorStop(1,    "#FFFFFF");
    strokeFillText(
      ctx, w.text, w.x, w.y,
      isA ? base : "rgba(255,255,255,0.55)", "#000000", strokeW,
    );
    clearShadow(ctx);

    if (!isA) continue;

    // Band sweeps from just before the word to just past it, once per word.
    const p    = through(t, w);
    const band = fs * 0.8;
    const head = w.x - band + (w.width + band * 2) * p;
    const grd  = ctx.createLinearGradient(head - band, 0, head + band, 0);
    grd.addColorStop(0,    "rgba(255,255,255,0)");
    grd.addColorStop(0.35, "rgba(103,232,249,0.85)");
    grd.addColorStop(0.5,  "#FFFFFF");
    grd.addColorStop(0.65, "rgba(244,114,182,0.85)");
    grd.addColorStop(1,    "rgba(255,255,255,0)");

    ctx.save();
    ctx.beginPath();
    ctx.rect(head - band, w.y - fs, band * 2, fs * 2);
    ctx.clip();
    ctx.fillStyle = grd;
    ctx.fillText(w.text, w.x, w.y);
    ctx.restore();
  }
}

/**
 * Depth Pop — layered copies build a solid extrusion whose depth animates in.
 */
function drawDepth(d: DrawCtx): void {
  const { ctx, laid, t, fs, cfg, activeIdx } = d;
  const LAYERS = 18;

  for (let i = 0; i < laid.length; i++) {
    const w   = laid[i]!;
    if (t < w.start) continue;
    const isA = i === activeIdx;
    const p   = easeOutBack(clamp01(entrance(t, w, 0.2)));
    const depth = (isA ? fs * 0.30 : fs * 0.12) * (isA ? p : 1);

    ctx.save();
    ctx.globalAlpha = isA ? 1 : 0.6;

    // Extrusion: back-to-front so the face lands on top.
    for (let l = LAYERS; l >= 1; l--) {
      const k = l / LAYERS;
      ctx.fillStyle = shade(cfg.accent, 0.35 + 0.3 * (1 - k));
      ctx.fillText(w.text, w.x + depth * k, w.y + depth * k);
    }

    strokeFillText(ctx, w.text, w.x, w.y, "#FFFFFF", "#0A0A0A", fs * 0.06);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/**
 * Glass Panel — a frosted panel springs to fit the page behind the words.
 */
function drawGlass(d: DrawCtx): void {
  const { ctx, laid, lines, t, fs, lineH, cx, cy, page, activeIdx } = d;

  const padX = fs * 0.62;
  const padY = fs * 0.5;
  let maxRowW = 0;
  for (const row of lines) {
    if (!row.length) continue;
    const rowW = row[row.length - 1]!.x + row[row.length - 1]!.width - row[0]!.x;
    if (rowW > maxRowW) maxRowW = rowW;
  }
  const panelW = maxRowW + padX * 2;
  const panelH = (lines.length - 1) * lineH + fs * 1.15 + padY * 2;

  const pageP = easeOutCubic(clamp01((t - page.start) / 0.22));
  const sx    = 0.9 + 0.1 * pageP;
  const sy    = 0.94 + 0.06 * pageP;

  ctx.save();
  ctx.globalAlpha = pageP;
  ctx.translate(cx, cy);
  ctx.scale(sx, sy);
  ctx.translate(-cx, -cy);

  const px = cx - panelW / 2;
  const py = cy - panelH / 2;
  const r  = fs * 0.42;

  // Darkened backdrop for legibility, then the translucent glass on top.
  ctx.fillStyle = "rgba(10,12,18,0.42)";
  roundRectPath(ctx, px, py, panelW, panelH, r);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRectPath(ctx, px, py, panelW, panelH, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.34)";
  ctx.lineWidth   = Math.max(1, fs * 0.022);
  roundRectPath(ctx, px, py, panelW, panelH, r);
  ctx.stroke();

  for (let i = 0; i < laid.length; i++) {
    const w   = laid[i]!;
    const isA = i === activeIdx;
    const p   = easeOutCubic(entrance(t, w, 0.16));
    ctx.globalAlpha = pageP * (isA ? 1 : 0.62 + 0.1 * p);
    strokeFillText(ctx, w.text, w.x, w.y, "#FFFFFF", null, 0);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Darken a #rrggbb colour by `f` (0 = black, 1 = unchanged). */
function shade(hex: string, f: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

const RENDERERS: Record<ProCaptionStyle, (d: DrawCtx) => void> = {
  "pro-spring":    drawSpring,
  "pro-slide-box": drawSlideBox,
  "pro-liquid":    drawLiquid,
  "pro-focus":     drawFocus,
  "pro-rise":      drawRise,
  "pro-tilt":      drawTilt,
  "pro-chroma":    drawChroma,
  "pro-shimmer":   drawShimmer,
  "pro-depth":     drawDepth,
  "pro-glass":     drawGlass,
};

// ── Entry point ───────────────────────────────────────────────────────────────

export interface ProRenderParams {
  ctx:      Ctx;
  canvasW:  number;
  canvasH:  number;
  words:    ProWord[];
  style:    ProCaptionStyle;
  /** Current time in seconds. */
  t:        number;
  /** Logical font size from the editor. */
  fontSize: number;
  /** Vertical offset, -100..100. */
  posOffset: number;
  /** Horizontal offset, -100..100. */
  hOffset:   number;
  /** Font stack for the Montserrat slot (app-specific). */
  montserrat: string;
  /** Font stack for the Poppins slot (app-specific). */
  poppins:    string;
  /**
   * Overrides both faces — used for scripts the display fonts don't cover
   * (Devanagari, CJK, Arabic …).
   */
  fontOverride?: string | null;
  /** Weight to pair with `fontOverride`. */
  overrideWeight?: string;
}

/**
 * Draw one frame of a Pro caption. Safe to call every frame; it is a pure
 * function of `t` so preview and export stay in lockstep.
 */
export function renderProCaptionFrame(params: ProRenderParams): void {
  const {
    ctx, canvasW, canvasH, words, style, t, fontSize,
    posOffset, hOffset, montserrat, poppins, fontOverride, overrideWeight,
  } = params;

  if (!words.length) return;
  const cfg = PRO_CFG[style];
  if (!cfg) return;

  const pages = buildPages(words, cfg.maxWords, cfg.maxChars);
  const page  = pages.find(p => t >= p.start - 0.05 && t < p.end);
  if (!page) return;

  const font   = fontOverride ?? (cfg.face === "montserrat" ? montserrat : poppins);
  const weight = fontOverride
    ? (overrideWeight ?? "700")
    : (cfg.face === "montserrat" ? "900" : "800");

  // Same scaling and safe-area maths as the legacy renderer so the position
  // sliders behave identically across all styles.
  const baseRef = canvasW >= 1920 ? 1920 : 1080;
  const fs      = fontSize * (canvasW / baseRef) * cfg.fsScale;

  const SAFE_H = 0.85;
  const cx = canvasW / 2 + (hOffset / 100) * (canvasW / 2) * SAFE_H;

  const SAFE_TOP = 0.06, SAFE_BOTTOM = 0.96;
  const base = cfg.yRatio;
  const frac = posOffset >= 0
    ? base + (posOffset / 100) * (SAFE_BOTTOM - base)
    : base + (posOffset / 100) * (base - SAFE_TOP);
  const cy = canvasH * frac;

  const prevBaseline = ctx.textBaseline;
  const prevAlign    = ctx.textAlign;
  ctx.textBaseline = "middle";
  ctx.textAlign    = "left";

  const { laid, lineH, lines } = layoutPage(
    ctx, page, font, weight, fs, cfg.upper, cx, cy, canvasW * 0.86, cfg.align,
  );
  ctx.font = `${weight} ${fs}px ${font}`;

  const activeIdx = laid.findIndex(w => t >= w.start && t < w.end);

  RENDERERS[style]({
    ctx, laid, lines, t, fs, lineH, cfg, font, weight, cx, cy, activeIdx, page,
  });

  clearShadow(ctx);
  ctx.filter          = "none";
  ctx.globalAlpha     = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.textBaseline    = prevBaseline;
  ctx.textAlign       = prevAlign;
}
