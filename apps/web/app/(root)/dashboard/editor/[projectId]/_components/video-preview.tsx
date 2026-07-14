"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2, Music } from "lucide-react";
import type { ThumbnailOverlay } from "./thumbnail-panel";

export interface VideoPreviewHandle {
  seek: (t: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface Props {
  src: string | null;
  itemType: "video" | "audio" | "text" | null; // type of the selected item
  isPlaying: boolean;
  isMuted: boolean;
  trimIn: number;
  trimOut: number;
  volume: number;         // 0-100
  audioDetached: boolean; // if true, video plays with no audio
  thumbnailOverlay?: ThumbnailOverlay | null;
  onThumbnailMove?: (overlay: ThumbnailOverlay) => void;
  onTimeUpdate: (t: number) => void;
  onDurationChange: (d: number) => void;
  onPlayPause: () => void;
  onMuteToggle: () => void;
  onEnded: () => void;
}

function formatTime(s: number) {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms  = Math.floor((s % 1) * 100);
  return `${m}:${String(sec).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

const VideoPreview = forwardRef<VideoPreviewHandle, Props>(function VideoPreview(
  { src, itemType, isPlaying, isMuted, trimIn, trimOut, volume, audioDetached,
    thumbnailOverlay, onThumbnailMove,
    onTimeUpdate, onDurationChange, onPlayPause, onMuteToggle, onEnded },
  ref
) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const trimInRef   = useRef(trimIn);
  const trimOutRef  = useRef(trimOut);
  trimInRef.current  = trimIn;
  trimOutRef.current = trimOut;

  // ── Thumbnail drag state ────────────────────────────────────────────────
  const canvasRef      = useRef<HTMLDivElement>(null);
  const dragStartRef   = useRef<{ mouseX: number; mouseY: number; overlayX: number; overlayY: number } | null>(null);
  const [isDraggingThumb, setIsDraggingThumb] = useState(false);

  const handleThumbMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!thumbnailOverlay || !canvasRef.current) return;
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      dragStartRef.current = {
        mouseX:   e.clientX,
        mouseY:   e.clientY,
        overlayX: thumbnailOverlay.x,
        overlayY: thumbnailOverlay.y,
      };
      setIsDraggingThumb(true);

      const onMove = (ev: MouseEvent) => {
        if (!dragStartRef.current || !canvasRef.current || !thumbnailOverlay) return;
        const dx = ((ev.clientX - dragStartRef.current.mouseX) / rect.width)  * 100;
        const dy = ((ev.clientY - dragStartRef.current.mouseY) / rect.height) * 100;
        const newX = Math.min(100 - thumbnailOverlay.width, Math.max(0, dragStartRef.current.overlayX + dx));
        const newY = Math.min(95, Math.max(0, dragStartRef.current.overlayY + dy));
        onThumbnailMove?.({ ...thumbnailOverlay, x: newX, y: newY });
      };

      const onUp = () => {
        dragStartRef.current = null;
        setIsDraggingThumb(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [thumbnailOverlay, onThumbnailMove]
  );

  useImperativeHandle(ref, () => ({
    seek: (t) => { if (videoRef.current) videoRef.current.currentTime = t; },
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getDuration: () => videoRef.current?.duration ?? 0,
  }));

  // Release WebMediaPlayer slot on unmount
  useEffect(() => {
    return () => {
      const v = videoRef.current;
      if (v) { v.pause(); v.removeAttribute("src"); v.load(); }
    };
  }, []);

  // Sync play/pause
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    if (isPlaying) v.play().catch(() => {});
    else v.pause();
  }, [isPlaying, src]);

  // Sync volume — audioDetached mutes the video track entirely
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted  = isMuted || audioDetached;
    v.volume = Math.min(1, Math.max(0, (isMuted || audioDetached ? 0 : volume) / 100));
  }, [isMuted, volume, audioDetached]);

  // When src changes seek to trimIn
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    const onLoaded = () => { v.currentTime = trimInRef.current; };
    v.addEventListener("loadedmetadata", onLoaded, { once: true });
    return () => v.removeEventListener("loadedmetadata", onLoaded);
  }, [src]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;

    // Stop at trimOut boundary
    if (trimOutRef.current > 0) {
      const endTime = v.duration - trimOutRef.current;
      if (t >= endTime) {
        v.pause();
        v.currentTime = trimInRef.current;
        onEnded();
        return;
      }
    }
    // Snap back if before trimIn
    if (t < trimInRef.current - 0.05) {
      v.currentTime = trimInRef.current;
      return;
    }
    onTimeUpdate(t);
  };

  const displayTime = Math.max(0, (videoRef.current?.currentTime ?? 0) - trimIn);
  const isAudioOnly = itemType === "audio";

  return (
    <div className="flex flex-col flex-1 bg-[#0d0d0d] overflow-hidden">
      {/* Canvas */}
      <div ref={canvasRef} className="flex-1 flex items-center justify-center relative bg-black overflow-hidden">
        {src ? (
          <>
            <video
              ref={videoRef}
              src={src}
              className={isAudioOnly ? "hidden" : "max-w-full max-h-full object-contain"}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={() => onDurationChange(videoRef.current?.duration ?? 0)}
              onEnded={onEnded}
              playsInline
            />
            {/* Audio-only visual */}
            {isAudioOnly && (
              <div className="flex flex-col items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-white/8 border border-white/12 flex items-center justify-center">
                  <Music className="h-8 w-8 text-white/40" />
                </div>
                <div className="flex items-center gap-1 h-8">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-white/40"
                      style={{
                        height: isPlaying ? `${20 + Math.sin(Date.now() / 200 + i) * 60}%` : "20%",
                        transition: "height 0.1s",
                      }}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-white/30 font-mono">{formatTime(displayTime)}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/15">
            <div className="h-16 w-16 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center">
              <Play className="h-6 w-6" />
            </div>
            <p className="text-[12px]">Select a clip from the timeline to preview</p>
          </div>
        )}

        {/* Thumbnail overlay — draggable */}
        {thumbnailOverlay && (
          <ThumbnailOverlayLayer
            overlay={thumbnailOverlay}
            isDragging={isDraggingThumb}
            onMouseDown={handleThumbMouseDown}
          />
        )}

        {src && !isAudioOnly && (
          <button
            onClick={() => videoRef.current?.requestFullscreen()}
            className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-lg bg-black/50 text-white/40 hover:text-white transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 border-t border-white/6 bg-[#1a1a1a] px-4 h-11 shrink-0">
        <button
          onClick={onPlayPause}
          className="h-8 w-8 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-colors shrink-0"
        >
          {isPlaying
            ? <Pause className="h-3.5 w-3.5 fill-black" />
            : <Play  className="h-3.5 w-3.5 fill-black ml-0.5" />
          }
        </button>
        <button onClick={onMuteToggle} className="text-white/40 hover:text-white transition-colors shrink-0">
          {isMuted || audioDetached ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        {!isAudioOnly && (
          <span className="text-[12px] font-mono text-white/50 shrink-0">
            {formatTime(displayTime)}
          </span>
        )}
      </div>
    </div>
  );
});

export default VideoPreview;

// ── Draggable thumbnail overlay rendered inside the preview canvas ──────────
function ThumbnailOverlayLayer({
  overlay,
  isDragging,
  onMouseDown,
}: {
  overlay: ThumbnailOverlay;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const heightMap: Record<string, string | undefined> = {
    full:            "100%",
    "top-banner":    "33%",
    "bottom-banner": "33%",
    "corner-br":     undefined,
    "corner-tl":     undefined,
    center:          undefined,
  };

  const height = heightMap[overlay.styleId];

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position:    "absolute",
        left:        `${overlay.x}%`,
        top:         `${overlay.y}%`,
        width:       `${overlay.width}%`,
        height:      height ?? "auto",
        aspectRatio: height ? undefined : "16/9",
        cursor:      isDragging ? "grabbing" : "grab",
        userSelect:  "none",
        zIndex:      10,
      }}
      title="Drag to reposition thumbnail"
    >
      <img
        src={overlay.imageUrl}
        alt="Thumbnail overlay"
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {/* Drag handle indicator */}
      <div
        style={{
          position:        "absolute",
          inset:           0,
          border:          isDragging ? "2px solid rgba(255,255,255,0.8)" : "1px dashed rgba(255,255,255,0.4)",
          borderRadius:    2,
          pointerEvents:   "none",
          transition:      "border 0.15s",
        }}
      />
    </div>
  );
}
