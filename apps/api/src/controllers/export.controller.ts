import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { Export } from "../model/export.model.js";
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

const CreateExportSchema = z.object({
  projectId:      z.string(),
  tracks:         z.array(TrackSchema),
  volumes:        z.record(z.string(), z.number()).default({}),
  speeds:         z.record(z.string(), z.number()).default({}),
  captionStyle:   z.string().default("none"),
  captionMap:     z.record(z.string(), z.array(CaptionWordSchema)).default({}),
  aspectRatio:    z.string().default("9:16"),
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

    const { projectId, tracks, volumes, speeds, captionStyle, captionMap, aspectRatio, originalClipId } = parsed.data;
    const exportId = randomUUID();

    await Export.create({
      _id:          exportId,
      userId,
      projectId,
      status:       "pending",
      progress:     0,
      captionStyle,
      aspectRatio,
    });

    const workerUrl = process.env.WORKER_URL;
    if (!workerUrl) throw new Error("WORKER_URL env variable is not set");

    const secret = process.env.INTERNAL_API_SECRET ?? "";

    try {
      const workerRes = await fetch(`${workerUrl}/internal/export`, {
        method:  "POST",
        headers: {
          "Content-Type":      "application/json",
          "X-Internal-Secret": secret,
        },
        body: JSON.stringify({
          exportId,
          projectId,
          userId,
          tracks,
          volumes,
          speeds,
          captionStyle,
          captionMap,
          aspectRatio,
          originalClipId: originalClipId ?? null,
        }),
        signal: AbortSignal.timeout(10_000), // 10s to get the 202 ack
      });

      if (!workerRes.ok) {
        const text = await workerRes.text().catch(() => "");
        throw new Error(`Worker rejected export: ${workerRes.status} ${text}`);
      }
    } catch (workerErr: any) {
      logger.error("Export worker request failed", {
        exportId,
        projectId,
        userId,
        workerUrl,
        error: workerErr?.message ?? String(workerErr),
      });
      // Worker unreachable or rejected — mark export failed immediately
      await Export.findByIdAndUpdate(exportId, { status: "failed", error: workerErr.message });
      throw workerErr;
    }

    logger.info("Export accepted by worker", {
      exportId,
      projectId,
      userId,
      aspectRatio,
      captionStyle,
      trackCount: tracks.length,
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
