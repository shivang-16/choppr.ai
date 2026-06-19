import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { Export } from "../model/export.model.js";
import { runExportPipeline } from "../services/export-pipeline.service.js";
import { logger } from "../utils/logger.js";

const TrackItemSchema = z.object({
  id:             z.string(),
  type:           z.enum(["video", "audio", "text"]),
  startTime:      z.number(),
  duration:       z.number(),
  sourceDuration: z.number(),
  trimIn:         z.number(),
  trimOut:        z.number(),
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

const BACKGROUND_FILLS = ["blur", "black", "white", "none"] as const;

const CreateExportSchema = z.object({
  projectId:      z.string(),
  tracks:         z.array(TrackSchema),
  volumes:        z.record(z.string(), z.number()).default({}),
  speeds:         z.record(z.string(), z.number()).default({}),
  captionStyle:   z.string().default("none"),
  captionFontSize: z.number().min(8).max(200).default(28),
  captionMap:     z.record(z.string(), z.array(CaptionWordSchema)).default({}),
  aspectRatio:    z.string().default("9:16"),
  backgroundFill: z.enum(BACKGROUND_FILLS).default("blur"),
  brightness:     z.number().min(0).max(400).default(100),
  contrast:       z.number().min(0).max(400).default(100),
  saturation:     z.number().min(0).max(400).default(100),
  originalClipId: z.string().optional(),
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

    const { projectId, tracks, volumes, speeds, captionStyle, captionFontSize, captionMap, aspectRatio, backgroundFill, brightness, contrast, saturation, originalClipId } = parsed.data;
    const exportId = randomUUID();

    await Export.create({
      _id:            exportId,
      userId,
      projectId,
      status:         "pending",
      progress:       0,
      captionStyle,
      aspectRatio,
      backgroundFill,
    });

    logger.info("Export pipeline starting", {
      exportId, projectId, userId, aspectRatio, backgroundFill, captionStyle,
      trackCount: tracks.length,
    });

    // Fire-and-forget: run the pipeline in the background, return immediately
    runExportPipeline({
      exportId, projectId, userId, tracks, volumes, speeds,
      captionStyle, captionFontSize, captionMap, aspectRatio, backgroundFill,
      brightness, contrast, saturation,
      originalClipId: originalClipId ?? null,
    }).catch((err) => {
      logger.error("Export pipeline crashed", {
        exportId, error: err?.message ?? String(err),
      });
    });

    res.status(201).json({ exportId, status: "pending" });
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
