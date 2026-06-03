import mongoose, { Schema } from "mongoose";

export interface IProject {
  _id: string;
  userId: string;
  title: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  videoDuration?: number;
  totalClips: number;
  status: "pending" | "processing" | "done" | "failed";
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
    jobId:         { type: String, required: true, index: true },
  },
  { timestamps: true, _id: false }
);

export const Project = mongoose.model<IProject>("Project", ProjectSchema);
