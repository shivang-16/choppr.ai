import mongoose, { Document, Schema } from "mongoose";

export interface ITopupPack extends Document {
  slug: string;           // "starter" | "boost" | "pro" | "power"
  name: string;
  credits: number;        // credits granted on purchase
  price: number;          // USD cents
  dodoProductId: string;  // Dodo Payments one-time product ID
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TopupPackSchema = new Schema<ITopupPack>(
  {
    slug:          { type: String, required: true, unique: true },
    name:          { type: String, required: true },
    credits:       { type: Number, required: true, min: 1 },
    price:         { type: Number, required: true, min: 0 },
    dodoProductId: { type: String, required: true },
    order:         { type: Number, default: 0 },
    active:        { type: Boolean, default: true },
  },
  { timestamps: true }
);

TopupPackSchema.index({ active: 1, order: 1 });

export const TopupPack =
  (mongoose.models.TopupPack as mongoose.Model<ITopupPack>) ||
  mongoose.model<ITopupPack>("TopupPack", TopupPackSchema);
