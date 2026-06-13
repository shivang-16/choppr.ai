import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Export } from "../model/export.model.js";

const sqs = new SQSClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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

    const queueUrl = process.env.SQS_QUEUE_URL;
    if (!queueUrl) throw new Error("SQS_QUEUE_URL not set");

    await sqs.send(new SendMessageCommand({
      QueueUrl:    queueUrl,
      MessageBody: JSON.stringify({
        type:           "export",
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
    }));

    res.status(201).json({ exportId, status: "pending" });
  } catch (err) {
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
