import mongoose from "mongoose";
import { UserCredits, IUserCredits } from "../model/user-credits.model.js";
import { CreditLedger, LedgerType, CreditBucket } from "../model/credit-ledger.model.js";
import { Plan } from "../model/plan.model.js";

// Cost per minute of source video for AI clipping — matches plan.creditCostPerMin
export const CREDITS_PER_MINUTE = 2;

// Flat cost per video export
export const CREDITS_PER_EXPORT = 2;

// User must have at least this many credits to start a job (1 min worth)
export const MIN_CREDITS_TO_START = CREDITS_PER_MINUTE;

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
 * Called by the Stripe webhook after invoice.paid.
 */
export async function grantSubscriptionCredits(
  userId: string,
  planId: PlanName
): Promise<void> {
  const plan   = await getPlanOrThrow(planId);
  const amount = plan.credits;
  const now    = new Date();
  const end    = cycleEnd(now);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // RESET the subscription bucket to the plan's credit amount (never accumulate).
      // We read the old subscriptionCredits first so we can compute the correct totalCredits delta.
      const existing = await UserCredits.findById(userId).session(session).lean() as IUserCredits | null;
      const oldSubCredits = existing?.subscriptionCredits ?? 0;
      // Delta to totalCredits = new allocation - old allocation (topupCredits stays untouched)
      const delta = amount - oldSubCredits;

      const doc = await UserCredits.findOneAndUpdate(
        { _id: userId },
        {
          $set: {
            plan:                planId,
            cycleStart:          now,
            cycleEnd:            end,
            subscriptionCredits: amount,                 // RESET, not accumulate
          },
          $inc: {
            totalCredits:   delta,                       // adjust by delta only
            lifetimeEarned: amount,
          },
        },
        { returnDocument: "after", upsert: true, session }
      ) as IUserCredits;

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
 * Flat cost: CREDITS_PER_EXPORT (default 1).
 * Drains subscriptionCredits first, then topupCredits.
 */
export async function deductExportCredits(
  userId: string,
  exportId: string
): Promise<{ deducted: number; balanceAfter: number }> {
  const totalCost = CREDITS_PER_EXPORT;

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
