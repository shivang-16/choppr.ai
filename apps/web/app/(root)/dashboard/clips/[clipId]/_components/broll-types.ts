export const BROLL_TRACK = "B-roll";
export const DEFAULT_BROLL_DUR = 3;

export type BrollMediaType = "video" | "image";
export type BrollMode = "cutaway" | "pip" | "split";
export type BrollSource = "upload" | "canvas" | "reel" | "stock" | "suggested";
export type BrollShotStatus = "ready" | "generating" | "failed" | "placeholder";

export interface BrollShot {
  id: string;
  startTime: number;
  duration: number;
  src: string;
  mediaType: BrollMediaType;
  mode: BrollMode;
  trimIn: number;
  prompt?: string;
  phrase?: string;
  source?: BrollSource;
  status?: BrollShotStatus;
}

export function parseBrollShots(raw: unknown): BrollShot[] {
  if (!Array.isArray(raw)) return [];
  const out: BrollShot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const src = typeof s.src === "string" ? s.src : "";
    const id = typeof s.id === "string" ? s.id : "";
    if (!src || !id) continue;
    out.push({
      id,
      startTime: Number(s.startTime) || 0,
      duration: Math.max(0.1, Number(s.duration) || DEFAULT_BROLL_DUR),
      src,
      mediaType: s.mediaType === "video" ? "video" : "image",
      mode: "cutaway",
      trimIn: Math.max(0, Number(s.trimIn) || 0),
      prompt: typeof s.prompt === "string" ? s.prompt : undefined,
      phrase: typeof s.phrase === "string" ? s.phrase : undefined,
      source: typeof s.source === "string" ? (s.source as BrollSource) : undefined,
      status: "ready",
    });
  }
  return out;
}

export function isBrollTrackName(name: string): boolean {
  return name === BROLL_TRACK || name.startsWith("B-roll");
}

/** Drop B-roll tracks from a serialized Twick project so other versions stay empty. */
export function stripBrollTracks(tracks: unknown[]): unknown[] {
  if (!Array.isArray(tracks)) return [];
  return tracks.filter(track => {
    if (!track || typeof track !== "object") return true;
    const rec = track as Record<string, unknown>;
    const name =
      (typeof rec.name === "string" && rec.name)
      || (typeof rec.trackName === "string" && rec.trackName)
      || "";
    return !name || !isBrollTrackName(name);
  });
}

export function serializedTracksHaveBroll(tracks: unknown[] | null | undefined): boolean {
  if (!Array.isArray(tracks) || tracks.length === 0) return false;
  try {
    return JSON.stringify(tracks).includes("B-roll");
  } catch {
    return false;
  }
}

export function activeBrollAt(shots: BrollShot[], time: number): BrollShot | null {
  let best: BrollShot | null = null;
  for (const shot of shots) {
    if (shot.status === "failed") continue;
    if (time >= shot.startTime - 0.02 && time < shot.startTime + shot.duration - 0.02) {
      if (!best || shot.startTime >= best.startTime) best = shot;
    }
  }
  return best;
}
