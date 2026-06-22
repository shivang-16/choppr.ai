/**
 * Seed credit top-up packs into MongoDB.
 * Safe to re-run — upserts by slug.
 *
 * Usage:
 *   npx tsx src/db/seed-topup-packs.ts
 */

import mongoose from "mongoose";
import { config } from "dotenv";
import { TopupPack } from "../model/topup-pack.model.js";

config({ path: "./.env" });

const TOPUP_PACKS = [
  {
    slug:          "starter",
    name:          "Starter",
    credits:       100,
    price:         300,    // $3.00
    dodoProductId: "pdt_0Nha4S7Vyv8ZClKmj2BLE",
    order:         0,
    active:        true,
  },
  {
    slug:          "boost",
    name:          "Boost",
    credits:       300,
    price:         800,    // $8.00
    dodoProductId: "pdt_0Nha4WF1T5RjetpL520u7",
    order:         1,
    active:        true,
  },
  {
    slug:          "pro",
    name:          "Pro",
    credits:       600,
    price:         1400,   // $14.00
    dodoProductId: "pdt_0Nha4hH9KwbrUpM53OSO6",
    order:         2,
    active:        true,
  },
  {
    slug:          "power",
    name:          "Power",
    credits:       1500,
    price:         3000,   // $30.00
    dodoProductId: "pdt_0Nha4pMhIn9ozBdTJUEuM",
    order:         3,
    active:        true,
  },
];

async function seed() {
  await mongoose.connect(process.env.CHOPPR_DB!);
  console.log("Connected to MongoDB");

  for (const pack of TOPUP_PACKS) {
    await TopupPack.findOneAndUpdate({ slug: pack.slug }, pack, { upsert: true, new: true });
    console.log(`  ✓ Upserted topup pack: ${pack.slug} (${pack.credits} credits / $${pack.price / 100})`);
  }

  console.log("Done.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
