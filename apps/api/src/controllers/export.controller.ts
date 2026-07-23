import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { Export } from "../model/export.model.js";
import { runExportPipeline, cancelExportPipeline, isExportPipelineActive } from "../services/export-pipeline.service.js";
import { checkBalance, deductExportCredits, computeExportCost, CREDITS_PER_EXPORT_BASE } from "../services/credits.service.js";
import { UserCredits } from "../model/user-credits.model.js";
import { logger } from "../utils/logger.js";

/** Free plan cannot export longer than this (seconds). */
export const FREE_EXPORT_MAX_SECS = 5 * 60;

const SPEED_MIN = 0.25;
const SPEED_MAX = 4.0;

/**
 * Actual rendered export length (matches export pipeline: outputDur = duration / speed).
 * Clip page sends one video item with duration=(trimEnd-trimStart) and speeds[id]=playback rate.
 */
function getExportDurationSecs(
  tracks: { items: { id: string; type: string; duration: number }[] }[],
  speeds: Record<string, number> = {},
): number {
  let total = 0;
  for (const track of tracks) {
    for (const item of track.items) {
      if (item.type !== "video") continue;
      if (!Number.isFinite(item.duration) || item.duration <= 0) continue;
      const spd = Math.max(SPEED_MIN, Math.min(SPEED_MAX, speeds[item.id] ?? 1.0));
      total += item.duration / spd;
    }
  }
  return total;
}

const TrackItemSchema = z.object({
  id:             z.string(),
  type:           z.enum(["video", "audio", "text"]),
  startTime:      z.number(),
  duration:       z.number(),
  sourceDuration: z.number(),
  trimIn:         z.number(),
  trimOut:        z.number(),
  /** DB clip id — backend resolves src/captions from Clip collection */
  clipId:         z.string().optional(),
  src:            z.string().optional(),
  audioDetached:  z.boolean().optional(),
  linkedAudioId:  z.string().optional(),
});

const TrackSchema = z.object({
  id:    z.string(),
  items: z.array(TrackItemSchema),
});

const CaptionWordSchema = z.object({
  word:  z.string(),
  start: z.number(),
  end:   z.number(),
});

const StickerSchema = z.object({
  stickerId:  z.string(),
  stickerUrl: z.string().url().optional(),
  giphyUrl:   z.string().url().optional(),
  previewUrl: z.string().url().optional(),
  x:          z.number().min(0).max(1),
  y:          z.number().min(0).max(1),
  scale:      z.number().min(0.1).max(5),
});

const TextOverlaySchema = z.object({
  id:        z.string(),
  text:      z.string(),
  x:         z.number().min(0).max(1),
  y:         z.number().min(0).max(1),
  fontSize:  z.number().min(8).max(300),
  color:     z.string(),
  bold:      z.boolean().default(false),
  italic:    z.boolean().default(false),
  startTime: z.number().min(0).optional(),
  duration:  z.number().min(0.1).optional(),
});

const CreateExportSchema = z.object({
  projectId:      z.string(),
  tracks:         z.array(TrackSchema),
  volumes:        z.record(z.string(), z.number()).default({}),
  speeds:         z.record(z.string(), z.number()).default({}),
  captionStyle:   z.string().default("none"),
  captionFontSize: z.number().min(8).max(200).default(50),
  captionPosY:    z.number().min(-100).max(100).default(0),
  captionPosX:    z.number().min(-100).max(100).default(0),
  captionMap:     z.record(z.string(), z.array(CaptionWordSchema)).default({}),
  captionSegments: z.array(z.object({
    style: z.string(),
    start: z.number(),
    end:   z.number(),
    posX:  z.number().min(-100).max(100).default(0),
    posY:  z.number().min(-100).max(100).default(0),
    words: z.array(CaptionWordSchema).default([]),
  })).default([]),
  aspectRatio:    z.string().default("9:16"),
  backgroundFill: z.string().default("blur"),
  brightness:     z.number().min(0).max(400).default(100),
  contrast:       z.number().min(0).max(400).default(100),
  saturation:     z.number().min(0).max(400).default(100),
  originalClipId: z.string().optional(),
  stickers:       z.array(StickerSchema).default([]),
  textOverlays:   z.array(TextOverlaySchema).default([]),
  thumbnailOverlay: z.object({
    imageUrl: z.string().url(),
    x:        z.number().min(0).max(100),
    y:        z.number().min(0).max(100),
    width:    z.number().min(1).max(100),
    height:   z.number().min(1).max(100),
    styleId:  z.string(),
    opacity:  z.number().min(0).max(100).default(100),
  }).nullable().optional(),
  previewWidth:   z.number().min(50).max(3000).default(380),
});

// ── POST /api/exports ───────────────────────────────────────────────────────

export async function createExport(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CreateExportSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn("Create export validation failed", {
        issues: parsed.error.issues,
      });
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const userId = (req as any).user?._id ?? (req as any).auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Compute the credit cost for this specific export based on features used
    const creditCost = computeExportCost({
      captionStyle: req.body.captionStyle ?? "none",
      stickers:     req.body.stickers    ?? [],
      tracks:       req.body.tracks      ?? [],
    });

    // Gate: user must have enough credits for the export
    const { ok, balance } = await checkBalance(userId);
    if (!ok || balance < creditCost) {
      logger.warn("Export rejected: insufficient credits", { userId, balance, required: creditCost });
      res.status(402).json({
        error: "insufficient_credits",
        message: `You need at least ${creditCost} credit(s) to export. Your balance: ${balance}.`,
        balance,
        required: creditCost,
      });
      return;
    }

    const { projectId, tracks, volumes, speeds, captionStyle, captionFontSize, captionPosY, captionPosX, captionMap, captionSegments, aspectRatio, backgroundFill, brightness, contrast, saturation, originalClipId, stickers, textOverlays, thumbnailOverlay, previewWidth } = parsed.data;

    // Gate: free plan cannot export clips longer than 5 minutes (after speed)
    const exportDurationSecs = getExportDurationSecs(tracks, speeds);
    const userCredits = await UserCredits.findById(userId).lean();
    const planSlug = userCredits?.plan ?? "free";
    if (planSlug === "free" && exportDurationSecs > FREE_EXPORT_MAX_SECS) {
      logger.warn("Export rejected: free plan duration limit", {
        userId, planSlug, exportDurationSecs, maxSecs: FREE_EXPORT_MAX_SECS,
      });
      res.status(403).json({
        error: "export_duration_limit",
        message: "Upgrade to export clips greater than 5 min",
        maxSecs: FREE_EXPORT_MAX_SECS,
        durationSecs: exportDurationSecs,
        upgradeUrl: "/dashboard/billing",
      });
      return;
    }

    const exportId = randomUUID();

    await Export.create({
      _id:            exportId,
      userId,
      projectId,
      status:         "pending",
      progress:       0,
      creditCost,
      captionStyle,
      captionFontSize,
      captionPosY,
      aspectRatio,
      backgroundFill,
      brightness,
      contrast,
      saturation,
      tracks,
      volumes,
      speeds,
      captionMap,
      stickers,
      textOverlays,
      thumbnailOverlay: thumbnailOverlay ?? null,
      previewWidth,
      ...(originalClipId ? { originalClipId } : {}),
    } as any);

    // [LOG_REDUCED]
    // logger.info("Export pipeline starting", {
    //   exportId, projectId, userId, aspectRatio, backgroundFill, captionStyle,
    //   trackCount: tracks.length, creditCost,
    // });

    // Fire-and-forget: run the pipeline in the background, return immediately
    runExportPipeline({
      exportId, projectId, userId, tracks, volumes, speeds,
      captionStyle, captionFontSize, captionPosY, captionPosX, captionMap, captionSegments,
      aspectRatio, backgroundFill,
      brightness, contrast, saturation,
      originalClipId: originalClipId ?? null,
      stickers,
      textOverlays,
      thumbnailOverlay: thumbnailOverlay ?? null,
      previewWidth,
    }).then(async () => {
      // Deduct credits only when the export actually completed (cancel returns without throwing)
      const doc = await Export.findById(exportId).lean();
      if (!doc || doc.status !== "done") {
        logger.info("Skipping credit deduction — export did not finish successfully", {
          exportId, userId, status: doc?.status ?? "missing",
        });
        return;
      }
      try {
        const { deducted, balanceAfter } = await deductExportCredits(userId, exportId, creditCost);
        logger.info("Export credits deducted", { exportId, userId, deducted, balanceAfter, creditCost });
      } catch (creditErr: any) {
        logger.error("Failed to deduct export credits (export still succeeded)", {
          exportId, userId, error: creditErr?.message,
        });
      }
    }).catch((err) => {
      logger.error("Export pipeline crashed", {
        exportId, error: err?.message ?? String(err),
      });
    });

    res.status(201).json({ exportId, status: "pending", creditCost });
  } catch (err) {
    logger.error("Create export failed", { error: err });
    next(err);
  }
}

// ── GET /api/exports/:exportId ──────────────────────────────────────────────

export async function getExport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId   = (req as any).user?._id ?? (req as any).auth?.userId;
    const exportDoc = await Export.findById(req.params.exportId).lean();

    if (!exportDoc) {
      res.status(404).json({ error: "Export not found" });
      return;
    }
    if (exportDoc.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.json(exportDoc);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/exports/:exportId/cancel ──────────────────────────────────────

export async function cancelExport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id ?? (req as any).auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const exportId = String(req.params.exportId ?? "");
    if (!exportId) {
      res.status(400).json({ error: "Export id required" });
      return;
    }
    const exportDoc = await Export.findById(exportId);
    if (!exportDoc) {
      res.status(404).json({ error: "Export not found" });
      return;
    }
    if (exportDoc.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (exportDoc.status === "done") {
      res.status(409).json({ error: "Export already completed" });
      return;
    }
    if (exportDoc.status === "cancelled") {
      res.json({ exportId, status: "cancelled" });
      return;
    }
    if (exportDoc.status === "failed") {
      res.json({ exportId, status: "failed", error: exportDoc.error });
      return;
    }

    const killed = cancelExportPipeline(exportId);
    exportDoc.status = "cancelled";
    exportDoc.error = "Cancelled by user";
    await exportDoc.save();

    logger.info("Export cancelled by user", {
      exportId,
      userId,
      pipelineActive: killed || isExportPipelineActive(exportId),
    });

    res.json({ exportId, status: "cancelled" });
  } catch (err) {
    logger.error("Cancel export failed", { error: err });
    next(err);
  }
}
