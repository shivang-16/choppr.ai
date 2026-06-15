import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document<string> {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl: string;
  email: string;
  ssoProvider?: 'google' | 'email' | 'extension';
  subscriptionStatus?: "active" | "inactive" | "cancelled" | "free";
  subscriptionStartDate?: Date;
  isOnboarded?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    _id: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    ssoProvider: {
      type: String,
      enum: ['google', 'email', 'extension'],
      required: false,
      index: true,
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "cancelled", "free"],
      default: "free",
    },
    subscriptionStartDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default (mongoose.models.User ||
  mongoose.model<IUser>("User", userSchema)) as mongoose.Model<IUser>;
