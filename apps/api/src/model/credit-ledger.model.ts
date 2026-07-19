import mongoose, { Document, Schema } from "mongoose";

/**
 * Append-only audit log — every credit change is a row here, never edited or deleted.
 * This is the ground truth for billing disputes, refunds, and analytics.
 *
 * Positive amount = credit granted  (grant, topup, refund)
 * Negative amount = credit spent    (job_cost)
 */

export type LedgerType =
  | "grant_free_signup"    // free plan credits on new account creation
  | "grant_subscription"   // monthly subscription credit reset
  | "grant_topup"          // one-time credit purchase
  | "grant_admin"          // manual grant by admin
  | "job_cost"             // deducted when a job completes (negative)
  | "export_cost"          // deducted when a video export completes (negative)
  | "refund_job_failed";   // refund when a job fails (positive)

export type CreditBucket = "subscription" | "topup";

export interface ICreditLedger extends Document {
  userId: string;           // Clerk userId
  amount: number;           // positive = earned, negative = spent
  bucket: CreditBucket;     // which bucket was affected
  type: LedgerType;
  balanceAfter: number;     // totalCredits snapshot after this transaction
  jobId?: string;           // set for job_cost / refund_job_failed
  jobDurationMins?: number; // source video duration in minutes (for job rows)
  note?: string;            // human-readable description
  /** Unique claim key for webhook/period dedup (sparse — only set on marker rows). */
  idempotencyKey?: string;
  createdAt: Date;
}

const creditLedgerSchema = new Schema<ICreditLedger>(
  {
    userId:          { type: String, required: true, index: true },
    amount:          { type: Number, required: true },
    bucket:          { type: String, enum: ["subscription", "topup"], required: true },
    type:            {
      type: String,
      enum: [
        "grant_free_signup",
        "grant_subscription",
        "grant_topup",
        "grant_admin",
        "job_cost",
        "export_cost",
        "refund_job_failed",
      ],
      required: true,
    },
    balanceAfter:    { type: Number, required: true },
    jobId:           { type: String, index: true },
    jobDurationMins: { type: Number },
    note:            { type: String },
    idempotencyKey:  { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // ledger rows are immutable
  }
);

// Common query patterns
creditLedgerSchema.index({ userId: 1, createdAt: -1 });  // user history feed
creditLedgerSchema.index({ type: 1, createdAt: -1 });     // admin analytics
// Atomic webhook/period claims — prevents double grants under concurrent delivery
creditLedgerSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true }
);

export const CreditLedger =
  (mongoose.models.CreditLedger as mongoose.Model<ICreditLedger>) ||
  mongoose.model<ICreditLedger>("CreditLedger", creditLedgerSchema);
