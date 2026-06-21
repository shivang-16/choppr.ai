/**
 * Server-side sticker renderer using @napi-rs/canvas.
 * Mirrors the draw functions from background-renderer.tsx on the client.
 * Returns a PNG Buffer for each placed sticker at the correct position/size.
 */

import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";

export interface PlacedSticker {
  stickerId: string;
  x: number; // 0-1 normalised
  y: number; // 0-1 normalised
  scale: number;
}

// ── Individual sticker draw functions (mirrored from client) ──────────────────

function drawFlower(ctx: SKRSContext2D, size: number, color: string, petals: number) {
  const r  = size * 0.4;
  const pr = size * 0.22;
  ctx.save();
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, pr, pr * 0.6, a, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = "#fbbf24";
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx: SKRSContext2D, size: number, points: number, color: string) {
  const outer = size * 0.45;
  const inner = size * 0.2;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawHeart(ctx: SKRSContext2D, size: number, color: string) {
  const s = size * 0.015;
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(0, 5);
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.bezierCurveTo(-20, -30, -35, 0, 0, 25);
  ctx.moveTo(0, -10);
  ctx.bezierCurveTo(20, -30, 35, 0, 0, 25);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawPlanet(ctx: SKRSContext2D, size: number) {
  const r = size * 0.3;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.2, 0, 0, 0, r);
  g.addColorStop(0, "#c4b5fd"); g.addColorStop(0.6, "#7c3aed"); g.addColorStop(1, "#4c1d95");
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.save();
  ctx.rotate(-0.3);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.6, r * 0.25, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(196,181,253,0.6)";
  ctx.lineWidth = size * 0.04;
  ctx.stroke();
  ctx.restore();
}

function drawButterfly(ctx: SKRSContext2D, size: number) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-size * 0.2, -size * 0.05, size * 0.25, size * 0.35, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(168,85,247,0.7)"; ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.2, -size * 0.05, size * 0.25, size * 0.35, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(236,72,153,0.7)"; ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.03, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#1f2937"; ctx.fill();
  ctx.restore();
}

function drawSparkle(ctx: SKRSContext2D, size: number) {
  const s = size * 0.45;
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(0, -s); ctx.lineTo(s * 0.12, -s * 0.12); ctx.lineTo(s, 0);
  ctx.lineTo(s * 0.12, s * 0.12); ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.12, s * 0.12); ctx.lineTo(-s, 0);
  ctx.lineTo(-s * 0.12, -s * 0.12); ctx.closePath();
  ctx.fill();
}

function drawCloud(ctx: SKRSContext2D, size: number) {
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
  ctx.arc(-size * 0.2, size * 0.05, size * 0.15, 0, Math.PI * 2);
  ctx.arc(size * 0.2, size * 0.05, size * 0.16, 0, Math.PI * 2);
  ctx.arc(size * 0.1, -size * 0.08, size * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrown(ctx: SKRSContext2D, size: number) {
  const w = size * 0.5, h = size * 0.35;
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(-w, h * 0.4);
  ctx.lineTo(-w, -h * 0.2);
  ctx.lineTo(-w * 0.5, h * 0.1);
  ctx.lineTo(0, -h * 0.5);
  ctx.lineTo(w * 0.5, h * 0.1);
  ctx.lineTo(w, -h * 0.2);
  ctx.lineTo(w, h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#d97706"; ctx.lineWidth = size * 0.02; ctx.stroke();
  ctx.fillStyle = "#ef4444";
  ctx.beginPath(); ctx.arc(0, -h * 0.1, size * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath(); ctx.arc(-w * 0.4, h * 0.05, size * 0.03, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.4, h * 0.05, size * 0.03, 0, Math.PI * 2); ctx.fill();
}

function drawLightning(ctx: SKRSContext2D, size: number) {
  const s = size * 0.01;
  ctx.save(); ctx.scale(s, s);
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(5, -40); ctx.lineTo(-8, -5); ctx.lineTo(2, -5);
  ctx.lineTo(-5, 40); ctx.lineTo(12, 5); ctx.lineTo(2, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#d97706"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

function drawFire(ctx: SKRSContext2D, size: number) {
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.4);
  ctx.bezierCurveTo(size * 0.25, -size * 0.2, size * 0.3, size * 0.1, size * 0.15, size * 0.35);
  ctx.quadraticCurveTo(0, size * 0.45, -size * 0.15, size * 0.35);
  ctx.bezierCurveTo(-size * 0.3, size * 0.1, -size * 0.25, -size * 0.2, 0, -size * 0.4);
  ctx.fill();
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.15);
  ctx.bezierCurveTo(size * 0.12, -size * 0.05, size * 0.15, size * 0.1, size * 0.08, size * 0.3);
  ctx.quadraticCurveTo(0, size * 0.35, -size * 0.08, size * 0.3);
  ctx.bezierCurveTo(-size * 0.15, size * 0.1, -size * 0.12, -size * 0.05, 0, -size * 0.15);
  ctx.fill();
}

type DrawFn = (ctx: SKRSContext2D, size: number) => void;

const STICKER_DRAW: Record<string, DrawFn> = {
  "lily-purple":   (c, s) => drawFlower(c, s, "#a855f7", 6),
  "rose-pink":     (c, s) => drawFlower(c, s, "#ec4899", 8),
  "daisy-white":   (c, s) => drawFlower(c, s, "#ffffff", 10),
  "sunflower":     (c, s) => drawFlower(c, s, "#fbbf24", 12),
  "heart-pink":    (c, s) => drawHeart(c, s, "#ec4899"),
  "heart-red":     (c, s) => drawHeart(c, s, "#ef4444"),
  "heart-pattern": (c, s) => drawHeart(c, s, "#a855f7"),
  "planet":        (c, s) => drawPlanet(c, s),
  "star-gold":     (c, s) => drawStar(c, s, 5, "#fbbf24"),
  "star-white":    (c, s) => drawStar(c, s, 5, "#ffffff"),
  "sparkle":       (c, s) => drawSparkle(c, s),
  "butterfly":     (c, s) => drawButterfly(c, s),
  "cloud":         (c, s) => drawCloud(c, s),
  "crown":         (c, s) => drawCrown(c, s),
  "lightning":     (c, s) => drawLightning(c, s),
  "fire":          (c, s) => drawFire(c, s),
};

/**
 * Render all placed stickers onto a single transparent PNG the same size as
 * the video frame. Returns a Buffer that FFmpeg can use as an overlay input.
 */
export function renderStickersToBuffer(
  stickers: PlacedSticker[],
  frameW: number,
  frameH: number,
): Buffer {
  const canvas: Canvas = createCanvas(frameW, frameH);
  const ctx = canvas.getContext("2d") as unknown as SKRSContext2D;

  for (const ps of stickers) {
    const drawFn = STICKER_DRAW[ps.stickerId];
    if (!drawFn) continue;

    const px    = ps.x * frameW;
    const py    = ps.y * frameH;
    // Scale relative to frame width — same formula used client-side
    const pSize = frameW * 0.18 * ps.scale;

    ctx.save();
    ctx.translate(px, py);
    drawFn(ctx, pSize);
    ctx.restore();
  }

  return (canvas as unknown as { toBuffer(mime: string): Buffer }).toBuffer("image/png");
}
