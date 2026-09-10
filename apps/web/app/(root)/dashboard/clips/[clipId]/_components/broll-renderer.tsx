"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { activeBrollAt, type BrollShot } from "./broll-types";

/**
 * Cutaway preview: covers the talking-head picture while A-roll audio
 * continues from the hidden <video>. Captions stay above this layer.
 */
export function BrollRenderer({
  shots,
  currentTime,
  playing,
  objectFit = "cover",
}: {
  shots: BrollShot[];
  currentTime: number;
  playing: boolean;
  objectFit?: "cover" | "contain";
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const active = activeBrollAt(shots, currentTime);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active || active.mediaType !== "video" || !active.src) return;

    const local = Math.max(0, currentTime - active.startTime);
    const target = active.trimIn + local;

    if (video.src !== active.src) {
      video.src = active.src;
      video.load();
    }

    if (Number.isFinite(target) && Math.abs(video.currentTime - target) > 0.18) {
      try {
        video.currentTime = target;
      } catch {
        /* seek race while loading */
      }
    }

    if (playing) {
      if (video.paused) void video.play().catch(() => {});
    } else if (!video.paused) {
      video.pause();
    }
  }, [active, currentTime, playing]);

  if (!active) return null;

  const kenBurns = active.mediaType === "image" && active.status !== "generating";

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 1 }}
    >
      {active.status === "generating" || !active.src ? (
        <div className="flex h-full w-full flex-col items-center justify-center bg-black/70">
          <Loader2 className="h-7 w-7 animate-spin text-white/80" />
          <p className="mt-2 text-[11px] font-medium text-white/70">Generating B-roll</p>
        </div>
      ) : active.mediaType === "image" ? (
        <img
          src={active.src}
          alt=""
          className="h-full w-full"
          style={{
            objectFit,
            transformOrigin: "center center",
            animation: kenBurns
              ? `chopprKenBurns ${Math.max(1.2, active.duration)}s linear both`
              : undefined,
          }}
        />
      ) : (
        <video
          ref={videoRef}
          muted
          playsInline
          preload="auto"
          className="h-full w-full"
          style={{ objectFit }}
        />
      )}
      <style>{`
        @keyframes chopprKenBurns {
          from { transform: scale(1); }
          to { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
