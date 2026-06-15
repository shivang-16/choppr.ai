/**
 * Run once to seed pricing plans into MongoDB.
 * Safe to re-run — uses upsert so existing plans are updated, not duplicated.
 *
 * Usage:
 *   npx tsx src/db/seed-plans.ts
 */

import mongoose from "mongoose";
import { config } from "dotenv";
import { Plan } from "../model/plan.model.js";

config({ path: "./.env" });

const PLANS = [
  {
    slug: "free",
    name: "Free",
    description: "Get started with AI clipping at no cost.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    credits: 500,
    creditCostPerMin: 2,
    maxVideoLengthMins: 60,
    maxClipsPerJob: 10,
    maxExportResolution: "720p",
    teamSeats: 1,
    apiAccess: false,
    priorityQueue: false,
    features: [
      "500 credits / month",
      "~4 hrs of AI clipping",
      "60 min max per video",
      "10 clips per video",
      "720p export",
      "AI Captions & Reframe",
    ],
    cta: "Current plan",
    popular: false,
    active: true,
    order: 0,
  },
  {
    slug: "core",
    name: "Core",
    description: "For creators who are just getting started with AI video clipping.",
    monthlyPrice: 1200,   // $12.00
    yearlyPrice: 900,     // $9.00/mo billed yearly
    credits: 1500,
    creditCostPerMin: 2,
    maxVideoLengthMins: 120,
    maxClipsPerJob: 30,
    maxExportResolution: "1080p",
    teamSeats: 1,
    apiAccess: false,
    priorityQueue: true,
    features: [
      "1,500 credits / month",
      "~12 hrs of AI clipping",
      "Up to 2 hr video per job",
      "30 clips per video",
      "1080p export",
      "Priority queue",
      "AI Captions & Reframe",
    ],
    cta: "Get Started",
    popular: false,
    active: true,
    order: 1,
  },
  {
    slug: "growth",
    name: "Growth",
    description: "For power creators who clip multiple videos every week at scale.",
    monthlyPrice: 2900,   // $29.00
    yearlyPrice: 2200,    // $22.00/mo billed yearly
    credits: 5000,
    creditCostPerMin: 2,
    maxVideoLengthMins: null,   // unlimited
    maxClipsPerJob: null,        // unlimited
    maxExportResolution: "4K",
    teamSeats: 1,
    apiAccess: false,
    priorityQueue: true,
    features: [
      "5,000 credits / month",
      "~40 hrs of AI clipping",
      "Unlimited video length",
      "Unlimited clips per video",
      "4K export",
      "Priority queue",
      "All features unlocked",
      "AI Hook & Speech Enhance",
    ],
    cta: "Get Started",
    popular: true,
    active: true,
    order: 2,
  },
  {
    slug: "scale",
    name: "Scale",
    description: "For agencies and teams processing large volumes of content daily.",
    monthlyPrice: 7500,   // $75.00
    yearlyPrice: 5900,    // $59.00/mo billed yearly
    credits: 20000,
    creditCostPerMin: 2,
    maxVideoLengthMins: null,
    maxClipsPerJob: null,
    maxExportResolution: "4K",
    teamSeats: 3,
    apiAccess: true,
    priorityQueue: true,
    features: [
      "20,000 credits / month",
      "~160 hrs of AI clipping",
      "Everything in Growth",
      "3 team seats included",
      "API access",
      "Custom integrations",
      "Dedicated support",
    ],
    cta: "Schedule a demo",
    popular: false,
    active: true,
    order: 3,
  },
];

async function seed() {
  await mongoose.connect(process.env.CHOPPR_DB!);
  console.log("Connected to MongoDB");

  for (const plan of PLANS) {
    await Plan.findOneAndUpdate({ slug: plan.slug }, plan, { upsert: true, new: true });
    console.log(`  ✓ Upserted plan: ${plan.slug}`);
  }

  console.log("Done.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
