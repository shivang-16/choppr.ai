import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { Job } from "../model/job.model.js";
import { Project } from "../model/project.model.js";
import { enqueueJob } from "../services/sqs.js";
import { checkBalance, MIN_CREDITS_TO_START } from "../services/credits.service.js";
import { logger } from "../utils/logger.js";

function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    const path = u.pathname.split("/").filter(Boolean).pop() ?? "";
    return path ? `${host} — ${decodeURIComponent(path).slice(0, 60)}` : host;
  } catch {
    return url.slice(0, 60);
  }
}

function thumbnailFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube watch URLs: ?v=ID
    const ytId = u.searchParams.get("v");
    if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    // youtu.be/ID short links
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "").split("?")[0];
      if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
    // YouTube shorts
    if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/shorts/")[1]?.split("/")[0];
      if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Validation schemas ──────────────────────────────────────────────────────

const BACKGROUND_FILLS = ["blur", "black", "white", "none"] as const;

const CreateJobSchema = z.object({
  url:            z.string().url("Must be a valid URL").optional(),
  s3Key:          z.string().optional(),
  query:          z.string().max(500).default(""),
  clipModel:      z.string().default("Auto"),
  genre:          z.string().default("Auto"),
  clipLength:     z.string().default("Auto (0m-3m)"),
  aspectRatio:    z.string().default("9:16"),
  backgroundFill: z.enum(BACKGROUND_FILLS).default("blur"),
  maxClips:       z.number().int().min(1).max(20).default(10),
  durationSecs:   z.number().min(0).optional(),
}).refine(data => data.url || data.s3Key, {
  message: "Either url or s3Key is required",
});

// ── POST /api/jobs ──────────────────────────────────────────────────────────

export async function createJob(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CreateJobSchema.safeParse(req.body);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      logger.warn("Create job validation failed", {
        issues,
        body: req.body,
      });
      res.status(400).json({ error: issues[0]?.message ?? "Invalid input" });
      return;
    }

    const { url, s3Key, query, clipModel, genre, clipLength, aspectRatio, backgroundFill, maxClips } = parsed.data;
    const userId = (req as any).user?._id ?? (req as any).auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Gate: user must have at least MIN_CREDITS_TO_START credits
    const { ok, balance } = await checkBalance(userId);
    if (!ok) {
      logger.warn("Job rejected: insufficient credits", {
        userId,
        balance,
        minRequired: MIN_CREDITS_TO_START,
      });
      res.status(402).json({
        error: "insufficient_credits",
        message: `You need at least ${MIN_CREDITS_TO_START} credits to start a job. Your balance: ${balance}.`,
        balance,
      });
      return;
    }

    const jobId     = randomUUID();
    const projectId = randomUUID();
    const sourceUrl = url ?? `s3://${s3Key}`;

    // 1. Create project + job atomically (both reference each other)
    await Promise.all([
      Project.create({
        _id:            projectId,
        userId,
        title:          url ? titleFromUrl(url) : (s3Key?.split("/").pop() ?? "Uploaded video"),
        sourceUrl,
        ...(url && thumbnailFromUrl(url) ? { thumbnailUrl: thumbnailFromUrl(url)! } : {}),
        status:         "pending",
        aspectRatio,
        backgroundFill,
        jobId,
        totalClips:     0,
      }),
      Job.create({
        _id:         jobId,
        userId,
        url:         sourceUrl,
        query,
        status:      "pending",
        progress:    0,
        projectId,
      }),
    ]);

  // 2. Push to SQS with all clip settings
    await enqueueJob({ jobId, userId, url: url ?? "", s3Key: s3Key ?? "", query, projectId, clipModel, genre, clipLength, aspectRatio, backgroundFill, maxClips });

    logger.info("Job created and enqueued", {
      jobId,
      projectId,
      userId,
      source: s3Key ? "upload" : "url",
      url: url ?? null,
      s3Key: s3Key ?? null,
      clipModel,
      genre,
      clipLength,
      aspectRatio,
      backgroundFill,
      maxClips,
    });

    res.status(201).json({ jobId, projectId, status: "pending" });
  } catch (err) {
    logger.error("Create job failed", { error: err });
    next(err);
  }
}

// ── GET /api/jobs/:jobId ────────────────────────────────────────────────────

export async function getJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?._id ?? (req as any).auth?.userId;

    const job = await Job.findById(jobId).lean();
    if (!job) {
      logger.warn("Job not found", { jobId, userId });
      res.status(404).json({ error: "Job not found" });
      return;
    }
    // Only the owner can see their job
    if (job.userId !== userId) {
      logger.warn("Job access denied", { jobId, userId, ownerId: job.userId });
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.json(job);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/jobs ── list all jobs for the authenticated user ───────────────

export async function listJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id ?? (req as any).auth?.userId;

    const jobs = await Job.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(jobs);
  } catch (err) {
    next(err);
  }
}
