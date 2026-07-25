import { Router, Request, Response } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { logger } from "../utils/logger.js";
import { fetchMetaLight, fetchDurationViaDownload } from "../utils/video-duration.js";

const router = Router();
router.use(baseAuth);

/**
 * Proxy fallback — hits the Python agent for light yt-dlp meta.
 * Used when local yt-dlp is unavailable on this server.
 */
async function fetchMetaViaAgent(url: string) {
  const workerUrl = process.env.WORKER_URL ?? "http://localhost:8000";
  const secret    = process.env.INTERNAL_API_SECRET ?? "";
  const workerRes = await fetch(
    `${workerUrl}/internal/video-meta?url=${encodeURIComponent(url)}`,
    {
      headers: { "X-Internal-Secret": secret },
      signal:  AbortSignal.timeout(35_000),
    },
  );
  return workerRes.json() as Promise<Record<string, any>>;
}

// GET /api/video-meta?url=...
// 1) Light yt-dlp metadata
// 2) If no duration → download video + ffprobe (API)
// 3) If that fails → unable to get the video
router.get("/", async (req: Request, res: Response) => {
  const url = String(req.query.url ?? "").trim();
  if (!url) { res.status(400).json({ error: "url is required" }); return; }

  let title: string | null = null;
  let thumbnail: string | null = null;
  let durationSecs: number | null = null;

  // Step 1: light metadata
  try {
    const meta = await fetchMetaLight(url);
    durationSecs = meta.durationSecs;
    title = meta.title;
    thumbnail = meta.thumbnail;
  } catch (localErr) {
    logger.warn("video-meta: local yt-dlp light meta failed, trying agent", {
      url,
      error: localErr instanceof Error ? localErr.message : String(localErr),
    });
    try {
      const data = await fetchMetaViaAgent(url);
      durationSecs = typeof data.durationSecs === "number" ? data.durationSecs : null;
      title = (data.title as string) ?? null;
      thumbnail = (data.thumbnail as string) ?? null;
    } catch (e) {
      logger.warn("video-meta: agent light meta also failed", {
        url,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (durationSecs && durationSecs > 0) {
    logger.info("video-meta: light meta succeeded", {
      url,
      durationSecs,
      title: title?.slice(0, 80) ?? null,
    });
    res.json({ durationSecs, thumbnail, title });
    return;
  }

  // Step 2: heavy fallback — download + ffprobe on API
  logger.info("video-meta: no duration from light meta, downloading for ffprobe", { url });
  const deep = await fetchDurationViaDownload(url);
  if (deep.durationSecs && deep.durationSecs > 0) {
    logger.info("video-meta: download+ffprobe succeeded", {
      url,
      durationSecs: deep.durationSecs,
    });
    res.json({
      durationSecs: deep.durationSecs,
      thumbnail: thumbnail ?? deep.thumbnail,
      title: title ?? deep.title,
    });
    return;
  }

  logger.warn("video-meta: unable to get video duration", {
    url,
    error: deep.error ?? "Unable to get the video.",
    hadLightTitle: !!title,
  });
  res.status(422).json({
    durationSecs: null,
    thumbnail,
    title,
    error: deep.error ?? "Unable to get the video.",
  });
});

export default router;
