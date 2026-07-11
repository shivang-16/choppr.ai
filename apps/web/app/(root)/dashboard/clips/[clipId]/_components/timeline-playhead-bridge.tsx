"use client";

import { useEffect, useRef } from "react";
import { useLivePlayerContext } from "@twick/live-player";
import { useTimelineContext } from "@twick/timeline";

/**
 * Extends the playhead into one continuous white line through every track
 * (Clipchamp / CapCut style), synced to Twick's native seek playhead position.
 */
export function TimelinePlayheadBridge() {
  const { currentTime } = useLivePlayerContext();
  const { changeLog } = useTimelineContext();
  const lineRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => {
      const scroll = document.querySelector(
        ".clip-timeline-shell .twick-timeline-scroll-container",
      ) as HTMLElement | null;
      const nativePlayhead = document.querySelector(
        ".clip-timeline-shell .twick-seek-track-playhead",
      ) as HTMLElement | null;
      const seekTrack = document.querySelector(
        ".clip-timeline-shell .twick-seek-track",
      ) as HTMLElement | null;

      const section = document.querySelector(
        ".clip-timeline-shell .clip-timeline-section",
      ) as HTMLElement | null;

      if (!scroll || !nativePlayhead || !section) {
        if (lineRef.current) lineRef.current.style.display = "none";
        return;
      }

      if (!lineRef.current) {
        const line = document.createElement("div");
        line.className = "clip-full-playhead";
        line.setAttribute("aria-hidden", "true");
        line.innerHTML =
          '<div class="clip-full-playhead__blob"></div><div class="clip-full-playhead__line"></div>';
        section.appendChild(line);
        lineRef.current = line;
      }

      const line = lineRef.current;
      const sectionRect = section.getBoundingClientRect();
      const playheadRect = nativePlayhead.getBoundingClientRect();
      const scrollRect = scroll.getBoundingClientRect();
      const centerX =
        playheadRect.left + playheadRect.width / 2 - sectionRect.left;

      const seekTop = seekTrack
        ? seekTrack.getBoundingClientRect().top - sectionRect.top
        : playheadRect.top - sectionRect.top;

      const lineBottom = scrollRect.bottom - sectionRect.top;
      const lineHeight = Math.max(lineBottom - seekTop, 0);

      line.style.display = lineHeight > 0 ? "block" : "none";
      line.style.left = `${centerX}px`;
      line.style.top = `${seekTop}px`;
      line.style.height = `${lineHeight}px`;
    };

    const tick = () => {
      sync();
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);

    const scroll = document.querySelector(
      ".clip-timeline-shell .twick-timeline-scroll-container",
    );
    scroll?.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    const shell = document.querySelector(".clip-timeline-shell");
    if (ro && shell) ro.observe(shell);

    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      scroll?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      ro?.disconnect();
      lineRef.current?.remove();
      lineRef.current = null;
    };
  }, [changeLog, currentTime]);

  return null;
}
