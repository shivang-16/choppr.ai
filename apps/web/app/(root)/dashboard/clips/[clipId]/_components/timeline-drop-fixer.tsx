"use client";

import { useEffect, useRef } from "react";
import {
  useTimelineContext,
  TRACK_TYPES,
  type TimelineEditor,
  type TrackElement,
} from "@twick/timeline";
import { resolveClipPlacement, type SnapResult } from "./timeline-playback";

const LABEL_WIDTH = 40;
const TRACK_HEIGHT = 52;
const SEPARATOR_HEIGHT = 6;

type PendingDrop = {
  elementId: string;
  intendedStart: number;
  span: number;
  clientY: number;
  clientX: number;
};

type DropTarget =
  | { kind: "track"; index: number }
  | { kind: "separator"; index: number };

/**
 * Clipchamp-style timeline drag:
 * - Same track: clip slides inline (no ghost), snaps to neighbors, never overlaps.
 * - Cross track: floating ghost follows cursor; dim placeholder stays on source track.
 */
export function TimelineDropFixer({ trackZoom }: { trackZoom: number }) {
  const { editor, changeLog, selectedItem, totalDuration, setSelectedItem } =
    useTimelineContext();
  const pendingRef = useRef<PendingDrop | null>(null);
  const draggingRef = useRef(false);
  const dropLockRef = useRef(false);
  const trimmingRef = useRef(false);
  const slotHighlightRef = useRef<HTMLDivElement | null>(null);
  const snapLineRef = useRef<HTMLDivElement | null>(null);
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const grabOffsetRef = useRef<{ x: number; y: number } | null>(null);
  /** Seconds from clip start → pointer, so the grab point stays under the cursor. */
  const grabOffsetSecRef = useRef<number | null>(null);
  const crossTrackDragRef = useRef(false);

  useEffect(() => {
    let sameTrackRaf: number | null = null;

    const forceEndNativeDrag = () => {
      document
        .querySelectorAll(".clip-timeline-shell .twick-track-element-dragging")
        .forEach(el => {
          if (!(el instanceof HTMLElement)) return;
          el.classList.remove("twick-track-element-dragging");
          el.style.transform = "";
          el.style.zIndex = "";
          el.style.pointerEvents = "";
          el.classList.remove("clip-lifted-dragging", "clip-drag-source-placeholder");
        });
    };

    const clearVisuals = () => {
      document
        .querySelectorAll(".clip-timeline-shell .clip-drop-target-separator")
        .forEach(el => el.classList.remove("clip-drop-target-separator"));

      document.querySelectorAll(".clip-timeline-drag-ghost").forEach(el => el.remove());
      dragGhostRef.current = null;
      grabOffsetRef.current = null;
      grabOffsetSecRef.current = null;

      document
        .querySelectorAll(
          ".clip-timeline-shell .clip-drag-source-placeholder, .clip-timeline-shell .clip-lifted-dragging",
        )
        .forEach(el => {
          if (!(el instanceof HTMLElement)) return;
          el.classList.remove("clip-lifted-dragging", "clip-drag-source-placeholder");
          el.style.pointerEvents = "";
          el.style.opacity = "";
        });

      slotHighlightRef.current?.remove();
      slotHighlightRef.current = null;
      snapLineRef.current?.remove();
      snapLineRef.current = null;
      document.body.classList.remove("clip-timeline-dragging-clip", "clip-timeline-dragging-cross-track");
      document.querySelector(".clip-timeline-shell")?.classList.remove("is-dragging");
      crossTrackDragRef.current = false;
    };

    const clearCrossTrackDragVisuals = (dragging: HTMLElement | null) => {
      document.querySelectorAll(".clip-timeline-drag-ghost").forEach(el => el.remove());
      dragGhostRef.current = null;
      // Keep grabOffsetSecRef — still needed for same-track positioning after leaving a cross-track hover
      grabOffsetRef.current = null;
      document.body.classList.remove("clip-timeline-dragging-clip", "clip-timeline-dragging-cross-track");
      crossTrackDragRef.current = false;

      if (dragging) {
        dragging.classList.remove("clip-lifted-dragging", "clip-drag-source-placeholder");
        dragging.style.opacity = "";
      } else {
        document
          .querySelectorAll(
            ".clip-timeline-shell .clip-drag-source-placeholder, .clip-timeline-shell .clip-lifted-dragging",
          )
          .forEach(el => {
            if (!(el instanceof HTMLElement)) return;
            el.classList.remove("clip-lifted-dragging", "clip-drag-source-placeholder");
            el.style.opacity = "";
          });
      }
    };

    const finishDrag = () => {
      dropLockRef.current = true;
      draggingRef.current = false;
      clearVisuals();
      forceEndNativeDrag();
    };

    const releaseDropLockLater = () => {
      window.setTimeout(() => {
        dropLockRef.current = false;
      }, 200);
    };

    const ensureSlotHighlight = (container: HTMLElement) => {
      if (slotHighlightRef.current?.parentElement === container) {
        return slotHighlightRef.current;
      }
      slotHighlightRef.current?.remove();
      const el = document.createElement("div");
      el.className = "clip-drop-slot-highlight";
      el.setAttribute("aria-hidden", "true");
      container.appendChild(el);
      slotHighlightRef.current = el;
      return el;
    };

    const ensureDragGhost = (source: HTMLElement) => {
      if (dropLockRef.current) return;
      if (dragGhostRef.current) return;

      const rect = source.getBoundingClientRect();
      const ghost = source.cloneNode(true) as HTMLElement;
      ghost.classList.remove(
        "twick-track-element-dragging",
        "clip-lifted-dragging",
        "clip-drag-source-placeholder",
      );
      ghost.classList.add("clip-timeline-drag-ghost");
      ghost.style.position = "fixed";
      ghost.style.left = "0";
      ghost.style.top = "0";
      ghost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.style.margin = "0";
      ghost.style.pointerEvents = "none";
      document.body.appendChild(ghost);
      dragGhostRef.current = ghost;

      source.classList.add("clip-lifted-dragging", "clip-drag-source-placeholder");
      document.body.classList.add("clip-timeline-dragging-clip");
    };

    const ensureSnapLine = (container: HTMLElement) => {
      if (snapLineRef.current?.parentElement === container) {
        return snapLineRef.current;
      }
      snapLineRef.current?.remove();
      const el = document.createElement("div");
      el.className = "clip-drop-snap-line";
      el.setAttribute("aria-hidden", "true");
      container.appendChild(el);
      snapLineRef.current = el;
      return el;
    };

    const updateDropChrome = (
      drop: DropTarget | null,
      id: string,
      timeSec: number,
      span: number,
      duration: number,
      tracks: NonNullable<ReturnType<TimelineEditor["getTimelineData"]>>["tracks"],
      mode: "inline" | "cross",
      placementOverride?: SnapResult,
    ) => {
      const tracksRoot = getTracksRoot();
      const trackRows = tracksRoot ? getTrackRowElements(tracksRoot) : [];

      document
        .querySelectorAll(".clip-timeline-shell .clip-drop-target-separator")
        .forEach(n => n.classList.remove("clip-drop-target-separator"));

      if (drop?.kind === "track" && trackRows[drop.index]) {
        const row = trackRows[drop.index]!;
        const container = row.querySelector(".twick-timeline-container") as HTMLElement | null;
        const targetTrack = tracks[drop.index];
        if (!targetTrack || !container) return;

        const trackContent = container.querySelector(".twick-track") as HTMLElement | null;
        const highlightContainer = trackContent ?? container;

        const others = targetTrack
          .getElements()
          .filter((o: TrackElement) => o.getId() !== id)
          .map((o: TrackElement) => ({ start: o.getStart(), end: o.getEnd() }));
        const placement = placementOverride ?? resolveClipPlacement(others, timeSec, span);
        const freeStart = placement.start;
        const slotLeftPct = (freeStart / duration) * 100;
        const slotWidthPct = (span / duration) * 100;

        if (mode === "cross") {
          const highlight = ensureSlotHighlight(highlightContainer);
          highlight.style.display = "block";
          highlight.style.left = `${slotLeftPct}%`;
          highlight.style.width = `${Math.max(slotWidthPct, 1.5)}%`;
          highlight.classList.toggle("clip-drop-slot-highlight-snapped", placement.snapped);
        } else {
          slotHighlightRef.current?.remove();
          slotHighlightRef.current = null;
        }

        snapLineRef.current?.remove();
        snapLineRef.current = null;
        if (placement.snapped && placement.snapTime != null) {
          const snapLine = ensureSnapLine(highlightContainer);
          const snapLeftPct = (placement.snapTime / duration) * 100;
          snapLine.style.display = "block";
          snapLine.style.left = `${snapLeftPct}%`;
        }
        return;
      }

      if (drop?.kind === "separator" && tracksRoot) {
        const seps = collectSeparators(tracksRoot, trackRows);
        seps[drop.index]?.classList.add("clip-drop-target-separator");
      }

      slotHighlightRef.current?.remove();
      slotHighlightRef.current = null;
      snapLineRef.current?.remove();
      snapLineRef.current = null;
    };

    const applySameTrackPosition = (
      el: TrackElement,
      trackIndex: number,
      timeSec: number,
      span: number,
    ) => {
      const tracks = editor.getTimelineData()?.tracks ?? [];
      const targetTrack = tracks[trackIndex];
      if (!targetTrack) return null;

      const others = targetTrack
        .getElements()
        .filter((o: TrackElement) => o.getId() !== el.getId());
      const placement = resolveClipPlacement(others, timeSec, span);

      // During drag: only update the DOM position directly (no editor.refresh)
      // This avoids React re-renders on every frame = much smoother
      const dragging = document.querySelector(
        ".clip-timeline-shell .twick-track-element-dragging",
      ) as HTMLElement | null;
      if (dragging) {
        const duration = Math.max(totalDuration || 0.1, 0.1);
        dragging.style.left = `${(placement.start / duration) * 100}%`;
        dragging.style.width = `${(span / duration) * 100}%`;
        dragging.style.transform = "none";
      }

      return placement;
    };

    const scheduleSameTrackPosition = (
      el: TrackElement,
      trackIndex: number,
      timeSec: number,
      span: number,
    ) => {
      if (sameTrackRaf != null) cancelAnimationFrame(sameTrackRaf);
      sameTrackRaf = requestAnimationFrame(() => {
        sameTrackRaf = null;
        applySameTrackPosition(el, trackIndex, timeSec, span);
      });
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (dropLockRef.current || trimmingRef.current) return;

      // Mouse released but Twick drag state stuck — force stop and drop.
      if (e instanceof MouseEvent && e.buttons === 0) {
        const stuck =
          draggingRef.current ||
          dragGhostRef.current != null ||
          document.querySelector(".clip-timeline-shell .twick-track-element-dragging");
        if (!stuck) return;

        const prev = pendingRef.current;
        finishDrag();
        pendingRef.current = null;

        if (prev && resolveDropTrackIndex(prev.clientY)) {
          window.setTimeout(() => {
            void applyPointerPlacement(editor, prev, setSelectedItem).finally(releaseDropLockLater);
            migrateVideoTracksToElement(editor);
          }, 0);
        } else {
          releaseDropLockLater();
        }
        return;
      }

      const pt = "touches" in e ? e.touches[0] : e;
      if (!pt) return;

      const dragging = document.querySelector(
        ".clip-timeline-shell .twick-track-element-dragging",
      ) as HTMLElement | null;
      if (!dragging) {
        if (draggingRef.current) {
          clearVisuals();
          draggingRef.current = false;
        }
        return;
      }

      draggingRef.current = true;

      // Add class to disable transitions during drag
      const shell = document.querySelector(".clip-timeline-shell") as HTMLElement | null;
      if (shell && !shell.classList.contains("is-dragging")) {
        shell.classList.add("is-dragging");
      }

      const id =
        selectedItem && typeof (selectedItem as TrackElement).getId === "function"
          ? (selectedItem as TrackElement).getId()
          : null;
      if (!id) return;

      const el = findElement(editor, id);
      if (!el) return;

      const tracks = editor.getTimelineData()?.tracks ?? [];
      const duration = Math.max(totalDuration || 0.1, 0.1);
      const pointerTime = computeTimeFromClientX(pt.clientX, duration, trackZoom);
      const span = Math.max(0.1, el.getEnd() - el.getStart());

      // Capture grab offset once (where on the clip the user clicked)
      if (grabOffsetSecRef.current == null) {
        const fromDom = measureGrabOffsetSec(dragging, pt.clientX, duration, trackZoom);
        grabOffsetSecRef.current =
          fromDom != null ? fromDom : Math.max(0, pointerTime - el.getStart());
      }
      if (!grabOffsetRef.current) {
        const rect = dragging.getBoundingClientRect();
        grabOffsetRef.current = {
          x: pt.clientX - rect.left,
          y: pt.clientY - rect.top,
        };
      }

      // Clip start follows pointer minus the grab point (not snapped to cursor)
      const timeSec = Math.max(0, pointerTime - grabOffsetSecRef.current);
      const drop = resolveDropTrackIndex(pt.clientY);
      const sourceTrackIdx = tracks.findIndex(t => t.getId() === el.getTrackId());
      const crossTrack = isCrossTrackDrop(el.getTrackId(), drop, tracks);

      let resolvedStart = timeSec;
      let inlinePlacement: SnapResult | undefined;

      if (crossTrack) {
        crossTrackDragRef.current = true;
        document.body.classList.add("clip-timeline-dragging-cross-track");
        ensureDragGhost(dragging);

        if (dragGhostRef.current && grabOffsetRef.current) {
          const gx = pt.clientX - grabOffsetRef.current.x;
          const gy = pt.clientY - grabOffsetRef.current.y;
          dragGhostRef.current.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
        }

        updateDropChrome(drop, id, timeSec, span, duration, tracks, "cross");
      } else {
        clearCrossTrackDragVisuals(dragging);

        if (sourceTrackIdx >= 0) {
          const track = tracks[sourceTrackIdx]!;
          const others = track
            .getElements()
            .filter((o: TrackElement) => o.getId() !== id);
          inlinePlacement = resolveClipPlacement(others, timeSec, span);
          resolvedStart = inlinePlacement.start;
          scheduleSameTrackPosition(el, sourceTrackIdx, timeSec, span);

          updateDropChrome(
            { kind: "track", index: sourceTrackIdx },
            id,
            timeSec,
            span,
            duration,
            tracks,
            "inline",
            inlinePlacement,
          );
        }
      }

      pendingRef.current = {
        elementId: id,
        intendedStart: resolvedStart,
        span,
        clientY: pt.clientY,
        clientX: pt.clientX,
      };
    };

    const onUp = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (trimmingRef.current) {
        trimmingRef.current = false;
        pendingRef.current = null;
        draggingRef.current = false;
        clearVisuals();
        forceEndNativeDrag();
        releaseDropLockLater();
        return;
      }

      const hadDrag =
        draggingRef.current ||
        dragGhostRef.current != null ||
        pendingRef.current != null ||
        !!document.querySelector(".clip-timeline-shell .twick-track-element-dragging");

      const pt =
        "changedTouches" in e
          ? e.changedTouches[0]
          : "clientX" in e
            ? e
            : null;
      const prev = pendingRef.current;
      const grabSec = grabOffsetSecRef.current;

      if (sameTrackRaf != null) {
        cancelAnimationFrame(sameTrackRaf);
        sameTrackRaf = null;
      }

      finishDrag();
      pendingRef.current = null;

      if (!hadDrag) {
        releaseDropLockLater();
        return;
      }

      if (!prev || !pt) {
        releaseDropLockLater();
        return;
      }

      const duration = Math.max(totalDuration || 0.1, 0.1);
      const pointerTime = computeTimeFromClientX(pt.clientX, duration, trackZoom);
      const intendedStart =
        grabSec != null ? Math.max(0, pointerTime - grabSec) : prev.intendedStart;
      const pending: PendingDrop = {
        ...prev,
        intendedStart,
        clientX: pt.clientX,
        clientY: pt.clientY,
      };

      if (!resolveDropTrackIndex(pending.clientY)) {
        releaseDropLockLater();
        return;
      }

      const dropEl = findElement(editor, pending.elementId);
      const dropTracks = editor.getTimelineData()?.tracks ?? [];
      const dropTarget = resolveDropTrackIndex(pending.clientY);
      if (
        dropEl &&
        dropTarget &&
        !isCrossTrackDrop(dropEl.getTrackId(), dropTarget, dropTracks)
      ) {
        // Same-track: commit the final position to the model in one shot
        const trackIdx = dropTracks.findIndex(t => t.getId() === dropEl.getTrackId());
        if (trackIdx >= 0) {
          const targetTrack = dropTracks[trackIdx]!;
          const others = targetTrack
            .getElements()
            .filter((o: TrackElement) => o.getId() !== pending.elementId);
          const placement = resolveClipPlacement(others, pending.intendedStart, pending.span);
          dropEl.setStart(placement.start);
          dropEl.setEnd(placement.start + pending.span);
          editor.refresh();
          setSelectedItem(dropEl);
          pending.intendedStart = placement.start;
        }
        releaseDropLockLater();
        return;
      }

      window.setTimeout(() => {
        void applyPointerPlacement(editor, pending, setSelectedItem).finally(() => {
          finishDrag();
          releaseDropLockLater();
        });
        migrateVideoTracksToElement(editor);
      }, 0);
    };

    const onPointerDownCapture = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".twick-track-element-handle")) {
        // Trim/resize in progress — don't treat as clip move / cross-track drop
        trimmingRef.current = true;
        pendingRef.current = null;
        draggingRef.current = false;
        clearVisuals();
        return;
      }

      trimmingRef.current = false;

      // Remember where on the clip the user grabbed (before any jump)
      const clipEl = target.closest(".twick-track-element") as HTMLElement | null;
      if (!clipEl || clipEl.closest(".clip-timeline-drag-ghost")) return;

      const duration = Math.max(totalDuration || 0.1, 0.1);
      const offsetSec = measureGrabOffsetSec(clipEl, e.clientX, duration, trackZoom);
      if (offsetSec != null) grabOffsetSecRef.current = offsetSec;

      const rect = clipEl.getBoundingClientRect();
      grabOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    window.addEventListener("pointerdown", onPointerDownCapture, true);
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("touchmove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
    window.addEventListener("touchend", onUp, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      if (sameTrackRaf != null) cancelAnimationFrame(sameTrackRaf);
      window.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("touchmove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
      window.removeEventListener("touchend", onUp, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      finishDrag();
    };
  }, [editor, selectedItem, totalDuration, trackZoom, setSelectedItem]);

  useEffect(() => {
    migrateVideoTracksToElement(editor);
  }, [changeLog, editor]);

  return null;
}

function computeTimeFromClientX(
  clientX: number,
  duration: number,
  trackZoom: number,
): number {
  const scroll = document.querySelector(
    ".clip-timeline-shell .twick-timeline-scroll-container",
  ) as HTMLElement | null;
  if (!scroll) return 0;

  const timelineWidth = Math.max(100, duration * trackZoom * 100);
  const contentWidth = Math.max(1, timelineWidth - LABEL_WIDTH);
  const scrollRect = scroll.getBoundingClientRect();
  const x = clientX - scrollRect.left + scroll.scrollLeft;
  return Math.max(0, ((x - LABEL_WIDTH) / contentWidth) * duration);
}

/** Seconds from the clip's left edge to the pointer — keeps the grab point under the cursor. */
function measureGrabOffsetSec(
  clipEl: HTMLElement,
  clientX: number,
  duration: number,
  trackZoom: number,
): number | null {
  const leftStr = clipEl.style.left;
  if (!leftStr.endsWith("%")) {
    // Fallback: ratio within the rendered box
    const rect = clipEl.getBoundingClientRect();
    if (rect.width < 1) return null;
    const spanGuess = Math.max(0.1, (parseFloat(clipEl.style.width) / 100) * duration);
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * spanGuess;
  }

  const startSec = (parseFloat(leftStr) / 100) * duration;
  const pointerTime = computeTimeFromClientX(clientX, duration, trackZoom);
  const widthPct = parseFloat(clipEl.style.width);
  const span = Number.isFinite(widthPct) ? (widthPct / 100) * duration : Infinity;
  return Math.min(Math.max(0, pointerTime - startSec), Math.max(0, span));
}

function getTracksRoot(): HTMLElement | null {
  const scroll = document.querySelector(
    ".clip-timeline-shell .twick-timeline-scroll-container",
  ) as HTMLElement | null;
  if (!scroll) return null;

  const timelineContent = scroll.querySelectorAll(":scope > div")[1] as HTMLElement | undefined;
  if (!timelineContent) return null;

  for (const child of timelineContent.children) {
    if (!(child instanceof HTMLElement)) continue;
    if (
      child.querySelector(":scope > div > .twick-timeline-container") ||
      child.querySelector(":scope > .twick-timeline-separator")
    ) {
      return child;
    }
  }

  const firstTrack = timelineContent.querySelector(".twick-timeline-container");
  return (firstTrack?.parentElement?.parentElement as HTMLElement) ?? null;
}

function getTrackRowElements(tracksRoot: HTMLElement): HTMLElement[] {
  return [...tracksRoot.children].filter(
    (c): c is HTMLElement =>
      c instanceof HTMLElement &&
      !!c.querySelector(":scope > .twick-timeline-container"),
  );
}

function collectSeparators(tracksRoot: HTMLElement, trackRows: HTMLElement[]): HTMLElement[] {
  const seps: HTMLElement[] = [];
  const first = [...tracksRoot.children].find(
    c => c instanceof HTMLElement && c.classList.contains("twick-timeline-separator"),
  ) as HTMLElement | undefined;
  if (first) seps.push(first);
  for (const row of trackRows) {
    const sep = row.querySelector(":scope > .twick-timeline-separator") as HTMLElement | null;
    if (sep) seps.push(sep);
  }
  return seps;
}

function findElement(editor: TimelineEditor, id: string): TrackElement | null {
  for (const track of editor.getTimelineData()?.tracks ?? []) {
    for (const el of track.getElements()) {
      if (el.getId() === id) return el as TrackElement;
    }
  }
  return null;
}

function resolveDropTrackIndex(clientY: number): DropTarget | null {
  const tracksRoot = getTracksRoot();
  if (!tracksRoot) return null;

  const rect = tracksRoot.getBoundingClientRect();
  const y = clientY - rect.top;
  if (y < -8) return null;

  if (y < SEPARATOR_HEIGHT) return { kind: "separator", index: 0 };

  const relativeY = y - SEPARATOR_HEIGHT;
  const rowHeight = TRACK_HEIGHT + SEPARATOR_HEIGHT;
  const row = Math.floor(relativeY / rowHeight);
  const offsetInRow = relativeY % rowHeight;

  if (offsetInRow > TRACK_HEIGHT) {
    return { kind: "separator", index: row + 1 };
  }
  return { kind: "track", index: Math.max(0, row) };
}

function isCrossTrackDrop(
  sourceTrackId: string,
  drop: DropTarget | null,
  tracks: NonNullable<ReturnType<TimelineEditor["getTimelineData"]>>["tracks"],
): boolean {
  if (!drop) return false;
  if (drop.kind === "separator") return true;
  const sourceIdx = tracks.findIndex(t => t.getId() === sourceTrackId);
  return sourceIdx >= 0 && drop.index !== sourceIdx;
}

async function applyPointerPlacement(
  editor: TimelineEditor,
  pending: PendingDrop,
  setSelectedItem: (item: TrackElement) => void,
) {
  const el = findElement(editor, pending.elementId);
  if (!el) return;

  const drop = resolveDropTrackIndex(pending.clientY);
  if (!drop) return;

  const tracks = editor.getTimelineData()?.tracks ?? [];
  const span = pending.span;
  let targetTrack = tracks.find(t => t.getId() === el.getTrackId()) ?? null;

  if (drop.kind === "track" && tracks[drop.index]) {
    targetTrack = tracks[drop.index]!;
  } else if (drop.kind === "separator") {
    const newTrack = editor.addTrack(`Track_${Date.now()}`, TRACK_TYPES.ELEMENT);
    const afterAdd = [...(editor.getTimelineData()?.tracks ?? [])];
    const newIdx = afterAdd.findIndex(t => t.getId() === newTrack.getId());
    if (newIdx >= 0) {
      const [removed] = afterAdd.splice(newIdx, 1);
      afterAdd.splice(Math.min(drop.index, afterAdd.length), 0, removed!);
      editor.reorderTracks(afterAdd);
    }
    targetTrack = newTrack;
  }

  if (!targetTrack) return;

  if (targetTrack.getType() === TRACK_TYPES.VIDEO) {
    migrateVideoTracksToElement(editor);
    targetTrack =
      editor.getTrackById(targetTrack.getId()) ??
      (editor.getTimelineData()?.tracks ?? []).find(t =>
        t.getElements().some(e => e.getId() === pending.elementId),
      ) ??
      null;
    if (!targetTrack) return;
  }

  const others = targetTrack
    .getElements()
    .filter(o => o.getId() !== pending.elementId);
  const start = resolveClipPlacement(others, pending.intendedStart, span).start;
  const end = start + span;
  const sameTrack = el.getTrackId() === targetTrack.getId();

  if (sameTrack) {
    el.setStart(start);
    el.setEnd(end);
    editor.refresh();
    setSelectedItem(el);
    return;
  }

  editor.removeElement(el);
  el.setStart(start);
  el.setEnd(end);
  try {
    await editor.addElementToTrack(targetTrack, el);
  } catch {
    const last = [...others].sort((a, b) => a.getEnd() - b.getEnd()).at(-1);
    const s2 = last ? last.getEnd() : start;
    el.setStart(s2);
    el.setEnd(s2 + span);
    await editor.addElementToTrack(targetTrack, el).catch(() => false);
  }
  editor.refresh();
  setSelectedItem(el);
}

function migrateVideoTracksToElement(editor: TimelineEditor) {
  const tracks = [...(editor.getTimelineData()?.tracks ?? [])];
  let changed = false;

  for (const track of tracks) {
    if (track.getType() !== TRACK_TYPES.VIDEO) continue;
    const elements = [...track.getElements()];

    if (elements.length === 0) {
      editor.removeTrack(track);
      changed = true;
      continue;
    }

    const newTrack = editor.addTrack(track.getName() || "Video", TRACK_TYPES.ELEMENT);
    for (const el of elements) {
      const s = el.getStart();
      const e = el.getEnd();
      editor.removeElement(el);
      el.setStart(s);
      el.setEnd(e);
      void editor.addElementToTrack(newTrack, el);
    }

    const current = [...(editor.getTimelineData()?.tracks ?? [])];
    const oldIdx = current.findIndex(t => t.getId() === track.getId());
    if (oldIdx >= 0) {
      const reordered = current.filter(t => t.getId() !== track.getId());
      const nIdx = reordered.findIndex(t => t.getId() === newTrack.getId());
      if (nIdx >= 0) {
        const [n] = reordered.splice(nIdx, 1);
        reordered.splice(Math.min(oldIdx, reordered.length), 0, n!);
        editor.reorderTracks(reordered);
      }
      editor.removeTrack(track);
    } else {
      editor.removeTrack(track);
    }
    changed = true;
  }

  if (changed) editor.refresh();
}
