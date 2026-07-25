import { spawn } from "child_process";
import { logger } from "./logger.js";

/**
 * Probe media duration in seconds via ffprobe.
 * Accepts a local file path or an http(s) URL (e.g. S3 presigned GET).
 */
export function probeDurationSecs(input: string, timeoutMs = 60_000): Promise<number | null> {
  return new Promise((resolve) => {
    const args = [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      input,
    ];

    const p = spawn("ffprobe", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      logger.warn("ffprobe timed out", { input: input.slice(0, 120) });
      finish(null);
    }, timeoutMs);

    p.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    p.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    p.on("error", (err) => {
      logger.warn("ffprobe spawn failed", { error: err.message });
      finish(null);
    });

    p.on("close", (code) => {
      if (code !== 0) {
        logger.warn("ffprobe exited non-zero", {
          code,
          stderr: stderr.slice(0, 300),
          input: input.slice(0, 120),
        });
        finish(null);
        return;
      }
      const raw = parseFloat(stdout.trim());
      if (!Number.isFinite(raw) || raw <= 0) {
        finish(null);
        return;
      }
      finish(Math.floor(raw));
    });
  });
}
