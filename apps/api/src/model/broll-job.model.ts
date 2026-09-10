import mongoose, { Schema } from "mongoose";

export type BrollJobStatus = "pending" | "generating" | "done" | "failed";
export type BrollShotStatus = "pending" | "ready" | "failed";

export interface IBrollShot {
  id: string;
  start: number;
  duration: number;
  phrase: string;
  prompt: string;
  status: BrollShotStatus;
  s3Key?: string;
  s3Url?: string;
  error?: string;
}

export interface IBrollJob {
  _id: string;
  clipId: string;
  userId: string;
  aspectRatio: string;
  status: BrollJobStatus;
  creditCost: number;
  shots: IBrollShot[];
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BrollShotSchema = new Schema<IBrollShot>(
  {
    id: { type: String, required: true },
    start: { type: Number, required: true },
    duration: { type: Number, required: true },
    phrase: { type: String, default: "" },
    prompt: { type: String, default: "" },
    status: { type: String, enum: ["pending", "ready", "failed"], default: "pending" },
    s3Key: { type: String },
    s3Url: { type: String },
    error: { type: String },
  },
  { _id: false },
);

const BrollJobSchema = new Schema<IBrollJob>(
  {
    _id: { type: String, required: true },
    clipId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    aspectRatio: { type: String, default: "9:16" },
    status: {
      type: String,
      enum: ["pending", "generating", "done", "failed"],
      default: "pending",
    },
    creditCost: { type: Number, default: 0 },
    shots: { type: [BrollShotSchema], default: [] },
    error: { type: String },
  },
  { timestamps: true, _id: false },
);

export const BrollJob = mongoose.model<IBrollJob>("BrollJob", BrollJobSchema);
