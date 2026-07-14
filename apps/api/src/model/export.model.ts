import mongoose, { Schema } from "mongoose";

export type ExportStatus = "pending" | "rendering" | "done" | "failed" | "cancelled";

export interface IExport {
  _id:             string;
  userId:          string;
  projectId:       string;
  status:          ExportStatus;
  progress:        number;
  s3Key?:          string;
  s3Url?:          string;
  error?:          string;
  // Style
  captionStyle:    string;
  captionFontSize: number;
  captionPosY:     number;
  aspectRatio:     string;
  backgroundFill:  string;
  brightness:      number;
  contrast:        number;
  saturation:      number;
  // Timeline
  tracks:          Record<string, unknown>[];
  volumes:         Record<string, number>;
  speeds:          Record<string, number>;
  captionMap:      Record<string, { word: string; start: number; end: number }[]>;
  stickers:        { stickerId: string; x: number; y: number; scale: number }[];
  textOverlays:    { id: string; text: string; x: number; y: number; fontSize: number; color: string; bold: boolean; italic: boolean }[];
  thumbnailOverlay?: { imageUrl: string; x: number; y: number; width: number; height: number; styleId: string; opacity: number } | null;
  previewWidth:    number;
  originalClipId?: string;
  createdAt:       Date;
  updatedAt:       Date;
}

const ExportSchema = new Schema<IExport>(
  {
    _id:          { type: String, required: true },
    userId:       { type: String, required: true, index: true },
    projectId:    { type: String, required: true, index: true },
    status:       { type: String, enum: ["pending","rendering","done","failed","cancelled"], default: "pending" },
    progress:     { type: Number, default: 0, min: 0, max: 100 },
    s3Key:        { type: String },
    s3Url:        { type: String },
    error:        { type: String },
    captionStyle:    { type: String, default: "none" },
    captionFontSize: { type: Number, default: 50 },
    captionPosY:     { type: Number, default: 0 },
    aspectRatio:     { type: String, default: "9:16" },
    backgroundFill:  { type: String, default: "blur" },
    brightness:      { type: Number, default: 100 },
    contrast:        { type: Number, default: 100 },
    saturation:      { type: Number, default: 100 },
    tracks:          { type: Schema.Types.Mixed, default: [] },
    volumes:         { type: Schema.Types.Mixed, default: {} },
    speeds:          { type: Schema.Types.Mixed, default: {} },
    captionMap:      { type: Schema.Types.Mixed, default: {} },
    stickers:        { type: Schema.Types.Mixed, default: [] },
    textOverlays:    { type: Schema.Types.Mixed, default: [] },
    thumbnailOverlay: { type: Schema.Types.Mixed, default: null },
    previewWidth:    { type: Number, default: 380 },
    originalClipId:  { type: String },
  },
  { timestamps: true, _id: false }
);

export const Export = mongoose.model<IExport>("Export", ExportSchema);
