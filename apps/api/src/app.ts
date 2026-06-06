import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { clerkMiddleware } from "@clerk/express";
import jobRoutes from "./routes/job.routes.js";
import projectRoutes from "./routes/project.routes.js";
import clipRoutes from "./routes/clip.routes.js";
import errorHandler from "./middlewares/error.js";
import expressWinston from "express-winston";
import { winstonLogger } from "./utils/logger.js";

config({ path: "./.env" });

const app: express.Application = express();

  app.use(
    expressWinston.logger({
      winstonInstance: winstonLogger,
      meta: false,
      expressFormat: true,
      colorize: true,
    })
  );

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());
app.use(clerkMiddleware()); // must come before any route that calls getAuth()

// ── Routes ──────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.json({ ok: true }));
app.use("/api/jobs", jobRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/clips",    clipRoutes);

// ── Error handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
