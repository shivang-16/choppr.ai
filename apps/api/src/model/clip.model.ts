import mongoose, { Schema } from "mongoose";

export interface ICaptionWord {
  word:  string;
  start: number; // seconds relative to clip start
  end:   number;
}

export interface IEditSettings {
  captionStyle:     string;
  captionLang:      string;
  captionWords?:    { word: string; start: number; end: number }[];
  speed:            number;
  trimStart:        number;
  trimEnd:          number;
  brightness:       number;
  contrast:         number;
  saturation:       number;
}

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
  captions: ICaptionWord[];
  captionLang: string;
  editSettings?: IEditSettings;
  originalClipId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClipSchema = new Schema<IClip>(
  {
    _id:         { type: String, required: true },
    projectId:   { type: String, required: true, index: true },
    jobId:       { type: String, required: true, index: true },
    userId:      { type: String, required: true, index: true },
    index:       { type: Number, required: true },
    s3Key:       { type: String, required: true },
    s3Url:       { type: String, required: true },
    score:       { type: Number, default: 0 },
    duration:    { type: Number, default: 0 },
    reason:      { type: String, default: "" },
    startTime:   { type: Number, default: 0 },
    endTime:     { type: Number, default: 0 },
    captions:    { type: [{ word: String, start: Number, end: Number }], default: [] },
    captionLang: { type: String, default: "" },
    editSettings: {
      type: {
        captionStyle:  { type: String, default: "none" },
        captionLang:   { type: String, default: "" },
        captionWords:  { type: [{ word: String, start: Number, end: Number }], default: undefined },
        speed:         { type: Number, default: 1.0 },
        trimStart:     { type: Number, default: 0 },
        trimEnd:       { type: Number, default: 0 },
        brightness:    { type: Number, default: 100 },
        contrast:      { type: Number, default: 100 },
        saturation:    { type: Number, default: 100 },
      },
      default: undefined,
    },
    originalClipId: { type: String, default: undefined, index: true },
  },
  { timestamps: true, _id: false }
);

export const Clip = mongoose.model<IClip>("Clip", ClipSchema);
