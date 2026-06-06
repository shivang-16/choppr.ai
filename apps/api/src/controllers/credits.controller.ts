import { Request, Response, NextFunction } from "express";
import {
  getBalance,
  deductJobCredits,
  refundFailedJob,
  grantTopupCredits,
} from "../services/credits.service.js";

// ── GET /api/credits ─────────────────────────────────────────────────────────
// Returns current balance + ledger history for the authenticated user

export async function getCredits(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?._id;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const data = await getBalance(userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/credits/deduct-job ─────────────────────────────────────────────
// Called internally by the Python worker after a job finishes successfully.
// Secured by INTERNAL_API_SECRET header so it's never called by the browser.

export async function deductJob(req: Request, res: Response, next: NextFunction) {
  try {
    const secret = req.headers["x-internal-secret"];
    if (secret !== process.env.INTERNAL_API_SECRET) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { userId, jobId, durationSecs } = req.body as {
      userId: string;
      jobId: string;
      durationSecs: number;
    };

    if (!userId || !jobId || typeof durationSecs !== "number") {
      res.status(400).json({ error: "userId, jobId, durationSecs required" });
      return;
    }

    const result = await deductJobCredits(userId, jobId, durationSecs);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/credits/refund-job ─────────────────────────────────────────────
// Called internally by the Python worker when a job fails.

export async function refundJob(req: Request, res: Response, next: NextFunction) {
  try {
    const secret = req.headers["x-internal-secret"];
    if (secret !== process.env.INTERNAL_API_SECRET) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { userId, jobId } = req.body as { userId: string; jobId: string };
    if (!userId || !jobId) {
      res.status(400).json({ error: "userId and jobId required" });
      return;
    }

    await refundFailedJob(userId, jobId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/credits/topup ──────────────────────────────────────────────────
// Will be called by the Stripe payment webhook after a successful top-up purchase.
// For now it's protected by the internal secret — payment integration hooks in here.

export async function topupCredits(req: Request, res: Response, next: NextFunction) {
  try {
    const secret = req.headers["x-internal-secret"];
    if (secret !== process.env.INTERNAL_API_SECRET) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { userId, amount, note } = req.body as {
      userId: string;
      amount: number;
      note?: string;
    };

    if (!userId || typeof amount !== "number" || amount <= 0) {
      res.status(400).json({ error: "userId and positive amount required" });
      return;
    }

    await grantTopupCredits(userId, amount, note);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
