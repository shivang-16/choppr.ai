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
  ImageElement,
  TrackElement,
  TRACK_TYPES,
  type TimelineEditor,
} from "@twick/timeline";
import { PLAYER_STATE, useLivePlayerContext } from "@twick/live-player";

export type TimelineOverlayApi = {
  addText: (opts: {
    id: string;
    text: string;
    color?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    startTime?: number;
    duration?: number;
  }) => Promise<void>;
  removeById: (id: string) => void;
  addSticker: (opts: {
    id: string;
    url: string;
    name?: string;
    startTime?: number;
    duration?: number;
  }) => Promise<void>;
  updateText: (opts: {
    id: string;
    text?: string;
    color?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
  }) => void;
  getCurrentTime: () => number;
  /** Rescale all overlay element start/end times by `factor` (newSpeed/oldSpeed inverse). */
  rescaleTimings: (factor: number) => void;
};

export type OverlayTimingItem = {
  id: string;
  startTime: number;
  duration: number;
  kind: "text" | "sticker";
  /** For text elements: the current text content (used to recover state after refresh) */
  text?: string;
};

const TEXT_TRACK = "Text";
const STICKER_TRACK = "Stickers";
const DEFAULT_OVERLAY_DUR = 4;

function getOrCreateTrack(editor: TimelineEditor, name: string) {
  const existing = editor.getTrackByName(name);
  if (existing) return existing;
  return editor.addTrack(name, TRACK_TYPES.ELEMENT);
}

function findElementById(editor: TimelineEditor, id: string): TrackElement | null {
  for (const track of editor.getTimelineData()?.tracks ?? []) {
    for (const el of track.getElements()) {
      if (el.getId() === id) return el as TrackElement;
    }
  }
  return null;
}

/** Keep Text / Stickers above video tracks (CapCut order). */
function ensureOverlayTracksOnTop(editor: TimelineEditor) {
  const tracks = editor.getTimelineData()?.tracks ?? [];
  if (tracks.length < 2) return;
  const text = tracks.filter(t => t.getName() === TEXT_TRACK);
  const stickers = tracks.filter(t => t.getName() === STICKER_TRACK);
  const rest = tracks.filter(
    t => t.getName() !== TEXT_TRACK && t.getName() !== STICKER_TRACK,
  );
  const ordered = [...text, ...stickers, ...rest];
  if (ordered.some((t, i) => t.getId() !== tracks[i]?.getId())) {
    editor.reorderTracks(ordered);
  }
}

/**
 * Registers an imperative API so the parent page can add text/sticker
 * clips onto dedicated timeline tracks (CapCut-style).
 */
export function TimelineOverlayBridge({
  apiRef,
  onOverlayTimingChange,
}: {
  apiRef: MutableRefObject<TimelineOverlayApi | null>;
  onOverlayTimingChange?: (items: OverlayTimingItem[]) => void;
}) {
  const { editor, changeLog } = useTimelineContext();
  const { seekTime, currentTime, playerState } = useLivePlayerContext();
  const seekRef = useRef(seekTime);
  seekRef.current = playerState === PLAYER_STATE.PLAYING ? currentTime : seekTime;

  const addText = useCallback(
    async (opts: {
      id: string;
      text: string;
      color?: string;
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
      startTime?: number;
      duration?: number;
    }) => {
      if (findElementById(editor, opts.id)) return;
      const start = Math.max(0, opts.startTime ?? seekRef.current);
      const dur = Math.max(0.5, opts.duration ?? DEFAULT_OVERLAY_DUR);
      const el = new TextElement(opts.text || "Text", {
        fill: opts.color ?? "#ffffff",
        fontSize: opts.fontSize ?? 48,
        fontWeight: opts.bold ? 700 : 400,
        fontStyle: opts.italic ? "italic" : "normal",
      });
      el.setId(opts.id);
      el.setName(opts.text?.slice(0, 24) || "Text");
      el.setStart(start).setEnd(start + dur);
      const track = getOrCreateTrack(editor, TEXT_TRACK);
      await editor.addElementToTrack(track, el);
      // Re-apply timing after addElementToTrack in case Twick reset start/end
      const added = findElementById(editor, opts.id);
      if (added) {
        added.setStart(start);
        added.setEnd(start + dur);
        editor.updateElement(added);
      }
      ensureOverlayTracksOnTop(editor);
      editor.refresh();
    },
    [editor],
  );

  const addSticker = useCallback(
    async (opts: {
      id: string;
      url: string;
      name?: string;
      startTime?: number;
      duration?: number;
    }) => {
      if (findElementById(editor, opts.id)) return;
      if (!opts.url) return;
      const start = Math.max(0, opts.startTime ?? seekRef.current);
      const dur = Math.max(0.5, opts.duration ?? DEFAULT_OVERLAY_DUR);
      const resolution = { width: 1080, height: 1920 };
      const el = new ImageElement(opts.url, resolution);
      el.setId(opts.id);
      el.setName(opts.name || "Sticker");
      try {
        await el.updateImageMeta();
      } catch {
        /* still add even if meta fails */
      }
      el.setStart(start).setEnd(start + dur);
      const track = getOrCreateTrack(editor, STICKER_TRACK);
      await editor.addElementToTrack(track, el);
      // Re-apply timing after addElementToTrack in case Twick reset start/end
      const added = findElementById(editor, opts.id);
      if (added) {
        added.setStart(start);
        added.setEnd(start + dur);
        editor.updateElement(added);
      }
      ensureOverlayTracksOnTop(editor);
      editor.refresh();
    },
    [editor],
  );

  const removeById = useCallback(
    (id: string) => {
      const el = findElementById(editor, id);
      if (!el) return;
      editor.removeElement(el);
      editor.refresh();
    },
    [editor],
  );

  const updateText = useCallback(
    (opts: {
      id: string;
      text?: string;
      color?: string;
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
    }) => {
      const el = findElementById(editor, opts.id);
      if (!el || !(el instanceof TextElement)) return;
      if (opts.text != null) {
        el.setText(opts.text);
        el.setName(opts.text.slice(0, 24) || "Text");
      }
      if (opts.color != null) el.setFill(opts.color);
      if (opts.fontSize != null) el.setFontSize(opts.fontSize);
      if (opts.bold != null) el.setFontWeight(opts.bold ? 700 : 400);
      if (opts.italic != null) el.setFontStyle(opts.italic ? "italic" : "normal");
      editor.updateElement(el);
      editor.refresh();
    },
    [editor],
  );

  const getCurrentTime = useCallback(() => seekRef.current, []);

  const rescaleTimings = useCallback((factor: number) => {
    if (factor <= 0 || factor === 1) return;
    for (const trackName of [TEXT_TRACK, STICKER_TRACK]) {
      const track = editor.getTrackByName(trackName);
      if (!track) continue;
      for (const el of track.getElements()) {
        const newStart = el.getStart() * factor;
        const newEnd   = el.getEnd()   * factor;
        el.setStart(newStart);
        el.setEnd(newEnd);
        editor.updateElement(el);
      }
    }
    editor.refresh();
  }, [editor]);

  useEffect(() => {
    apiRef.current = { addText, addSticker, removeById, updateText, getCurrentTime, rescaleTimings };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, addText, addSticker, removeById, updateText, getCurrentTime, rescaleTimings]);

  // Push timing back to parent when timeline elements move/trim/delete
  useEffect(() => {
    if (!onOverlayTimingChange) return;
    const items: OverlayTimingItem[] = [];
    for (const track of editor.getTimelineData()?.tracks ?? []) {
      const name = track.getName();
      const kind: "text" | "sticker" | null =
        name === TEXT_TRACK ? "text" : name === STICKER_TRACK ? "sticker" : null;
      if (!kind) continue;
      for (const el of track.getElements()) {
        const dur = Math.max(0.1, el.getEnd() - el.getStart());
        items.push({
          id: el.getId(),
          startTime: el.getStart(),
          duration: dur,
          kind,
          text: kind === "text" && el instanceof TextElement ? el.getText() : undefined,
        });
      }
    }
    onOverlayTimingChange(items);
  }, [changeLog, editor, onOverlayTimingChange]);

  return null;
}
