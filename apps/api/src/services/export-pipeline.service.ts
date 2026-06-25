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

import { spawn }             from "child_process";
import { createWriteStream, promises as fsp } from "fs";
import { pipeline }          from "stream/promises";
import { Readable }          from "stream";
import { tmpdir }            from "os";
import { join }              from "path";
import { randomUUID }        from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Export }            from "../model/export.model.js";
import { Clip }              from "../model/clip.model.js";
import { renderCaptionToFile } from "./caption-overlay.service.js";
import { renderStickersToBuffer, type PlacedSticker } from "./sticker-renderer.js";
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
  captionMap:     Record<string, { word: string; start: number; end: number }[]>;
  aspectRatio:    string;
  backgroundFill: string;
  brightness?:    number;
  contrast?:      number;
  saturation?:    number;
  originalClipId?: string | null;
  stickers?:      PlacedSticker[];
  textOverlays?:  TextOverlay[];
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

/** Build an FFmpeg filter_complex string that reframes to target_w × target_h. */
function buildReframeFilter(w: number, h: number, fill: string): string {
  if (fill === "none") {
    return (
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,` +
      `crop=${w}:${h}[out]`
    );
  }
  if (fill === "black" || fill === "white") {
    return (
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
      `scale=trunc(iw/2)*2:trunc(ih/2)*2,` +
      `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:${fill}[out]`
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
function runFFmpeg(args: string[], tag = "ffmpeg"): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.debug(`[${tag}] Running: ffmpeg ${args.join(" ")}`);
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    const errLines: string[] = [];
    p.stderr.on("data", (c: Buffer) => errLines.push(c.toString()));
    p.on("close", code => {
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
async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  if (!res.body) throw new Error(`No body for URL: ${url}`);
  const fileStream = createWriteStream(dest);
  await pipeline(Readable.fromWeb(res.body as any), fileStream);
  const stat = await fsp.stat(dest);
  if (stat.size === 0) throw new Error(`Downloaded file is empty: ${url}`);
}

/** Update the Export document in MongoDB. */
async function updateExport(exportId: string, fields: Record<string, unknown>) {
  await Export.findByIdAndUpdate(exportId, { $set: fields });
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runExportPipeline(params: ExportPipelineParams): Promise<void> {
  const {
    exportId, projectId, userId, tracks, volumes, speeds,
    captionStyle, captionFontSize, captionPosY, aspectRatio, backgroundFill,
    brightness = 100, contrast = 100, saturation = 100, originalClipId,
    stickers = [], textOverlays = [],
  } = params;

  const previewWidth = params.previewWidth ?? 380;

  const enhanceFilter = buildEnhanceFilter(brightness, contrast, saturation);

  const [targetW, targetH] = ASPECT_DIMS[aspectRatio] ?? [1080, 1920];
  const tmpDir = join(tmpdir(), `export_${exportId}`);

  try {
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
    const segFiles: string[] = [];
    for (let idx = 0; idx < videoItems.length; idx++) {
      const item   = videoItems[idx]!;
      const local  = urlToLocal.get(item.src ?? "");
      if (!local) continue;

      const trimIn   = item.trimIn ?? 0;
      const duration = item.duration;
      const vol      = (volumes[item.id] ?? 100) / 100;
      const spd      = Math.max(0.25, Math.min(4.0, speeds[item.id] ?? 1.0));
      const muted    = item.audioDetached ?? false;
      const segOut   = join(tmpDir, `seg_${idx.toString().padStart(3, "0")}.mp4`);

      const reframeRaw = buildReframeFilter(targetW, targetH, backgroundFill);
      const reframe    = reframeRaw.replace("[out]", "[reframed]");

      // Post-reframe chain: color enhancement (brightness/contrast/saturation)
      // then speed (setpts). Ordered to match the browser preview.
      const postParts: string[] = [];
      if (enhanceFilter) postParts.push(enhanceFilter);
      if (Math.abs(spd - 1.0) > 0.01) postParts.push(`setpts=${(1.0 / spd).toFixed(6)}*PTS`);
      if (postParts.length === 0) postParts.push("null");
      const videoFilter = `${reframe};[reframed]${postParts.join(",")}[vout]`;

      let ffArgs: string[];
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

      await runFFmpeg(ffArgs, `seg_${idx}`);
      segFiles.push(segOut);

      const pct = 30 + Math.round(((idx + 1) / videoItems.length) * 30);
      await updateExport(exportId, { progress: pct });
    }

    // ── 4. Concat ────────────────────────────────────────────────────────────
    const concatList = join(tmpDir, "concat.txt");
    await fsp.writeFile(concatList, segFiles.map(f => `file '${f}'`).join("\n"));
    const concatOut  = join(tmpDir, "concat.mp4");

    await runFFmpeg([
      "-y", "-f", "concat", "-safe", "0", "-i", concatList,
      "-c", "copy", concatOut,
    ], "concat");
    await updateExport(exportId, { progress: 70 });

    // ── 5. Sticker overlay (applied first so captions sit on top) ────────────
    let finalOut = concatOut;

    if (stickers.length > 0) {
      logger.info(`[export:${exportId}] Compositing ${stickers.length} sticker(s)...`);

      const stickerPng  = renderStickersToBuffer(stickers, targetW, targetH);
      const stickerPath = join(tmpDir, "stickers.png");
      await fsp.writeFile(stickerPath, stickerPng);

      const stickerOut = join(tmpDir, "with_stickers.mp4");
      await runFFmpeg([
        "-y",
        "-i", concatOut,
        "-loop", "1", "-i", stickerPath,
        "-filter_complex", "[0:v][1:v]overlay=0:0:shortest=1[vout]",
        "-map", "[vout]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "copy", "-movflags", "+faststart",
        stickerOut,
      ], "sticker-composite");

      finalOut = stickerOut;
      logger.info(`[export:${exportId}] Stickers composited`);
    }

    // ── 6. Caption overlay (on top of stickers) ──────────────────────────────
    if (captionStyle && captionStyle !== "none") {
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
      let offset = 0;
      for (const item of videoItems) {
        const trimIn   = item.trimIn ?? 0;
        const itemDur  = item.duration;
        const words    = captionMap[item.id] ?? [];
        for (const w of words) {
          const adjStart = w.start - trimIn + offset;
          const adjEnd   = w.end   - trimIn + offset;
          if (adjEnd > offset && adjStart < offset + itemDur) {
            allWords.push({
              word:  w.word,
              start: Math.max(0, adjStart),
              end:   Math.min(adjStart + (w.end - w.start), offset + itemDur),
            });
          }
        }
        offset += itemDur;
      }

      const totalDuration = offset;
      logger.info(`[export:${exportId}] Caption words: ${allWords.length}, duration: ${totalDuration.toFixed(1)}s`);

      if (allWords.length > 0) {
        logger.info(`[export:${exportId}] Rendering caption overlay (${captionStyle})...`);

        const overlayPath = join(tmpDir, "captions_overlay.mov");
        await renderCaptionToFile({
          words:        allWords,
          style:        captionStyle,
          width:        targetW,
          height:       targetH,
          durationSecs: totalDuration,
          fontSize:     captionFontSize ?? 50,
          posOffset:    captionPosY ?? 0,
          outputPath:   overlayPath,
        });

        const captionOut = join(tmpDir, "captioned.mp4");
        await runFFmpeg([
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
    if (textOverlays.length > 0) {
      logger.info(`[export:${exportId}] Applying ${textOverlays.length} text overlay(s)...`);

      const textPng = await renderTextOverlaysToBuffer(textOverlays, targetW, targetH, previewWidth);
      const textPath = join(tmpDir, "text_overlay.png");
      await fsp.writeFile(textPath, textPng);

      const textOut = join(tmpDir, "with_text.mp4");
      await runFFmpeg([
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

    // ── 7. Upload to S3 ──────────────────────────────────────────────────────
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
    logger.error(`[export:${exportId}] Pipeline failed`, { error: err?.message ?? err });
    await updateExport(exportId, { status: "failed", error: err?.message ?? String(err) });
    throw err;
  } finally {
    // Clean up temp directory
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
