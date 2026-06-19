/**
 * Caption overlay service.
 *
 * Renders caption frames server-side using @napi-rs/canvas (identical API to
 * the browser canvas) and encodes them into a transparent VP9 WebM via FFmpeg.
 *
 * Performance strategy
 * ─────────────────────
 * • Render at 10 fps — plenty for text animations.
 * • Static styles: cache the PNG buffer, re-render only when the active word
 *   changes → O(words) renders instead of O(frames).
 * • Motion styles (bounce/wave/shake/glitch): always re-render per frame.
 */

import { createCanvas } from "@napi-rs/canvas";
import { spawn }        from "child_process";
import { renderCaptionFrame, MOTION_STYLES, CaptionWord, CaptionStyle } from "./caption-renderer.js";
import { logger }       from "../utils/logger.js";

const FPS               = 10;
const DEFAULT_FONT_SIZE = 28; // same default as the browser CaptionRenderer

export interface OverlayParams {
  words:        CaptionWord[];
  style:        string;
  width:        number;
  height:       number;
  durationSecs: number;
  fontSize?:    number; // logical font size from the editor (default 28)
  outputPath:   string; // destination .mov file
}

/**
 * Render caption frames to a transparent QTRLE .mov file.
 *
 * IMPORTANT — codec choice:
 * VP9/WebM silently DROPS the alpha plane (encodes as yuv420p instead of
 * yuva420p), making the overlay fully opaque black. QTRLE (QuickTime
 * Animation) in a .mov container is lossless and reliably preserves the
 * ARGB alpha channel, so the caption overlay composites transparently.
 *
 * QTRLE .mov needs a seekable output (the moov atom), so we write to a real
 * file rather than piping to stdout.
 */
export async function renderCaptionToFile(params: OverlayParams): Promise<void> {
  const { words, width, height, durationSecs, outputPath } = params;
  const fontSize    = params.fontSize ?? DEFAULT_FONT_SIZE;
  const style       = (params.style as CaptionStyle) ?? "bold-center";
  const isMotion    = MOTION_STYLES.has(style as CaptionStyle);
  const totalFrames = Math.ceil(durationSecs * FPS);

  logger.info("Caption overlay render started", {
    style, width, height, durationSecs, totalFrames, wordCount: words.length, fontSize,
  });

  const ffmpeg = spawn("ffmpeg", [
    "-y",
    "-f", "image2pipe", "-vcodec", "png", "-r", String(FPS), "-i", "pipe:0",
    "-c:v", "qtrle", "-pix_fmt", "argb",
    outputPath,
  ], { stdio: ["pipe", "ignore", "pipe"] });

  const stderrLog: string[] = [];
  ffmpeg.stderr.on("data", (c: Buffer) => stderrLog.push(c.toString()));

  const done = new Promise<void>((resolve, reject) => {
    ffmpeg.on("close", code =>
      code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}:\n${stderrLog.slice(-20).join("")}`))
    );
    ffmpeg.on("error", reject);
  });

  // Guard against EPIPE if ffmpeg dies early
  ffmpeg.stdin.on("error", () => {});

  const canvas      = createCanvas(width, height);
  // alpha: true so clearRect produces transparent pixels (not opaque black).
  const ctx         = canvas.getContext("2d", { alpha: true } as any);
  const bounceStart: Record<string, number> = {};

  let lastActiveStart: number | null | undefined = undefined;
  let lastPng: Buffer | null = null;

  for (let f = 0; f < totalFrames; f++) {
    const timeMs  = (f / FPS) * 1000;
    const timeSec = f / FPS;
    const active  = words.find(w => timeSec >= w.start && timeSec < w.end);
    const needsRender = isMotion || active?.start !== lastActiveStart;

    if (needsRender) {
      ctx.clearRect(0, 0, width, height);
      renderCaptionFrame(ctx, width, height, words, style as CaptionStyle, timeMs, fontSize, bounceStart);
      lastPng         = canvas.toBuffer("image/png");
      lastActiveStart = active?.start ?? null;
    }

    if (lastPng) {
      const ok = ffmpeg.stdin.write(lastPng);
      if (!ok) await new Promise<void>(r => ffmpeg.stdin.once("drain", r));
    }
  }

  ffmpeg.stdin.end();
  await done;

  logger.info("Caption overlay encoded", { style, outputPath });
}
