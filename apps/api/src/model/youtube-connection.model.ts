import mongoose, { Schema } from "mongoose";

export type YoutubeConnectionStatus = "active" | "needs_reconnect";

export interface IYoutubeConnection {
  _id: string;
  userId: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string;
  customUrl?: string;
  uploadsPlaylistId: string;
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: Date;
  status: YoutubeConnectionStatus;
  lastSyncedAt?: Date;
  lastSyncError?: string;
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const YoutubeConnectionSchema = new Schema<IYoutubeConnection>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    channelTitle: { type: String, required: true },
    thumbnailUrl: { type: String },
    customUrl: { type: String },
    uploadsPlaylistId: { type: String, required: true },
    refreshToken: { type: String, required: true },
    accessToken: { type: String },
    accessTokenExpiresAt: { type: Date },
    status: {
      type: String,
      enum: ["active", "needs_reconnect"],
      default: "active",
    },
    lastSyncedAt: { type: Date },
    lastSyncError: { type: String },
    videoCount: { type: Number, default: 0 },
  },
  { timestamps: true, _id: false },
);

YoutubeConnectionSchema.index({ userId: 1, channelId: 1 }, { unique: true });

export const YoutubeConnection = mongoose.model<IYoutubeConnection>(
  "YoutubeConnection",
  YoutubeConnectionSchema,
);
