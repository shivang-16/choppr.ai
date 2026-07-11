"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
} from "react";
import {
  useTimelineContext,
  TextElement,
  TRACK_TYPES,
  type TimelineEditor,
  type TrackElement,
} from "@twick/timeline";
import { PLAYER_STATE, useLivePlayerContext } from "@twick/live-player";
import type { CaptionStyle, CaptionWord } from "./caption-renderer";

export const CAPTION_TRACK = "Captions";

export interface CaptionSegment {
  /** Stable ID — used as the timeline element id. */
  id: string;
  style: CaptionStyle;
  /** Timeline start / end (seconds) — kept in sync with the timeline element. */
  start: number;
  end: number;
  /** Words that fall inside this segment (subset of the global words array). */
  words: CaptionWord[];
  /** Horizontal offset (-100..100). Per-segment so each style can sit elsewhere. */
  posX: number;
  /** Vertical offset (-100..100). */
  posY: number;
}

export type CaptionTrackApi = {
  /** Replace all caption segments with n equal-length ones covering [0, videoDuration]. */
  resetSegments: (
    styles: CaptionStyle[],
    words: CaptionWord[],
    videoDuration: number,
  ) => void;
  /** Add a single new segment (equal split + auto push). */
  addSegment: (
    style: CaptionStyle,
    words: CaptionWord[],
    videoDuration: number,
  ) => void;
  /** Remove one segment by id. */
  removeSegment: (id: string) => void;
  /** Update position for one segment (persisted on the timeline element). */
  updateSegmentPosition: (id: string, posX: number, posY: number) => void;
  /** Get the current segments (read from timeline). */
  getSegments: () => CaptionSegment[];
};

// ── Caption track is always on top ───────────────────────────────────────────
function ensureCaptionTrackOnTop(editor: TimelineEditor) {
  const tracks = editor.getTimelineData()?.tracks ?? [];
  const captionTrack = tracks.find(t => t.getName() === CAPTION_TRACK);
  if (!captionTrack || tracks[0]?.getId() === captionTrack.getId()) return;
  const reordered = [captionTrack, ...tracks.filter(t => t.getId() !== captionTrack.getId())];
  editor.reorderTracks(reordered);
}

function getOrCreateCaptionTrack(editor: TimelineEditor) {
  const existing = editor.getTimelineData()?.tracks?.find(t => t.getName() === CAPTION_TRACK);
  if (existing) return existing;
  return editor.addTrack(CAPTION_TRACK, TRACK_TYPES.ELEMENT);
}

function findById(editor: TimelineEditor, id: string): TrackElement | null {
  for (const t of editor.getTimelineData()?.tracks ?? []) {
    for (const el of t.getElements()) {
      if (el.getId() === id) return el as TrackElement;
    }
  }
  return null;
}

function wordsForRange(words: CaptionWord[], start: number, end: number): CaptionWord[] {
  return words.filter(w => w.start < end && w.end > start);
}

function buildLabel(style: CaptionStyle): string {
  return style
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Style + position encoded on the element name — text stays as the caption name. */
function encodeSegmentMeta(style: CaptionStyle, posX = 0, posY = 0): string {
  return `__cap__:${style};${Math.round(posX)},${Math.round(posY)}`;
}

function decodeSegmentMeta(
  el: TrackElement,
  allWords: CaptionWord[],
): CaptionSegment | null {
  if (!(el instanceof TextElement)) return null;
  // Prefer name (new); fall back to text for elements created before the split.
  const raw = el.getName?.() ?? "";
  const legacy = el.getText?.() ?? "";
  const encoded = raw.startsWith("__cap__:") ? raw : legacy;
  if (!encoded.startsWith("__cap__:")) return null;

  const body = encoded.slice("__cap__:".length);
  const [stylePart, posPart] = body.split(";");
  // stylePart may be "shadow" or legacy "shadow:0.000:16.900"
  const style = (stylePart ?? "").split(":")[0];
  if (!style) return null;

  let posX = 0;
  let posY = 0;
  if (posPart) {
    const [xStr, yStr] = posPart.split(",");
    const x = Number(xStr);
    const y = Number(yStr);
    if (Number.isFinite(x)) posX = Math.max(-100, Math.min(100, Math.round(x)));
    if (Number.isFinite(y)) posY = Math.max(-100, Math.min(100, Math.round(y)));
  }

  const start = el.getStart();
  const end = el.getEnd();
  return {
    id: el.getId(),
    style: style as CaptionStyle,
    start,
    end,
    words: wordsForRange(allWords, start, end),
    posX,
    posY,
  };
}

type SegmentSpec = { style: CaptionStyle; posX?: number; posY?: number };

// ── Caption background colors (one per style family) ─────────────────────────
const STYLE_COLORS: Record<string, string> = {
  subtitle: "#1e40af",
  "full-line": "#1e3a5f",
  shadow: "#374151",
  "clean-mid": "#1e40af",
  "word-pop": "#7c3aed",
  "bold-center": "#4c1d95",
  bounce: "#7c3aed",
  "solo-pop": "#4c1d95",
  "solo-red": "#991b1b",
  "mr-beast": "#991b1b",
  "stack-reveal": "#1e3a5f",
  shake: "#991b1b",
  "solo-shake": "#991b1b",
  fire: "#92400e",
  "gradient-gold": "#78350f",
  comic: "#1e3a8a",
  rainbow: "#6b21a8",
  "highlight-box": "#78350f",
  neon: "#064e3b",
  "electric-blue": "#0c4a6e",
  "solo-glow": "#064e3b",
  "gradient-pop": "#581c87",
  "solo-gradient": "#581c87",
  karaoke: "#78350f",
  wave: "#1e3a5f",
  typewriter: "#052e16",
  glitch: "#4a044e",
  "outline-white": "#1f2937",
  "outline-black": "#1f2937",
  "solo-box": "#78350f",
  gothic: "#0f172a",
  "word-stack": "#0c4a6e",
  "stack-shake": "#991b1b",
  "stack-wave": "#1e3a5f",
  "stack-neon": "#064e3b",
  "stack-fire": "#92400e",
  "stack-comic": "#1e3a8a",
  "stack-gold": "#78350f",
  "stack-sunny": "#78350f",
  "font-cycle": "#581c87",
};

function colorForStyle(style: CaptionStyle): string {
  return STYLE_COLORS[style] ?? "#1f2937";
}

export function useTimelineCaptionApi(
  apiRef: MutableRefObject<CaptionTrackApi | null>,
  wordsRef: MutableRefObject<CaptionWord[]>,
  onSegmentsChange: (segs: CaptionSegment[]) => void,
) {
  const { editor, changeLog } = useTimelineContext();
  const { seekTime, currentTime, playerState } = useLivePlayerContext();
  const seekRef = useRef(seekTime);
  seekRef.current = playerState === PLAYER_STATE.PLAYING ? currentTime : seekTime;

  const clearCaptionTrack = useCallback(() => {
    const track = editor.getTimelineData()?.tracks?.find(t => t.getName() === CAPTION_TRACK);
    if (!track) return;
    for (const el of [...track.getElements()]) {
      editor.removeElement(el);
    }
    editor.removeTrack(track);
    editor.refresh();
  }, [editor]);

  const buildSegments = useCallback(
    async (specs: SegmentSpec[], words: CaptionWord[], videoDuration: number) => {
      if (!specs.length || videoDuration <= 0) return;

      clearCaptionTrack();

      const track = getOrCreateCaptionTrack(editor);
      const span = videoDuration / specs.length;

      for (let i = 0; i < specs.length; i++) {
        const spec = specs[i]!;
        const style = spec.style;
        const posX = spec.posX ?? 0;
        const posY = spec.posY ?? 0;
        const start = +(i * span).toFixed(3);
        const end = +(Math.min((i + 1) * span, videoDuration)).toFixed(3);
        const el = new TextElement(buildLabel(style), {
          fill: colorForStyle(style),
          fontSize: 14,
        });
        el.setId(`cap_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        el.setName(encodeSegmentMeta(style, posX, posY));
        el.setStart(start).setEnd(end);
        await editor.addElementToTrack(track, el);
      }

      ensureCaptionTrackOnTop(editor);
      editor.refresh();
    },
    [editor, clearCaptionTrack],
  );

  const resetSegments = useCallback(
    (styles: CaptionStyle[], words: CaptionWord[], videoDuration: number) => {
      void buildSegments(styles.map(style => ({ style })), words, videoDuration);
    },
    [buildSegments],
  );

  const addSegment = useCallback(
    async (style: CaptionStyle, words: CaptionWord[], videoDuration: number) => {
      if (videoDuration <= 0) return;

      const track = editor.getTimelineData()?.tracks?.find(t => t.getName() === CAPTION_TRACK);
      const existing = track ? [...track.getElements()] : [];

      const specs: SegmentSpec[] = [
        ...existing.map(el => {
          const seg = decodeSegmentMeta(el, words);
          return {
            style: seg?.style ?? ("subtitle" as CaptionStyle),
            posX: seg?.posX ?? 0,
            posY: seg?.posY ?? 0,
          };
        }),
        { style, posX: 0, posY: 0 },
      ];

      void buildSegments(specs, words, videoDuration);
    },
    [editor, buildSegments],
  );

  const removeSegment = useCallback(
    (id: string) => {
      const el = findById(editor, id);
      if (!el) return;
      editor.removeElement(el);
      editor.refresh();
    },
    [editor],
  );

  const updateSegmentPosition = useCallback(
    (id: string, posX: number, posY: number) => {
      const el = findById(editor, id);
      if (!el || !(el instanceof TextElement)) return;
      const seg = decodeSegmentMeta(el, wordsRef.current);
      if (!seg) return;
      const x = Math.max(-100, Math.min(100, Math.round(posX)));
      const y = Math.max(-100, Math.min(100, Math.round(posY)));
      el.setName(encodeSegmentMeta(seg.style, x, y));
      editor.refresh();
    },
    [editor, wordsRef],
  );

  const getSegments = useCallback((): CaptionSegment[] => {
    const track = editor.getTimelineData()?.tracks?.find(t => t.getName() === CAPTION_TRACK);
    if (!track) return [];
    return track
      .getElements()
      .flatMap(el => {
        const seg = decodeSegmentMeta(el, wordsRef.current);
        if (!seg) return [];
        // Sync start/end from the live timeline element (user may have dragged it)
        seg.start = el.getStart();
        seg.end = el.getEnd();
        seg.words = wordsForRange(wordsRef.current, seg.start, seg.end);
        return [seg];
      })
      .sort((a, b) => a.start - b.start);
  }, [editor, wordsRef]);

  useEffect(() => {
    apiRef.current = { resetSegments, addSegment, removeSegment, updateSegmentPosition, getSegments };
    return () => { apiRef.current = null; };
  }, [apiRef, resetSegments, addSegment, removeSegment, updateSegmentPosition, getSegments]);

  // Push segments back to parent whenever the timeline changes
  useEffect(() => {
    if (!onSegmentsChange) return;
    const segs = getSegments();
    onSegmentsChange(segs);
  }, [changeLog, getSegments, onSegmentsChange]);

  return null;
}

/**
 * Component wrapper so it can live inside the TimelineProvider / LivePlayerProvider.
 */
export function TimelineCaptionBridge({
  apiRef,
  wordsRef,
  onSegmentsChange,
}: {
  apiRef: MutableRefObject<CaptionTrackApi | null>;
  wordsRef: MutableRefObject<CaptionWord[]>;
  onSegmentsChange: (segs: CaptionSegment[]) => void;
}) {
  useTimelineCaptionApi(apiRef, wordsRef, onSegmentsChange);
  return null;
}
