"use client";

import { useEffect, useRef } from "react";
import { clamp, paneRects, sourceCropPixels, type SplitLayout } from "./video-layout";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  layout: SplitLayout;
  filter?: string;
  isMobile?: boolean;
  /** Picture stays under captions; controls stay above the play overlay. */
  layer?: "picture" | "controls";
  onCropPane?: (pane: 0 | 1) => void;
  onDivider?: (divider: number) => void;
}

const cropBtnClass =
  "pointer-events-auto absolute z-[6] inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-black shadow-[0_2px_14px_rgba(0,0,0,0.55)] ring-1 ring-black/10 hover:bg-white/90";

export function SplitLayoutRenderer({
  videoRef, layout, filter, isMobile, layer = "picture", onCropPane, onDivider,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const dragRef = useRef<{
    startY: number;
    startDivider: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (layer !== "picture") return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const parent = canvas.parentElement;
      const cssW = parent?.clientWidth || canvas.clientWidth;
      const cssH = parent?.clientHeight || canvas.clientHeight;
      if (cssW > 0 && cssH > 0) {
        if (canvas.width !== cssW) canvas.width = cssW;
        if (canvas.height !== cssH) canvas.height = cssH;
      }

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const srcW = video.videoWidth;
      const srcH = video.videoHeight;
      if (srcW > 0 && srcH > 0) {
        const [top, bot] = paneRects(canvas.height, layout.divider);
        const panes = [
          { rect: top, crop: layout.panes[0].crop },
          { rect: bot, crop: layout.panes[1].crop },
        ];
        for (const pane of panes) {
          const { sx, sy, sw, sh } = sourceCropPixels(pane.crop, srcW, srcH);
          try {
            ctx.drawImage(video, sx, sy, sw, sh, 0, pane.rect.y, canvas.width, pane.rect.h);
          } catch { /* frame not ready */ }
        }
      }

      const y = Math.round(canvas.height * layout.divider);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(0, y - 1, canvas.width, 2);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef, layout, layer]);

  const topPct = layout.divider * 100;

  if (layer === "picture") {
    return (
      <div className="absolute inset-0 pointer-events-none">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ filter: filter || undefined }}
        />
      </div>
    );
  }

  return (
    <div ref={frameRef} className="absolute inset-0 pointer-events-none">
      <button
        type="button"
        data-crop-btn
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onClick={(e) => { e.stopPropagation(); onCropPane?.(0); }}
        className={`${cropBtnClass} ${isMobile ? "right-2" : "left-2 top-2"}`}
        style={isMobile ? { top: `calc(${topPct}% - 8px)`, transform: "translateY(-100%)" } : undefined}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v10h10M2 4h10v10" /></svg>
        Crop top
      </button>
      <button
        type="button"
        data-crop-btn
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onClick={(e) => { e.stopPropagation(); onCropPane?.(1); }}
        className={`${cropBtnClass} ${isMobile ? "right-2 bottom-2" : "left-2"}`}
        style={isMobile ? undefined : { top: `calc(${topPct}% + 8px)` }}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v10h10M2 4h10v10" /></svg>
        Crop bottom
      </button>
      {/* Full-width divider — drag up/down to resize panes (20%–80%) */}
      <div
        data-split-divider
        className="pointer-events-auto absolute inset-x-0 z-[7] -translate-y-1/2 cursor-row-resize touch-none"
        style={{ top: `${topPct}%`, height: 28 }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const parent = frameRef.current?.getBoundingClientRect();
          dragRef.current = {
            startY: e.clientY,
            startDivider: layout.divider,
            height: parent?.height ?? 1,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) return;
          onDivider?.(clamp(drag.startDivider + (e.clientY - drag.startY) / drag.height, 0.2, 0.8));
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-white/70" />
        <div className="absolute left-1/2 top-1/2 flex h-5 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-[3px] rounded-full bg-white shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
          <span className="h-[3px] w-[3px] rounded-full bg-black/45" />
          <span className="h-[3px] w-[3px] rounded-full bg-black/45" />
          <span className="h-[3px] w-[3px] rounded-full bg-black/45" />
        </div>
      </div>
    </div>
  );
}
