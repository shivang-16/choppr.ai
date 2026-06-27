"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type StickerId = string;

export interface PlacedSticker {
  stickerId:  string;      // "stipop:{id}" for Stipop stickers
  stickerUrl?: string;     // full render URL — set for Stipop stickers
  previewUrl?: string;     // small thumbnail URL for UI — set for Stipop stickers
  /** @deprecated use stickerUrl */
  giphyUrl?:  string;      // kept for backwards-compat with any saved exports
  x:     number;           // 0-1 normalized
  y:     number;           // 0-1 normalized
  scale: number;           // 0.3 - 2.0
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

// ── Stipop helpers ─────────────────────────────────────────────────────────────
export const STIPOP_KEY = process.env.NEXT_PUBLIC_STIPOP_API_KEY ?? "";
const STIPOP_USER_ID = "choppr-web";

export interface StipopSticker {
  id:         string;
  title:      string;
  previewUrl: string;   // image URL for the picker grid
  renderUrl:  string;   // full-size image URL for canvas / export
}

export interface StipopPack {
  packageId:  number;
  packageName: string;
  packageImg: string;
}

/** Fetch trending sticker packs (shown as pack covers on "Trending" tab) */
export async function fetchStipopTrendingPacks(limit = 20): Promise<StipopPack[]> {
  if (!STIPOP_KEY) return [];
  try {
    const res  = await fetch(
      `https://messenger.stipop.io/v1/package?userId=${STIPOP_USER_ID}&limit=${limit}&lang=en&countryCode=US`,
      { headers: { apikey: STIPOP_KEY } },
    );
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.body?.packageList ?? []).map((p: any) => ({
      packageId:   p.packageId,
      packageName: p.packageName ?? "",
      packageImg:  p.packageImg  ?? "",
    }));
  } catch {
    return [];
  }
}

/** Fetch all stickers inside a pack */
export async function fetchStipopPackStickers(packageId: number): Promise<StipopSticker[]> {
  if (!STIPOP_KEY) return [];
  try {
    const res  = await fetch(
      `https://messenger.stipop.io/v1/package/${packageId}?userId=${STIPOP_USER_ID}`,
      { headers: { apikey: STIPOP_KEY } },
    );
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.body?.package?.stickers ?? []).map((s: any) => ({
      id:         String(s.stickerId),
      title:      json.body?.package?.packageName ?? "",
      previewUrl: s.stickerImg ?? "",
      renderUrl:  s.stickerImg ?? "",
    }));
  } catch {
    return [];
  }
}

/** Search stickers by keyword */
export async function fetchStipopStickers(query: string, limit = 24): Promise<StipopSticker[]> {
  if (!STIPOP_KEY) return [];
  if (!query.trim()) return [];
  try {
    const res  = await fetch(
      `https://messenger.stipop.io/v1/search?userId=${STIPOP_USER_ID}&q=${encodeURIComponent(query)}&limit=${limit}&lang=en&countryCode=US`,
      { headers: { apikey: STIPOP_KEY } },
    );
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.body?.stickerList ?? []).map((s: any) => ({
      id:         String(s.stickerId),
      title:      s.keyword ?? "",
      previewUrl: s.stickerImg ?? "",
      renderUrl:  s.stickerImg ?? "",
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
      const url = ps.stickerUrl ?? ps.giphyUrl;
      if (url && !loadedImgs.current.has(ps.stickerId)) {
        loadImage(url).then(img => {
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

      if (ps.stickerUrl ?? ps.giphyUrl) {
        // Stipop (or legacy Giphy) image sticker
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
