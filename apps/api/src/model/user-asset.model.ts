import mongoose, { Schema } from "mongoose";

export interface IUserAsset {
  _id: string;
  userId: string;
  name: string;
  s3Key: string;
  s3Url: string;
  mimeType: string;
  sizeBytes: number;
  assetType: "image" | "audio" | "video" | "other";
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
  },
  { timestamps: true, _id: false }
);

export const UserAsset = (mongoose.models.UserAsset ||
  mongoose.model<IUserAsset>("UserAsset", UserAssetSchema)) as mongoose.Model<IUserAsset>;
