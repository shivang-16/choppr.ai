import { Router, Request, Response } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";

const router = Router();

router.use(baseAuth);

// Extracts PT1H2M3S → total seconds
function parseIsoDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? "0") * 3600) + (parseInt(m[2] ?? "0") * 60) + parseInt(m[3] ?? "0");
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

// GET /api/video-meta?url=...
router.get("/", async (req: Request, res: Response) => {
  const url = String(req.query.url ?? "");
  if (!url) { res.status(400).json({ error: "url is required" }); return; }

  try {
    const ytId = extractYouTubeId(url);
    if (ytId) {
      // Fetch the YouTube watch page and pull duration from og:video:duration or itemprop
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${ytId}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Choppr/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      const html = await pageRes.text();

      // "approxDurationMs":"12345678"
      const msMatch = html.match(/"approxDurationMs":"(\d+)"/);
      if (msMatch) {
        const durationSecs = Math.floor(parseInt(msMatch[1]) / 1000);
        res.json({ durationSecs });
        return;
      }

      // itemprop="duration" content="PT1H2M3S"
      const isoMatch = html.match(/itemprop="duration"\s+content="([^"]+)"/);
      if (isoMatch) {
        res.json({ durationSecs: parseIsoDuration(isoMatch[1]) });
        return;
      }
    }

    res.json({ durationSecs: null });
  } catch {
    res.json({ durationSecs: null });
  }
});

export default router;
