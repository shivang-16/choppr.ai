"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useApiFetch } from "@/lib/apiFetch";
import { randomUUID } from "crypto";
import EditorTopbar from "./_components/editor-topbar";
import MediaPanel from "./_components/media-panel";
import VideoPreview, { VideoPreviewHandle } from "./_components/video-preview";
import RightToolbar from "./_components/right-toolbar";
import AudioPanel from "./_components/audio-panel";
import ThumbnailPanel from "./_components/thumbnail-panel";
import type { ThumbnailOverlay } from "./_components/thumbnail-panel";
import Timeline, { Track, TrackItem, TrackItemType } from "./_components/timeline";
import ExportModal from "./_components/export-modal";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const INITIAL_ZOOM = 60;

function uid() {
  return Math.random().toString(36).slice(2, 12);
}

interface DbClip {
  _id: string;
  index: number;
  s3Url: string;
  duration: number;
  score: number;
  startTime: number;
  endTime: number;
  reason: string;
  thumbnailUrl?: string;
}

interface HistoryEntry {
  tracks: Track[];
}

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const apiFetch = useApiFetch();

  // ── State ──────────────────────────────────────────────────────────────────
  const [project, setProject]       = useState<any>(null);
  const [dbClips, setDbClips]       = useState<DbClip[]>([]);
  const [tracks, setTracks]         = useState<Track[]>([]);
  const [activeMediaClip, setActiveMediaClip] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId]   = useState<string | null>(null);
  const [activeSrc, setActiveSrc]             = useState<string | null>(null);
  const [currentTime, setCurrentTime]         = useState(0);
  const [totalDuration, setTotalDuration]     = useState(0);
  const [isPlaying, setIsPlaying]             = useState(false);
  const [isMuted, setIsMuted]                 = useState(false);
  const [zoom, setZoom]                       = useState(INITIAL_ZOOM);
  const [rightPanel, setRightPanel]           = useState("");
  const [showExport, setShowExport]           = useState(false);
  // volume per item id (0-100), default 100
  const [volumes, setVolumes]                 = useState<Record<string, number>>({});
  const [history, setHistory]                 = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx]           = useState(-1);
  const [thumbnailOverlay, setThumbnailOverlay] = useState<ThumbnailOverlay | null>(null);

  const videoRef = useRef<VideoPreviewHandle>(null);

  // ── Fetch project + clips → build initial tracks ──────────────────────────
  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      apiFetch(`${API_URL}/api/projects/${projectId}`).then(r => r.json()),
      apiFetch(`${API_URL}/api/projects/${projectId}/clips`).then(r => r.json()),
    ]).then(([proj, clips]) => {
      setProject(proj);
      setDbClips(clips);

      // Build default 3 empty tracks — user drags clips from media panel
      const initialTracks: Track[] = [
        { id: "track-video", items: [] },
        { id: "track-text", items: [] },
        { id: "track-audio", items: [] },
      ];

      setTracks(initialTracks);
      setTotalDuration(30); // default 30s visible

      // Don't auto-load preview — only plays when on timeline
      if (clips.length > 0) {
        setActiveMediaClip(clips[0]._id);
      }

      pushHistory(initialTracks);
    }).catch(() => {});
  }, [projectId]);

  // ── History ───────────────────────────────────────────────────────────────
  const pushHistory = useCallback((newTracks: Track[]) => {
    setHistory(h => {
      const sliced = h.slice(0, historyIdx + 1);
      const entry: HistoryEntry = { tracks: JSON.parse(JSON.stringify(newTracks)) };
      const next = [...sliced, entry];
      setHistoryIdx(next.length - 1);
      return next;
    });
  }, [historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    const prev = history[historyIdx - 1];
    if (prev) { setTracks(prev.tracks); setHistoryIdx(i => i - 1); }
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const next = history[historyIdx + 1];
    if (next) { setTracks(next.tracks); setHistoryIdx(i => i + 1); }
  }, [history, historyIdx]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); setIsPlaying(p => !p); }
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ" && e.shiftKey) { e.preventDefault(); redo(); }
      if (e.code === "KeyS") { e.preventDefault(); handleCut(); }
      if (e.code === "Delete" || e.code === "Backspace") {
        if (selectedItemId) {
          const track = tracks.find(t => t.items.some(i => i.id === selectedItemId));
          if (track) handleDeleteItem(track.id, selectedItemId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [historyIdx, history, selectedItemId, tracks]);

  // ── Recalculate duration ──────────────────────────────────────────────────
  useEffect(() => {
    let max = 1;
    for (const track of tracks) {
      for (const item of track.items) {
        max = Math.max(max, item.startTime + item.duration);
      }
    }
    setTotalDuration(max);
  }, [tracks]);

  // ── Timeline handlers ─────────────────────────────────────────────────────
  const updateTracks = (newTracks: Track[]) => {
    setTracks(newTracks);
    pushHistory(newTracks);
  };

  // ── Timeline position (what the playhead shows) vs video source time ────────
  // currentTime = timeline position (seconds from start of timeline)
  // video source time = currentTime - selectedItem.startTime + selectedItem.trimIn
  const handleSeek = (t: number) => {
    setCurrentTime(t);
    if (selectedItem) {
      // Convert timeline position → video source position
      const sourceTime = selectedItem.trimIn + (t - selectedItem.startTime);
      if (sourceTime >= selectedItem.trimIn && sourceTime <= selectedItem.trimIn + selectedItem.duration) {
        videoRef.current?.seek(sourceTime);
      }
    } else {
      videoRef.current?.seek(t);
    }
  };

  const handleTrimStart = (trackId: string, itemId: string, newStart: number, newDuration: number) => {
    setTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      return {
        ...t,
        items: t.items.map(i => {
          if (i.id !== itemId) return i;
          // trimIn increases by however much startTime increased
          const delta = newStart - i.startTime;
          return { ...i, startTime: newStart, duration: newDuration, trimIn: Math.max(0, i.trimIn + delta), sourceDuration: i.sourceDuration };
        }),
      };
    }));
  };

  const handleTrimEnd = (trackId: string, itemId: string, newDuration: number) => {
    setTracks(prev => prev.map(t =>
      t.id === trackId
        ? { ...t, items: t.items.map(i => i.id === itemId ? { ...i, duration: newDuration } : i) }
        : t
    ));
  };

  const handleMoveItem = (fromTrackId: string, toTrackId: string, itemId: string, newStartTime: number) => {
    let movedItem: TrackItem | null = null;

    // Step 1: Remove item from source track
    const withRemoved = tracks.map(t => {
      if (t.id !== fromTrackId) return t;
      const item = t.items.find(i => i.id === itemId);
      if (item) movedItem = { ...item, startTime: newStartTime };
      return { ...t, items: t.items.filter(i => i.id !== itemId) };
    });

    if (!movedItem) return;
    const moved = movedItem as TrackItem;
    const movedEnd = moved.startTime + moved.duration;

    // Step 2: Insert into target track with overlap prevention
    const updated = withRemoved.map(t => {
      if (t.id !== toTrackId) return t;

      // Sort existing items
      const sorted = [...t.items].sort((a, b) => a.startTime - b.startTime);

      // Check if drop lands inside a gap between clips — fill & push
      // Find items that overlap with the moved clip
      const overlapping = sorted.filter(i =>
        i.startTime < movedEnd && i.startTime + i.duration > moved.startTime
      );

      let finalItems: TrackItem[];
      if (overlapping.length === 0) {
        // No overlap — just insert
        finalItems = [...sorted, moved].sort((a, b) => a.startTime - b.startTime);
      } else {
        // Push all items that start AFTER the drop point to make room
        const pushAmount = movedEnd - Math.min(...overlapping.map(i => i.startTime));
        finalItems = [
          moved,
          ...sorted.map(i =>
            i.startTime >= moved.startTime
              ? { ...i, startTime: i.startTime + pushAmount }
              : i
          ),
        ].sort((a, b) => a.startTime - b.startTime);
      }

      return { ...t, items: finalItems };
    });

    updateTracks(updated);
  };

  const handleDeleteItem = (trackId: string, itemId: string) => {
    const updated = tracks.map(t =>
      t.id === trackId ? { ...t, items: t.items.filter(i => i.id !== itemId) } : t
    );
    setSelectedItemId(null);
    updateTracks(updated);
  };

  const handleDeleteGap = (trackId: string, gapStart: number) => {
    const updated = tracks.map(t => {
      if (t.id !== trackId) return t;
      const sorted = [...t.items].sort((a, b) => a.startTime - b.startTime);
      // Find items after the gap and shift them left
      const gap = sorted.find(i => i.startTime > gapStart);
      if (!gap) return t;
      const gapEnd = gap.startTime;
      const gapSize = gapEnd - gapStart;
      return {
        ...t,
        items: t.items.map(i => i.startTime >= gapEnd ? { ...i, startTime: i.startTime - gapSize } : i),
      };
    });
    updateTracks(updated);
  };

  const handleDropMedia = (trackId: string, startTime: number, media: { id: string; src: string; duration: number; label: string; type: TrackItemType; thumbnailUrl?: string }) => {
    const newItem: TrackItem = {
      id: uid(),
      type: media.type,
      startTime,
      duration: media.duration,
      sourceDuration: media.duration,
      trimIn: 0,
      trimOut: 0,
      label: media.label,
      src: media.src,
      thumbnailUrl: media.thumbnailUrl,
    };
    const newEnd = startTime + media.duration;

    const updated = tracks.map(t => {
      if (t.id !== trackId) return t;

      const sorted = [...t.items].sort((a, b) => a.startTime - b.startTime);
      const overlapping = sorted.filter(i =>
        i.startTime < newEnd && i.startTime + i.duration > startTime
      );

      let finalItems: TrackItem[];
      if (overlapping.length === 0) {
        finalItems = [...sorted, newItem].sort((a, b) => a.startTime - b.startTime);
      } else {
        // Push items at or after drop point to make room
        const pushAmount = newEnd - Math.min(...overlapping.map(i => i.startTime));
        finalItems = [
          newItem,
          ...sorted.map(i =>
            i.startTime >= startTime
              ? { ...i, startTime: i.startTime + pushAmount }
              : i
          ),
        ].sort((a, b) => a.startTime - b.startTime);
      }
      return { ...t, items: finalItems };
    });
    updateTracks(updated);
  };

  // ── Cut at playhead ───────────────────────────────────────────────────────
  const handleCut = useCallback(() => {
    if (!selectedItemId) return;

    let cutDone = false;
    const updated = tracks.map(track => {
      if (cutDone) return track;
      const itemIdx = track.items.findIndex(i => i.id === selectedItemId);
      if (itemIdx === -1) return track;
      const item = track.items[itemIdx]!;

      // playhead must be inside the clip
      const localTime = currentTime - item.startTime;
      if (localTime <= 0.1 || localTime >= item.duration - 0.1) return track;

      cutDone = true;
      const left: TrackItem = {
        ...item,
        duration: localTime,
        trimOut: item.trimOut + (item.duration - localTime),
      };
      const right: TrackItem = {
        ...item,
        id: uid(),
        startTime: item.startTime + localTime,
        duration: item.duration - localTime,
        sourceDuration: item.sourceDuration,
        trimIn: item.trimIn + localTime,
      };
      const newItems = [...track.items];
      newItems.splice(itemIdx, 1, left, right);
      return { ...track, items: newItems };
    });

    if (cutDone) updateTracks(updated);
  }, [selectedItemId, currentTime, tracks]);

  // ── Media panel click — only selects, doesn't load preview ─────────────────
  const handleMediaClipClick = (clip: { _id: string; s3Url: string }) => {
    setActiveMediaClip(clip._id);
  };

  // ── Selected item (for trim enforcement in preview) ─────────────────────
  const selectedItem = selectedItemId
    ? tracks.flatMap(t => t.items).find(i => i.id === selectedItemId) ?? null
    : null;

  // ── Timeline item select → load src into preview ────────────────────────────
  const handleSelectItem = (id: string | null) => {
    setSelectedItemId(id);
    if (id) {
      for (const track of tracks) {
        const item = track.items.find(i => i.id === id);
        if (item?.src) {
          // Audio-only items also load into preview (video element handles audio)
          setActiveSrc(item.src);
          // Set playhead to start of clip on timeline
          setCurrentTime(item.startTime);
          setTimeout(() => {
            // Seek video to trimIn (start of trimmed region in source)
            videoRef.current?.seek(item.trimIn);
          }, 50);
          setIsPlaying(false);
          return;
        }
      }
    }
    setActiveSrc(null);
  };

  // ── Detach audio from selected video clip ────────────────────────────────
  const handleDetachAudio = useCallback(() => {
    if (!selectedItem || !selectedItem.src) return;

    // Find which track holds the selected item
    const sourceTrack = tracks.find(t => t.items.some(i => i.id === selectedItemId));
    if (!sourceTrack) return;

    // Find or create an audio track
    const audioTrackId = tracks.find(t => t.id === "track-audio")?.id ?? "track-audio";

    const audioItemId = uid();

    // Create an audio item at the same timeline position
    const audioItem: TrackItem = {
      id: audioItemId,
      type: "audio",
      startTime: selectedItem.startTime,
      duration: selectedItem.duration,
      sourceDuration: selectedItem.sourceDuration,
      trimIn: selectedItem.trimIn,
      trimOut: selectedItem.trimOut,
      label: `${selectedItem.label} (audio)`,
      src: selectedItem.src,
    };

    // Add to media panel
    setDbClips(prev => [...prev, {
      _id: audioItem.id,
      index: prev.length + 1,
      s3Url: selectedItem.src!,
      duration: selectedItem.duration,
      score: 0,
      startTime: selectedItem.trimIn,
      endTime: selectedItem.trimIn + selectedItem.duration,
      reason: "Detached audio",
    }]);

    // Mark the video item as audioDetached (plays muted) and add audio track item
    const updated = tracks.map(t => {
      // Mute the original video item
      if (t.items.some(i => i.id === selectedItemId)) {
        return {
          ...t,
          items: t.items.map(i =>
            i.id === selectedItemId
              ? { ...i, audioDetached: true, linkedAudioId: audioItemId }
              : i
          ),
        };
      }
      // Add audio item to audio track
      if (t.id === audioTrackId) return { ...t, items: [...t.items, audioItem] };
      return t;
    });
    updateTracks(updated);

    // Sync volumes
    setVolumes(v => ({ ...v, [audioItemId]: v[selectedItemId ?? ""] ?? 100 }));
  }, [selectedItem, selectedItemId, tracks, volumes]);

  const handleExport = () => setShowExport(true);

  return (
    <div className="flex flex-col h-screen bg-[#111] overflow-hidden select-none">
      {showExport && (
        <ExportModal
          projectId={projectId}
          tracks={tracks}
          volumes={volumes}
          aspectRatio="9:16"
          onClose={() => setShowExport(false)}
        />
      )}
      {/* Topbar */}
      <EditorTopbar
        title={project?.title ?? "Untitled project"}
        projectId={projectId}
        canUndo={historyIdx > 0}
        canRedo={historyIdx < history.length - 1}
        onUndo={undo}
        onRedo={redo}
        onExport={handleExport}
      />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — media panel */}
        <MediaPanel
          clips={dbClips as any}
          activeClipId={activeMediaClip}
          onClipClick={handleMediaClipClick as any}
        />

        {/* Center — preview */}
        <VideoPreview
          ref={videoRef}
          src={activeSrc}
          itemType={selectedItem?.type ?? null}
          isPlaying={isPlaying}
          isMuted={isMuted}
          trimIn={selectedItem?.trimIn ?? 0}
          trimOut={selectedItem?.trimOut ?? 0}
          volume={volumes[selectedItemId ?? ""] ?? 100}
          audioDetached={selectedItem?.audioDetached ?? false}
          thumbnailOverlay={thumbnailOverlay}
          onThumbnailMove={setThumbnailOverlay}
          onTimeUpdate={(sourceTime) => {
            if (selectedItem) {
              // Convert source time → timeline position
              const timelinePos = selectedItem.startTime + (sourceTime - selectedItem.trimIn);
              // Clamp to clip end so playhead never goes past clip boundary
              const clampedPos = Math.min(timelinePos, selectedItem.startTime + selectedItem.duration);
              setCurrentTime(clampedPos);
            } else {
              setCurrentTime(sourceTime);
            }
          }}
          onDurationChange={() => {}}
          onPlayPause={() => setIsPlaying(p => !p)}
          onMuteToggle={() => setIsMuted(m => !m)}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Right — tool icons + expandable panels */}
        <div className="flex shrink-0">
          {/* Audio panel */}
          {rightPanel === "audio" && selectedItem && (
            <AudioPanel
              clipLabel={selectedItem.label}
              clipIndex={tracks.flatMap(t => t.items).findIndex(i => i.id === selectedItemId) + 1}
              volume={volumes[selectedItemId ?? ""] ?? 100}
              onVolumeChange={(v) => setVolumes(prev => ({ ...prev, [selectedItemId!]: v }))}
              onDetachAudio={handleDetachAudio}
              onClose={() => setRightPanel("")}
            />
          )}
          {/* Thumbnail panel */}
          {rightPanel === "thumbnail" && (
            <ThumbnailPanel
              onClose={() => setRightPanel("")}
              onApply={setThumbnailOverlay}
              currentOverlay={thumbnailOverlay}
            />
          )}
          <RightToolbar
            active={rightPanel}
            onChange={setRightPanel}
            visible={!!selectedItemId || rightPanel === "thumbnail"}
          />
        </div>
      </div>

      {/* Timeline */}
      <Timeline
        tracks={tracks}
        currentTime={currentTime}
        totalDuration={totalDuration}
        zoom={zoom}
        isPlaying={isPlaying}
        onSeek={handleSeek}
        onZoomChange={setZoom}
        onPlayPause={() => setIsPlaying(p => !p)}
        onSkipBack={() => handleSeek(Math.max(0, currentTime - 5))}
        onSkipForward={() => handleSeek(Math.min(totalDuration, currentTime + 5))}
        onCut={handleCut}
        onTrimStart={handleTrimStart}
        onTrimEnd={handleTrimEnd}
        onMoveItem={handleMoveItem}
        onDeleteItem={handleDeleteItem}
        onDeleteGap={handleDeleteGap}
        onDropMedia={handleDropMedia}
        selectedItemId={selectedItemId}
        onSelectItem={handleSelectItem}
      />
    </div>
  );
}
