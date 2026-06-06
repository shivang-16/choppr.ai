import mongoose, { Document, Schema } from "mongoose";

/**
 * Materialized credit balance per user.
 * Single document per user — always the source of truth for the current balance.
 * Updated atomically via $inc to prevent race conditions.
 *
 * Two buckets:
 *   subscriptionCredits — reset monthly when plan renews
 *   topupCredits        — never expire, consumed after subscription bucket is empty
 */
export interface IUserCredits extends Document {
  _id: string;                    // Clerk userId
  subscriptionCredits: number;    // from active plan, resets on renewal
  topupCredits: number;           // purchased top-ups, never expire
  totalCredits: number;           // subscriptionCredits + topupCredits (denormalized for fast reads)
  plan: "free" | "starter" | "pro" | "business";
  cycleStart: Date;               // when current subscription cycle started
  cycleEnd: Date;                 // when current cycle ends (reset happens here)
  lifetimeEarned: number;         // total credits ever granted (for analytics)
  lifetimeSpent: number;          // total credits ever spent
  createdAt: Date;
  updatedAt: Date;
}

const userCreditsSchema = new Schema<IUserCredits>(
  {
    _id: { type: String, required: true },   // Clerk userId
    subscriptionCredits: { type: Number, default: 0, min: 0 },
    topupCredits:        { type: Number, default: 0, min: 0 },
    totalCredits:        { type: Number, default: 0, min: 0 },
    plan: {
      type: String,
      enum: ["free", "starter", "pro", "business"],
      default: "free",
    },
    cycleStart: { type: Date, required: true },
    cycleEnd:   { type: Date, required: true },
    lifetimeEarned: { type: Number, default: 0 },
    lifetimeSpent:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Fast lookup by plan (e.g. bulk reset all free users at cycle end)
userCreditsSchema.index({ plan: 1 });
userCreditsSchema.index({ cycleEnd: 1 });

export const UserCredits =
  (mongoose.models.UserCredits as mongoose.Model<IUserCredits>) ||
  mongoose.model<IUserCredits>("UserCredits", userCreditsSchema);
