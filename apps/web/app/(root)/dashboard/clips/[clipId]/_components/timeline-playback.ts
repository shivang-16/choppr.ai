import type { VideoElement } from "@twick/timeline";

/** Snap when clip edges are within this many seconds (Clipchamp-style). */
export const SNAP_THRESHOLD_SEC = 0.15;

export function listVideoElementsFromTracks(
  tracks: Array<{ getElements: () => Iterable<{ getId: () => string }> }>,
): VideoElement[] {
  const out: VideoElement[] = [];
  for (const track of tracks) {
    for (const el of track.getElements()) {
      if (el instanceof Object && "getSrc" in el && typeof (el as VideoElement).getSrc === "function") {
        out.push(el as VideoElement);
      }
    }
  }
  return out;
}

export function activeVideoAt(videos: VideoElement[], timelineTime: number): VideoElement | null {
  let best: VideoElement | null = null;
  for (const el of videos) {
    if (timelineTime >= el.getStart() - 0.001 && timelineTime < el.getEnd() - 0.001) {
      if (!best || el.getStart() >= best.getStart()) best = el;
    }
  }
  return best;
}

export function findNextVideoClip(videos: VideoElement[], timelineTime: number): VideoElement | null {
  let best: VideoElement | null = null;
  for (const el of videos) {
    if (el.getStart() > timelineTime + 0.001) {
      if (!best || el.getStart() < best.getStart()) best = el;
    }
  }
  return best;
}

export function findPrevVideoClip(videos: VideoElement[], timelineTime: number): VideoElement | null {
  let best: VideoElement | null = null;
  for (const el of videos) {
    if (el.getEnd() <= timelineTime + 0.001) {
      if (!best || el.getEnd() > best.getEnd()) best = el;
    }
  }
  return best;
}

export function sourceTimeFor(el: VideoElement, timelineTime: number): number {
  const local = Math.max(0, timelineTime - el.getStart());
  const rate = el.getPlaybackRate() || 1;
  return el.getStartAt() + local * rate;
}

export function urlsMatch(a: string, b: string): boolean {
  if (!a || !b) return a === b;
  try {
    return new URL(a, window.location.href).href === new URL(b, window.location.href).href;
  } catch {
    return a === b;
  }
}

/** During playback, skip gaps; while scrubbing, preview nearest clip. */
export function resolvePlaybackAt(
  videos: VideoElement[],
  timelineTime: number,
  playing: boolean,
): { time: number; active: VideoElement | null } {
  const sorted = [...videos].sort((a, b) => a.getStart() - b.getStart());
  const active = activeVideoAt(sorted, timelineTime);
  if (active) return { time: timelineTime, active };

  if (playing) {
    const next = findNextVideoClip(sorted, timelineTime);
    if (next) return { time: next.getStart(), active: next };
    return { time: timelineTime, active: null };
  }

  const next = findNextVideoClip(sorted, timelineTime);
  const prev = findPrevVideoClip(sorted, timelineTime);
  if (next && prev) {
    const gapMid = (prev.getEnd() + next.getStart()) / 2;
    if (timelineTime >= gapMid) {
      return { time: next.getStart(), active: next };
    }
    return { time: Math.max(prev.getStart(), prev.getEnd() - 0.04), active: prev };
  }
  if (next) return { time: next.getStart(), active: next };
  if (prev) return { time: Math.max(prev.getStart(), prev.getEnd() - 0.04), active: prev };
  return { time: timelineTime, active: null };
}

export type SnapResult = {
  start: number;
  snapped: boolean;
  snapTime: number | null;
};

type ClipRange = { start: number; end: number };

/** Magnetically attach clip edges when dragged close to neighbors. */
export function snapClipStart(
  others: ClipRange[],
  proposedStart: number,
  span: number,
  threshold = SNAP_THRESHOLD_SEC,
): SnapResult {
  let start = Math.max(0, proposedStart);
  let snapTime: number | null = null;
  const end = start + span;

  for (const o of others) {
    if (Math.abs(start - o.end) <= threshold) {
      start = o.end;
      snapTime = o.end;
    }
    if (Math.abs(end - o.start) <= threshold) {
      start = Math.max(0, o.start - span);
      snapTime = o.start;
    }
    if (Math.abs(start - o.start) <= threshold) {
      start = o.start;
      snapTime = o.start;
    }
    if (Math.abs(end - o.end) <= threshold) {
      start = Math.max(0, o.end - span);
      snapTime = o.end;
    }
  }

  return { start, snapped: snapTime != null, snapTime };
}

function toRanges(
  others: Array<ClipRange | { getStart: () => number; getEnd: () => number }>,
): ClipRange[] {
  return others
    .map(o =>
      "getStart" in o
        ? { start: o.getStart(), end: o.getEnd() }
        : { start: o.start, end: o.end },
    )
    .sort((a, b) => a.start - b.start);
}

/** Resolve drop position with magnetic snap + collision avoidance. */
export function resolveClipPlacement(
  others: Array<ClipRange | { getStart: () => number; getEnd: () => number }>,
  intendedStart: number,
  span: number,
): SnapResult {
  const ranges = toRanges(others);
  let snapTime: number | null = null;
  let s = Math.max(0, intendedStart);

  const applySnap = (candidate: number) => {
    const r = snapClipStart(ranges, candidate, span);
    if (r.snapTime != null) snapTime = r.snapTime;
    return r.start;
  };

  s = applySnap(s);

  for (let guard = 0; guard < 24; guard++) {
    const blocker = ranges.find(o => s < o.end && s + span > o.start);
    if (!blocker) break;

    const after = blocker.end;
    const before = blocker.start - span;
    const mid = (blocker.start + blocker.end) / 2;
    if (intendedStart >= mid || before < 0) {
      s = applySnap(after);
    } else {
      const prev = ranges.find(o => before < o.end && before + span > o.start && o !== blocker);
      if (!prev && before >= 0) {
        s = applySnap(before);
        break;
      }
      s = applySnap(after);
    }
  }

  return { start: s, snapped: snapTime != null, snapTime };
}

export function findFreeStart(
  others: Array<ClipRange | { getStart: () => number; getEnd: () => number }>,
  start: number,
  span: number,
): number {
  return resolveClipPlacement(others, start, span).start;
}
