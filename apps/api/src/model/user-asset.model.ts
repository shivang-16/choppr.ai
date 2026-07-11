import mongoose, { Schema } from "mongoose";

/** Where this asset is intended to be used in the editor. */
export type UserAssetUsage = "timeline" | "watermark";

export interface IUserAsset {
  _id: string;
  userId: string;
  name: string;
  s3Key: string;
  s3Url: string;
  mimeType: string;
  sizeBytes: number;
  assetType: "image" | "audio" | "video" | "other";
  /** Distinguishes timeline media vs watermark/thumbnail uploads. */
  usage: UserAssetUsage;
  createdAt: Date;
  updatedAt: Date;
}

const UserAssetSchema = new Schema<IUserAsset>(
  {
    _id:       { type: String, required: true },
    userId:    { type: String, required: true, index: true },
    name:      { type: String, required: true, trim: true },
    s3Key:     { type: String, required: true },
    s3Url:     { type: String, required: true },
    mimeType:  { type: String, required: true },
    sizeBytes: { type: Number, default: 0 },
    assetType: {
      type: String,
      enum: ["image", "audio", "video", "other"],
      default: "other",
    },
    usage: {
      type: String,
      enum: ["timeline", "watermark"],
      default: "timeline",
      index: true,
    },
  },
  { timestamps: true, _id: false }
);

export const UserAsset = (mongoose.models.UserAsset ||
  mongoose.model<IUserAsset>("UserAsset", UserAssetSchema)) as mongoose.Model<IUserAsset>;
