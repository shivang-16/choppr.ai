"use client";

import { useEffect, useRef } from "react";
import {
  useTimelineContext,
  VideoElement,
  AudioElement,
  type TimelineEditor,
  type TrackElement,
} from "@twick/timeline";

const MIN_SPAN = 0.1;

function isTimedMedia(el: TrackElement): el is VideoElement | AudioElement {
  return el instanceof VideoElement || el instanceof AudioElement;
}

function maxTimelineSpan(el: VideoElement | AudioElement): number | null {
  const mediaDur = el.getMediaDuration();
  if (!(mediaDur > 0)) return null;
  const rate = Math.max(0.01, el.getPlaybackRate?.() || 1);
  const startAt = Math.max(0, el.getStartAt?.() ?? 0);
  return Math.max(MIN_SPAN, (mediaDur - startAt) / rate);
}

/**
 * Cap a clip's timeline length to the remaining source media.
 * Never longer than the original file from the current in-point.
 */
function clampElementToSource(el: TrackElement): boolean {
  if (!isTimedMedia(el)) return false;

  const mediaDur = el.getMediaDuration();
  if (!(mediaDur > 0)) return false;

  const rate = Math.max(0.01, el.getPlaybackRate?.() || 1);
  let startAt = el.getStartAt?.() ?? 0;
  let changed = false;

  // In-point can't go before the start of the source
  if (startAt < 0) {
    const push = -startAt / rate;
    el.setStartAt(0);
    el.setStart(Math.max(0, el.getStart() + push));
    startAt = 0;
    changed = true;
  }

  if (startAt >= mediaDur - MIN_SPAN * rate) {
    startAt = Math.max(0, mediaDur - MIN_SPAN * rate);
    el.setStartAt(startAt);
    changed = true;
  }

  const maxSpan = Math.max(MIN_SPAN, (mediaDur - startAt) / rate);
  const start = el.getStart();
  const span = el.getEnd() - start;

  if (span > maxSpan + 0.001) {
    el.setEnd(start + maxSpan);
    changed = true;
  }

  return changed;
}

function clampAll(editor: TimelineEditor): boolean {
  let any = false;
  for (const track of editor.getTimelineData()?.tracks ?? []) {
    for (const el of track.getElements()) {
      if (clampElementToSource(el)) any = true;
    }
  }
  return any;
}

async function ensureMediaMeta(editor: TimelineEditor, failedSrc: Set<string>) {
  const tasks: Promise<void>[] = [];
  for (const track of editor.getTimelineData()?.tracks ?? []) {
    for (const el of track.getElements()) {
      if (el instanceof VideoElement && !(el.getMediaDuration() > 0)) {
        const src = el.getSrc?.() ?? "";
        if (src && failedSrc.has(src)) continue;
        tasks.push(
          el.updateVideoMeta(false)
            .then(() => undefined)
            .catch(() => {
              if (src) failedSrc.add(src);
            }),
        );
      } else if (el instanceof AudioElement && !(el.getMediaDuration() > 0)) {
        tasks.push(el.updateAudioMeta().then(() => undefined).catch(() => undefined));
      }
    }
  }
  if (tasks.length) await Promise.all(tasks);
}

/**
 * Prevents video/audio clips from being stretched longer than their
 * original source duration when dragging trim handles.
 */
export function TimelineMediaLengthClamp() {
  const { editor, changeLog, selectedItem, totalDuration } = useTimelineContext();
  const clampingRef = useRef(false);
  const trimSideRef = useRef<"start" | "end" | null>(null);
  const failedMetaSrcRef = useRef<Set<string>>(new Set());

  const runClamp = () => {
    if (clampingRef.current) return;
    if (!clampAll(editor)) return;
    clampingRef.current = true;
    try {
      editor.refresh();
    } finally {
      requestAnimationFrame(() => {
        clampingRef.current = false;
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureMediaMeta(editor, failedMetaSrcRef.current);
      if (cancelled || clampingRef.current) return;
      runClamp();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeLog, editor]);

  // Live: while dragging the end handle, don't let the clip grow past source length
  useEffect(() => {
    const clearLiveLimit = () => {
      const shell = document.querySelector(".clip-timeline-shell") as HTMLElement | null;
      shell?.style.removeProperty("--choppr-trim-max-width");
      shell?.removeAttribute("data-trimming-end");
      trimSideRef.current = null;
      document.body.dataset.chopprTrimming = "0";
    };

    const applyLiveLimit = () => {
      if (trimSideRef.current !== "end") return;
      if (!selectedItem || !isTimedMedia(selectedItem as TrackElement)) return;

      const el = selectedItem as VideoElement | AudioElement;
      const maxSpan = maxTimelineSpan(el);
      if (maxSpan == null) return;

      const dom = document.querySelector(
        ".clip-timeline-shell .twick-track-element-selected",
      ) as HTMLElement | null;
      const track = dom?.closest(".twick-track") as HTMLElement | null;
      if (!dom || !track) return;

      const trackW = track.getBoundingClientRect().width;
      const duration = Math.max(totalDuration || 0.1, 0.1);
      const maxPx = Math.max(8, (maxSpan / duration) * trackW);

      const shell = document.querySelector(".clip-timeline-shell") as HTMLElement | null;
      if (!shell) return;
      shell.style.setProperty("--choppr-trim-max-width", `${maxPx}px`);
      shell.setAttribute("data-trimming-end", "1");
    };

    const onDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const handle = target.closest(".twick-track-element-handle");
      if (!handle) {
        clearLiveLimit();
        return;
      }
      document.body.dataset.chopprTrimming = "1";
      trimSideRef.current = handle.classList.contains(
        "twick-track-element-handle-start",
      )
        ? "start"
        : "end";
      void ensureMediaMeta(editor, failedMetaSrcRef.current).then(applyLiveLimit);
    };

    const onMove = () => {
      if (document.body.dataset.chopprTrimming === "1") applyLiveLimit();
    };

    const onUp = () => {
      const was = document.body.dataset.chopprTrimming === "1";
      clearLiveLimit();
      if (!was) return;
      // After Twick commits the drag, clamp any overshoot past source length
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void ensureMediaMeta(editor, failedMetaSrcRef.current).then(runClamp);
        });
      });
    };

    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("mouseup", onUp, true);
    window.addEventListener("touchend", onUp, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("mouseup", onUp, true);
      window.removeEventListener("touchend", onUp, true);
      clearLiveLimit();
    };
  }, [editor, selectedItem, totalDuration]);

  return null;
}
