import { Request, Response, NextFunction } from "express";
import { UserCredits } from "../model/user-credits.model.js";
import { Plan } from "../model/plan.model.js";

/**
 * Enforces plan-level video length limit.
 * Reads `durationSecs` from the request body (optional, client-supplied).
 * If the client doesn't send it we skip the check here — the worker will
 * enforce it once the actual duration is known.
 */
export async function checkVideoLengthLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const durationSecs = Number(req.body?.durationSecs);
    if (!durationSecs || durationSecs <= 0) return next();

    const userId = (req as any).user?._id ?? (req as any).auth?.userId;
    if (!userId) return next();

    const userCredits = await UserCredits.findById(userId).lean();
    const planSlug    = userCredits?.plan ?? "free";
    const plan        = await Plan.findOne({ slug: planSlug }).lean();

    if (plan?.maxVideoLengthMins != null && durationSecs > plan.maxVideoLengthMins * 60) {
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
