import { Request, Response, NextFunction } from "express";
import { Plan } from "../model/plan.model.js";
import { UserCredits } from "../model/user-credits.model.js";

// GET /api/plans  — public, no auth needed
export async function listPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const plans = await Plan.find({ active: true }).sort({ order: 1 }).lean();
    res.json(plans);
  } catch (err) {
    next(err);
  }
}

// GET /api/plans/me  — returns active plans + which one the user is currently on
export async function myPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?._id;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [plans, credits] = await Promise.all([
      Plan.find({ active: true }).sort({ order: 1 }).lean(),
      UserCredits.findById(userId).lean(),
    ]);

    res.json({
      plans,
      currentPlanId: credits?.plan ?? "free",
      balance: credits?.totalCredits ?? 0,
      cycleEnd: credits?.cycleEnd ?? null,
    });
  } catch (err) {
    next(err);
  }
}
