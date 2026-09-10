import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { ICaptionWord } from "../model/clip.model.js";
import { logger } from "../utils/logger.js";

export interface BrollWindow {
  start: number;
  end: number;
  phrase: string;
  prompt: string;
}

function modelId(): string | null {
  return process.env.MODEL_ID?.trim() || null;
}

function modelRegion(): string {
  return process.env.MODEL_REGION?.trim() || "us-east-1";
}

function client(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: modelRegion(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

const SYSTEM = `You plan B-roll cutaways for a talking-head short video.

Return ONLY JSON: {"windows":[{"start":number,"end":number,"phrase":string,"prompt":string}]}

Rules:
- start/end are seconds on the clip timeline (clip-relative, same as the transcript)
- Each window is 2.2–4.0 seconds and lands on phrase boundaries, never mid-word
- Never cover the first 1.5s (hook face) or the last 1.0s (payoff face)
- Cover at most 30% of the clip. Prefer 3–6 windows. Leave ≥1.2s between windows
- Skip greetings, filler, and jokes that only work on the speaker's face
- phrase: the spoken words this visual illustrates
- prompt: a concrete English visual for a still image (subject, setting, lighting, camera). No text-in-image, no logos, no readable writing. Photoreal cinematic B-roll, vertical-friendly composition.
- If the user supplied a target range, only plan inside that range (still obey hook/payoff padding if the range is the full clip)`;

function transcriptBlock(words: ICaptionWord[]): string {
  return words
    .map(w => `[${w.start.toFixed(2)}-${w.end.toFixed(2)}] ${w.word}`)
    .join(" ");
}

function heuristicWindows(
  words: ICaptionWord[],
  duration: number,
  range?: { start: number; end: number; phrase?: string },
): BrollWindow[] {
  const hook = 1.5;
  const tail = 1.0;
  const lo = Math.max(range?.start ?? hook, hook);
  const hi = Math.min(range?.end ?? duration - tail, Math.max(0, duration - tail));
  if (hi - lo < 2.2) {
    if (range && range.end - range.start >= 1.2) {
      const phrase = range.phrase
        || words.filter(w => w.start < range.end && w.end > range.start).map(w => w.word).join(" ");
      return [{
        start: range.start,
        end: Math.min(duration, range.start + Math.max(2.2, range.end - range.start)),
        phrase: phrase || "the topic being discussed",
        prompt: `Cinematic photoreal B-roll illustrating: ${phrase || "the speaker's topic"}. Natural light, shallow depth of field, no text.`,
      }];
    }
    return [];
  }

  const inRange = words.filter(w => w.start >= lo && w.end <= hi);
  const windows: BrollWindow[] = [];
  let i = 0;
  while (i < inRange.length && windows.length < 5) {
    const startWord = inRange[i]!;
    let j = i;
    let end = startWord.end;
    const parts = [startWord.word];
    while (j + 1 < inRange.length) {
      const next = inRange[j + 1]!;
      if (next.end - startWord.start > 3.6) break;
      parts.push(next.word);
      end = next.end;
      j += 1;
      if (end - startWord.start >= 2.4) break;
    }
    const dur = end - startWord.start;
    const lastEnd = windows[windows.length - 1]?.end ?? -10;
    if (dur >= 2.0 && startWord.start - lastEnd >= 1.2) {
      const phrase = parts.join(" ").trim();
      if (phrase.split(/\s+/).length >= 3) {
        windows.push({
          start: startWord.start,
          end,
          phrase,
          prompt: `Cinematic photoreal B-roll illustrating: "${phrase}". Natural light, shallow depth of field, no text or logos.`,
        });
      }
    }
    i = j + 3;
  }

  const covered = windows.reduce((s, w) => s + (w.end - w.start), 0);
  const cap = duration * 0.3;
  if (covered <= cap) return windows;
  const trimmed: BrollWindow[] = [];
  let acc = 0;
  for (const w of windows) {
    const d = w.end - w.start;
    if (acc + d > cap) break;
    trimmed.push(w);
    acc += d;
  }
  return trimmed;
}

function parseWindows(text: string): BrollWindow[] | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { windows?: unknown };
    if (!Array.isArray(parsed.windows)) return null;
    const out: BrollWindow[] = [];
    for (const item of parsed.windows) {
      if (!item || typeof item !== "object") continue;
      const w = item as Record<string, unknown>;
      const s = Number(w.start);
      const e = Number(w.end);
      if (!Number.isFinite(s) || !Number.isFinite(e) || e - s < 1.0) continue;
      out.push({
        start: s,
        end: e,
        phrase: String(w.phrase ?? "").trim(),
        prompt: String(w.prompt ?? "").trim(),
      });
    }
    return out;
  } catch {
    return null;
  }
}

export async function planBrollWindows(params: {
  words: ICaptionWord[];
  duration: number;
  reason?: string;
  range?: { start: number; end: number; phrase?: string };
}): Promise<BrollWindow[]> {
  const { words, duration, reason, range } = params;
  const fallback = () => heuristicWindows(words, duration, range);

  const id = modelId();
  if (!id || words.length === 0) return fallback();

  try {
    const user = [
      `Clip duration: ${duration.toFixed(2)}s`,
      reason ? `Why this clip was chosen: ${reason}` : "",
      range ? `Only plan inside ${range.start.toFixed(2)}–${range.end.toFixed(2)}s. Phrase hint: ${range.phrase ?? ""}` : "Plan for the full clip.",
      "Transcript:",
      transcriptBlock(words),
    ].filter(Boolean).join("\n");

    const response = await client().send(new ConverseCommand({
      modelId: id,
      system: [{ text: SYSTEM }],
      messages: [{ role: "user", content: [{ text: user }] }],
      inferenceConfig: { maxTokens: 2048, temperature: 0.3 },
    }));
    const text = (response.output?.message?.content ?? [])
      .map(b => ("text" in b ? b.text : "") ?? "")
      .join("\n");
    const parsed = parseWindows(text);
    if (parsed && parsed.length > 0) return parsed;
    logger.warn("B-roll planner returned no windows; using heuristic");
    return fallback();
  } catch (err) {
    logger.warn("B-roll planner Bedrock failed; using heuristic", {
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback();
  }
}
