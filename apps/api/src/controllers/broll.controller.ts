import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { Clip } from "../model/clip.model.js";
import { BrollJob } from "../model/broll-job.model.js";
import { UserCredits } from "../model/user-credits.model.js";
import { planBrollWindows } from "../services/broll-planner.service.js";
import { runBrollGenerateJob } from "../services/broll-generate.service.js";
import { checkBalance, deductBrollCredits, CREDITS_PER_BROLL_CANVAS } from "../services/credits.service.js";
import { logger } from "../utils/logger.js";

export const FREE_BROLL_MAX_MOMENTS = 4;
export const FREE_BROLL_MAX_GENERATES = 2;

async function ensureBrollGenerateCount(userId: string): Promise<number> {
  const userCredits = await UserCredits.findById(userId);
  if (!userCredits) {
    return BrollJob.countDocuments({ userId });
  }
  if (typeof userCredits.brollGenerateCount === "number" && userCredits.brollGenerateCount > 0) {
    return userCredits.brollGenerateCount;
  }
  const counted = await BrollJob.countDocuments({ userId });
  if (counted > (userCredits.brollGenerateCount ?? 0)) {
    userCredits.brollGenerateCount = counted;
    await userCredits.save();
  }
  return userCredits.brollGenerateCount ?? counted;
}

async function brollUsage(userId: string) {
  const userCredits = await UserCredits.findById(userId).lean();
  const plan = userCredits?.plan ?? "free";
  const generatesUsed = await ensureBrollGenerateCount(userId);
  return {
    plan,
    isFree: plan === "free",
    generatesUsed,
    maxMoments: plan === "free" ? FREE_BROLL_MAX_MOMENTS : 8,
    maxGenerates: plan === "free" ? FREE_BROLL_MAX_GENERATES : null,
  };
}

const SuggestSchema = z.object({
  aspectRatio: z.string().optional(),
  start: z.number().min(0).optional(),
  end: z.number().min(0).optional(),
  phrase: z.string().max(500).optional(),
});

const GenerateSchema = z.object({
  aspectRatio: z.string().default("9:16"),
  windows: z.array(z.object({
    start: z.number().min(0),
    end: z.number().min(0),
    phrase: z.string().max(500).default(""),
    prompt: z.string().max(1200).default(""),
  })).min(1).max(8),
});

export async function suggestBroll(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id ?? (req as any).auth?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parsed = SuggestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const clip = await Clip.findById(req.params.clipId).lean();
    if (!clip) { res.status(404).json({ error: "Not found" }); return; }
    if (clip.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    const words = clip.editSettings?.captionWords ?? clip.captions ?? [];
    const duration = clip.duration || Math.max(0, (clip.endTime ?? 0) - (clip.startTime ?? 0));
    const range =
      parsed.data.start != null && parsed.data.end != null
        ? {
            start: parsed.data.start,
            end: parsed.data.end,
            ...(parsed.data.phrase ? { phrase: parsed.data.phrase } : {}),
          }
        : undefined;

    const windows = await planBrollWindows({
      words,
      duration,
      ...(clip.reason ? { reason: clip.reason } : {}),
      ...(range ? { range } : {}),
    });

    const usage = await brollUsage(userId);
    res.json({
      windows,
      plan: usage.plan,
      limits: {
        maxMoments: usage.maxMoments,
        maxGenerates: usage.maxGenerates,
        generatesUsed: usage.generatesUsed,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function generateBroll(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id ?? (req as any).auth?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parsed = GenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const clip = await Clip.findById(req.params.clipId).lean();
    if (!clip) { res.status(404).json({ error: "Not found" }); return; }
    if (clip.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    const usage = await brollUsage(userId);
    if (usage.isFree) {
      if (usage.generatesUsed >= FREE_BROLL_MAX_GENERATES) {
        res.status(403).json({
          error: "broll_generate_limit",
          message: `Free plan allows ${FREE_BROLL_MAX_GENERATES} B-roll generations. Upgrade for more.`,
          generatesUsed: usage.generatesUsed,
          maxGenerates: FREE_BROLL_MAX_GENERATES,
          maxMoments: FREE_BROLL_MAX_MOMENTS,
          upgradeUrl: "/dashboard/billing",
        });
        return;
      }
      if (parsed.data.windows.length > FREE_BROLL_MAX_MOMENTS) {
        res.status(403).json({
          error: "broll_moment_limit",
          message: `Free plan can generate up to ${FREE_BROLL_MAX_MOMENTS} moments at a time. Upgrade for more.`,
          maxMoments: FREE_BROLL_MAX_MOMENTS,
          selected: parsed.data.windows.length,
          upgradeUrl: "/dashboard/billing",
        });
        return;
      }
    }

    const creditCost = parsed.data.windows.length * CREDITS_PER_BROLL_CANVAS;
    const { balance } = await checkBalance(userId);
    if (balance < creditCost) {
      res.status(402).json({
        error: "insufficient_credits",
        message: `You need ${creditCost} credit(s) to generate these B-roll shots. Your balance: ${balance}.`,
        required: creditCost,
        balance,
      });
      return;
    }

    const jobId = randomUUID();
    await BrollJob.create({
      _id: jobId,
      clipId: clip._id,
      userId,
      aspectRatio: parsed.data.aspectRatio,
      status: "pending",
      creditCost,
      shots: parsed.data.windows.map(w => ({
        id: randomUUID(),
        start: w.start,
        duration: Math.max(0.8, w.end - w.start),
        phrase: w.phrase,
        prompt: w.prompt || `Cinematic photoreal B-roll illustrating: ${w.phrase}`,
        status: "pending",
      })),
    });

    try {
      await deductBrollCredits(userId, jobId, creditCost);
    } catch (creditErr) {
      logger.error("B-roll credit deduction failed", { jobId, userId, error: (creditErr as Error).message });
      await BrollJob.findByIdAndDelete(jobId);
      res.status(402).json({ error: "insufficient_credits", message: "Could not deduct credits" });
      return;
    }

    await UserCredits.updateOne({ _id: userId }, { $inc: { brollGenerateCount: 1 } });

    void runBrollGenerateJob(jobId).catch(err => {
      logger.error("B-roll generate job crashed", { jobId, error: (err as Error).message });
    });

    res.status(201).json({ jobId, status: "pending", creditCost });
  } catch (err) {
    next(err);
  }
}

export async function getClipBroll(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id ?? (req as any).auth?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const clip = await Clip.findById(req.params.clipId).lean();
    if (!clip) { res.status(404).json({ error: "Not found" }); return; }
    if (clip.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    const jobs = await BrollJob.find({ clipId: clip._id, userId }).sort({ createdAt: 1 }).lean();
    const usage = await brollUsage(userId);
    const shots = [];
    for (const job of jobs) {
      for (const s of job.shots ?? []) {
        if (s.status !== "ready" || !s.s3Url) continue;
        shots.push({
          id: s.id,
          startTime: s.start,
          duration: s.duration,
          src: s.s3Url,
          mediaType: "image" as const,
          mode: "cutaway" as const,
          trimIn: 0,
          phrase: s.phrase,
          prompt: s.prompt,
          source: "canvas" as const,
          status: "ready" as const,
        });
      }
    }

    res.json({
      shots,
      plan: usage.plan,
      limits: {
        maxMoments: usage.maxMoments,
        maxGenerates: usage.maxGenerates,
        generatesUsed: usage.generatesUsed,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getBrollJob(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id ?? (req as any).auth?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const job = await BrollJob.findById(req.params.jobId).lean();
    if (!job) { res.status(404).json({ error: "Not found" }); return; }
    if (job.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    res.json(job);
  } catch (err) {
    next(err);
  }
}
