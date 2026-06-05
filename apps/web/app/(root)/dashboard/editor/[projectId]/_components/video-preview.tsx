"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2, Music } from "lucide-react";

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
    onTimeUpdate, onDurationChange, onPlayPause, onMuteToggle, onEnded },
  ref
) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const trimInRef   = useRef(trimIn);
  const trimOutRef  = useRef(trimOut);
  trimInRef.current  = trimIn;
  trimOutRef.current = trimOut;

  useImperativeHandle(ref, () => ({
    seek: (t) => { if (videoRef.current) videoRef.current.currentTime = t; },
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getDuration: () => videoRef.current?.duration ?? 0,
  }));

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
      <div className="flex-1 flex items-center justify-center relative bg-black overflow-hidden">
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
