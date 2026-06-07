import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: "./.env" });

async function run() {
  await mongoose.connect(process.env.CHOPPR_DB!);
  const plans = mongoose.connection.db!.collection("plans");

  await plans.updateOne({ _id: "starter" },  { $set: { dodoProductIdMonthly: "pdt_0NWzs21Qdmsf6gizRmVAM" } });
  await plans.updateOne({ _id: "pro" },      { $set: { dodoProductIdMonthly: "pdt_0NgSVEfgTJWfMtz8vUKFI" } });
  await plans.updateOne({ _id: "business" }, { $set: { dodoProductIdMonthly: "pdt_0NgSVKiRjTPOVCzooDLIR" } });

  const result = await plans.find(
    { _id: { $in: ["starter", "pro", "business"] } },
    { projection: { _id: 1, dodoProductIdMonthly: 1, dodoProductIdYearly: 1 } }
  ).toArray();

  console.log("Updated plans:");
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

run().catch(console.error);
