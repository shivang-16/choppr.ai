import mongoose, { Schema } from "mongoose";

export type JobStatus =
  | "pending"
  | "downloading"
  | "transcribing"
  | "analyzing"
  | "clipping"
  | "done"
  | "failed";

export interface IClip {
  s3Url: string;
  score: number;
  duration: number;
  reason: string;
  index: number;
}

export interface IJob {
  _id: string;
  userId: string;
  projectId: string;
  url: string;
  query: string;
  status: JobStatus;
  progress: number;
  error?: string;
  clips: IClip[];
  sourceVideoS3Key?: string;
  videoDuration?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ClipSchema = new Schema<IClip>({
  s3Url:    { type: String, required: true },
  score:    { type: Number, required: true },
  duration: { type: Number, required: true },
  reason:   { type: String, default: "" },
  index:    { type: Number, required: true },
});

const JobSchema = new Schema<IJob>(
  {
    _id:               { type: String, required: true },
    userId:            { type: String, required: true, index: true },
    projectId:         { type: String, required: true, index: true },
    url:               { type: String, required: true },
    query:             { type: String, default: "" },
    status:            { type: String, enum: ["pending","downloading","transcribing","analyzing","clipping","done","failed"], default: "pending" },
    progress:          { type: Number, default: 0, min: 0, max: 100 },
    error:             { type: String },
    clips:             { type: [ClipSchema], default: [] },
    sourceVideoS3Key:  { type: String },
    videoDuration:     { type: Number },
  },
  { timestamps: true, _id: false }
);

export const Job = mongoose.model<IJob>("Job", JobSchema);
