"use client";

import { Film, LayoutGrid, Type, Wand2, Layers, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Clip {
  _id: string;
  index: number;
  s3Url: string;
  duration: number;
  score: number;
  thumbnailUrl?: string;
}

interface Props {
  clips: Clip[];
  activeClipId: string | null;
  onClipClick: (clip: Clip) => void;
}

const NAV = [
  { icon: Film,        label: "My media" },
  { icon: RefreshCw,   label: "Record & create" },
  { icon: LayoutGrid,  label: "Content library" },
  { icon: Layers,      label: "Templates" },
  { icon: Type,        label: "Text" },
  { icon: Wand2,       label: "Transitions" },
];

function formatDur(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function MediaPanel({ clips, activeClipId, onClipClick }: Props) {
  return (
    <aside className="flex h-full shrink-0">
      {/* Icon rail */}
      <div className="flex w-16 flex-col items-center gap-1 border-r border-white/6 bg-[#111] pt-3 pb-4">
        {NAV.map(({ icon: Icon, label }, i) => (
          <button
            key={label}
            className={cn(
              "flex flex-col items-center gap-1 w-14 py-2 rounded-lg text-[9px] transition-colors",
              i === 0
                ? "bg-white/10 text-white"
                : "text-white/35 hover:bg-white/6 hover:text-white/70"
            )}
            title={label}
          >
            <Icon className="h-4 w-4" />
            <span className="leading-none text-center px-1">{label}</span>
          </button>
        ))}
      </div>

      {/* Media list panel */}
      <div className="flex w-56 flex-col border-r border-white/6 bg-[#141414]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-white/6">
          <span className="text-[12px] font-semibold text-white/70">My media</span>
          <span className="text-[10px] text-white/25">{clips.length} clips</span>
        </div>

        {/* Clips grid */}
        <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
          {clips.length === 0 ? (
            <div className="flex flex-col items-center gap-2 pt-8 text-center px-2">
              <Film className="h-8 w-8 text-white/10" />
              <p className="text-[11px] text-white/25">No clips yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {clips.map((clip) => (
                <div
                  key={clip._id}
                  draggable
                  onDragStart={(e) => {
                    const data = JSON.stringify({
                      id: clip._id,
                      src: clip.s3Url,
                      duration: clip.duration,
                      label: `Clip #${clip.index}`,
                      type: "video",
                      thumbnailUrl: clip.s3Url,
                    });
                    e.dataTransfer.setData("application/media-clip", data);
                    e.dataTransfer.setData("text/plain", data); // fallback for some browsers
                    e.dataTransfer.effectAllowed = "copyMove";
                  }}
                  onClick={() => onClipClick(clip)}
                  className={cn(
                    "group relative flex flex-col rounded-lg overflow-hidden border transition-all text-left cursor-grab active:cursor-grabbing",
                    activeClipId === clip._id
                      ? "border-white/40 ring-1 ring-white/20"
                      : "border-white/8 hover:border-white/20"
                  )}
                >
                  {/* Thumbnail via video poster frame */}
                  <div className="relative aspect-video w-full bg-[#1e1e1e] overflow-hidden">
                    <video
                      src={clip.s3Url}
                      preload="metadata"
                      muted
                      playsInline
                      className="w-full h-full object-cover pointer-events-none"
                      onLoadedData={(e) => {
                        // Seek to 1s to get a meaningful frame
                        (e.target as HTMLVideoElement).currentTime = 1;
                      }}
                    />
                    {/* Duration badge */}
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[8px] font-mono text-white/70">
                      {formatDur(clip.duration)}
                    </span>
                  </div>
                  {/* Name */}
                  <div className="px-1.5 py-1 bg-[#1a1a1a]">
                    <p className="text-[9px] text-white/50 truncate">Clip #{clip.index}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
