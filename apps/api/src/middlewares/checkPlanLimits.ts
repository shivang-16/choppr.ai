import { Request, Response, NextFunction } from "express";
import { UserCredits } from "../model/user-credits.model.js";
import { Plan } from "../model/plan.model.js";
import { logger } from "../utils/logger.js";

/**
 * Enforces plan-level video length limit.
 * Requires `durationSecs` in the body — jobs without a known duration are rejected.
 */
export async function checkVideoLengthLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const durationSecs = Number(req.body?.durationSecs);
    if (!Number.isFinite(durationSecs) || durationSecs <= 0) {
      res.status(400).json({
        error: "duration_required",
        message: "Unable to get the video duration. Please try again.",
      });
      return;
    }

    const userId = (req as any).user?._id ?? (req as any).auth?.userId;
    if (!userId) return next();

    const userCredits = await UserCredits.findById(userId).lean();
    const planSlug    = userCredits?.plan ?? "free";
    const plan        = await Plan.findOne({ slug: planSlug }).lean();

    if (plan?.maxVideoLengthMins != null && durationSecs > plan.maxVideoLengthMins * 60) {
      logger.warn("Video length limit exceeded", {
        userId,
        planSlug,
        durationSecs,
        maxVideoLengthMins: plan.maxVideoLengthMins,
      });
      res.status(403).json({
        error: "video_too_long",
        message: `Your ${plan.name} plan allows videos up to ${plan.maxVideoLengthMins} minutes. Upgrade to process longer videos.`,
        maxVideoLengthMins: plan.maxVideoLengthMins,
        planSlug,
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
