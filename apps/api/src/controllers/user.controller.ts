import { Request, Response, NextFunction } from "express";
import User, { PopupKey } from "../model/user.model.js";
import { UserCredits } from "../model/user-credits.model.js";

/** Wait this long after "Ask me later" before showing again */
const DISCOUNT_RESHOW_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
/** Stop nudging after this many "Ask me later" clicks */
const DISCOUNT_MAX_LATER = 3;

const VALID_POPUPS: PopupKey[] = ["discount"];

function shouldShowDiscount(
  state: { completed?: boolean; seeCount?: number; lastSeenAt?: Date } | undefined | null,
  plan: string
): boolean {
  // Paid users don't need the discount promo
  if (plan !== "free") return false;
  // Old users (no popups field yet) or never interacted → show
  if (!state) return true;
  if (state.completed) return false;
  if ((state.seeCount ?? 0) >= DISCOUNT_MAX_LATER) return false;
  if (!state.lastSeenAt) return true;
  return Date.now() - new Date(state.lastSeenAt).getTime() >= DISCOUNT_RESHOW_MS;
}

// ── GET /api/users/me/popups ─────────────────────────────────────────────────
// Returns which popups the client should display right now

export async function getMyPopups(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [user, credits] = await Promise.all([
      User.findById(userId).select("popups").lean(),
      UserCredits.findById(userId).select("plan").lean(),
    ]);

    const plan = credits?.plan ?? "free";
    const discountState = user?.popups?.discount;

    res.json({
      discount: {
        show: shouldShowDiscount(discountState, plan),
        completed: discountState?.completed ?? false,
        seeCount: discountState?.seeCount ?? 0,
        lastSeenAt: discountState?.lastSeenAt ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/users/me/popups/:key ──────────────────────────────────────────
// Body: { action: "complete" | "later" }
//   complete → user claimed / dismissed permanently
//   later    → increment seeCount, set lastSeenAt; show again after delay

export async function updatePopup(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const key = req.params.key as PopupKey;
    if (!VALID_POPUPS.includes(key)) {
      res.status(400).json({ error: `Unknown popup: ${key}` });
      return;
    }

    const action = (req.body as { action?: string })?.action;
    if (action !== "complete" && action !== "later") {
      res.status(400).json({ error: 'action must be "complete" or "later"' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (!user.popups) user.popups = {};
    if (!user.popups[key]) {
      user.popups[key] = { completed: false, seeCount: 0 };
    }

    const state = user.popups[key]!;
    const now = new Date();

    if (action === "complete") {
      state.completed = true;
      state.lastSeenAt = now;
    } else {
      state.seeCount = (state.seeCount ?? 0) + 1;
      state.lastSeenAt = now;
    }

    user.markModified("popups");
    await user.save();

    res.json({
      [key]: {
        completed: state.completed,
        seeCount: state.seeCount,
        lastSeenAt: state.lastSeenAt,
      },
    });
  } catch (err) {
    next(err);
  }
}
