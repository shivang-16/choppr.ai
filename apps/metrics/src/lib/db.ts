import mongoose from "mongoose";

const uri = process.env.CHOPPR_DB;

declare global {
  // eslint-disable-next-line no-var
  var __metricsMongoose: typeof mongoose | undefined;
}

export async function connectDB() {
  if (!uri) {
    throw new Error("CHOPPR_DB is not set");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (global.__metricsMongoose?.connection.readyState === 1) {
    return global.__metricsMongoose;
  }

  await mongoose.connect(uri);
  global.__metricsMongoose = mongoose;
  return mongoose;
}
