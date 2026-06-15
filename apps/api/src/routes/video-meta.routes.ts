import { Router, Request, Response } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
import { logger } from "../utils/logger.js";

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
      // --- Method 1: InnerTube ANDROID client (bypasses IP blocks) ---
      try {
        const innerTubeRes = await fetch(
          "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "com.google.android.youtube/17.36.4 (Linux; U; Android 12; GB) gzip",
              "X-YouTube-Client-Name": "3",
              "X-YouTube-Client-Version": "17.36.4",
              ...(YT_COOKIE_HEADER ? { Cookie: YT_COOKIE_HEADER } : {}),
            },
            body: JSON.stringify({
              videoId: ytId,
              context: {
                client: {
                  clientName: "ANDROID",
                  clientVersion: "17.36.4",
                  androidSdkVersion: 31,
                  hl: "en",
                  gl: "US",
                },
              },
            }),
            signal: AbortSignal.timeout(8000),
          }
        );
        const data = await innerTubeRes.json() as any;
        logger.debug("InnerTube response", { status: innerTubeRes.status, lengthSeconds: data?.videoDetails?.lengthSeconds, error: data?.playabilityStatus?.reason });
        const lengthSecs = data?.videoDetails?.lengthSeconds;
        if (lengthSecs && parseInt(lengthSecs) > 0) {
          res.json({ durationSecs: parseInt(lengthSecs) });
          return;
        }
      } catch (e) {
        logger.warn("InnerTube fetch failed", { error: String(e) });
      }

      // --- Method 2: HTML scrape fallback ---
      try {
        const headers: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        };
        if (YT_COOKIE_HEADER) headers["Cookie"] = YT_COOKIE_HEADER;

        const pageRes = await fetch(`https://www.youtube.com/watch?v=${ytId}`, { headers, signal: AbortSignal.timeout(8000) });
        const html = await pageRes.text();
        logger.debug("YouTube HTML scrape", { status: pageRes.status, htmlLen: html.length, hasDuration: html.includes("approxDurationMs") || html.includes("lengthSeconds") });

        const msMatch = html.match(/"approxDurationMs":"(\d+)"/);
        if (msMatch?.[1]) { res.json({ durationSecs: Math.floor(parseInt(msMatch[1]) / 1000) }); return; }

        const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
        if (lengthMatch?.[1]) { res.json({ durationSecs: parseInt(lengthMatch[1]) }); return; }

        const isoMatch = html.match(/itemprop="duration"\s+content="([^"]+)"/);
        if (isoMatch?.[1]) { res.json({ durationSecs: parseIsoDuration(isoMatch[1]) }); return; }
      } catch (e) {
        logger.warn("HTML scrape failed", { error: String(e) });
      }
    }

    res.json({ durationSecs: null });
  } catch (e) {
    logger.error("video-meta unhandled error", { error: String(e) });
    res.json({ durationSecs: null });
  }
});

export default router;
