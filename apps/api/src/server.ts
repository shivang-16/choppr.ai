import app from "./app.js";
import connectDB from "./db/db.js";
import { logger } from "./utils/logger.js";
import { startMediaCleanupSchedule } from "./services/purge-old-media.js";

const port = process.env.PORT || 4000;

connectDB().then(() => {
  startMediaCleanupSchedule();
});

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});