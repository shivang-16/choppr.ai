"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type StickerId = string;

export interface PlacedSticker {
  stickerId:  string;     // "giphy:{id}" for GIPHY stickers
  giphyUrl?:  string;     // full render URL (webp/gif) — set for GIPHY stickers
  previewUrl?: string;    // small thumbnail URL for UI — set for GIPHY stickers
  x:     number;          // 0-1 normalized
  y:     number;          // 0-1 normalized
  scale: number;          // 0.3 - 2.0
}

// Legacy emoji sticker types (kept so nothing breaks if old stickers exist)
export interface StickerDef {
  id:       StickerId;
  label:    string;
  emoji:    string;
  category: "reactions" | "hype" | "love" | "memes" | "nature" | "misc";
}

export const STICKERS: StickerDef[] = [];
export const STICKER_CATEGORIES: { id: StickerDef["category"]; label: string }[] = [];

// ── GIPHY helpers ──────────────────────────────────────────────────────────────
export const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "";

export interface GiphySticker {
  id:         string;
  title:      string;
  previewUrl: string;   // small webp for the picker grid
  renderUrl:  string;   // medium webp for canvas
}

export async function fetchGiphyStickers(query: string, limit = 24): Promise<GiphySticker[]> {
  if (!GIPHY_KEY) return [];
  const endpoint = query.trim()
    ? `https://api.giphy.com/v1/stickers/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=g`
    : `https://api.giphy.com/v1/stickers/trending?api_key=${GIPHY_KEY}&limit=${limit}&rating=g`;
  try {
    const res  = await fetch(endpoint);
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.data ?? []).map((item: any) => ({
      id:         item.id,
      title:      item.title ?? "",
      previewUrl: item.images?.fixed_width_small?.webp ?? item.images?.fixed_width_small?.url ?? "",
      renderUrl:  item.images?.fixed_width?.url        ?? item.images?.fixed_width?.webp       ?? "",
    }));
  } catch {
    return [];
  }
}

// ── Image cache for canvas rendering ──────────────────────────────────────────
const _imgCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): Promise<HTMLImageElement> {
  if (_imgCache.has(url)) return Promise.resolve(_imgCache.get(url)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => { _imgCache.set(url, img); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

// ── BackgroundRenderer ─────────────────────────────────────────────────────────
interface Props {
  videoRef:          React.RefObject<HTMLVideoElement | null>;
  placedStickers:    PlacedSticker[];
  segmentationReady: boolean;
  segmenter:         React.RefObject<ImageSegmenterRef | null>;
  filterStyle?:      string;
}

export interface ImageSegmenterRef {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  segmentForVideo: (video: HTMLVideoElement, timestamp: number, callback: (result: any) => void) => void;
}

export default function BackgroundRenderer({ videoRef, placedStickers, segmentationReady, segmenter, filterStyle }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef(0);
  const maskRef     = useRef<Float32Array | null>(null);
  const loadedImgs  = useRef<Map<string, HTMLImageElement>>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, []);

  // Pre-load images whenever placed stickers change
  useEffect(() => {
    for (const ps of placedStickers) {
      if (ps.giphyUrl && !loadedImgs.current.has(ps.stickerId)) {
        loadImage(ps.giphyUrl).then(img => {
          loadedImgs.current.set(ps.stickerId, img);
        }).catch(() => {});
      }
    }
  }, [placedStickers]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video || !ready) { rafRef.current = requestAnimationFrame(draw); return; }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    if (placedStickers.length === 0) { rafRef.current = requestAnimationFrame(draw); return; }

    // Get segmentation mask
    if (segmentationReady && segmenter.current && !video.paused && video.readyState >= 2) {
      try {
        segmenter.current.segmentForVideo(video, video.currentTime * 1000, (result) => {
          const cat = result.categoryMask;
          if (cat) { maskRef.current = cat.getAsFloat32Array(); cat.close(); }
          result.close?.();
        });
      } catch { /* ignore */ }
    }

    // Build sticker layer
    const stickerLayer = document.createElement("canvas");
    stickerLayer.width = cw; stickerLayer.height = ch;
    const sCtx = stickerLayer.getContext("2d")!;

    for (const ps of placedStickers) {
      const px    = ps.x * cw;
      const py    = ps.y * ch;
      const pSize = cw * 0.18 * ps.scale;

      sCtx.save();
      sCtx.translate(px, py);

      if (ps.giphyUrl) {
        // GIPHY image sticker
        const img = loadedImgs.current.get(ps.stickerId);
        if (img) {
          const half = pSize / 2;
          sCtx.drawImage(img, -half, -half, pSize, pSize);
        }
      }
      sCtx.restore();
    }

    // Composite: video → stickers → person on top
    ctx.drawImage(video, 0, 0, cw, ch);

    if (maskRef.current && maskRef.current.length === cw * ch) {
      const mask = maskRef.current;
      ctx.drawImage(stickerLayer, 0, 0);

      const videoFrame = document.createElement("canvas");
      videoFrame.width = cw; videoFrame.height = ch;
      const vCtx = videoFrame.getContext("2d")!;
      vCtx.drawImage(video, 0, 0, cw, ch);
      const vData = vCtx.getImageData(0, 0, cw, ch);

      const personLayer = ctx.createImageData(cw, ch);
      for (let i = 0; i < mask.length; i++) {
        if ((mask[i] ?? 1) < 0.5) {
          personLayer.data[i * 4]     = vData.data[i * 4]     ?? 0;
          personLayer.data[i * 4 + 1] = vData.data[i * 4 + 1] ?? 0;
          personLayer.data[i * 4 + 2] = vData.data[i * 4 + 2] ?? 0;
          personLayer.data[i * 4 + 3] = 255;
        }
      }

      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(video, 0, 0, cw, ch);
      ctx.drawImage(stickerLayer, 0, 0);
      const personCanvas = document.createElement("canvas");
      personCanvas.width = cw; personCanvas.height = ch;
      personCanvas.getContext("2d")!.putImageData(personLayer, 0, 0);
      ctx.drawImage(personCanvas, 0, 0);
    } else {
      // No segmentation — stickers are shown via the <img> drag handles;
      // skip canvas rendering to avoid duplicates
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
