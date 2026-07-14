"use client";

import { useRef, useCallback, useState, useEffect, memo } from "react";
import { Scissors, ZoomIn, ZoomOut, Sparkles, SkipForward, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Extracts frames from a single shared video element and renders them as
 * canvas snapshots. This avoids creating N video elements per clip item.
 */
const VideoThumbnailStrip = memo(function VideoThumbnailStrip({
  src,
  duration,
  zoom,
}: {
  src: string;
  duration: number;
  zoom: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const thumbCount = Math.min(Math.ceil(duration * zoom / 48), 20);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear stale canvases from previous extraction
    container.innerHTML = "";

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    // Do NOT set crossOrigin — S3 clips don't always send CORS headers and
    // the extraction is only for UI thumbnails, so CORS errors don't matter.
    video.src = src;

    let frameIdx = 0;
    let disposed = false;

    const extractNext = () => {
      if (disposed || frameIdx >= thumbCount) {
        // Done — release the video element
        video.removeAttribute("src");
        video.load();
        return;
      }
      const seekTo = (frameIdx / Math.max(1, thumbCount)) * duration;
      video.currentTime = Math.min(seekTo, duration - 0.1);
    };

    video.addEventListener("seeked", () => {
      if (disposed) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 64;
        canvas.className = "h-full w-12 object-cover shrink-0 border-r border-black/20 pointer-events-none";
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, 48, 64);
        }
        container.appendChild(canvas);
      } catch { /* CORS or other draw errors — skip frame */ }
      frameIdx++;
      extractNext();
    });

    video.addEventListener("loadeddata", () => {
      if (!disposed) extractNext();
    }, { once: true });

    video.addEventListener("error", () => {
      video.removeAttribute("src");
      video.load();
    }, { once: true });

    return () => {
      disposed = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, duration, thumbCount]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex overflow-hidden opacity-70"
    />
  );
});

// ── Types ────────────────────────────────────────────────────────────────────

export type TrackItemType = "video" | "audio" | "text";

export interface TrackItem {
  id: string;
  type: TrackItemType;
  startTime: number;     // position on timeline (seconds)
  duration: number;      // visible length on timeline (seconds)
  sourceDuration: number;// ORIGINAL full length of the source — cannot stretch beyond this
  trimIn: number;        // seconds trimmed from start of source
  trimOut: number;       // seconds trimmed from end of source
  label: string;
  /** DB clip id — used by export to resolve src/captions server-side */
  clipId?: string;
  src?: string;
  thumbnailUrl?: string;
  audioDetached?: boolean; // if true, this video item plays muted
  linkedAudioId?: string;  // id of the detached audio item
}

export interface Track {
  id: string;
  items: TrackItem[];
}

interface Props {
  tracks: Track[];
  currentTime: number;
  totalDuration: number;
  zoom: number;
  isPlaying: boolean;
  onSeek: (t: number) => void;
  onZoomChange: (z: number) => void;
  onPlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onCut: () => void;
  onTrimStart: (trackId: string, itemId: string, newStart: number, newDuration: number) => void;
  onTrimEnd: (trackId: string, itemId: string, newDuration: number) => void;
  onMoveItem: (fromTrackId: string, toTrackId: string, itemId: string, newStartTime: number) => void;
  onDeleteItem: (trackId: string, itemId: string) => void;
  onDeleteGap: (trackId: string, gapStart: number) => void;
  onDropMedia: (trackId: string, startTime: number, media: { id: string; src: string; duration: number; label: string; type: TrackItemType; thumbnailUrl?: string }) => void;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
}

const TRACK_HEIGHT = 56;
const RULER_HEIGHT = 28;
const MIN_ZOOM = 15;
const MAX_ZOOM = 300;

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return `${m}:${String(sec).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

function formatRulerTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Timeline({
  tracks, currentTime, totalDuration, zoom, isPlaying,
  onSeek, onZoomChange, onPlayPause, onSkipBack, onSkipForward, onCut,
  onTrimStart, onTrimEnd, onMoveItem, onDeleteItem, onDeleteGap, onDropMedia,
  selectedItemId, onSelectItem,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);
  const [hoveredGap, setHoveredGap] = useState<{ trackId: string; start: number } | null>(null);

  const totalWidth = Math.max(totalDuration * zoom + 200, 900);

  // ── Ruler ticks ──────────────────────────────────────────────────────────
  const tickInterval = zoom > 100 ? 1 : zoom > 50 ? 2 : zoom > 25 ? 5 : 10;
  const ticks: number[] = [];
  for (let t = 0; t <= totalDuration + tickInterval; t += tickInterval) ticks.push(t);

  // ── Seek on ruler click ──────────────────────────────────────────────────
  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = containerRef.current?.scrollLeft ?? 0;
    const x = e.clientX - rect.left + scrollLeft;
    onSeek(Math.max(0, Math.min(x / zoom, totalDuration)));
  }, [zoom, totalDuration, onSeek]);

  // Use a ref for zoom so drag callbacks always get fresh value without re-registering
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // ── Trim left handle ─────────────────────────────────────────────────────
  const handleTrimLeft = useCallback((e: React.PointerEvent, trackId: string, item: TrackItem) => {
    e.stopPropagation();
    e.preventDefault();
    const startX     = e.clientX;
    const origStart  = item.startTime;
    const origDur    = item.duration;
    const origTrimIn = item.trimIn;
    const maxTrimIn  = origTrimIn + origDur - 0.3; // can't trim past 0.3s remaining

    const onMove = (mv: PointerEvent) => {
      const dx       = (mv.clientX - startX) / zoomRef.current;
      const newTrimIn = Math.min(maxTrimIn, Math.max(0, origTrimIn + dx));
      const delta     = newTrimIn - origTrimIn;
      onTrimStart(trackId, item.id, Math.max(0, origStart + delta), Math.max(0.3, origDur - delta));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [onTrimStart]);

  // ── Trim right handle ────────────────────────────────────────────────────
  const handleTrimRight = useCallback((e: React.PointerEvent, trackId: string, item: TrackItem) => {
    e.stopPropagation();
    e.preventDefault();
    const startX  = e.clientX;
    const origDur = item.duration;
    // Max stretch = sourceDuration - trimIn (never exceed original length)
    const maxDur  = item.sourceDuration - item.trimIn;

    const onMove = (mv: PointerEvent) => {
      const dx     = (mv.clientX - startX) / zoomRef.current;
      const newDur = Math.min(maxDur, Math.max(0.3, origDur + dx));
      onTrimEnd(trackId, item.id, newDur);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [onTrimEnd]);

  // ── Drag item via pointer events ─────────────────────────────────────────
  // Tracks ref so closure always reads latest tracks/zoom
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  // Ghost preview state (just position/track highlight — don't mutate tracks)
  const [dragPreview, setDragPreview] = useState<{
    itemId: string; fromTrackId: string; targetTrackIdx: number; previewStart: number;
  } | null>(null);

  const handleItemPointerDown = useCallback((
    e: React.PointerEvent,
    trackId: string,
    item: TrackItem,
    trackIdx: number
  ) => {
    if ((e.target as HTMLElement).closest("[data-trim]")) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const origStart  = item.startTime;
    const startX     = e.clientX;

    // Ghost div follows cursor
    const ghost = document.createElement("div");
    const w = Math.max(item.duration * zoomRef.current, 30);
    ghost.style.cssText = [
      "position:fixed","pointer-events:none","z-index:9999",
      "background:rgba(90,70,190,0.85)","border:2px solid rgba(255,255,255,0.6)",
      "border-radius:8px",`height:${TRACK_HEIGHT - 10}px`,`width:${w}px`,
      "display:flex","align-items:center","padding:0 8px",
      "color:rgba(255,255,255,0.9)","font-size:11px","font-weight:500",
      "white-space:nowrap","overflow:hidden","box-shadow:0 4px 20px rgba(0,0,0,0.5)",
    ].join(";");
    ghost.textContent = item.label;
    document.body.appendChild(ghost);

    let currentTrackIdx = trackIdx;
    let currentStart    = origStart;

    const onMove = (mv: PointerEvent) => {
      const dx          = (mv.clientX - startX) / zoomRef.current;
      currentStart      = Math.max(0, origStart + dx);

      // Detect target track from Y position
      const container = containerRef.current;
      if (container) {
        const rect   = container.getBoundingClientRect();
        const relY   = mv.clientY - rect.top - RULER_HEIGHT + container.scrollTop;
        const idx    = Math.max(0, Math.min(Math.floor(relY / TRACK_HEIGHT), tracksRef.current.length - 1));
        currentTrackIdx = idx;
        setDragOverTrackId(tracksRef.current[idx]?.id ?? null);
      }

      // Update ghost
      ghost.style.left = `${mv.clientX - 20}px`;
      ghost.style.top  = `${mv.clientY - (TRACK_HEIGHT - 10) / 2}px`;

      // Show preview without mutating state
      setDragPreview({
        itemId: item.id,
        fromTrackId: trackId,
        targetTrackIdx: currentTrackIdx,
        previewStart: currentStart,
      });
    };

    const onUp = () => {
      ghost.remove();
      setDragOverTrackId(null);
      setDragPreview(null);

      const targetTrack = tracksRef.current[currentTrackIdx];
      if (targetTrack) {
        onMoveItem(trackId, targetTrack.id, item.id, currentStart);
      }

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [onMoveItem]);

  // ── Calculate drop time from mouse position ─────────────────────────────
  const getDropTime = useCallback((e: React.DragEvent): number => {
    const container = containerRef.current;
    if (!container) return 0;
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const x = e.clientX - containerRect.left + scrollLeft;
    return Math.max(0, x / zoom);
  }, [zoom]);

  // ── Drop on track ────────────────────────────────────────────────────────
  const handleTrackDrop = useCallback((e: React.DragEvent, targetTrackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTrackId(null);

    const dropTime = getDropTime(e);

    // Check if it's an internal move
    const itemData = e.dataTransfer.getData("application/timeline-item");
    if (itemData) {
      try {
        const { trackId, item } = JSON.parse(itemData);
        onMoveItem(trackId, targetTrackId, item.id, dropTime);
      } catch {}
      return;
    }

    // External media drop from media panel
    const mediaData = e.dataTransfer.getData("application/media-clip");
    if (mediaData) {
      try {
        const media = JSON.parse(mediaData);
        onDropMedia(targetTrackId, dropTime, media);
      } catch {}
    }
  }, [getDropTime, onMoveItem, onDropMedia]);

  const handleTrackDragOver = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setDragOverTrackId(trackId);
  };

  // ── Find gaps in a track ─────────────────────────────────────────────────
  const getGaps = (track: Track): { start: number; end: number }[] => {
    const sorted = [...track.items].sort((a, b) => a.startTime - b.startTime);
    const gaps: { start: number; end: number }[] = [];
    // Gap before first item
    if (sorted.length > 0 && sorted[0]!.startTime > 0.5) {
      gaps.push({ start: 0, end: sorted[0]!.startTime });
    }
    // Gaps between items
    for (let i = 0; i < sorted.length - 1; i++) {
      const end = sorted[i]!.startTime + sorted[i]!.duration;
      const nextStart = sorted[i + 1]!.startTime;
      if (nextStart - end > 0.3) {
        gaps.push({ start: end, end: nextStart });
      }
    }
    return gaps;
  };

  return (
    <div className="flex flex-col border-t border-white/8 bg-[#0f0f0f] shrink-0" style={{ height: 240 }}>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-white/6 shrink-0 bg-[#151515]">
        {/* Left tools */}
        <div className="flex items-center gap-1">
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 hover:bg-white/8 hover:text-white transition-colors" title="AI tools">
            <Sparkles className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onCut}
            disabled={!selectedItemId}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 hover:bg-white/8 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            title="Split at playhead (S)"
          >
            <Scissors className="h-3.5 w-3.5" />
          </button>
          {selectedItemId && (
            <button
              onClick={() => {
                const track = tracks.find(t => t.items.some(i => i.id === selectedItemId));
                if (track) onDeleteItem(track.id, selectedItemId);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Center — playback controls + time */}
        <div className="flex items-center gap-2">
          <button onClick={onSkipBack} className="h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:bg-white/8 hover:text-white transition-colors" title="-5s">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="15.5" textAnchor="middle" fontSize="7" fill="currentColor">5</text></svg>
          </button>
          <button
            onClick={onPlayPause}
            className="h-9 w-9 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-colors"
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current ml-0.5"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          <button onClick={onSkipForward} className="h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:bg-white/8 hover:text-white transition-colors" title="+5s">
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <span className="text-[12px] font-mono text-white/50 ml-2">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>

        {/* Right — zoom */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => onZoomChange(Math.max(MIN_ZOOM, zoom - 15))} className="h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:bg-white/8 hover:text-white transition-colors">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <div className="w-16 h-1 rounded-full bg-white/10 relative">
            <div className="absolute left-0 top-0 h-full rounded-full bg-white/40" style={{ width: `${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%` }} />
          </div>
          <button onClick={() => onZoomChange(Math.min(MAX_ZOOM, zoom + 15))} className="h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:bg-white/8 hover:text-white transition-colors">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Scrollable timeline area ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto no-scrollbar relative"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (!dragOverTrackId && tracks[0]) setDragOverTrackId(tracks[0].id); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOverTrackId(null); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverTrackId(null);
          // Fallback — if the drop lands on the container (not a specific track)
          const targetTrackId = tracks[0]?.id;
          if (!targetTrackId) return;

          const dropTime = getDropTime(e);
          const mediaData = e.dataTransfer.getData("application/media-clip") || e.dataTransfer.getData("text/plain");
          if (mediaData) {
            try {
              const media = JSON.parse(mediaData);
              if (media.src && media.duration) {
                onDropMedia(targetTrackId, dropTime, media);
              }
            } catch {}
            return;
          }
          const itemData = e.dataTransfer.getData("application/timeline-item");
          if (itemData) {
            try {
              const { trackId, item } = JSON.parse(itemData);
              onMoveItem(trackId, targetTrackId, item.id, dropTime);
            } catch {}
          }
        }}
      >

        {/* Empty state overlay — pointer-events-none so drops pass through */}
        {tracks.every(t => t.items.length === 0) && (
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-white/15 px-16 py-8">
              <p className="text-[13px] text-white/30 font-medium">Drag & drop media here</p>
            </div>
          </div>
        )}

        <div style={{ width: totalWidth, minWidth: "100%" }} className="relative">

          {/* Ruler */}
          <div
            className="sticky top-0 z-20 bg-[#0f0f0f] border-b border-white/6 cursor-crosshair select-none"
            style={{ height: RULER_HEIGHT }}
            onClick={handleRulerClick}
          >
            {ticks.map((t) => (
              <div key={t} className="absolute top-0" style={{ left: t * zoom }}>
                <div className="w-px bg-white/12" style={{ height: t % (tickInterval * 5) === 0 ? 12 : 6, marginTop: RULER_HEIGHT - (t % (tickInterval * 5) === 0 ? 12 : 6) }} />
                {t % (tickInterval * 2) === 0 && (
                  <span className="absolute top-1 left-1 text-[9px] font-mono text-white/25">{formatRulerTime(t)}</span>
                )}
              </div>
            ))}
            {/* Playhead top marker */}
            <div className="absolute z-30" style={{ left: currentTime * zoom - 5, top: 0 }}>
              <div className="w-[10px] h-3 rounded-b bg-white" />
            </div>
          </div>

          {/* Tracks */}
          <div className="relative">
            {tracks.map((track, trackIdx) => {
              const gaps = getGaps(track);
              return (
                <div
                  key={track.id}
                  className={cn(
                    "relative border-b border-white/5 transition-colors",
                    dragOverTrackId === track.id && "bg-white/4"
                  )}
                  style={{ height: TRACK_HEIGHT }}
                  onDragOver={(e) => handleTrackDragOver(e, track.id)}
                  onDragLeave={() => setDragOverTrackId(null)}
                  onDrop={(e) => handleTrackDrop(e, track.id)}
                >
                  {/* Track background lines */}
                  <div className="absolute inset-0 opacity-30">
                    {ticks.filter(t => t % (tickInterval * 5) === 0).map(t => (
                      <div key={t} className="absolute top-0 bottom-0 w-px bg-white/5" style={{ left: t * zoom }} />
                    ))}
                  </div>

                  {/* Gaps with delete action */}
                  {gaps.map((gap) => (
                    <div
                      key={`gap-${gap.start}`}
                      className="absolute top-2 bottom-2 rounded-lg border border-dashed border-white/12 bg-white/3 flex items-center justify-center cursor-pointer hover:border-white/25 hover:bg-white/6 transition-colors group"
                      style={{ left: gap.start * zoom, width: (gap.end - gap.start) * zoom }}
                      onMouseEnter={() => setHoveredGap({ trackId: track.id, start: gap.start })}
                      onMouseLeave={() => setHoveredGap(null)}
                      onClick={() => onDeleteGap(track.id, gap.start)}
                    >
                      {hoveredGap?.trackId === track.id && hoveredGap.start === gap.start && (gap.end - gap.start) * zoom > 50 && (
                        <div className="flex items-center gap-1 rounded bg-[#222] px-2 py-1 text-[9px] text-white/60 shadow-lg">
                          <Trash2 className="h-2.5 w-2.5" />
                          Delete this gap
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Drag preview ghost in target track */}
                  {dragPreview && dragPreview.targetTrackIdx === trackIdx && dragPreview.fromTrackId !== track.id && (() => {
                    const draggedItem = tracks.flatMap(t => t.items).find(i => i.id === dragPreview.itemId);
                    if (!draggedItem) return null;
                    return (
                      <div
                        key="drag-preview"
                        className="absolute top-1.5 bottom-1.5 rounded-lg border-2 border-white/50 bg-white/10 pointer-events-none z-20"
                        style={{ left: dragPreview.previewStart * zoom, width: Math.max(draggedItem.duration * zoom, 4) }}
                      />
                    );
                  })()}

                  {/* Track items */}
                  {track.items.map((item) => {
                    const isBeingDragged = dragPreview?.itemId === item.id;
                    return (
                    <div
                      key={item.id}
                      onClick={(e) => { e.stopPropagation(); onSelectItem(item.id); }}
                      onPointerDown={(e) => handleItemPointerDown(e, track.id, item, trackIdx)}
                      className={cn(
                        "absolute top-1.5 bottom-1.5 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing border group transition-opacity",
                        isBeingDragged ? "opacity-40" : "opacity-100",
                        selectedItemId === item.id
                          ? "border-white/70 ring-1 ring-white/30 shadow-lg"
                          : "border-white/15 hover:border-white/40"
                      )}
                      style={{
                        left: item.startTime * zoom,
                        width: Math.max(item.duration * zoom, 4),
                      }}
                    >
                      {/* Clip background based on type */}
                      <div className={cn(
                        "absolute inset-0",
                        item.type === "video" && "bg-gradient-to-r from-[#3d2d6b] via-[#4a3580] to-[#3d2d6b]",
                        item.type === "audio" && "bg-gradient-to-r from-[#1e3a2e] via-[#264f3a] to-[#1e3a2e]",
                        item.type === "text"  && "bg-gradient-to-r from-[#3a3a1e] via-[#4f4f26] to-[#3a3a1e]",
                      )} />

                      {/* Video thumbnail strip — uses a single video for frame extraction */}
                      {item.type === "video" && item.src && (
                        <VideoThumbnailStrip
                          src={item.src}
                          duration={item.duration}
                          zoom={zoom}
                        />
                      )}

                      {/* Audio waveform visualization */}
                      {item.type === "audio" && (
                        <div className="absolute inset-0 flex items-center px-1 overflow-hidden opacity-70">
                          {Array.from({ length: Math.floor(item.duration * zoom / 2.5) }).map((_, i) => (
                            <div
                              key={i}
                              className="flex-none w-px mx-px rounded-full bg-white/40"
                              style={{ height: `${25 + Math.sin(i * 0.5) * 40 + Math.random() * 20}%` }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Speaker icon for video/audio */}
                      {(item.type === "video" || item.type === "audio") && (
                        <div className="absolute top-1 left-1.5 z-10">
                          <svg viewBox="0 0 24 24" className="h-3 w-3 fill-white/50"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>
                        </div>
                      )}

                      {/* Label */}
                      <div className="absolute inset-0 flex items-center px-5 z-10">
                        <span className="text-[9px] font-medium text-white/70 truncate drop-shadow-sm">{item.label}</span>
                      </div>

                      {/* Left trim handle */}
                      <div
                        data-trim="left"
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-20 flex items-center justify-center"
                        onPointerDown={(e) => { e.stopPropagation(); handleTrimLeft(e, track.id, item); }}
                      >
                        <div className={cn(
                          "w-0.5 h-4 rounded-full transition-colors",
                          selectedItemId === item.id ? "bg-white" : "bg-white/30 group-hover:bg-white/60"
                        )} />
                      </div>

                      {/* Right trim handle */}
                      <div
                        data-trim="right"
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-20 flex items-center justify-center"
                        onPointerDown={(e) => { e.stopPropagation(); handleTrimRight(e, track.id, item); }}
                      >
                        <div className={cn(
                          "w-0.5 h-4 rounded-full transition-colors",
                          selectedItemId === item.id ? "bg-white" : "bg-white/30 group-hover:bg-white/60"
                        )} />
                      </div>

                      {/* Selected highlight borders */}
                      {selectedItemId === item.id && (
                        <>
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/80 rounded-l-lg" />
                          <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/80 rounded-r-lg" />
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Playhead line */}
          <div
            className="absolute z-30 pointer-events-none"
            style={{ left: currentTime * zoom, top: RULER_HEIGHT, bottom: 0 }}
          >
            <div className="w-px h-full bg-white/90" />
          </div>
        </div>
      </div>

      {/* Bottom scrollbar area */}
      <div className="h-3 border-t border-white/6 bg-[#0a0a0a]" />
    </div>
  );
}
