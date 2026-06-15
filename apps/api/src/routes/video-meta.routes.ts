import { Router, Request, Response } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const router = Router();

// Load YouTube auth cookies once at startup
function loadYoutubeCookies(): string {
  try {
    const __dir = dirname(fileURLToPath(import.meta.url));
    const authPath = resolve(__dir, "../../.youtube_auth_state.json");
    const raw = JSON.parse(readFileSync(authPath, "utf-8"));
    const ytCookies: Array<{ name: string; value: string; domain: string }> = raw.cookies ?? [];
    return ytCookies
      .filter((c) => c.domain.includes("youtube.com") || c.domain.includes(".google.com"))
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  } catch {
    return "";
  }
}

const YT_COOKIE_HEADER = loadYoutubeCookies();

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
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      };
      if (YT_COOKIE_HEADER) headers["Cookie"] = YT_COOKIE_HEADER;

      const pageRes = await fetch(`https://www.youtube.com/watch?v=${ytId}`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      const html = await pageRes.text();

      // "approxDurationMs":"12345678"
      const msMatch = html.match(/"approxDurationMs":"(\d+)"/);
      if (msMatch?.[1]) {
        const durationSecs = Math.floor(parseInt(msMatch[1]) / 1000);
        res.json({ durationSecs });
        return;
      }

      // itemprop="duration" content="PT1H2M3S"
      const isoMatch = html.match(/itemprop="duration"\s+content="([^"]+)"/);
      if (isoMatch?.[1]) {
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
