import {
  AudioElement,
  VideoElement,
  type TimelineEditor,
} from "@twick/timeline";

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
    for (const el of track.getElements()) {
      if (el instanceof VideoElement && el.getId() === primaryId) return el;
    }
  }

  for (const track of data.tracks) {
    for (const el of track.getElements()) {
      if (el instanceof VideoElement) return el;
    }
  }
  return null;
}
