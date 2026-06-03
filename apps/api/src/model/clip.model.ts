import mongoose, { Schema } from "mongoose";

export interface IClip {
  _id: string;
  projectId: string;
  jobId: string;
  userId: string;
  index: number;
  s3Key: string;
  s3Url: string;
  score: number;
  duration: number;
  reason: string;
  startTime: number;
  endTime: number;
  createdAt: Date;
  updatedAt: Date;
}

const ClipSchema = new Schema<IClip>(
  {
    _id:       { type: String, required: true },
    projectId: { type: String, required: true, index: true },
    jobId:     { type: String, required: true, index: true },
    userId:    { type: String, required: true, index: true },
    index:     { type: Number, required: true },
    s3Key:     { type: String, required: true },
    s3Url:     { type: String, required: true },
    score:     { type: Number, default: 0 },
    duration:  { type: Number, default: 0 },
    reason:    { type: String, default: "" },
    startTime: { type: Number, default: 0 },
    endTime:   { type: Number, default: 0 },
  },
  { timestamps: true, _id: false }
);

export const Clip = mongoose.model<IClip>("Clip", ClipSchema);
