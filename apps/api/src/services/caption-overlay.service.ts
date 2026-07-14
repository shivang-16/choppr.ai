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
import { ensureFontsRegistered } from "../utils/fonts.js";
import { logger }       from "../utils/logger.js";

const FPS               = 10;
const DEFAULT_FONT_SIZE = 50; // same default as the browser CaptionRenderer

export interface OverlayParams {
  words:        CaptionWord[];
  style:        string;
  width:        number;
  height:       number;
  durationSecs: number;
  fontSize?:    number; // logical font size from the editor (default 28)
  posOffset?:   number; // vertical offset in % of height (- = up, + = down)
  hOffset?:     number; // horizontal offset in % of width (- = left, + = right)
  /** When set, each frame picks style/position/words from the active time segment. */
  segments?: Array<{
    style: string;
    start: number;
    end: number;
    posX: number;
    posY: number;
    words: CaptionWord[];
  }>;
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
  ensureFontsRegistered();
  const { words, width, height, durationSecs, outputPath, segments } = params;
  const fontSize    = params.fontSize ?? DEFAULT_FONT_SIZE;
  const posOffset   = params.posOffset ?? 0;
  const hOffset     = params.hOffset ?? 0;
  const style       = (params.style as CaptionStyle) ?? "bold-center";
  const useSegments = Array.isArray(segments) && segments.length > 0;
  const isMotion    = useSegments
    ? segments!.some(s => MOTION_STYLES.has(s.style as CaptionStyle))
    : MOTION_STYLES.has(style as CaptionStyle);
  const totalFrames = Math.ceil(durationSecs * FPS);

  logger.info("Caption overlay render started", {
    style, width, height, durationSecs, totalFrames,
    wordCount: words.length, fontSize, segmentCount: segments?.length ?? 0,
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

  let lastActiveKey: string | null | undefined = undefined;
  let lastPng: Buffer | null = null;

  for (let f = 0; f < totalFrames; f++) {
    const timeMs  = (f / FPS) * 1000;
    const timeSec = f / FPS;

    let frameWords = words;
    let frameStyle = style as CaptionStyle;
    let framePosY = posOffset;
    let framePosX = hOffset;

    if (useSegments) {
      const seg = segments!.find(s => timeSec >= s.start - 0.001 && timeSec < s.end + 0.001);
      if (!seg) {
        frameWords = [];
        frameStyle = "none" as CaptionStyle;
      } else {
        frameWords = seg.words;
        frameStyle = seg.style as CaptionStyle;
        framePosX = seg.posX;
        framePosY = seg.posY;
      }
    }

    const active  = frameWords.find(w => timeSec >= w.start && timeSec < w.end);
    const activeKey = `${frameStyle}:${framePosX}:${framePosY}:${active?.start ?? "none"}`;
    const needsRender = isMotion || activeKey !== lastActiveKey;

    if (needsRender) {
      ctx.clearRect(0, 0, width, height);
      if (frameStyle !== "none" && frameWords.length > 0) {
        renderCaptionFrame(
          ctx, width, height, frameWords, frameStyle, timeMs, fontSize,
          bounceStart, framePosY, framePosX,
        );
      }
      lastPng     = canvas.toBuffer("image/png");
      lastActiveKey = activeKey;
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
