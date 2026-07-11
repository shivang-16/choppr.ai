/**
 * TypeScript export pipeline — replaces the Python exporter entirely.
 *
 * Steps (mirrors process_export in exporter.py):
 *  1. Download source clips from their S3 URLs
 *  2. Cut + reframe each segment with FFmpeg
 *  3. Concat all segments
 *  4. Render caption overlay in-process (node-canvas → transparent WebM)
 *  5. Composite overlay onto video with FFmpeg
 *  6. Upload final.mp4 to S3
 *  7. Update Export + (optionally) Clip documents in MongoDB
 */

import { spawn, type ChildProcess } from "child_process";
import { createWriteStream, promises as fsp } from "fs";
import { pipeline }          from "stream/promises";
import { Readable }          from "stream";
import { tmpdir }            from "os";
import { createCanvas }      from "@napi-rs/canvas";
import { join }              from "path";
import { randomUUID }        from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Export }            from "../model/export.model.js";
import { Clip }              from "../model/clip.model.js";
import { renderCaptionToFile } from "./caption-overlay.service.js";
import { type PlacedSticker } from "./sticker-renderer.js";
import { renderTextOverlaysToBuffer, type TextOverlay as TextOverlayRenderable } from "./text-overlay-renderer.js";
import { logger }            from "../utils/logger.js";

// ── AWS ───────────────────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-south-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_CLIPS_BUCKET ?? "choppr-media";
const REGION = process.env.AWS_REGION      ?? "ap-south-1";

/** Abort exports that run longer than this (25 min — above the 20 min UX minimum). */
export const EXPORT_PIPELINE_TIMEOUT_MS = 25 * 60 * 1000;

class ExportCancelledError extends Error {
  constructor(message = "Export cancelled by user") {
    super(message);
    this.name = "ExportCancelledError";
  }
}

class ExportTimeoutError extends Error {
  constructor() {
    super(`Export timed out after ${EXPORT_PIPELINE_TIMEOUT_MS / 60_000} minutes`);
    this.name = "ExportTimeoutError";
  }
}

type ExportRun = {
  aborted: boolean;
  processes: ChildProcess[];
};

const activeExports = new Map<string, ExportRun>();

function registerExport(exportId: string): ExportRun {
  const run: ExportRun = { aborted: false, processes: [] };
  activeExports.set(exportId, run);
  return run;
}

function unregisterExport(exportId: string) {
  activeExports.delete(exportId);
}

/** Kill FFmpeg children and mark the in-memory run as aborted. */
export function cancelExportPipeline(exportId: string): boolean {
  const run = activeExports.get(exportId);
  if (!run) return false;
  run.aborted = true;
  for (const proc of run.processes) {
    try {
      proc.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  return true;
}

export function isExportPipelineActive(exportId: string): boolean {
  return activeExports.has(exportId);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrackItem {
  id:             string;
  type:           "video" | "audio" | "text";
  startTime:      number;
  duration:       number;
  trimIn:         number;
  src?:           string | undefined;
  audioDetached?: boolean | undefined;
  [key: string]:  unknown; // allow extra fields from Zod schema (trimOut, sourceDuration, etc.)
}

export interface Track {
  id:    string;
  items: TrackItem[];
}

export interface ExportPipelineParams {
  exportId:       string;
  projectId:      string;
  userId:         string;
  tracks:         Track[];
  volumes:        Record<string, number>;
  speeds:         Record<string, number>;
  captionStyle:   string;
  captionFontSize?: number;
  captionPosY?:   number;
  captionPosX?:   number;
  captionMap:     Record<string, { word: string; start: number; end: number }[]>;
  captionSegments?: Array<{
    style: string;
    start: number;
    end: number;
    posX: number;
    posY: number;
    words: { word: string; start: number; end: number }[];
  }>;
  aspectRatio:    string;
  backgroundFill: string;
  brightness?:    number;
  contrast?:      number;
  saturation?:    number;
  originalClipId?: string | null;
  stickers?:      PlacedSticker[];
  textOverlays?:  TextOverlay[];
  thumbnailOverlay?: {
    imageUrl: string;
    x:        number; // 0-100 %
    y:        number;
    width:    number;
    height:   number;
    styleId:  string;
    opacity:  number; // 0-100
  } | null;
  previewWidth?:  number;
}

export interface TextOverlay {
  id:       string;
  text:     string;
  x:        number;  // 0–1 relative
  y:        number;  // 0–1 relative
  fontSize: number;
  color:    string;  // hex e.g. "#ffffff"
  bold:     boolean;
  italic:   boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ASPECT_DIMS: Record<string, [number, number]> = {
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
  "1:1":  [1080, 1080],
  "4:3":  [1440, 1080],
};

// ── Animated background gradient definitions ──────────────────────────────
type GradientStop = { color: string; pos: number };
type GradientBlob = { x: number; y: number; rx: number; ry: number; color: string; alpha: number };

const ANIM_GRADIENTS: Record<string, { base: string; blobs: GradientBlob[] }> = {
  "anim-aurora": {
    base: "#0a0a18",
    blobs: [
      { x: 0.2,  y: 0.3,  rx: 0.5, ry: 0.4, color: "#8b5cf6", alpha: 0.65 },
      { x: 0.8,  y: 0.65, rx: 0.45, ry: 0.55, color: "#06b6d4", alpha: 0.60 },
      { x: 0.5,  y: 0.85, rx: 0.55, ry: 0.35, color: "#ec4899", alpha: 0.55 },
    ],
  },
  "anim-mesh": {
    base: "#0f0518",
    blobs: [
      { x: 0.1,  y: 0.2,  rx: 0.5, ry: 0.45, color: "#f97316", alpha: 0.65 },
      { x: 0.9,  y: 0.1,  rx: 0.45, ry: 0.55, color: "#ec4899", alpha: 0.60 },
      { x: 0.8,  y: 0.88, rx: 0.55, ry: 0.45, color: "#8b5cf6", alpha: 0.60 },
      { x: 0.2,  y: 0.75, rx: 0.45, ry: 0.50, color: "#06b6d4", alpha: 0.55 },
    ],
  },
  "anim-conic": {
    base: "#0a0a0a",
    blobs: [
      { x: 0.5,  y: 0.5,  rx: 0.6, ry: 0.6, color: "#f97316", alpha: 0.50 },
      { x: 0.5,  y: 0.5,  rx: 0.4, ry: 0.4, color: "#8b5cf6", alpha: 0.55 },
      { x: 0.25, y: 0.25, rx: 0.4, ry: 0.4, color: "#06b6d4", alpha: 0.50 },
      { x: 0.75, y: 0.75, rx: 0.4, ry: 0.4, color: "#ec4899", alpha: 0.50 },
    ],
  },
  "anim-grain": {
    base: "#1a1a2e",
    blobs: [
      { x: 0.3,  y: 0.4,  rx: 0.55, ry: 0.50, color: "#1e3a5f", alpha: 0.80 },
      { x: 0.7,  y: 0.6,  rx: 0.50, ry: 0.55, color: "#0f3460", alpha: 0.75 },
    ],
  },
  "anim-sunset": {
    base: "#1a0520",
    blobs: [
      { x: 0.15, y: 0.25, rx: 0.50, ry: 0.45, color: "#ff6b6b", alpha: 0.65 },
      { x: 0.85, y: 0.15, rx: 0.45, ry: 0.55, color: "#feca57", alpha: 0.60 },
      { x: 0.75, y: 0.85, rx: 0.55, ry: 0.45, color: "#ff9ff3", alpha: 0.60 },
      { x: 0.25, y: 0.75, rx: 0.45, ry: 0.50, color: "#54a0ff", alpha: 0.55 },
    ],
  },
  "anim-neon": {
    base: "#050510",
    blobs: [
      { x: 0.2,  y: 0.4,  rx: 0.45, ry: 0.50, color: "#00ff88", alpha: 0.55 },
      { x: 0.8,  y: 0.3,  rx: 0.50, ry: 0.45, color: "#00d4ff", alpha: 0.55 },
      { x: 0.5,  y: 0.78, rx: 0.50, ry: 0.45, color: "#ff00ff", alpha: 0.50 },
    ],
  },
};

/** Generate a gradient background PNG for animated fills. Returns the file path. */
async function generateAnimBgImage(fill: string, w: number, h: number, outPath: string): Promise<void> {
  const def = ANIM_GRADIENTS[fill];
  if (!def) throw new Error(`Unknown animated fill: ${fill}`);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");

  // Base color
  ctx.fillStyle = def.base;
  ctx.fillRect(0, 0, w, h);

  // Radial gradient blobs
  for (const blob of def.blobs) {
    const cx = blob.x * w;
    const cy = blob.y * h;
    const rx = blob.rx * Math.max(w, h);
    const ry = blob.ry * Math.max(w, h);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    // Parse hex → rgba
    const r = parseInt(blob.color.slice(1, 3), 16);
    const g = parseInt(blob.color.slice(3, 5), 16);
    const b = parseInt(blob.color.slice(5, 7), 16);
    grad.addColorStop(0,   `rgba(${r},${g},${b},${blob.alpha})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${(blob.alpha * 0.4).toFixed(2)})`);
    grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    // Stretch horizontally by scaling x-axis
    ctx.save();
    ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    ctx.beginPath();
    ctx.arc(cx * Math.max(rx, ry) / rx, cy * Math.max(rx, ry) / ry, Math.max(rx, ry), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Soft blur approximation: draw the blobs at reduced scale, scaled back up
  // (canvas doesn't have blur, but the radial gradients already create soft edges)
  const buf = canvas.toBuffer("image/png");
  await fsp.writeFile(outPath, buf);
}

/** Build an FFmpeg filter_complex string that reframes to target_w × target_h. */
function buildReframeFilter(w: number, h: number, fill: string): string {
  // Animated fills are handled via buildAnimBgFilter (separate image input)
  if (fill === "none") {
    return (
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,` +
      `crop=${w}:${h}[out]`
    );
  }
  // Solid color: named colors ("black", "white") or hex ("#1a3a2a" → "0x1a3a2a")
  if (fill === "black" || fill === "white" || fill.startsWith("#")) {
    const ffColor = fill.startsWith("#") ? fill.replace("#", "0x") : fill;
    return (
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
      `scale=trunc(iw/2)*2:trunc(ih/2)*2,` +
      `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:${ffColor}[out]`
    );
  }
  // blur (default)
  const bw = Math.floor(w / 4);
  const bh = Math.floor(h / 4);
  return (
    `[0:v]split=2[bg][fg];` +
    `[bg]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},gblur=sigma=8,scale=${w}:${h}[blurred];` +
    `[fg]scale=${w}:${h}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[fg_scaled];` +
    `[blurred][fg_scaled]overlay=(W-w)/2:(H-h)/2[out]`
  );
}

/**
 * Build an FFmpeg filter_complex for animated fills that uses a pre-generated
 * gradient image (input index 1) as the background and overlays the scaled
 * video on top.
 *  [0:v] = the source clip   [1:v] = the gradient bg PNG (loop 1)
 */
function buildAnimBgFilter(w: number, h: number): string {
  return (
    `[1:v]scale=${w}:${h}[bgscaled];` +
    `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
    `scale=trunc(iw/2)*2:trunc(ih/2)*2[fg_scaled];` +
    `[bgscaled][fg_scaled]overlay=(W-w)/2:(H-h)/2[out]`
  );
}

/**
 * Build an FFmpeg color-enhancement chain that mirrors the browser preview's
 * CSS `filter: brightness(b%) contrast(c%) saturate(s%)`.
 *
 * • CSS brightness multiplies each RGB channel → colorchannelmixer (exact match)
 * • CSS contrast / saturate pivot the same way as the eq filter
 * Returns "" when all values are at their 100% defaults (no-op).
 */
function buildEnhanceFilter(brightnessPct: number, contrastPct: number, saturationPct: number): string {
  const parts: string[] = [];
  if (Math.round(brightnessPct) !== 100) {
    const b = (brightnessPct / 100).toFixed(4);
    parts.push(`colorchannelmixer=rr=${b}:gg=${b}:bb=${b}`);
  }
  if (Math.round(contrastPct) !== 100 || Math.round(saturationPct) !== 100) {
    const c = (contrastPct / 100).toFixed(4);
    const s = (saturationPct / 100).toFixed(4);
    parts.push(`eq=contrast=${c}:saturation=${s}`);
  }
  return parts.join(",");
}

/** Build a chained atempo filter string (supports speeds outside [0.5, 2.0]). */
function buildAtempo(speed: number): string {
  if (Math.abs(speed - 1.0) <= 0.01) return "anull";
  const stages: string[] = [];
  let s = speed;
  while (s > 2.0) { stages.push("atempo=2.0"); s /= 2.0; }
  while (s < 0.5) { stages.push("atempo=0.5"); s /= 0.5; }
  stages.push(`atempo=${s.toFixed(6)}`);
  return stages.join(",");
}

/** Run an FFmpeg command and reject on non-zero exit. */
function runFFmpeg(args: string[], tag = "ffmpeg", run?: ExportRun): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.debug(`[${tag}] Running: ffmpeg ${args.join(" ")}`);
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    if (run) run.processes.push(p);
    const errLines: string[] = [];
    p.stderr.on("data", (c: Buffer) => errLines.push(c.toString()));
    p.on("close", code => {
      if (run?.aborted) {
        reject(new ExportCancelledError());
        return;
      }
      if (code === 0) {
        resolve();
      } else {
        const msg = `FFmpeg [${tag}] failed (rc=${code}):\n${errLines.slice(-40).join("")}`;
        logger.error(msg);
        reject(new Error(msg));
      }
    });
    p.on("error", reject);
  });
}

/** Stream-download a URL to a local file path using Node.js pipeline (reliable back-pressure). */
async function downloadFile(url: string, dest: string, timeoutMs = 30_000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
    if (!res.body) throw new Error(`No body for URL: ${url}`);
    const fileStream = createWriteStream(dest);
    await pipeline(Readable.fromWeb(res.body as any), fileStream);
    const stat = await fsp.stat(dest);
    if (stat.size === 0) throw new Error(`Downloaded file is empty: ${url}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Detect the real file extension from a URL (ignores query params). */
function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const dot = pathname.lastIndexOf(".");
    if (dot !== -1) {
      const ext = pathname.slice(dot + 1).toLowerCase().split("?")[0]!;
      if (["gif", "webp", "png", "jpg", "jpeg", "apng"].includes(ext)) return ext;
    }
  } catch { /* ignore */ }
  return "png"; // safe default
}

/** Update the Export document in MongoDB. */
async function updateExport(exportId: string, fields: Record<string, unknown>) {
  if (fields.status && fields.status !== "cancelled") {
    const doc = await Export.findById(exportId).lean();
    if (doc?.status === "cancelled") return;
  }
  await Export.findByIdAndUpdate(exportId, { $set: fields });
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runExportPipeline(params: ExportPipelineParams): Promise<void> {
  const {
    exportId, projectId, userId, tracks, volumes, speeds,
    captionStyle, captionFontSize, captionPosY, captionPosX, captionSegments = [],
    aspectRatio, backgroundFill,
    brightness = 100, contrast = 100, saturation = 100, originalClipId,
    stickers = [], textOverlays = [],
    thumbnailOverlay = null,
  } = params;

  const run = registerExport(exportId);
  const deadline = Date.now() + EXPORT_PIPELINE_TIMEOUT_MS;
  const tick = () => {
    if (run.aborted) throw new ExportCancelledError();
    if (Date.now() > deadline) {
      cancelExportPipeline(exportId);
      throw new ExportTimeoutError();
    }
  };
  const ffmpeg = (args: string[], tag: string) => runFFmpeg(args, tag, run);

  const checkStillActive = async () => {
    tick();
    const doc = await Export.findById(exportId).lean();
    if (doc?.status === "cancelled") {
      run.aborted = true;
      cancelExportPipeline(exportId);
      throw new ExportCancelledError("Export cancelled by user");
    }
  };

  const previewWidth = params.previewWidth ?? 380;

  const enhanceFilter = buildEnhanceFilter(brightness, contrast, saturation);

  const [targetW, targetH] = ASPECT_DIMS[aspectRatio] ?? [1080, 1920];
  const tmpDir = join(tmpdir(), `export_${exportId}`);

  const existingDoc = await Export.findById(exportId).lean();
  if (!existingDoc || existingDoc.status === "cancelled") {
    unregisterExport(exportId);
    logger.info(`[export:${exportId}] Skipping pipeline — already cancelled or missing`);
    return;
  }

  try {
    tick();
    await checkStillActive();
    await fsp.mkdir(tmpDir, { recursive: true });
    await updateExport(exportId, { status: "rendering", progress: 5 });

    // ── 1. Collect ordered video items ───────────────────────────────────────
    const videoItems: TrackItem[] = [];
    const audioItems: TrackItem[] = [];
    for (const track of tracks) {
      for (const item of track.items) {
        if (item.type !== "video" && item.type !== "audio") continue;
        if (track.id === "track-audio") audioItems.push(item);
        else if (item.type === "video")  videoItems.push(item);
      }
    }
    videoItems.sort((a, b) => a.startTime - b.startTime);

    if (videoItems.length === 0) throw new Error("No video items on timeline");

    // ── 2. Download source clips (deduplicate by URL) ────────────────────────
    tick();
    await checkStillActive();
    const urlToLocal = new Map<string, string>();
    let dlIdx = 0;
    for (const item of [...videoItems, ...audioItems]) {
      const src = item.src ?? "";
      if (!src || urlToLocal.has(src)) continue;
      const dest = join(tmpDir, `src_${dlIdx++}.mp4`);
      logger.info(`[export:${exportId}] Downloading clip...`, { src: src.slice(-60) });
      await downloadFile(src, dest);
      urlToLocal.set(src, dest);
    }
    await updateExport(exportId, { progress: 30 });

    // ── 3. Cut each segment (reframe + speed) ────────────────────────────────
    tick();
    const segFiles: string[] = [];

    // Pre-generate animated gradient bg image once (reused for all segments)
    const isAnimFill = backgroundFill.startsWith("anim-") && backgroundFill in ANIM_GRADIENTS;
    const bgImagePath = isAnimFill ? join(tmpDir, "bg_gradient.png") : null;
    if (isAnimFill && bgImagePath) {
      logger.info(`[export:${exportId}] Generating animated background image...`);
      await generateAnimBgImage(backgroundFill, targetW, targetH, bgImagePath);
    }

    for (let idx = 0; idx < videoItems.length; idx++) {
      tick();
      const item   = videoItems[idx]!;
      const local  = urlToLocal.get(item.src ?? "");
      if (!local) continue;

      const trimIn   = item.trimIn ?? 0;
      const duration = item.duration;
      const vol      = (volumes[item.id] ?? 100) / 100;
      const spd      = Math.max(0.25, Math.min(4.0, speeds[item.id] ?? 1.0));
      const muted    = item.audioDetached ?? false;
      const segOut   = join(tmpDir, `seg_${idx.toString().padStart(3, "0")}.mp4`);

      // Post-reframe chain: color enhancement + speed
      const postParts: string[] = [];
      if (enhanceFilter) postParts.push(enhanceFilter);
      if (Math.abs(spd - 1.0) > 0.01) postParts.push(`setpts=${(1.0 / spd).toFixed(6)}*PTS`);
      if (postParts.length === 0) postParts.push("null");

      let ffArgs: string[];
      if (isAnimFill && bgImagePath) {
        // Animated fill: use gradient bg PNG as second input
        const animFilterRaw = buildAnimBgFilter(targetW, targetH);
        const animFilter = animFilterRaw.replace("[out]", "[reframed]");
        const videoFilter = `${animFilter};[reframed]${postParts.join(",")}[vout]`;
        if (muted || vol === 0) {
          ffArgs = [
            "-y",
            "-ss", String(trimIn), "-t", String(duration), "-i", local,
            "-loop", "1", "-i", bgImagePath!,
            "-f", "lavfi", "-t", String(duration), "-i", "anullsrc=r=44100:cl=stereo",
            "-filter_complex", videoFilter,
            "-map", "[vout]", "-map", "2:a",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-r", "30", "-ar", "44100",
            "-movflags", "+faststart",
            segOut,
          ];
        } else {
          const atempo      = buildAtempo(spd);
          const audioFilter = `[0:a]volume=${vol.toFixed(3)},${atempo}[aout]`;
          ffArgs = [
            "-y",
            "-ss", String(trimIn), "-t", String(duration), "-i", local,
            "-loop", "1", "-i", bgImagePath!,
            "-filter_complex", `${videoFilter};${audioFilter}`,
            "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-r", "30", "-ar", "44100",
            "-movflags", "+faststart",
            segOut,
          ];
        }
      } else {
        const reframeRaw = buildReframeFilter(targetW, targetH, backgroundFill);
        const reframe    = reframeRaw.replace("[out]", "[reframed]");
        const videoFilter = `${reframe};[reframed]${postParts.join(",")}[vout]`;
        if (muted || vol === 0) {
          // Silent segment: generate silent audio from a lavfi source.
          ffArgs = [
            "-y",
            "-ss", String(trimIn), "-t", String(duration), "-i", local,
            "-f", "lavfi", "-t", String(duration), "-i", "anullsrc=r=44100:cl=stereo",
            "-filter_complex", videoFilter,
            "-map", "[vout]", "-map", "1:a",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-r", "30", "-ar", "44100",
            "-movflags", "+faststart",
            segOut,
          ];
        } else {
          const atempo      = buildAtempo(spd);
          const audioFilter = `[0:a]volume=${vol.toFixed(3)},${atempo}[aout]`;
          ffArgs = [
            "-y",
            "-ss", String(trimIn), "-t", String(duration), "-i", local,
            "-filter_complex", `${videoFilter};${audioFilter}`,
            "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-r", "30", "-ar", "44100",
            "-movflags", "+faststart",
            segOut,
          ];
        }
      }

      await ffmpeg(ffArgs, `seg_${idx}`);
      segFiles.push(segOut);

      const pct = 30 + Math.round(((idx + 1) / videoItems.length) * 30);
      await updateExport(exportId, { progress: pct });
    }

    // ── 4. Concat ────────────────────────────────────────────────────────────
    tick();
    const concatList = join(tmpDir, "concat.txt");
    await fsp.writeFile(concatList, segFiles.map(f => `file '${f}'`).join("\n"));
    const concatOut  = join(tmpDir, "concat.mp4");

    await ffmpeg([
      "-y", "-f", "concat", "-safe", "0", "-i", concatList,
      "-c", "copy", concatOut,
    ], "concat");
    await updateExport(exportId, { progress: 70 });

    // ── 5. Sticker overlay (applied first so captions sit on top) ────────────
    tick();
    let finalOut = concatOut;

    if (stickers.length > 0) {
      logger.info(`[export:${exportId}] Compositing ${stickers.length} sticker(s)...`);

      // Download each sticker and overlay with FFmpeg (preserves animation for GIFs)
      for (let si = 0; si < stickers.length; si++) {
        tick();
        const ps = stickers[si]!;
        const stickerSrc = ps.stickerUrl ?? ps.giphyUrl;
        if (!stickerSrc) continue;

        const ext = extFromUrl(stickerSrc);
        const stickerFile = join(tmpDir, `sticker_${si}.${ext}`);
        try {
          await downloadFile(stickerSrc, stickerFile, 20_000);
        } catch (dlErr: any) {
          logger.warn(`[export:${exportId}] Failed to download sticker ${si} (${dlErr?.message}), skipping`);
          continue;
        }

        const pSize = Math.round(targetW * 0.18 * ps.scale);
        const posX  = Math.round(ps.x * targetW - pSize / 2);
        const posY  = Math.round(ps.y * targetH - pSize / 2);

        const stickerOut = join(tmpDir, `with_sticker_${si}.mp4`);

        // GIF stickers: use -stream_loop + -ignore_loop so animation loops for the full duration.
        // Static images (webp/png/jpg): use -loop 1 (single still frame held for the full clip).
        const isGif = ext === "gif";
        const stickerInputArgs = isGif
          ? ["-ignore_loop", "0", "-stream_loop", "-1", "-i", stickerFile]
          : ["-loop", "1", "-i", stickerFile];

        await ffmpeg([
          "-y",
          "-i", finalOut,
          ...stickerInputArgs,
          "-filter_complex",
          `[1:v]scale=${pSize}:${pSize}:flags=lanczos,format=rgba[stk];[0:v][stk]overlay=${posX}:${posY}:shortest=1[vout]`,
          "-map", "[vout]", "-map", "0:a?",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
          "-c:a", "copy", "-movflags", "+faststart",
          stickerOut,
        ], `sticker-${si}`);

        finalOut = stickerOut;
        // Update progress as each sticker is composited
        const stickerPct = 70 + Math.round(((si + 1) / stickers.length) * 10);
        await updateExport(exportId, { progress: stickerPct });
      }

      logger.info(`[export:${exportId}] Stickers composited`);
    }

    // ── 6. Caption overlay (on top of stickers) ──────────────────────────────
    tick();
    if ((captionStyle && captionStyle !== "none") || captionSegments.length > 0) {
      // Load captions from DB (prefer translated captionWords over original captions)
      const captionMap: Record<string, { word: string; start: number; end: number }[]> = {};
      for (const item of videoItems) {
        const clipDoc = await Clip.findById(item.id).lean();
        if (!clipDoc) continue;
        const words = clipDoc.editSettings?.captionWords ?? clipDoc.captions ?? [];
        if (words.length) captionMap[item.id] = words as any;
      }

      // Build timeline-shifted word list for the full concatenated video
      const allWords: { word: string; start: number; end: number }[] = [];
      const remappedSegments: Array<{
        style: string;
        start: number;
        end: number;
        posX: number;
        posY: number;
        words: { word: string; start: number; end: number }[];
      }> = [];
      let offset = 0;
      for (const item of videoItems) {
        const trimIn    = item.trimIn ?? 0;
        const itemDur   = item.duration;
        const spd       = Math.max(0.25, Math.min(4.0, speeds[item.id] ?? 1.0));
        const outputDur = itemDur / spd;   // actual duration of this segment in the exported video
        const words     = captionMap[item.id] ?? [];
        for (const w of words) {
          // Shift caption times: subtract trimIn, compress by speed factor, add timeline offset
          const adjStart = (w.start - trimIn) / spd + offset;
          const adjEnd   = (w.end   - trimIn) / spd + offset;
          if (adjEnd > offset && adjStart < offset + outputDur) {
            allWords.push({
              word:  w.word,
              start: Math.max(0, adjStart),
              end:   Math.min(adjStart + (w.end - w.start) / spd, offset + outputDur),
            });
          }
        }

        // Per-style caption segments from the editor (usually for the original clip)
        const applySegs = captionSegments.length > 0
          && (item.id === originalClipId || (!originalClipId && videoItems.length === 1));
        if (applySegs) {
          for (const seg of captionSegments) {
            const adjStart = seg.start / spd + offset;
            const adjEnd   = seg.end / spd + offset;
            if (adjEnd <= offset || adjStart >= offset + outputDur) continue;
            const segWords = (seg.words?.length ? seg.words : words)
              .map(w => {
                const ws = (w.start - trimIn) / spd + offset;
                const we = (w.end - trimIn) / spd + offset;
                return {
                  word: w.word,
                  start: Math.max(adjStart, ws),
                  end: Math.min(adjEnd, we),
                };
              })
              .filter(w => w.end > w.start);
            remappedSegments.push({
              style: seg.style,
              start: Math.max(offset, adjStart),
              end: Math.min(offset + outputDur, adjEnd),
              posX: seg.posX ?? 0,
              posY: seg.posY ?? 0,
              words: segWords,
            });
          }
        }

        offset += outputDur;   // accumulate actual output duration (not source duration)
      }

      const totalDuration = offset;
      logger.info(`[export:${exportId}] Caption words: ${allWords.length}, segments: ${remappedSegments.length}, duration: ${totalDuration.toFixed(1)}s`);

      if (allWords.length > 0 || remappedSegments.length > 0) {
        logger.info(`[export:${exportId}] Rendering caption overlay (${remappedSegments.length ? "multi-segment" : captionStyle})...`);

        const overlayPath = join(tmpDir, "captions_overlay.mov");
        await renderCaptionToFile({
          words:        remappedSegments.length
            ? remappedSegments.flatMap(s => s.words)
            : allWords,
          style:        remappedSegments[0]?.style ?? captionStyle,
          width:        targetW,
          height:       targetH,
          durationSecs: totalDuration,
          fontSize:     captionFontSize ?? 50,
          posOffset:    captionPosY ?? 0,
          hOffset:      captionPosX ?? 0,
          segments:     remappedSegments.length ? remappedSegments : undefined,
          outputPath:   overlayPath,
        });

        const captionOut = join(tmpDir, "captioned.mp4");
        await ffmpeg([
          "-y",
          "-i", finalOut,
          "-i", overlayPath,
          "-filter_complex", "[0:v][1:v]overlay=0:0:shortest=1[vout]",
          "-map", "[vout]", "-map", "0:a?",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
          "-c:a", "copy", "-movflags", "+faststart",
          captionOut,
        ], "caption-composite");

        finalOut = captionOut;
        logger.info(`[export:${exportId}] Captions composited`);
      }
    }

    await updateExport(exportId, { progress: 88 });

    // ── 7. Text overlays (rendered via canvas → PNG → FFmpeg overlay) ────────
    tick();
    if (textOverlays.length > 0) {
      logger.info(`[export:${exportId}] Applying ${textOverlays.length} text overlay(s)...`);

      const textPng = await renderTextOverlaysToBuffer(textOverlays, targetW, targetH, previewWidth);
      const textPath = join(tmpDir, "text_overlay.png");
      await fsp.writeFile(textPath, textPng);

      const textOut = join(tmpDir, "with_text.mp4");
      await ffmpeg([
        "-y",
        "-i", finalOut,
        "-loop", "1", "-i", textPath,
        "-filter_complex", "[0:v][1:v]overlay=0:0:shortest=1[vout]",
        "-map", "[vout]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "copy", "-movflags", "+faststart",
        textOut,
      ], "text-overlay");

      finalOut = textOut;
      logger.info(`[export:${exportId}] Text overlays composited`);
    }

    await updateExport(exportId, { progress: 92 });

    // ── 8. Thumbnail overlay ──────────────────────────────────────────────────
    tick();
    if (thumbnailOverlay) {
      logger.info(`[export:${exportId}] Compositing thumbnail overlay (${thumbnailOverlay.styleId})...`);

      const thumbFile = join(tmpDir, "thumbnail.png");
      try {
        await downloadFile(thumbnailOverlay.imageUrl, thumbFile, 20_000);

        // Convert percent positions to pixel coordinates
        const thumbW = Math.max(1, Math.round(thumbnailOverlay.width  / 100 * targetW));
        const thumbH = Math.max(1, Math.round(thumbnailOverlay.height / 100 * targetH));
        const thumbX = Math.round(thumbnailOverlay.x / 100 * targetW);
        const thumbY = Math.round(thumbnailOverlay.y / 100 * targetH);

        // Border radius for circle/rounded shapes (applied via vignette crop)
        const opacity   = Math.min(1, Math.max(0, (thumbnailOverlay.opacity ?? 100) / 100));

        // Scale thumbnail, apply opacity, overlay onto video
        const thumbOut = join(tmpDir, "with_thumbnail.mp4");
        await ffmpeg([
          "-y",
          "-i", finalOut,
          "-loop", "1", "-i", thumbFile,
          "-filter_complex",
          `[1:v]scale=${thumbW}:${thumbH}:flags=lanczos,format=rgba,colorchannelmixer=aa=${opacity.toFixed(3)}[thumb];[0:v][thumb]overlay=${thumbX}:${thumbY}:shortest=1[vout]`,
          "-map", "[vout]", "-map", "0:a?",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
          "-c:a", "copy", "-movflags", "+faststart",
          thumbOut,
        ], "thumbnail-overlay");

        finalOut = thumbOut;
        logger.info(`[export:${exportId}] Thumbnail composited`);
      } catch (thumbErr: any) {
        logger.warn(`[export:${exportId}] Thumbnail overlay failed (skipping): ${thumbErr?.message}`);
      }
    }

    // ── 9. Upload to S3 ──────────────────────────────────────────────────────
    tick();
    logger.info(`[export:${exportId}] Uploading to S3...`);
    const s3Key  = `exports/${exportId}/final.mp4`;
    const fileBuf = await fsp.readFile(finalOut);

    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         s3Key,
      Body:        fileBuf,
      ContentType: "video/mp4",
    }));

    const s3Url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;

    // ── 7. Optionally save as a new Clip doc ─────────────────────────────────
    if (originalClipId) {
      const origDoc = await Clip.findById(originalClipId).lean();
      if (origDoc) {
        const now = new Date();
        await Clip.create({
          _id:            randomUUID(),
          projectId:      origDoc.projectId ?? projectId,
          jobId:          origDoc.jobId ?? "",
          userId,
          index:          origDoc.index ?? 0,
          s3Key,
          s3Url,
          score:          origDoc.score ?? 0,
          duration:       origDoc.duration ?? 0,
          reason:         origDoc.reason ?? "",
          startTime:      origDoc.startTime ?? 0,
          endTime:        origDoc.endTime ?? 0,
          captions:       origDoc.captions ?? [],
          captionLang:    origDoc.captionLang ?? "",
          originalClipId,
          createdAt:      now,
          updatedAt:      now,
        });
        logger.info(`[export:${exportId}] Saved exported clip with originalClipId=${originalClipId}`);
      }
    }

    await updateExport(exportId, { status: "done", progress: 100, s3Key, s3Url });
    logger.info(`[export:${exportId}] Done → ${s3Url}`);

  } catch (err: any) {
    if (err instanceof ExportCancelledError) {
      logger.info(`[export:${exportId}] Cancelled`, { error: err.message });
      await updateExport(exportId, { status: "cancelled", error: err.message });
      return;
    }
    if (err instanceof ExportTimeoutError) {
      logger.error(`[export:${exportId}] Timed out`, {
        timeoutMs: EXPORT_PIPELINE_TIMEOUT_MS,
        error: err.message,
      });
      await updateExport(exportId, { status: "failed", error: err.message });
      throw err;
    }
    logger.error(`[export:${exportId}] Pipeline failed`, { error: err?.message ?? err });
    await updateExport(exportId, { status: "failed", error: err?.message ?? String(err) });
    throw err;
  } finally {
    unregisterExport(exportId);
    // Clean up temp directory
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
