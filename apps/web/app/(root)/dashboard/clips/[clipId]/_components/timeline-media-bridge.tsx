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
  AudioElement,
  TRACK_TYPES,
  ValidationError,
  VALIDATION_ERROR_CODE,
  type TimelineEditor,
  type Track,
} from "@twick/timeline";
import { PLAYER_STATE, useLivePlayerContext } from "@twick/live-player";

export type TimelineMediaType = "video" | "audio" | "image";

export type TimelineMediaApi = {
  addMedia: (opts: {
    type: TimelineMediaType;
    url: string;
    name?: string;
  }) => Promise<void>;
};

const OVERLAY_TRACK_NAMES = new Set(["Text", "Stickers", "Captions"]);

function pickMediaTrack(editor: TimelineEditor): Track | null {
  const tracks = editor.getTimelineData()?.tracks ?? [];
  for (let i = tracks.length - 1; i >= 0; i--) {
    const t = tracks[i]!;
    if (OVERLAY_TRACK_NAMES.has(t.getName())) continue;
    if (t.getType() === TRACK_TYPES.ELEMENT || t.getType() === TRACK_TYPES.VIDEO) {
      return t;
    }
  }
  return null;
}

function createElement(
  type: TimelineMediaType,
  url: string,
  resolution: { width: number; height: number },
) {
  switch (type) {
    case "video":
      return new VideoElement(url, resolution);
    case "audio":
      return new AudioElement(url);
    case "image":
      return new ImageElement(url, resolution);
  }
}

/**
 * Imperative API so the Upload panel can click-to-add media
 * at the playhead (same element path as drag-drop onto the timeline).
 */
export function TimelineMediaBridge({
  apiRef,
}: {
  apiRef: MutableRefObject<TimelineMediaApi | null>;
}) {
  const { editor, videoResolution, setSelectedItem } = useTimelineContext();
  const { seekTime, currentTime, playerState } = useLivePlayerContext();
  const seekRef = useRef(seekTime);
  seekRef.current = playerState === PLAYER_STATE.PLAYING ? currentTime : seekTime;

  const addMedia = useCallback(
    async (opts: { type: TimelineMediaType; url: string; name?: string }) => {
      if (!opts.url) return;
      const resolution = videoResolution ?? { width: 1080, height: 1920 };
      const element = createElement(opts.type, opts.url, resolution);
      if (opts.name) element.setName(opts.name);
      element.setStart(Math.max(0, seekRef.current));

      const targetTrack =
        pickMediaTrack(editor) ?? editor.addTrack(`Track_${Date.now()}`, TRACK_TYPES.ELEMENT);

      const tryAdd = async (track: Track): Promise<boolean> => {
        try {
          const result = await editor.addElementToTrack(track, element);
          if (result) {
            setSelectedItem?.(element);
            return true;
          }
        } catch (err) {
          if (
            err instanceof ValidationError &&
            err.errors?.includes(VALIDATION_ERROR_CODE.COLLISION_ERROR)
          ) {
            const newTrack = editor.addTrack(`Track_${Date.now()}`, TRACK_TYPES.ELEMENT);
            return tryAdd(newTrack);
          }
          throw err;
        }
        return false;
      };

      await tryAdd(targetTrack);
      editor.refresh();
    },
    [editor, videoResolution, setSelectedItem],
  );

  useEffect(() => {
    apiRef.current = { addMedia };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, addMedia]);

  return null;
}
