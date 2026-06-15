import { Router, Request, Response } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { logger } from "../utils/logger.js";

const router = Router();
router.use(baseAuth);

// GET /api/video-meta?url=...
// Proxies to the Python worker which uses yt-dlp with auth cookies
router.get("/", async (req: Request, res: Response) => {
  const url = String(req.query.url ?? "");
  if (!url) { res.status(400).json({ error: "url is required" }); return; }

  const workerUrl = process.env.WORKER_URL ?? "http://localhost:8000";
  const secret = process.env.INTERNAL_API_SECRET ?? "";

  try {
    const workerRes = await fetch(
      `${workerUrl}/internal/video-meta?url=${encodeURIComponent(url)}`,
      {
        headers: { "X-Internal-Secret": secret },
        signal: AbortSignal.timeout(35000),
      }
    );
    const data = await workerRes.json() as any;
    res.json(data);
  } catch (e) {
    logger.error("video-meta proxy failed", { error: String(e) });
    res.json({ durationSecs: null });
  }
});

export default router;
