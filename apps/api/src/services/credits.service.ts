import mongoose from "mongoose";
import { UserCredits, IUserCredits } from "../model/user-credits.model.js";
import { CreditLedger, LedgerType, CreditBucket } from "../model/credit-ledger.model.js";
import { Plan } from "../model/plan.model.js";

// Cost per minute of source video for AI clipping — matches plan.creditCostPerMin
export const CREDITS_PER_MINUTE = 2;

// Base cost per video export (feature add-ons are computed via computeExportCost)
export const CREDITS_PER_EXPORT      = 2;
export const CREDITS_PER_EXPORT_BASE = 2;
export const CREDITS_PER_EXPORT_MAX  = 6;

// User must have at least this many credits to start a job (1 min worth)
export const MIN_CREDITS_TO_START = CREDITS_PER_MINUTE;

// ── Export cost calculation ───────────────────────────────────────────────────

export interface ExportCostPayload {
  captionStyle: string;
  stickers: { stickerId: string }[];
  tracks: { items: { type: string }[] }[];
}

/**
 * Compute the credit cost for an export.
 *
 * Base: 2 credits
 * +1 if captions are enabled (captionStyle !== "none")
 * +1 if stickers are placed
 * +1 if more than 1 video item exists across all tracks (multi-clip)
 * Maximum: 6 credits
 */
export function computeExportCost(p: ExportCostPayload): number {
  let cost = CREDITS_PER_EXPORT_BASE;
  if (p.captionStyle && p.captionStyle !== "none") cost += 1;
  if (p.stickers.length > 0) cost += 1;
  const videoItems = p.tracks.flatMap(t => t.items.filter(i => i.type === "video"));
  if (videoItems.length > 1) cost += 1;
  return Math.min(cost, CREDITS_PER_EXPORT_MAX);
}

export type PlanName = "free" | "core" | "growth" | "scale";

// ── Internal helpers ─────────────────────────────────────────────────────────

function cycleEnd(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

async function getPlanOrThrow(slug: string) {
  const plan = await Plan.findOne({ slug }).lean();
  if (!plan) throw new Error(`Plan not found in DB: "${slug}". Run npm run seed:plans.`);
  return plan;
}

async function writeLedger(
  session: mongoose.ClientSession,
  userId: string,
  amount: number,
  bucket: CreditBucket,
  type: LedgerType,
  balanceAfter: number,
  extras: { jobId?: string; jobDurationMins?: number; note?: string } = {}
) {
  await CreditLedger.create(
    [{ userId, amount, bucket, type, balanceAfter, ...extras }],
    { session }
  );
}

// ── Core operations ──────────────────────────────────────────────────────────

/**
 * Grant free signup credits to a brand-new user.
 * Credit amount comes from the "free" Plan document in MongoDB.
 * Idempotent — safe to re-call; setOnInsert means it only writes on true insert.
 */
export async function grantSignupCredits(userId: string): Promise<void> {
  const freePlan = await getPlanOrThrow("free");
  const amount   = freePlan.credits;
  const now      = new Date();
  const end      = cycleEnd(now);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const result = await UserCredits.updateOne(
        { _id: userId },
        {
          $setOnInsert: {
            _id:                 userId,
            subscriptionCredits: amount,
            topupCredits:        0,
            totalCredits:        amount,
            plan:                "free",
            cycleStart:          now,
            cycleEnd:            end,
            lifetimeEarned:      amount,
            lifetimeSpent:       0,
          },
        },
        { upsert: true, session }
      );

      if (result.upsertedCount === 1) {
        await writeLedger(session, userId, amount, "subscription", "grant_free_signup", amount, {
          note: `${freePlan.name} plan signup — ${amount} credits`,
        });
      }
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Grant (or reset) monthly subscription credits after a payment.
 * Credit amount comes from the Plan document in MongoDB.
 *
 * mode "add"   — used for subscription.active (new subscription).
 *                Adds plan credits on top of whatever the user currently has,
 *                so free signup credits (150) are preserved.
 *                e.g. free user (150) subscribes to Core (500) → total 650.
 *
 * mode "reset" — used for subscription.renewed / plan_changed.
 *                Resets the subscription bucket to exactly the plan amount so
 *                credits never accumulate across billing cycles.
 *                e.g. 300 remaining → renewal → subscription bucket back to 500.
 */
export async function grantSubscriptionCredits(
  userId: string,
  planId: PlanName,
  mode: "add" | "reset" = "reset"
): Promise<void> {
  const plan   = await getPlanOrThrow(planId);
  const amount = plan.credits;
  const now    = new Date();
  const end    = cycleEnd(now);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      let doc: IUserCredits;

      if (mode === "add") {
        // ADD plan credits on top — preserves existing subscription and topup credits.
        doc = await UserCredits.findOneAndUpdate(
          { _id: userId },
          {
            $set: {
              plan:       planId,
              cycleStart: now,
              cycleEnd:   end,
            },
            $inc: {
              subscriptionCredits: amount,
              totalCredits:        amount,
              lifetimeEarned:      amount,
            },
          },
          { returnDocument: "after", upsert: true, session }
        ) as IUserCredits;
      } else {
        // RESET the subscription bucket to the plan amount — never accumulate across cycles.
        const existing = await UserCredits.findById(userId).session(session).lean() as IUserCredits | null;
        const oldSubCredits = existing?.subscriptionCredits ?? 0;
        const delta = amount - oldSubCredits; // topupCredits stays untouched

        doc = await UserCredits.findOneAndUpdate(
          { _id: userId },
          {
            $set: {
              plan:                planId,
              cycleStart:          now,
              cycleEnd:            end,
              subscriptionCredits: amount,
            },
            $inc: {
              totalCredits:   delta,
              lifetimeEarned: amount,
            },
          },
          { returnDocument: "after", upsert: true, session }
        ) as IUserCredits;
      }

      await writeLedger(session, userId, amount, "subscription", "grant_subscription", doc.totalCredits, {
        note: `${plan.name} plan renewal — ${amount} credits`,
      });
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Add one-time top-up credits after a purchase.
 */
export async function grantTopupCredits(
  userId: string,
  amount: number,
  note?: string
): Promise<void> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const doc = await UserCredits.findOneAndUpdate(
        { _id: userId },
        {
          $inc: {
            topupCredits:   amount,
            totalCredits:   amount,
            lifetimeEarned: amount,
          },
        },
        { returnDocument: "after", session }
      ) as IUserCredits;

      if (!doc) throw new Error(`UserCredits not found for user ${userId}`);

      await writeLedger(session, userId, amount, "topup", "grant_topup", doc.totalCredits, {
        note: note ?? `Top-up — ${amount} credits`,
      });
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Check whether a user has enough credits to start a job.
 */
export async function checkBalance(
  userId: string
): Promise<{ ok: boolean; balance: number }> {
  const doc     = await UserCredits.findById(userId).lean();
  const balance = doc?.totalCredits ?? 0;
  return { ok: balance >= MIN_CREDITS_TO_START, balance };
}

/**
 * Atomically deduct credits after a job completes successfully.
 * Reads creditCostPerMin from the user's current Plan document.
 * Drains subscriptionCredits first, then topupCredits.
 */
export async function deductJobCredits(
  userId: string,
  jobId: string,
  durationSecs: number
): Promise<{ deducted: number; balanceAfter: number }> {
  const durationMins = Math.max(1, Math.ceil(durationSecs / 60));

  // Look up the user's current plan to get cost per minute
  const userCredits = await UserCredits.findById(userId).lean();
  const planId      = userCredits?.plan ?? "free";
  const plan        = await Plan.findOne({ slug: planId }).lean();
  const costPerMin  = plan?.creditCostPerMin ?? CREDITS_PER_MINUTE;
  const totalCost   = durationMins * costPerMin;

  const session = await mongoose.startSession();
  try {
    let deducted     = 0;
    let balanceAfter = 0;

    await session.withTransaction(async () => {
      const doc = await UserCredits.findById(userId).session(session);
      if (!doc) throw new Error(`UserCredits not found for user ${userId}`);

      const fromSub   = Math.min(doc.subscriptionCredits, totalCost);
      const remaining = totalCost - fromSub;
      const fromTopup = Math.min(doc.topupCredits, remaining);
      deducted        = fromSub + fromTopup;

      await UserCredits.updateOne(
        { _id: userId },
        {
          $inc: {
            subscriptionCredits: -fromSub,
            topupCredits:        -fromTopup,
            totalCredits:        -deducted,
            lifetimeSpent:       deducted,
          },
        },
        { session }
      );

      balanceAfter = doc.totalCredits - deducted;

      if (fromSub > 0) {
        await writeLedger(
          session, userId, -fromSub, "subscription", "job_cost",
          balanceAfter + fromTopup,
          { jobId, jobDurationMins: durationMins, note: `Job ${jobId} — ${durationMins} min × ${costPerMin} credits` }
        );
      }
      if (fromTopup > 0) {
        await writeLedger(
          session, userId, -fromTopup, "topup", "job_cost",
          balanceAfter,
          { jobId, jobDurationMins: durationMins, note: `Job ${jobId} — topup bucket` }
        );
      }
    });

    return { deducted, balanceAfter };
  } finally {
    await session.endSession();
  }
}

/**
 * Atomically deduct credits for a video export.
 * Cost is determined by computeExportCost() (base 2 + feature add-ons, max 6).
 * Drains subscriptionCredits first, then topupCredits.
 */
export async function deductExportCredits(
  userId: string,
  exportId: string,
  cost = CREDITS_PER_EXPORT_BASE,
): Promise<{ deducted: number; balanceAfter: number }> {
  const totalCost = cost;

  const session = await mongoose.startSession();
  try {
    let deducted     = 0;
    let balanceAfter = 0;

    await session.withTransaction(async () => {
      const doc = await UserCredits.findById(userId).session(session);
      if (!doc) throw new Error(`UserCredits not found for user ${userId}`);

      const fromSub   = Math.min(doc.subscriptionCredits, totalCost);
      const remaining = totalCost - fromSub;
      const fromTopup = Math.min(doc.topupCredits, remaining);
      deducted        = fromSub + fromTopup;

      await UserCredits.updateOne(
        { _id: userId },
        {
          $inc: {
            subscriptionCredits: -fromSub,
            topupCredits:        -fromTopup,
            totalCredits:        -deducted,
            lifetimeSpent:       deducted,
          },
        },
        { session }
      );

      balanceAfter = doc.totalCredits - deducted;

      if (fromSub > 0) {
        await writeLedger(
          session, userId, -fromSub, "subscription", "export_cost",
          balanceAfter + fromTopup,
          { jobId: exportId, note: `Export ${exportId} — ${fromSub} credit(s)` }
        );
      }
      if (fromTopup > 0) {
        await writeLedger(
          session, userId, -fromTopup, "topup", "export_cost",
          balanceAfter,
          { jobId: exportId, note: `Export ${exportId} — topup bucket` }
        );
      }
    });

    return { deducted, balanceAfter };
  } finally {
    await session.endSession();
  }
}

/**
 * Refund credits when a job fails.
 * Looks up the original deduction rows in the ledger for this job.
 */
export async function refundFailedJob(
  userId: string,
  jobId: string
): Promise<void> {
  const rows = await CreditLedger.find({ userId, jobId, type: "job_cost" }).lean();
  if (rows.length === 0) return;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const row of rows) {
        const refundAmount = Math.abs(row.amount);

        await UserCredits.updateOne(
          { _id: userId },
          {
            $inc: {
              [`${row.bucket}Credits`]: refundAmount,
              totalCredits:             refundAmount,
              lifetimeSpent:           -refundAmount,
            },
          },
          { session }
        );

        const doc = await UserCredits.findById(userId).session(session).lean() as IUserCredits;

        await writeLedger(
          session, userId, refundAmount, row.bucket, "refund_job_failed",
          doc.totalCredits,
          { jobId, note: `Refund for failed job ${jobId}` }
        );
      }
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Fetch credit balance + recent ledger history for the frontend.
 */
export async function getBalance(userId: string) {
  const [credits, history] = await Promise.all([
    UserCredits.findById(userId).lean(),
    CreditLedger.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  return {
    balance:             credits?.totalCredits ?? 0,
    subscriptionCredits: credits?.subscriptionCredits ?? 0,
    topupCredits:        credits?.topupCredits ?? 0,
    plan:                credits?.plan ?? "free",
    cycleEnd:            credits?.cycleEnd ?? null,
    history,
  };
}
