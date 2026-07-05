import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { clerkMiddleware } from "@clerk/express";
import jobRoutes from "./routes/job.routes.js";
import projectRoutes from "./routes/project.routes.js";
import clipRoutes from "./routes/clip.routes.js";
import creditsRoutes from "./routes/credits.routes.js";
import planRoutes from "./routes/plan.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import exportRoutes from "./routes/export.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import videoMetaRoutes from "./routes/video-meta.routes.js";
import userAssetRoutes from "./routes/user-asset.routes.js";
import errorHandler from "./middlewares/error.js";
import expressWinston from "express-winston";
import { winstonLogger } from "./utils/logger.js";
import { requestContextMiddleware } from "./middlewares/requestContext.js";

config({ path: "./.env" });

const app: express.Application = express();

app.use(requestContextMiddleware);

app.use(
  expressWinston.logger({
    winstonInstance: winstonLogger,
    meta: true,
    msg: "{{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms",
    dynamicMeta: (req, res) => ({
      userEmail: (req as any).user?.email ?? null,
      userId: (req as any).user?._id ?? null,
      statusCode: res.statusCode,
      responseTimeMs: (res as any).responseTime ?? null,
    }),
    expressFormat: false,
    colorize: process.env.NODE_ENV !== "production",
  })
);

// ── Middleware ──────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",
  "https://choppr.pro",
  "https://www.choppr.pro",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// Webhook routes MUST come before express.json() — they need the raw body
// for HMAC signature verification. express.raw() is applied per-route inside.
app.use("/api/webhooks", webhookRoutes);

app.use(express.json());
app.use(clerkMiddleware()); // must come before any route that calls getAuth()

// ── Routes ──────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.json({ ok: true }));
app.use("/api/jobs",      jobRoutes);
app.use("/api/projects",  projectRoutes);
app.use("/api/clips",     clipRoutes);
app.use("/api/credits",   creditsRoutes);
app.use("/api/plans",     planRoutes);
app.use("/api/payments",  paymentRoutes);
app.use("/api/exports",   exportRoutes);
app.use("/api/uploads",     uploadRoutes);
app.use("/api/video-meta",  videoMetaRoutes);
app.use("/api/user-assets", userAssetRoutes);

// ── Error handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
