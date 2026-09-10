"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
} from "react";
import {
  useTimelineContext,
  VideoElement,
  ImageElement,
  TrackElement,
  TRACK_TYPES,
  ValidationError,
  VALIDATION_ERROR_CODE,
  type TimelineEditor,
} from "@twick/timeline";
import { PLAYER_STATE, useLivePlayerContext } from "@twick/live-player";
import {
  BROLL_TRACK,
  DEFAULT_BROLL_DUR,
  isBrollTrackName,
  type BrollMediaType,
  type BrollMode,
  type BrollShot,
  type BrollSource,
} from "./broll-types";

export type TimelineBrollApi = {
  addBroll: (opts: {
    id?: string;
    type: BrollMediaType;
    url: string;
    name?: string;
    startTime?: number;
    duration?: number;
    trimIn?: number;
    prompt?: string;
    phrase?: string;
    source?: BrollSource;
    mode?: BrollMode;
  }) => Promise<string | null>;
  removeById: (id: string) => void;
  removeAll: () => void;
  getCurrentTime: () => number;
  rescaleTimings: (factor: number) => void;
};

function getSrc(el: TrackElement): string {
  const anyEl = el as TrackElement & { getSrc?: () => string };
  return typeof anyEl.getSrc === "function" ? anyEl.getSrc() ?? "" : "";
}

function findElementById(editor: TimelineEditor, id: string): TrackElement | null {
  for (const track of editor.getTimelineData()?.tracks ?? []) {
    for (const el of track.getElements()) {
      if (el.getId() === id) return el as TrackElement;
    }
  }
  return null;
}

function ensureBrollTrackOrder(editor: TimelineEditor) {
  const tracks = editor.getTimelineData()?.tracks ?? [];
  if (tracks.length < 2) return;
  const pick = (name: string) => tracks.filter(t => t.getName() === name);
  const overlay = new Set(["Captions", "Text", "Stickers"]);
  const ordered = [
    ...pick("Captions"),
    ...pick("Text"),
    ...pick("Stickers"),
    ...tracks.filter(t => isBrollTrackName(t.getName())),
    ...tracks.filter(t => !overlay.has(t.getName()) && !isBrollTrackName(t.getName())),
  ];
  if (ordered.length === tracks.length && ordered.some((t, i) => t.getId() !== tracks[i]?.getId())) {
    editor.reorderTracks(ordered);
  }
}

function getOrCreateBrollTrack(editor: TimelineEditor) {
  const existing = editor.getTimelineData()?.tracks?.find(t => t.getName() === BROLL_TRACK);
  if (existing) return existing;
  return editor.addTrack(BROLL_TRACK, TRACK_TYPES.ELEMENT);
}

export function TimelineBrollBridge({
  apiRef,
  onBrollChange,
}: {
  apiRef: MutableRefObject<TimelineBrollApi | null>;
  onBrollChange?: (shots: BrollShot[]) => void;
}) {
  const { editor, videoResolution, changeLog, setSelectedItem } = useTimelineContext();
  const { seekTime, currentTime, playerState } = useLivePlayerContext();
  const seekRef = useRef(seekTime);
  seekRef.current = playerState === PLAYER_STATE.PLAYING ? currentTime : seekTime;

  const addBroll = useCallback(
    async (opts: {
      id?: string;
      type: BrollMediaType;
      url: string;
      name?: string;
      startTime?: number;
      duration?: number;
      trimIn?: number;
      prompt?: string;
      phrase?: string;
      source?: BrollSource;
      mode?: BrollMode;
    }): Promise<string | null> => {
      if (!opts.url) return null;
      const id = opts.id ?? `broll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (findElementById(editor, id)) return id;

      const resolution = videoResolution ?? { width: 1080, height: 1920 };
      const start = Math.max(0, opts.startTime ?? seekRef.current);
      const trimIn = Math.max(0, opts.trimIn ?? 0);
      const requested = Math.max(0.4, opts.duration ?? DEFAULT_BROLL_DUR);

      const element =
        opts.type === "video"
          ? new VideoElement(opts.url, resolution)
          : new ImageElement(opts.url, resolution);

      element.setId(id);
      element.setName(opts.name || opts.phrase || "B-roll");

      try {
        if (opts.type === "video") await (element as VideoElement).updateVideoMeta();
        else await (element as ImageElement).updateImageMeta();
      } catch {
        /* still add */
      }

      let dur = requested;
      if (opts.type === "video") {
        const mediaDur = (element as VideoElement).getMediaDuration();
        if (mediaDur > 0.2) dur = Math.min(requested, Math.max(0.4, mediaDur - trimIn));
      }
      element.setStart(start).setEnd(start + dur);
      if (opts.type === "video") (element as VideoElement).setStartAt(trimIn);

      const tryAdd = async (trackName: string): Promise<boolean> => {
        const track =
          editor.getTimelineData()?.tracks?.find(t => t.getName() === trackName) ??
          (trackName === BROLL_TRACK
            ? getOrCreateBrollTrack(editor)
            : editor.addTrack(trackName, TRACK_TYPES.ELEMENT));
        try {
          const result = await editor.addElementToTrack(track, element);
          if (result) {
            const added = findElementById(editor, id);
            if (added) {
              added.setStart(start);
              added.setEnd(start + dur);
              if (added instanceof VideoElement) added.setStartAt(trimIn);
              editor.updateElement(added);
            }
            setSelectedItem?.(element);
            return true;
          }
        } catch (err) {
          if (
            err instanceof ValidationError &&
            err.errors?.includes(VALIDATION_ERROR_CODE.COLLISION_ERROR)
          ) {
            return false;
          }
          throw err;
        }
        return false;
      };

      let placed = await tryAdd(BROLL_TRACK);
      if (!placed) placed = await tryAdd(`${BROLL_TRACK} ${Date.now()}`);
      if (!placed) return null;

      ensureBrollTrackOrder(editor);
      editor.refresh();
      return id;
    },
    [editor, setSelectedItem, videoResolution],
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

  const removeAll = useCallback(() => {
    const tracks = editor.getTimelineData()?.tracks ?? [];
    for (const track of [...tracks]) {
      if (!isBrollTrackName(track.getName())) continue;
      for (const el of [...track.getElements()]) {
        editor.removeElement(el);
      }
      if (track.getElements().length === 0 && track.getName() !== BROLL_TRACK) {
        editor.removeTrack(track);
      }
    }
    editor.refresh();
  }, [editor]);

  const getCurrentTime = useCallback(() => seekRef.current, []);

  const rescaleTimings = useCallback(
    (factor: number) => {
      if (factor <= 0 || factor === 1) return;
      for (const track of editor.getTimelineData()?.tracks ?? []) {
        if (!isBrollTrackName(track.getName())) continue;
        for (const el of track.getElements()) {
          el.setStart(el.getStart() * factor);
          el.setEnd(el.getEnd() * factor);
          editor.updateElement(el);
        }
      }
      editor.refresh();
    },
    [editor],
  );

  useEffect(() => {
    apiRef.current = { addBroll, removeById, removeAll, getCurrentTime, rescaleTimings };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, addBroll, removeById, removeAll, getCurrentTime, rescaleTimings]);

  useEffect(() => {
    if (!onBrollChange) return;
    const shots: BrollShot[] = [];
    for (const track of editor.getTimelineData()?.tracks ?? []) {
      if (!isBrollTrackName(track.getName())) continue;
      for (const el of track.getElements()) {
        const src = getSrc(el);
        if (!src) continue;
        const mediaType: BrollMediaType = el instanceof VideoElement ? "video" : "image";
        const trimIn = el instanceof VideoElement ? el.getStartAt() : 0;
        shots.push({
          id: el.getId(),
          startTime: el.getStart(),
          duration: Math.max(0.1, el.getEnd() - el.getStart()),
          src,
          mediaType,
          mode: "cutaway",
          trimIn,
          status: "ready",
        });
      }
    }
    shots.sort((a, b) => a.startTime - b.startTime);
    onBrollChange(shots);
  }, [changeLog, editor, onBrollChange]);

  return null;
}
