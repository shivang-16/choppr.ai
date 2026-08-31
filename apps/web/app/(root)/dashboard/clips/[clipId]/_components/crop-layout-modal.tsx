"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  clampCrop,
  coverCrop,
  type SourceCrop,
} from "./video-layout";

type Handle = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";
type Pane = 0 | 1;

interface SplitProps {
  variant?: "split";
  src: string;
  currentTime: number;
  initialTop: SourceCrop;
  initialBottom: SourceCrop;
  initialPane?: Pane;
  onApply: (top: SourceCrop, bottom: SourceCrop) => void;
  onClose: () => void;
}

interface FillProps {
  variant: "fill";
  src: string;
  currentTime: number;
  aspectLabel: string;
  lockAspect: number;
  initialCrop: SourceCrop;
  onApply: (crop: SourceCrop) => void;
  onClose: () => void;
}

type Props = SplitProps | FillProps;

export function CropLayoutModal(props: Props) {
  const isFill = props.variant === "fill";
  const { src, currentTime, onClose } = props;

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState<Pane>(() => (
    !isFill && props.initialPane === 1 ? 1 : 0
  ));
  const [crops, setCrops] = useState<[SourceCrop, SourceCrop]>(() => (
    isFill ? [props.initialCrop, props.initialCrop] : [props.initialTop, props.initialBottom]
  ));
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    start: SourceCrop;
  } | null>(null);
  const cropRef = useRef<SourceCrop>(crops[isFill ? 0 : 0]);

  const crop = crops[isFill ? 0 : pane];
  cropRef.current = crop;

  const setCrop = (next: SourceCrop | ((prev: SourceCrop) => SourceCrop)) => {
    setCrops(prev => {
      const idx = isFill ? 0 : pane;
      const value = typeof next === "function" ? next(prev[idx]) : next;
      if (isFill) return [value, value];
      return pane === 0 ? [value, prev[1]] : [prev[0], value];
    });
  };

  const goToPane = (next: Pane) => {
    dragRef.current = null;
    setDragging(false);
    setPane(next);
  };

  const [frameReady, setFrameReady] = useState(false);
  const seekOnceRef = useRef(currentTime);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    setFrameReady(false);
    let cancelled = false;

    const paint = () => {
      if (cancelled) return;
      setFrameReady(true);
    };

    const seekAndPaint = () => {
      if (cancelled) return;
      const t = Number.isFinite(seekOnceRef.current) ? Math.max(0, seekOnceRef.current) : 0;
      const onSeeked = () => {
        v.removeEventListener("seeked", onSeeked);
        paint();
      };
      v.addEventListener("seeked", onSeeked);
      try {
        // Seek away from 0 so browsers that skip seeked-at-zero still decode a frame.
        v.currentTime = t > 0.04 ? t : 0.04;
      } catch {
        paint();
      }
      // Force a decoded frame when a second <video> shares the preview URL.
      v.muted = true;
      const playAttempt = v.play();
      if (playAttempt) {
        playAttempt.then(() => {
          if (cancelled) return;
          v.pause();
          paint();
        }).catch(() => { /* autoplay blocked — seeked should still paint */ });
      }
    };

    const onLoaded = () => seekAndPaint();
    v.addEventListener("loadeddata", onLoaded);
    v.addEventListener("canplay", onLoaded, { once: true });
    if (v.readyState >= 2) seekAndPaint();
    else v.load();

    return () => {
      cancelled = true;
      v.removeEventListener("loadeddata", onLoaded);
      v.removeEventListener("canplay", onLoaded);
      try { v.pause(); } catch { /* ignore */ }
    };
  }, [src]);

  useEffect(() => {
    if (!isFill) return;
    const v = videoRef.current;
    const applyLock = () => {
      const srcW = v?.videoWidth || 16;
      const srcH = v?.videoHeight || 9;
      const dest = props.lockAspect;
      const cur = cropRef.current;
      const cropAspect = (cur.w * srcW) / Math.max(cur.h * srcH, 1);
      if (Math.abs(cropAspect - dest) < 0.02) return;
      setCrop(coverCrop(srcW, srcH, dest, cur.x + cur.w / 2));
    };
    if (v && v.readyState >= 1) applyLock();
    else v?.addEventListener("loadedmetadata", applyLock, { once: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFill, isFill ? props.lockAspect : 0]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const applyDrag = useCallback((clientX: number, clientY: number) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dx = (clientX - drag.startX) / rect.width;
    const dy = (clientY - drag.startY) / rect.height;
    const s = drag.start;
    let next = { ...s };

    if (isFill || drag.handle === "move") {
      next = { ...s, x: s.x + dx, y: s.y + dy };
    } else {
      if (drag.handle.includes("w")) {
        next.x = s.x + dx;
        next.w = s.w - dx;
      }
      if (drag.handle.includes("e")) next.w = s.w + dx;
      if (drag.handle.includes("n")) {
        next.y = s.y + dy;
        next.h = s.h - dy;
      }
      if (drag.handle.includes("s")) next.h = s.h + dy;
    }
    setCrop(clampCrop(next));
  }, [isFill, pane]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      applyDrag(e.clientX, e.clientY);
    };
    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [applyDrag]);

  const startDrag = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, start: cropRef.current };
    setDragging(true);
  };

  const nudge = (dx: number, dy: number) => {
    setCrop(prev => clampCrop({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  };

  const resetCrop = () => {
    if (isFill) {
      const v = videoRef.current;
      const srcW = v?.videoWidth || 16;
      const srcH = v?.videoHeight || 9;
      setCrop(coverCrop(srcW, srcH, props.lockAspect));
      return;
    }
    setCrop(pane === 0 ? props.initialTop : props.initialBottom);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/80 sm:items-center sm:px-4 sm:py-8 sm:backdrop-blur-sm">
      <div className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-[#111] sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-white/12 sm:shadow-2xl">
        {isFill ? (
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <p className="text-[12px] font-semibold text-white/70">Crop · Fill</p>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-black">
                {props.aspectLabel}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M3 3l10 10M13 3 3 13" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center border-b border-white/8 px-4 pt-3">
            {([
              { id: 0 as const, label: "Top" },
              { id: 1 as const, label: "Bottom" },
            ]).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => goToPane(t.id)}
                className={cn(
                  "relative cursor-pointer px-4 py-2 text-[12px] font-semibold transition-colors",
                  pane === t.id ? "text-white" : "text-white/40 hover:text-white/70",
                )}
              >
                {t.label}
                {pane === t.id && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-white" />
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-auto mb-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 3l10 10M13 3 3 13" />
              </svg>
            </button>
          </div>
        )}

        <p className="px-4 pt-2 text-center text-[11px] text-white/45 sm:hidden">
          Drag anywhere on the video to move the box
        </p>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-black px-0 py-3 sm:flex-none sm:px-4 sm:py-5">
          <div
            ref={stageRef}
            className={cn(
              "relative max-h-full max-w-full touch-none select-none overflow-hidden",
              !frameReady && "min-h-[240px] w-full min-w-[280px]",
            )}
            style={{ touchAction: "none" }}
            onPointerDown={startDrag("move")}
          >
            {!frameReady && (
              <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black text-[12px] text-white/40">
                Loading video…
              </div>
            )}
            <video
              ref={videoRef}
              key={src}
              src={src}
              muted
              playsInline
              preload="auto"
              controls={false}
              className="pointer-events-none block max-h-[min(62dvh,100%)] max-w-full sm:max-h-[58vh]"
              style={{ width: "auto", height: "auto", opacity: frameReady ? 1 : 0 }}
            />
            <div
              className={cn(
                "absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]",
                dragging ? "cursor-grabbing" : "cursor-grab",
              )}
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
                touchAction: "none",
              }}
              onPointerDown={startDrag("move")}
            >
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:h-8 sm:w-8">
                  <svg viewBox="0 0 16 16" className="h-5 w-5 text-black sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M8 2v12M2 8h12M4.5 4.5 2 8l2.5 3.5M11.5 4.5 14 8l-2.5 3.5M4.5 11.5 8 14l3.5-2.5M4.5 4.5 8 2l3.5 2.5" />
                  </svg>
                </div>
              </div>
              {!isFill && (["nw", "ne", "sw", "se"] as Handle[]).map(h => (
                <div
                  key={h}
                  onPointerDown={startDrag(h)}
                  className="absolute h-5 w-5 -m-1 rounded-sm border border-black/40 bg-white sm:h-3 sm:w-3 sm:m-0"
                  style={{
                    cursor: `${h}-resize`,
                    touchAction: "none",
                    ...(h.includes("n") ? { top: -8 } : { bottom: -8 }),
                    ...(h.includes("w") ? { left: -8 } : { right: -8 }),
                  }}
                />
              ))}
              {!isFill && (["n", "s"] as Handle[]).map(h => (
                <div
                  key={h}
                  onPointerDown={startDrag(h)}
                  className="absolute left-1/2 h-4 w-11 -translate-x-1/2 rounded-sm bg-white/90 sm:h-2 sm:w-8"
                  style={{
                    cursor: "ns-resize",
                    touchAction: "none",
                    ...(h === "n" ? { top: -6 } : { bottom: -6 }),
                  }}
                />
              ))}
              {!isFill && (["e", "w"] as Handle[]).map(h => (
                <div
                  key={h}
                  onPointerDown={startDrag(h)}
                  className="absolute top-1/2 h-11 w-4 -translate-y-1/2 rounded-sm bg-white/90 sm:h-8 sm:w-2"
                  style={{
                    cursor: "ew-resize",
                    touchAction: "none",
                    ...(h === "w" ? { left: -6 } : { right: -6 }),
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 px-4 pb-2 sm:hidden">
          {(["left", "up", "down", "right"] as const).map(dir => (
            <button
              key={dir}
              type="button"
              onClick={() => nudge(
                dir === "left" ? -0.04 : dir === "right" ? 0.04 : 0,
                dir === "up" ? -0.04 : dir === "down" ? 0.04 : 0,
              )}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/16"
              aria-label={`Nudge ${dir}`}
            >
              <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {dir === "left" && <path d="M10 3 5 8l5 5" />}
                {dir === "right" && <path d="M6 3l5 5-5 5" />}
                {dir === "up" && <path d="M3 10l5-5 5 5" />}
                {dir === "down" && <path d="M3 6l5 5 5-5" />}
              </svg>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-white/8 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg px-3 py-2 text-[13px] text-white/50 hover:text-white"
          >
            Close
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetCrop}
              className="cursor-pointer rounded-lg border border-white/12 px-3 py-2 text-[13px] text-white/60 hover:bg-white/8 hover:text-white"
            >
              Reset
            </button>
            {isFill ? (
              <button
                type="button"
                onClick={() => props.onApply(crops[0])}
                className="rounded-lg bg-white px-5 py-2 text-[13px] font-semibold text-black"
              >
                Apply
              </button>
            ) : pane === 0 ? (
              <button
                type="button"
                onClick={() => goToPane(1)}
                className="rounded-lg bg-white px-5 py-2 text-[13px] font-semibold text-black"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => props.onApply(crops[0], crops[1])}
                className="rounded-lg bg-white px-5 py-2 text-[13px] font-semibold text-black"
              >
                Apply
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
