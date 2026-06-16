import { Router, Request, Response } from "express";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { promisify } from "util";
import { baseAuth } from "../middlewares/checkAuth.js";
import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);
const router = Router();
router.use(baseAuth);

// Path to the Playwright auth state saved alongside this server
const STORAGE_STATE_PATH = join(process.cwd(), ".youtube_auth_state.json");

/**
 * Convert Playwright storage-state cookies to Netscape/Netscape HTTP Cookie File
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
 * Fetch video metadata directly on this server using yt-dlp + saved YouTube
 * cookies. No Playwright refresh — just reuse whatever the agent last wrote.
 * Throws if .youtube_auth_state.json is missing or yt-dlp is not on PATH.
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
    const { stdout } = await execFileAsync(
      "yt-dlp",
      ["--cookies", tmpFile, "-J", "--no-playlist", "--no-warnings", url],
      { timeout: 30_000 },
    );
    const info        = JSON.parse(stdout) as Record<string, any>;
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
    res.json(meta);
    return;
  } catch (localErr) {
    logger.warn("video-meta: local yt-dlp failed, falling back to agent", {
      error: String(localErr),
    });
  }

  // Agent fallback
  try {
    const data = await fetchMetaViaAgent(url);
    res.json(data);
  } catch (e) {
    logger.error("video-meta: agent fallback also failed", { error: String(e) });
    res.json({ durationSecs: null });
  }
});

export default router;
