"use client";

import { useCallback, useEffect, useState } from "react";
import { useTimelineContext, type TimelineEditor } from "@twick/timeline";
import { Trash2 } from "lucide-react";
import { createPortal } from "react-dom";

const MIN_GAP_PX = 10;

type GapHit = {
  trackId: string;
  from: number;
  to: number;
  /** Gap box in viewport coords */
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Close a gap on one track by shifting later clips left. */
export function closeGapOnTrack(
  editor: TimelineEditor,
  trackId: string,
  from: number,
  to: number,
) {
  const track = editor.getTrackById(trackId);
  if (!track) return;
  const shift = to - from;
  if (shift <= 0) return;

  const updates: Array<{ elementId: string; updates: { s: number; e: number } }> = [];
  for (const el of track.getElements()) {
    if (el.getStart() >= to - 0.001) {
      updates.push({
        elementId: el.getId(),
        updates: { s: el.getStart() - shift, e: el.getEnd() - shift },
      });
    }
  }
  if (updates.length) {
    editor.updateElements(updates);
    editor.refresh();
  }
}

/**
 * CapCut-style gap delete: striped region between clips + trash icon +
 * "Delete this gap" bubble anchored above the gap (not a cursor-following chip).
 */
export function TimelineGapDelete({ enabled = true }: { trackZoom?: number; enabled?: boolean }) {
  const { editor, changeLog } = useTimelineContext();
  const [hit, setHit] = useState<GapHit | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hoveringOverlay, setHoveringOverlay] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const resolveGapAtPoint = useCallback(
    (clientX: number, clientY: number): GapHit | null => {
      const shell = document.querySelector(".clip-timeline-shell");
      if (!shell) return null;

      const trackNodes = Array.from(
        shell.querySelectorAll(".twick-track"),
      ) as HTMLElement[];
      const editorTracks = editor.getTimelineData()?.tracks ?? [];

      let trackEl: HTMLElement | null = null;
      let trackIndex = -1;

      for (let i = 0; i < trackNodes.length; i++) {
        const rect = trackNodes[i]!.getBoundingClientRect();
        if (
          clientY >= rect.top - 6 &&
          clientY <= rect.bottom + 6 &&
          clientX >= rect.left &&
          clientX <= rect.right
        ) {
          trackEl = trackNodes[i]!;
          trackIndex = i;
          break;
        }
      }

      if (!trackEl || trackIndex < 0) return null;
      const track = editorTracks[trackIndex];
      if (!track) return null;

      const trackRect = trackEl.getBoundingClientRect();
      const clipNodes = Array.from(
        trackEl.querySelectorAll(".twick-track-element"),
      ) as HTMLElement[];
      if (clipNodes.length < 1) return null;

      const boxes = clipNodes
        .map(node => {
          const r = node.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        })
        .sort((a, b) => a.left - b.left);

      const els = [...track.getElements()].sort((a, b) => a.getStart() - b.getStart());

      // Leading gap: timeline start → first clip
      const firstBox = boxes[0]!;
      const firstEl = els[0];
      if (
        firstEl &&
        firstEl.getStart() > 0.05 &&
        firstBox.left - trackRect.left >= MIN_GAP_PX &&
        clientX >= trackRect.left &&
        clientX <= firstBox.left
      ) {
        return {
          trackId: track.getId(),
          from: 0,
          to: firstEl.getStart(),
          left: trackRect.left,
          top: trackRect.top + 2,
          width: Math.max(0, firstBox.left - trackRect.left),
          height: Math.max(0, trackRect.height - 4),
        };
      }

      if (clipNodes.length < 2) return null;

      let gapIndex = -1;
      for (let i = 0; i < boxes.length - 1; i++) {
        const left = boxes[i]!.right;
        const right = boxes[i + 1]!.left;
        if (right - left < MIN_GAP_PX) continue;
        if (clientX >= left && clientX <= right) {
          gapIndex = i;
          break;
        }
      }
      if (gapIndex < 0) return null;

      const leftEl = els[gapIndex];
      const rightEl = els[gapIndex + 1];
      if (!leftEl || !rightEl) return null;

      const from = leftEl.getEnd();
      const to = rightEl.getStart();
      if (to - from < 0.05) return null;

      const gapLeft = boxes[gapIndex]!.right;
      const gapRight = boxes[gapIndex + 1]!.left;

      return {
        trackId: track.getId(),
        from,
        to,
        left: gapLeft,
        top: trackRect.top + 2,
        width: Math.max(0, gapRight - gapLeft),
        height: Math.max(0, trackRect.height - 4),
      };
    },
    [editor],
  );

  useEffect(() => {
    if (!enabled) {
      setHit(null);
      return;
    }

    const onMove = (e: MouseEvent) => {
      if (document.querySelector(".twick-track-element-dragging")) {
        setHit(null);
        return;
      }

      const target = e.target as HTMLElement | null;
      if (target?.closest?.(".clip-gap-delete-overlay") || hoveringOverlay) {
        return;
      }
      if (target?.closest?.(".twick-track-element")) {
        setHit(null);
        return;
      }

      setHit(resolveGapAtPoint(e.clientX, e.clientY));
    };

    document.addEventListener("mousemove", onMove, true);
    return () => document.removeEventListener("mousemove", onMove, true);
  }, [enabled, resolveGapAtPoint, changeLog, hoveringOverlay]);

  // Keep overlay aligned if the timeline scrolls while it's open
  useEffect(() => {
    if (!hit) return;
    const scroll = document.querySelector(
      ".clip-timeline-shell .twick-timeline-scroll-container",
    );
    if (!scroll) return;
    const onScroll = () => setHit(null);
    scroll.addEventListener("scroll", onScroll, { passive: true });
    return () => scroll.removeEventListener("scroll", onScroll);
  }, [hit]);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hit) return;
    closeGapOnTrack(editor, hit.trackId, hit.from, hit.to);
    setHoveringOverlay(false);
    setHit(null);
  };

  if (!mounted || !hit || hit.width < MIN_GAP_PX) return null;

  return createPortal(
    <button
      type="button"
      className="clip-gap-delete-overlay"
      style={{
        left: hit.left,
        top: hit.top,
        width: hit.width,
        height: hit.height,
      }}
      title="Delete this gap"
      aria-label="Delete this gap"
      onClick={handleDelete}
      onMouseDown={e => e.stopPropagation()}
      onMouseEnter={() => setHoveringOverlay(true)}
      onMouseLeave={() => {
        setHoveringOverlay(false);
        setHit(null);
      }}
    >
      <span className="clip-gap-delete-overlay__tooltip">Delete this gap</span>
      <Trash2 className="clip-gap-delete-overlay__icon" strokeWidth={2} />
    </button>,
    document.body,
  );
}
