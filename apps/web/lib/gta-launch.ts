// GTA 6 launch promo: swap homepage demo imagery for GTA 6 artwork.
// Set to false to restore the original images (nothing was deleted).
export const GTA_LAUNCH_MODE = true;

const N = 11;
/** 11 full 16:9 images: /gta6/gta6-1.jpg … gta6-11.jpg */
export const GTA6 = Array.from({ length: N }, (_, i) => `/gta6/gta6-${i + 1}.jpg`);

const assigned = new Map<string, number>();
let cursor = 0;

/** Map any key (e.g. an unsplash id) to a GTA 6 image/crop matching the slot's shape. */
export function gtaImage(key: string): string {
  // Round-robin through ALL images so neighbouring slots differ; the same key
  // always maps to the same image. Always a FULL image (never pre-cropped).
  let i = assigned.get(key);
  if (i === undefined) {
    i = (cursor * 4) % N; // stride 4 (coprime with 11) spreads similar slots apart
    cursor++;
    assigned.set(key, i);
  }
  return GTA6[i]!;
}

/** Use full GTA 6 image #index when launch mode is on, otherwise the original. */
export const gtaOr = (original: string, index: number) =>
  GTA_LAUNCH_MODE ? GTA6[index % N]! : original;

// GTA VI Trailer 2, streamed from S3 (not stored in the repo). Each use shows a
// short silent segment via a media fragment (#t=start,end) that loops in-range.
const TRAILER2_URL =
  "https://general-storage-shivang.s3.ap-south-1.amazonaws.com/choppr/gta6/GTAVI_Trailer_2_720p.mp4";

export const gtaSrc = (original: string, start: number, end: number) =>
  GTA_LAUNCH_MODE ? `${TRAILER2_URL}#t=${start},${end}` : original;

/** Spread on a <video>: loops inside the #t=start,end fragment of its source. */
export const gtaVideoProps = GTA_LAUNCH_MODE
  ? {
      muted: true,
      preload: "metadata" as const,
      onTimeUpdate: (e: { currentTarget: HTMLVideoElement }) => {
        const v = e.currentTarget;
        const m = /#t=([\d.]+),([\d.]+)/.exec(v.currentSrc);
        if (m && v.currentTime >= Number(m[2])) v.currentTime = Number(m[1]);
      },
    }
  : {};
