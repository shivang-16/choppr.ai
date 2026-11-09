import mongoose, { Schema } from "mongoose";

export type YoutubeVideoCategory = "video" | "short" | "live";

export interface IYoutubeVideo {
  _id: string;
  userId: string;
  connectionId: string;
  channelId: string;
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  publishedAt?: Date;
  durationSecs: number;
  privacyStatus: string;
  category: YoutubeVideoCategory;
  madeForKids: boolean;
  viewCount: number;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const YoutubeVideoSchema = new Schema<IYoutubeVideo>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    connectionId: { type: String, required: true },
    channelId: { type: String, required: true },
    videoId: { type: String, required: true },
    title: { type: String, required: true },
    thumbnailUrl: { type: String },
    publishedAt: { type: Date },
    durationSecs: { type: Number, default: 0 },
    privacyStatus: { type: String, default: "unknown" },
    category: {
      type: String,
      enum: ["video", "short", "live"],
      required: true,
    },
    madeForKids: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0 },
    syncedAt: { type: Date, required: true },
  },
  { timestamps: true, _id: false },
);

YoutubeVideoSchema.index({ connectionId: 1, videoId: 1 }, { unique: true });
YoutubeVideoSchema.index({ userId: 1, publishedAt: -1 });

export const YoutubeVideo = mongoose.model<IYoutubeVideo>(
  "YoutubeVideo",
  YoutubeVideoSchema,
);
