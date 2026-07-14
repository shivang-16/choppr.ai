/**
 * Server-side text overlay renderer using @napi-rs/canvas + twemoji.
 * Text is rendered with the system sans-serif font.
 * Emoji are extracted, fetched as Twemoji PNGs, and composited individually
 * — this ensures pixel-perfect emoji on any OS (no system emoji font required).
 */

import { createCanvas, loadImage } from "@napi-rs/canvas";

export interface TextOverlay {
  id:        string;
  text:      string;
  x:         number;
  y:         number;
  fontSize:  number;
  color:     string;
  bold:      boolean;
  italic:    boolean;
  /** Timeline start time in seconds. Undefined = show for entire video. */
  startTime?: number | undefined;
  /** Duration in seconds. Undefined = show for entire video. */
  duration?:  number | undefined;
}

// Matches a single Unicode emoji (including ZWJ sequences, flag pairs, etc.)
const EMOJI_REGEX =
  /\p{Emoji_Presentation}|\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}))*|\uD83C[\uDDE0-\uDDFF]\uD83C[\uDDE0-\uDDFF]/gu;

/** Split text into alternating runs of plain text and emoji. */
function tokenize(text: string): Array<{ type: "text" | "emoji"; value: string }> {
  const tokens: Array<{ type: "text" | "emoji"; value: string }> = [];
  let last = 0;
  for (const m of text.matchAll(new RegExp(EMOJI_REGEX.source, "gu"))) {
    if (m.index! > last) tokens.push({ type: "text",  value: text.slice(last, m.index) });
    tokens.push({ type: "emoji", value: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}

/** Convert a single emoji string to its Twemoji CDN URL (72×72 PNG). */
function twemojiUrl(emoji: string): string {
  const cp = [...emoji]
    .map(c => c.codePointAt(0)!.toString(16))
    .filter(h => h !== "fe0f") // strip variation selector-16
    .join("-");
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/72x72/${cp}.png`;
}

/** Measure the total pixel width of a full text string using a scratch canvas. */
function measureFull(text: string, font: string): number {
  const scratch = createCanvas(10, 10).getContext("2d");
  scratch.font = font;
  return scratch.measureText(text).width;
}

/**
 * Render text overlays to a transparent PNG buffer.
 * @param overlays        - Array of text overlay definitions
 * @param targetW         - Export video width in pixels
 * @param targetH         - Export video height in pixels
 * @param previewBaseWidth - Actual pixel width of the browser preview container
 */
export async function renderTextOverlaysToBuffer(
  overlays: TextOverlay[],
  targetW: number,
  targetH: number,
  previewBaseWidth = 380,
): Promise<Buffer> {
  const canvas = createCanvas(targetW, targetH);
  const ctx = canvas.getContext("2d");

  const scale = targetW / previewBaseWidth;

  for (const t of overlays) {
    const scaledFontSize = Math.round(t.fontSize * scale);
    const weight = t.bold ? "bold " : "";
    const style  = t.italic ? "italic " : "";
    const font   = `${style}${weight}${scaledFontSize}px sans-serif`;

    ctx.font      = font;
    ctx.fillStyle = t.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const tokens = tokenize(t.text);

    // Measure total width to centre the text at (x, y)
    const totalWidth = measureFull(t.text, font);
    const cx = Math.round(t.x * targetW) - totalWidth / 2;
    const cy = Math.round(t.y * targetH);

    let cursorX = cx;

    for (const token of tokens) {
      if (token.type === "text") {
        // Drop shadow
        ctx.shadowColor    = "rgba(0,0,0,0.7)";
        ctx.shadowBlur     = Math.max(3, scaledFontSize * 0.06);
        ctx.shadowOffsetX  = 2;
        ctx.shadowOffsetY  = 2;

        ctx.fillText(token.value, cursorX, cy);

        ctx.shadowColor   = "transparent";
        ctx.shadowBlur    = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        cursorX += ctx.measureText(token.value).width;
      } else {
        // Emoji: fetch Twemoji PNG and draw it
        const emojiSize = scaledFontSize * 1.15; // slight upscale to match visual weight
        try {
          const img = await loadImage(twemojiUrl(token.value));
          ctx.drawImage(img, cursorX, cy - emojiSize / 2, emojiSize, emojiSize);
          cursorX += emojiSize;
        } catch {
          // Fallback: try rendering with system font (may show tofu if unavailable)
          ctx.fillText(token.value, cursorX, cy);
          cursorX += ctx.measureText(token.value).width;
        }
      }
    }
  }

  return Buffer.from(canvas.toBuffer("image/png"));
}
