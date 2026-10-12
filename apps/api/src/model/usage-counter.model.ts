import mongoose, { Schema } from "mongoose";

/** Lifetime totals. Cleanup never decrements these. */
export interface IUsageCounter {
  _id: string;
  projects: number;
  clips: number;
  seeded: boolean;
  lastCleanupAt?: Date;
  updatedAt: Date;
}

const UsageCounterSchema = new Schema<IUsageCounter>(
  {
    _id: { type: String, required: true },
    projects: { type: Number, default: 0 },
    clips: { type: Number, default: 0 },
    seeded: { type: Boolean, default: false },
    lastCleanupAt: { type: Date },
  },
  { timestamps: true, collection: "usagecounters", _id: false },
);

export const UsageCounter = mongoose.model<IUsageCounter>("UsageCounter", UsageCounterSchema);

const LIFETIME_ID = "lifetime";

export async function incProjects(n = 1) {
  if (n <= 0) return;
  await UsageCounter.updateOne({ _id: LIFETIME_ID }, { $inc: { projects: n } }, { upsert: true });
}

export async function incClips(n = 1) {
  if (n <= 0) return;
  await UsageCounter.updateOne({ _id: LIFETIME_ID }, { $inc: { clips: n } }, { upsert: true });
}
