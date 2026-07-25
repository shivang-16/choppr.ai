import { existsSync } from "fs";
import { readFile, writeFile, unlink, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { youtubeDl as ytDlpExec } from "youtube-dl-exec";
import { probeDurationSecs } from "./ffprobe.js";
import { logger } from "./logger.js";

const STORAGE_STATE_PATH = join(process.cwd(), ".youtube_auth_state.json");

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

async function withCookiesFile<T>(fn: (cookiesPath: string | undefined) => Promise<T>): Promise<T> {
  if (!existsSync(STORAGE_STATE_PATH)) {
    return fn(undefined);
  }
  const state   = JSON.parse(await readFile(STORAGE_STATE_PATH, "utf-8"));
  const cookies = (state.cookies ?? []) as Array<Record<string, any>>;
  const tmpFile = join(tmpdir(), `yt-cookies-${process.pid}-${Date.now()}.txt`);
  await writeFile(tmpFile, cookiesToNetscape(cookies));
  try {
    return await fn(tmpFile);
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

export type VideoMetaResult = {
  durationSecs: number | null;
  thumbnail: string | null;
  title: string | null;
  error?: string;
};

/** Light metadata via yt-dlp JSON (no full download). */
export async function fetchMetaLight(url: string): Promise<VideoMetaResult> {
  return withCookiesFile(async (cookiesPath) => {
    const info = await ytDlpExec(url, {
      ...(cookiesPath ? { cookies: cookiesPath } : {}),
      dumpSingleJson: true,
      noPlaylist: true,
      noWarnings: true,
    }) as Record<string, any>;

    const rawDuration = parseFloat(String(info.duration ?? "0"));
    return {
      durationSecs: rawDuration > 0 ? Math.floor(rawDuration) : null,
      thumbnail:    (info.thumbnail as string) ?? null,
      title:        (info.title as string) ?? null,
    };
  });
}

/**
 * Heavy fallback: download the video with yt-dlp, ffprobe duration, delete temp file.
 * Used only when light metadata has no duration.
 */
export async function fetchDurationViaDownload(url: string): Promise<VideoMetaResult> {
  const workDir = join(tmpdir(), `choppr-meta-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });
  const outTemplate = join(workDir, "video.%(ext)s");

  try {
    await withCookiesFile(async (cookiesPath) => {
      await ytDlpExec(url, {
        ...(cookiesPath ? { cookies: cookiesPath } : {}),
        output: outTemplate,
        noPlaylist: true,
        noWarnings: true,
        // Prefer a smaller file for probing when possible
        format: "best[height<=720]/bestvideo[height<=720]+bestaudio/best",
        mergeOutputFormat: "mp4",
      });
    });

    const { readdir } = await import("fs/promises");
    const files = await readdir(workDir);
    const videoFile = files.find((f) => /\.(mp4|mkv|webm|mov|m4a)$/i.test(f));
    if (!videoFile) {
      logger.warn("video duration download fallback: no media file in output", {
        url,
        files,
      });
      return {
        durationSecs: null,
        thumbnail: null,
        title: null,
        error: "Unable to get the video.",
      };
    }

    const localPath = join(workDir, videoFile);
    const durationSecs = await probeDurationSecs(localPath, 120_000);
    if (!durationSecs) {
      logger.warn("video duration download fallback: ffprobe returned no duration", {
        url,
        videoFile,
      });
      return {
        durationSecs: null,
        thumbnail: null,
        title: null,
        error: "Unable to get the video.",
      };
    }

    return { durationSecs, thumbnail: null, title: null };
  } catch (err) {
    logger.warn("video duration download fallback failed", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      durationSecs: null,
      thumbnail: null,
      title: null,
      error: "Unable to get the video.",
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
