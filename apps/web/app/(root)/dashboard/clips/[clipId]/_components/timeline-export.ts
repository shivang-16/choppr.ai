import {
  AudioElement,
  ImageElement,
  VideoElement,
  type TimelineEditor,
} from "@twick/timeline";
import { isBrollTrackName, type BrollShot } from "./broll-types";

export interface ChopprTrackItem {
  id: string;
  type: "video" | "audio";
  startTime: number;
  duration: number;
  sourceDuration: number;
  trimIn: number;
  trimOut: number;
  src?: string;
}

export interface ChopprTrack {
  id: string;
  items: ChopprTrackItem[];
}

export function buildExportTracksFromEditor(editor: TimelineEditor): ChopprTrack[] {
  const data = editor.getTimelineData();
  const videoItems: ChopprTrackItem[] = [];
  const audioItems: ChopprTrackItem[] = [];

  for (const track of data?.tracks ?? []) {
    if (isBrollTrackName(track.getName())) continue;
    for (const el of track.getElements()) {
      if (el instanceof VideoElement) {
        const trimIn = el.getStartAt();
        const timelineDur = Math.max(0.1, el.getEnd() - el.getStart());
        const sourceDur = el.getMediaDuration() > 0 ? el.getMediaDuration() : timelineDur;
        videoItems.push({
          id: el.getId(),
          type: "video",
          startTime: el.getStart(),
          duration: timelineDur,
          sourceDuration: sourceDur,
          trimIn,
          trimOut: Math.max(0, sourceDur - trimIn - timelineDur),
          src: el.getSrc(),
        });
      } else if (el instanceof AudioElement) {
        const trimIn = el.getStartAt();
        const timelineDur = Math.max(0.1, el.getEnd() - el.getStart());
        const sourceDur =
          el.getMediaDuration() > 0 ? el.getMediaDuration() : timelineDur;
        audioItems.push({
          id: el.getId(),
          type: "audio",
          startTime: el.getStart(),
          duration: timelineDur,
          sourceDuration: sourceDur,
          trimIn,
          trimOut: Math.max(0, sourceDur - trimIn - timelineDur),
          src: el.getSrc(),
        });
      }
    }
  }

  videoItems.sort((a, b) => a.startTime - b.startTime);
  audioItems.sort((a, b) => a.startTime - b.startTime);

  return [
    { id: "track-video", items: videoItems },
    { id: "track-audio", items: audioItems },
  ];
}

export function findPrimaryVideoElement(
  editor: TimelineEditor,
  primaryId: string,
): VideoElement | null {
  const data = editor.getTimelineData();
  if (!data?.tracks) return null;

  for (const track of data.tracks) {
    if (isBrollTrackName(track.getName())) continue;
    for (const el of track.getElements()) {
      if (el instanceof VideoElement && el.getId() === primaryId) return el;
    }
  }

  for (const track of data.tracks) {
    if (isBrollTrackName(track.getName())) continue;
    for (const el of track.getElements()) {
      if (el instanceof VideoElement) return el;
    }
  }
  return null;
}

function elementSrc(el: unknown): string {
  if (!el || typeof el !== "object") return "";
  const src = (el as { getSrc?: () => string }).getSrc;
  return typeof src === "function" ? src.call(el) ?? "" : "";
}

/** Overlay B-roll items — never concatenated into the A-roll track. */
export function buildBrollFromEditor(editor: TimelineEditor): BrollShot[] {
  const shots: BrollShot[] = [];
  for (const track of editor.getTimelineData()?.tracks ?? []) {
    if (!isBrollTrackName(track.getName())) continue;
    for (const el of track.getElements()) {
      const src = elementSrc(el);
      if (!src) continue;
      const mediaType = el instanceof VideoElement ? "video" : el instanceof ImageElement ? "image" : null;
      if (!mediaType) continue;
      const trimIn = el instanceof VideoElement ? el.getStartAt() : 0;
      const sourceDur = el instanceof VideoElement && el.getMediaDuration() > 0
        ? el.getMediaDuration()
        : Math.max(0.1, el.getEnd() - el.getStart());
      shots.push({
        id: el.getId(),
        startTime: el.getStart(),
        duration: Math.max(0.1, el.getEnd() - el.getStart()),
        src,
        mediaType,
        mode: "cutaway",
        trimIn: Math.min(trimIn, Math.max(0, sourceDur - 0.1)),
        status: "ready",
      });
    }
  }
  shots.sort((a, b) => a.startTime - b.startTime);
  return shots;
}
