import mongoose, { Schema } from "mongoose";

export type BackgroundFill = "blur" | "black" | "white" | "none";

export interface IProject {
  _id: string;
  userId: string;
  title: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  videoDuration?: number;
  totalClips: number;
  status: "pending" | "processing" | "done" | "failed";
  error?: string;
  aspectRatio?: string;
  backgroundFill?: BackgroundFill;
  // Clip generation settings
  clipModel?: string;
  genre?: string;
  clipLength?: string;
  maxClips?: number;
  language?: string;
  query?: string;
  jobId: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    _id:           { type: String, required: true },
    userId:        { type: String, required: true, index: true },
    title:         { type: String, required: true },
    sourceUrl:     { type: String, required: true },
    thumbnailUrl:  { type: String },
    videoDuration: { type: Number },
    totalClips:    { type: Number, default: 0 },
    status:        { type: String, enum: ["pending", "processing", "done", "failed"], default: "pending" },
    error:         { type: String },
    aspectRatio:    { type: String, default: "9:16" },
    backgroundFill: { type: String, enum: ["blur", "black", "white", "none"], default: "blur" },
    clipModel:     { type: String, default: "Auto" },
    genre:         { type: String, default: "Auto" },
    clipLength:    { type: String, default: "Auto (0m-3m)" },
    maxClips:      { type: Number, default: 10 },
    language:      { type: String },
    query:         { type: String, default: "" },
    jobId:         { type: String, required: true, index: true },
  },
  { timestamps: true, _id: false }
);

export const Project = mongoose.model<IProject>("Project", ProjectSchema);
