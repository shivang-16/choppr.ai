import mongoose, { Schema } from "mongoose";

export type ExportStatus = "pending" | "rendering" | "done" | "failed";

export interface IExport {
  _id:            string;
  userId:         string;
  projectId:      string;
  status:         ExportStatus;
  progress:       number;
  s3Key?:         string;
  s3Url?:         string;
  error?:         string;
  captionStyle:   string;
  aspectRatio:    string;
  backgroundFill: string;
  createdAt:      Date;
  updatedAt:      Date;
}

const ExportSchema = new Schema<IExport>(
  {
    _id:          { type: String, required: true },
    userId:       { type: String, required: true, index: true },
    projectId:    { type: String, required: true, index: true },
    status:       { type: String, enum: ["pending","rendering","done","failed"], default: "pending" },
    progress:     { type: Number, default: 0, min: 0, max: 100 },
    s3Key:        { type: String },
    s3Url:        { type: String },
    error:        { type: String },
    captionStyle:   { type: String, default: "none" },
    aspectRatio:    { type: String, default: "9:16" },
    backgroundFill: { type: String, enum: ["blur", "black", "white", "none"], default: "blur" },
  },
  { timestamps: true, _id: false }
);

export const Export = mongoose.model<IExport>("Export", ExportSchema);
