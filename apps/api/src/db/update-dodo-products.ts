import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: "./.env" });

async function run() {
  await mongoose.connect(process.env.CHOPPR_DB!);
  const plans = mongoose.connection.db!.collection("plans");

  await plans.updateOne({ slug: "core" },   { $set: { dodoProductIdMonthly: "pdt_0NWzs21Qdmsf6gizRmVAM" } });
  await plans.updateOne({ slug: "growth" }, { $set: { dodoProductIdMonthly: "pdt_0NgSVEfgTJWfMtz8vUKFI" } });
  await plans.updateOne({ slug: "scale" },  { $set: { dodoProductIdMonthly: "pdt_0NgSVKiRjTPOVCzooDLIR" } });

  const result = await plans.find(
    { slug: { $in: ["core", "growth", "scale"] } },
    { projection: { _id: 1, dodoProductIdMonthly: 1, dodoProductIdYearly: 1 } }
  ).toArray();

  console.log("Updated plans:");
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

run().catch(console.error);
