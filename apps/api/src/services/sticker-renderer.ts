/**
 * Server-side sticker renderer using @napi-rs/canvas.
 * Supports Stipop image stickers (stickerId starts with "stipop:")
 * and legacy Giphy stickers (stickerId starts with "giphy:").
 * Downloads each sticker render URL, draws it onto a transparent canvas,
 * and returns a PNG Buffer for FFmpeg overlay compositing.
 */

import { createCanvas, loadImage, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";

export interface PlacedSticker {
  stickerId:   string;   // "stipop:{id}" for Stipop stickers, "giphy:{id}" for legacy
  stickerUrl?: string | undefined;  // render URL — set for Stipop stickers
  giphyUrl?:   string | undefined;  // render URL — legacy Giphy stickers
  previewUrl?: string | undefined;  // small thumbnail URL — unused server-side
  x:     number;         // 0-1 normalised
  y:     number;         // 0-1 normalised
  scale: number;         // 0.3-2.0
}

/**
 * Render all placed stickers onto a single transparent PNG the same size as
 * the video frame. Returns a Buffer that FFmpeg can use as an overlay input.
 */
export async function renderStickersToBuffer(
  stickers: PlacedSticker[],
  frameW:   number,
  frameH:   number,
): Promise<Buffer> {
  const canvas: Canvas = createCanvas(frameW, frameH);
  const ctx = canvas.getContext("2d") as unknown as SKRSContext2D;

  for (const ps of stickers) {
    const px    = ps.x * frameW;
    const py    = ps.y * frameH;
    const pSize = frameW * 0.18 * ps.scale;
    const half  = pSize / 2;

    const url = ps.stickerUrl ?? ps.giphyUrl;
    if (url) {
      try {
        const img = await loadImage(url);
        (ctx as any).save();
        (ctx as any).drawImage(img, px - half, py - half, pSize, pSize);
        (ctx as any).restore();
      } catch {
        // Download failed — skip this sticker, don't break the export
      }
      continue;
    }

    // Unknown / legacy sticker id — skip silently
  }

  return (canvas as unknown as { toBuffer(mime: string): Buffer }).toBuffer("image/png");
}
