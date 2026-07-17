import mongoose, { Schema } from "mongoose";

/** Read-only models for Choppr collections — metrics app only. */

const UserSchema = new Schema(
  {
    _id: String,
    firstName: String,
    lastName: String,
    username: String,
    email: String,
    avatarUrl: String,
    subscriptionStatus: String,
    isOnboarded: Boolean,
    ssoProvider: String,
  },
  { timestamps: true, collection: "users" }
);

const ProjectSchema = new Schema(
  {
    _id: String,
    userId: String,
    title: String,
    status: String,
    totalClips: Number,
    videoDuration: Number,
    aspectRatio: String,
    error: String,
  },
  { timestamps: true, collection: "projects", _id: false }
);

const ClipSchema = new Schema(
  {
    _id: String,
    userId: String,
    projectId: String,
  },
  { timestamps: true, collection: "clips", _id: false }
);

const ExportSchema = new Schema(
  {
    _id: String,
    userId: String,
    projectId: String,
    status: String,
  },
  { timestamps: true, collection: "exports", _id: false }
);

const UserCreditsSchema = new Schema(
  {
    _id: String,
    plan: String,
    subscriptionCredits: Number,
    topupCredits: Number,
    totalCredits: Number,
    lifetimeEarned: Number,
    lifetimeSpent: Number,
    cycleStart: Date,
    cycleEnd: Date,
  },
  { timestamps: true, collection: "usercredits" }
);

const CreditLedgerSchema = new Schema(
  {
    userId: String,
    amount: Number,
    type: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "creditledgers" }
);

function model<T>(name: string, schema: Schema) {
  return (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);
}

export const User = model("User", UserSchema);
export const Project = model("Project", ProjectSchema);
export const Clip = model("Clip", ClipSchema);
export const Export = model("Export", ExportSchema);
export const UserCredits = model("UserCredits", UserCreditsSchema);
export const CreditLedger = model("CreditLedger", CreditLedgerSchema);
