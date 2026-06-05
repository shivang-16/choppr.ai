"use client";

import { useState } from "react";
import { X, Volume2, Unlink } from "lucide-react";

interface Props {
  clipLabel: string;
  clipIndex: number;
  volume: number;
  onVolumeChange: (v: number) => void;
  onDetachAudio: () => void;
  onClose: () => void;
}

export default function AudioPanel({ clipLabel, clipIndex, volume, onVolumeChange, onDetachAudio, onClose }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="flex flex-col w-64 shrink-0 border-l border-white/8 bg-[#141414]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-white">Audio</span>
          <div className="flex items-center gap-1 rounded-md bg-white/8 px-2 py-0.5">
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-white/60"><path d="M8 5v14l11-7z"/></svg>
            <span className="text-[11px] text-white/60">{clipIndex}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Go to clip */}
          <button className="h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:bg-white/8 hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:bg-white/8 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Volume section */}
      <div className="flex flex-col gap-4 px-4 py-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-white">Volume</span>
            <span className="text-[14px] text-white/50">{Math.round(volume)}%</span>
          </div>

          {/* Slider */}
          <div className="flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-white/40 shrink-0" />
            <div className="relative flex-1 h-5 flex items-center">
              <div className="absolute left-0 right-0 h-1.5 rounded-full bg-white/10" />
              {/* Filled track */}
              <div
                className="absolute left-0 h-1.5 rounded-full bg-white pointer-events-none"
                style={{ width: `${volume}%` }}
              />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="absolute left-0 right-0 h-1.5 w-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-0"
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/6" />

        {/* Detach audio */}
        <button
          onClick={onDetachAudio}
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-[13px] font-medium text-white/70 hover:bg-white/10 hover:border-white/20 hover:text-white transition-all active:scale-[0.98]"
        >
          <Unlink className="h-4 w-4" />
          Detach audio
        </button>
        <p className="text-[11px] text-white/25 text-center -mt-2">
          Separates audio into its own track
        </p>
      </div>
    </div>
  );
}
