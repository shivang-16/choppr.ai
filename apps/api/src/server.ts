import app from "./app.js";
import connectDB from "./db/db.js";
import { logger } from "./utils/logger.js";

const port = process.env.PORT || 4000;

connectDB();

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});