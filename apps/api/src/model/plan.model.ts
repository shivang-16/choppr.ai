import mongoose, { Document, Schema } from "mongoose";

export interface IPlan extends Document {
  slug: string;                     // stable identifier: "free" | "core" | "growth" | "scale"
  name: string;                     // display name: "Free", "Core", etc.
  description: string;
  monthlyPrice: number;             // USD cents  (0 for free)
  yearlyPrice: number;              // USD cents per month when billed yearly
  credits: number;                  // credits granted per billing cycle
  creditCostPerMin: number;         // credits charged per minute of video (default 2)
  maxVideoLengthMins: number | null; // null = unlimited
  maxClipsPerJob: number | null;     // null = unlimited
  maxExportResolution: string;      // "720p" | "1080p" | "4K"
  teamSeats: number;                // 1 = solo
  apiAccess: boolean;
  priorityQueue: boolean;
  features: string[];               // human-readable list shown on pricing page
  cta: string;                      // button label: "Get Started" | "Schedule a demo"
  popular: boolean;
  active: boolean;
  order: number;                    // display order on pricing page
  dodoProductIdMonthly?: string;    // Dodo Payments product ID for monthly billing
  dodoProductIdYearly?: string;     // Dodo Payments product ID for yearly billing
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>(
  {
    slug:                 { type: String, required: true, unique: true },
    name:                 { type: String, required: true },
    description:          { type: String, required: true },
    monthlyPrice:         { type: Number, required: true, min: 0 },
    yearlyPrice:          { type: Number, required: true, min: 0 },
    credits:              { type: Number, required: true, min: 0 },
    creditCostPerMin:     { type: Number, required: true, default: 2 },
    maxVideoLengthMins:   { type: Number, default: null },
    maxClipsPerJob:       { type: Number, default: null },
    maxExportResolution:  { type: String, default: "1080p" },
    teamSeats:            { type: Number, default: 1 },
    apiAccess:            { type: Boolean, default: false },
    priorityQueue:        { type: Boolean, default: false },
    features:             [{ type: String }],
    cta:                  { type: String, default: "Get Started" },
    popular:              { type: Boolean, default: false },
    active:               { type: Boolean, default: true },
    order:                { type: Number, default: 0 },
    dodoProductIdMonthly: { type: String },
    dodoProductIdYearly:  { type: String },
  },
  { timestamps: true }
);

planSchema.index({ active: 1, order: 1 });
planSchema.index({ slug: 1 });

export const Plan =
  (mongoose.models.Plan as mongoose.Model<IPlan>) ||
  mongoose.model<IPlan>("Plan", planSchema);
