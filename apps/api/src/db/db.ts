import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

const MONGODB_URI = process.env.CHOPPR_DB;

const connectDB = async () => {
    try {
        if (!MONGODB_URI) {
            throw new Error("CHOPPR_DB environment variable is not set");
        }

        await mongoose.connect(MONGODB_URI);
        logger.info("MongoDB connected");
    } catch (error) {
        logger.error("MongoDB connection error", error);
        process.exit(1);
    }
};

export default connectDB;