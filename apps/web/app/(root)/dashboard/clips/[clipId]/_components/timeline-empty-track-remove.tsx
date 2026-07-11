"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { useTimelineContext } from "@twick/timeline";

type EmptyHit = {
  trackId: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Shows a trash control on empty track headers so users can remove
 * leftover empty lanes without selecting them first.
 */
export function TimelineEmptyTrackRemove() {
  const { editor, changeLog } = useTimelineContext();
  const [hits, setHits] = useState<EmptyHit[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sync = useCallback(() => {
    const shell = document.querySelector(".clip-timeline-shell");
    if (!shell) {
      setHits([]);
      return;
    }

    const headers = Array.from(
      shell.querySelectorAll(".twick-track-header"),
    ) as HTMLElement[];
    const tracks = editor.getTimelineData()?.tracks ?? [];
    const next: EmptyHit[] = [];

    for (let i = 0; i < Math.min(headers.length, tracks.length); i++) {
      const track = tracks[i]!;
      if (track.getElements().length > 0) continue;

      const header = headers[i]!;
      const rect = header.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      next.push({
        trackId: track.getId(),
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    }

    setHits(next);
  }, [editor]);

  useEffect(() => {
    sync();
  }, [sync, changeLog]);

  useEffect(() => {
    const scroll = document.querySelector(
      ".clip-timeline-shell .twick-timeline-scroll-container",
    );
    const shell = document.querySelector(".clip-timeline-shell");
    scroll?.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const ro = shell ? new ResizeObserver(sync) : null;
    if (shell && ro) ro.observe(shell);
    return () => {
      scroll?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      ro?.disconnect();
    };
  }, [sync]);

  const removeTrack = useCallback(
    (trackId: string) => {
      const track = editor.getTrackById(trackId);
      if (!track) return;
      if (track.getElements().length > 0) return;
      editor.removeTrack(track);
      editor.refresh();
    },
    [editor],
  );

  if (!mounted || hits.length === 0) return null;

  return createPortal(
    <>
      {hits.map(hit => (
        <button
          key={hit.trackId}
          type="button"
          className="clip-empty-track-remove"
          style={{
            left: hit.left,
            top: hit.top,
            width: hit.width,
            height: hit.height,
          }}
          title="Remove empty track"
          aria-label="Remove empty track"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            removeTrack(hit.trackId);
          }}
        >
          <Trash2 className="clip-empty-track-remove__icon" />
        </button>
      ))}
    </>,
    document.body,
  );
}
