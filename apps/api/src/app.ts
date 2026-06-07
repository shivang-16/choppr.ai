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
const allowedOrigins = [
  process.env.FRONTEND_URL ?? "http://localhost:3000",
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

// ── Error handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
