import { Router, Request, Response } from "express";
import { existsSync } from "fs";
import { readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { youtubeDl as ytDlpExec } from "youtube-dl-exec";
import { baseAuth } from "../middlewares/checkAuth.js";
import { logger } from "../utils/logger.js";

const router = Router();
router.use(baseAuth);

// Path to the Playwright auth state saved alongside this server
const STORAGE_STATE_PATH = join(process.cwd(), ".youtube_auth_state.json");

/**
 * Convert Playwright storage-state cookies to Netscape HTTP Cookie File
 * format that yt-dlp understands. Mirrors the Python logic in cookie_refresher.py.
 */
function cookiesToNetscape(cookies: Array<Record<string, any>>): string {
  const lines = ["# Netscape HTTP Cookie File\n"];
  const now = Math.floor(Date.now() / 1000);
  for (const c of cookies) {
    const domain = String(c.domain ?? "");
    const flag   = domain.startsWith(".") ? "TRUE" : "FALSE";
    const path   = String(c.path ?? "/");
    const secure = c.secure ? "TRUE" : "FALSE";
    let   expires = Math.floor(Number(c.expires ?? 0));
    if (expires < 0) expires = now + 365 * 24 * 3600;
    lines.push(`${domain}\t${flag}\t${path}\t${secure}\t${expires}\t${c.name}\t${c.value}\n`);
  }
  return lines.join("");
}

/**
 * Fetch video metadata directly on this server using youtube-dl-exec (bundles
 * yt-dlp) + saved YouTube cookies. No Playwright refresh, no agent hop.
 * Throws if .youtube_auth_state.json is missing.
 */
async function fetchMetaLocal(url: string) {
  if (!existsSync(STORAGE_STATE_PATH)) {
    throw new Error(".youtube_auth_state.json not found");
  }

  const state   = JSON.parse(await readFile(STORAGE_STATE_PATH, "utf-8"));
  const cookies = (state.cookies ?? []) as Array<Record<string, any>>;
  const tmpFile = join(tmpdir(), `yt-cookies-${process.pid}-${Date.now()}.txt`);

  await writeFile(tmpFile, cookiesToNetscape(cookies));

  try {
    const info = await ytDlpExec(url, {
      cookies:    tmpFile,
      dumpSingleJson: true,
      noPlaylist: true,
      noWarnings: true,
    }) as Record<string, any>;

    const rawDuration = parseFloat(String(info.duration ?? "0"));
    return {
      durationSecs: rawDuration > 0 ? Math.floor(rawDuration) : null,
      thumbnail:    (info.thumbnail as string) ?? null,
      title:        (info.title    as string) ?? null,
    };
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

/**
 * Proxy fallback — hits the Python agent exactly as before.
 * Used when yt-dlp is unavailable on this server or the cookie file is absent.
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
router.get("/", async (req: Request, res: Response) => {
  const url = String(req.query.url ?? "").trim();
  if (!url) { res.status(400).json({ error: "url is required" }); return; }

  // Try locally first — keeps the agent free for heavy processing
  try {
    const meta = await fetchMetaLocal(url);
    logger.info("Video metadata fetched locally", {
      url,
      durationSecs: meta.durationSecs,
      title: meta.title,
    });
    res.json(meta);
    return;
  } catch (localErr) {
    logger.warn("video-meta: local yt-dlp failed, falling back to agent", {
      url,
      error: localErr instanceof Error ? localErr.message : String(localErr),
      stack: localErr instanceof Error ? localErr.stack : undefined,
    });
  }

  // Agent fallback
  try {
    const data = await fetchMetaViaAgent(url);
    logger.info("Video metadata fetched via agent fallback", {
      url,
      durationSecs: data.durationSecs ?? null,
    });
    res.json(data);
  } catch (e) {
    logger.error("video-meta: agent fallback also failed", {
      url,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    res.json({ durationSecs: null });
  }
});

export default router;
