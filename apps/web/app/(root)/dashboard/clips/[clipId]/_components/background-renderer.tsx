"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Sticker definitions ────────────────────────────────────────────────────────
export type StickerId = string;

export interface StickerDef {
  id: StickerId;
  label: string;
  category: "flowers" | "shapes" | "space" | "cute" | "effects" | "text";
  // SVG drawn directly on canvas
  draw: (ctx: CanvasRenderingContext2D, size: number, t: number) => void;
}

export interface PlacedSticker {
  stickerId: StickerId;
  x: number; // 0-1 normalized position
  y: number; // 0-1 normalized position
  scale: number; // 0.3 - 2.0
}

// ── SVG Sticker library (drawn directly on canvas) ─────────────────────────────
function drawFlower(ctx: CanvasRenderingContext2D, size: number, _t: number, color: string, petals: number) {
  const r = size * 0.4;
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

function drawStar(ctx: CanvasRenderingContext2D, size: number, points: number, color: string) {
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

function drawHeart(ctx: CanvasRenderingContext2D, size: number, color: string) {
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

function drawPlanet(ctx: CanvasRenderingContext2D, size: number) {
  const r = size * 0.3;
  // Planet body
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.2, 0, 0, 0, r);
  g.addColorStop(0, "#c4b5fd"); g.addColorStop(0.6, "#7c3aed"); g.addColorStop(1, "#4c1d95");
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  // Ring
  ctx.save();
  ctx.rotate(-0.3);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.6, r * 0.25, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(196,181,253,0.6)";
  ctx.lineWidth = size * 0.04;
  ctx.stroke();
  ctx.restore();
}

function drawButterfly(ctx: CanvasRenderingContext2D, size: number, t: number) {
  const flap = Math.sin(t / 8) * 0.3;
  ctx.save();
  // Left wing
  ctx.save(); ctx.scale(1 - flap, 1);
  ctx.beginPath();
  ctx.ellipse(-size * 0.2, -size * 0.05, size * 0.25, size * 0.35, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(168,85,247,0.7)";
  ctx.fill();
  ctx.restore();
  // Right wing
  ctx.save(); ctx.scale(1 - flap, 1);
  ctx.beginPath();
  ctx.ellipse(size * 0.2, -size * 0.05, size * 0.25, size * 0.35, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(236,72,153,0.7)";
  ctx.fill();
  ctx.restore();
  // Body
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.03, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#1f2937";
  ctx.fill();
  ctx.restore();
}

function drawSparkle(ctx: CanvasRenderingContext2D, size: number, t: number) {
  const pulse = 0.8 + Math.sin(t / 10) * 0.2;
  const s = size * 0.45 * pulse;
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(0, -s); ctx.lineTo(s * 0.12, -s * 0.12); ctx.lineTo(s, 0);
  ctx.lineTo(s * 0.12, s * 0.12); ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.12, s * 0.12); ctx.lineTo(-s, 0);
  ctx.lineTo(-s * 0.12, -s * 0.12); ctx.closePath();
  ctx.fill();
}

function drawCloud(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
  ctx.arc(-size * 0.2, size * 0.05, size * 0.15, 0, Math.PI * 2);
  ctx.arc(size * 0.2, size * 0.05, size * 0.16, 0, Math.PI * 2);
  ctx.arc(size * 0.1, -size * 0.08, size * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrown(ctx: CanvasRenderingContext2D, size: number) {
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
  // Gems
  ctx.fillStyle = "#ef4444";
  ctx.beginPath(); ctx.arc(0, -h * 0.1, size * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath(); ctx.arc(-w * 0.4, h * 0.05, size * 0.03, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.4, h * 0.05, size * 0.03, 0, Math.PI * 2); ctx.fill();
}

function drawLightning(ctx: CanvasRenderingContext2D, size: number) {
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

function drawFireEmoji(ctx: CanvasRenderingContext2D, size: number, t: number) {
  const flicker = Math.sin(t / 6) * size * 0.02;
  ctx.save(); ctx.translate(0, flicker);
  // Outer flame
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.4);
  ctx.bezierCurveTo(size * 0.25, -size * 0.2, size * 0.3, size * 0.1, size * 0.15, size * 0.35);
  ctx.quadraticCurveTo(0, size * 0.45, -size * 0.15, size * 0.35);
  ctx.bezierCurveTo(-size * 0.3, size * 0.1, -size * 0.25, -size * 0.2, 0, -size * 0.4);
  ctx.fill();
  // Inner flame
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.15);
  ctx.bezierCurveTo(size * 0.12, -size * 0.05, size * 0.15, size * 0.1, size * 0.08, size * 0.3);
  ctx.quadraticCurveTo(0, size * 0.35, -size * 0.08, size * 0.3);
  ctx.bezierCurveTo(-size * 0.15, size * 0.1, -size * 0.12, -size * 0.05, 0, -size * 0.15);
  ctx.fill();
  ctx.restore();
}

export const STICKERS: StickerDef[] = [
  { id: "lily-purple", label: "Lily", category: "flowers",
    draw: (ctx, s, t) => drawFlower(ctx, s, t, "#a855f7", 6) },
  { id: "rose-pink", label: "Rose", category: "flowers",
    draw: (ctx, s, t) => drawFlower(ctx, s, t, "#ec4899", 8) },
  { id: "daisy-white", label: "Daisy", category: "flowers",
    draw: (ctx, s, t) => drawFlower(ctx, s, t, "#ffffff", 10) },
  { id: "sunflower", label: "Sunflower", category: "flowers",
    draw: (ctx, s, t) => drawFlower(ctx, s, t, "#fbbf24", 12) },
  { id: "heart-pink", label: "Heart", category: "cute",
    draw: (ctx, s) => drawHeart(ctx, s, "#ec4899") },
  { id: "heart-red", label: "Red Heart", category: "cute",
    draw: (ctx, s) => drawHeart(ctx, s, "#ef4444") },
  { id: "heart-pattern", label: "Purple Heart", category: "cute",
    draw: (ctx, s) => drawHeart(ctx, s, "#a855f7") },
  { id: "planet", label: "Planet", category: "space",
    draw: (ctx, s) => drawPlanet(ctx, s) },
  { id: "star-gold", label: "Gold Star", category: "shapes",
    draw: (ctx, s) => drawStar(ctx, s, 5, "#fbbf24") },
  { id: "star-white", label: "White Star", category: "shapes",
    draw: (ctx, s) => drawStar(ctx, s, 5, "#ffffff") },
  { id: "sparkle", label: "Sparkle", category: "effects",
    draw: (ctx, s, t) => drawSparkle(ctx, s, t) },
  { id: "butterfly", label: "Butterfly", category: "cute",
    draw: (ctx, s, t) => drawButterfly(ctx, s, t) },
  { id: "cloud", label: "Cloud", category: "shapes",
    draw: (ctx, s) => drawCloud(ctx, s) },
  { id: "crown", label: "Crown", category: "cute",
    draw: (ctx, s) => drawCrown(ctx, s) },
  { id: "lightning", label: "Lightning", category: "effects",
    draw: (ctx, s) => drawLightning(ctx, s) },
  { id: "fire", label: "Fire", category: "effects",
    draw: (ctx, s, t) => drawFireEmoji(ctx, s, t) },
];

// ── BackgroundRenderer ─────────────────────────────────────────────────────────
interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  placedStickers: PlacedSticker[];
  segmentationReady: boolean;
  segmenter: React.RefObject<ImageSegmenterRef | null>;
  filterStyle?: string;
}

export interface ImageSegmenterRef {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  segmentForVideo: (video: HTMLVideoElement, timestamp: number, callback: (result: any) => void) => void;
}

export default function BackgroundRenderer({ videoRef, placedStickers, segmentationReady, segmenter, filterStyle }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef(0);
  const tickRef     = useRef(0);
  const maskRef     = useRef<Float32Array | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video || !ready) { rafRef.current = requestAnimationFrame(draw); return; }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

    const cw = canvas.width;
    const ch = canvas.height;
    tickRef.current++;

    ctx.clearRect(0, 0, cw, ch);

    if (placedStickers.length === 0) { rafRef.current = requestAnimationFrame(draw); return; }

    // ── Step 1: Get segmentation mask ──────────────────────────────────────────
    if (segmentationReady && segmenter.current && !video.paused && video.readyState >= 2) {
      try {
        segmenter.current.segmentForVideo(video, video.currentTime * 1000, (result) => {
          const cat = result.categoryMask;
          if (cat) {
            maskRef.current = cat.getAsFloat32Array();
            cat.close();
          }
          result.close?.();
        });
      } catch { /* ignore */ }
    }

    // ── Step 2: Draw original video frame as base ──────────────────────────────
    ctx.drawImage(video, 0, 0, cw, ch);

    // ── Step 3: Draw stickers ON TOP of video (they'll be masked next) ─────────
    const stickerLayer = document.createElement("canvas");
    stickerLayer.width = cw; stickerLayer.height = ch;
    const sCtx = stickerLayer.getContext("2d")!;

    for (const ps of placedStickers) {
      const def = STICKERS.find(s => s.id === ps.stickerId);
      if (!def) continue;
      const px = ps.x * cw;
      const py = ps.y * ch;
      const pSize = cw * 0.18 * ps.scale;
      sCtx.save();
      sCtx.translate(px, py);
      def.draw(sCtx, pSize, tickRef.current);
      sCtx.restore();
    }

    // ── Step 4: Composite — stickers behind person ─────────────────────────────
    if (maskRef.current && maskRef.current.length === cw * ch) {
      const mask = maskRef.current;

      // Draw stickers first
      ctx.drawImage(stickerLayer, 0, 0);

      // Now re-draw person pixels on top (overwriting stickers where person is)
      const videoFrame = document.createElement("canvas");
      videoFrame.width = cw; videoFrame.height = ch;
      const vCtx = videoFrame.getContext("2d")!;
      vCtx.drawImage(video, 0, 0, cw, ch);
      const vData = vCtx.getImageData(0, 0, cw, ch);

      const personLayer = ctx.createImageData(cw, ch);
      for (let i = 0; i < mask.length; i++) {
        // mask value < 0.5 = person pixel
        if ((mask[i] ?? 1) < 0.5) {
          personLayer.data[i * 4]     = vData.data[i * 4]     ?? 0;
          personLayer.data[i * 4 + 1] = vData.data[i * 4 + 1] ?? 0;
          personLayer.data[i * 4 + 2] = vData.data[i * 4 + 2] ?? 0;
          personLayer.data[i * 4 + 3] = 255;
        }
      }
      ctx.putImageData(personLayer, 0, 0);

      // Re-draw the video background where no sticker and no person
      // (Already composited: video base → sticker → person on top)
      // Actually the layering should be: video + sticker merged, then person on top
      // Let's redo properly:
      ctx.clearRect(0, 0, cw, ch);
      // Layer 1: Original video
      ctx.drawImage(video, 0, 0, cw, ch);
      // Layer 2: Stickers (drawn on top of video)
      ctx.drawImage(stickerLayer, 0, 0);
      // Layer 3: Person — redraw person pixels on TOP of stickers
      ctx.putImageData(personLayer, 0, 0);
      // Problem: putImageData replaces pixels, need to only draw person pixels
      // Fix: Use a composited approach instead
      ctx.clearRect(0, 0, cw, ch);

      // Proper 3-layer composite:
      // Draw video base
      ctx.drawImage(video, 0, 0, cw, ch);
      // Draw stickers on top
      ctx.drawImage(stickerLayer, 0, 0);
      // Now mask out person area and re-draw person (no sticker visible on person)
      const personCanvas = document.createElement("canvas");
      personCanvas.width = cw; personCanvas.height = ch;
      const pCtx = personCanvas.getContext("2d")!;
      pCtx.putImageData(personLayer, 0, 0);
      ctx.drawImage(personCanvas, 0, 0);
    } else {
      // No segmentation yet — just draw stickers ON TOP (not behind person)
      ctx.drawImage(stickerLayer, 0, 0);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [placedStickers, segmentationReady, segmenter, videoRef, ready]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  if (placedStickers.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      width={1080}
      height={1920}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ objectFit: "cover", zIndex: 1, filter: filterStyle }}
    />
  );
}
