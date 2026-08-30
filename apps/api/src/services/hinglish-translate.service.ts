import { BedrockRuntimeClient, ConverseCommand, type ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import type { ICaptionWord } from "../model/clip.model.js";
import { logger } from "../utils/logger.js";

const BATCH = 80;

function modelId(): string {
  const id = process.env.MODEL_ID;
  if (!id) throw new Error("MODEL_ID is not set");
  return id;
}

function modelRegion(): string {
  const region = process.env.MODEL_REGION;
  if (!region) throw new Error("MODEL_REGION is not set");
  return region;
}

let client: BedrockRuntimeClient | null = null;

function modelClient(): BedrockRuntimeClient {
  if (client) return client;
  client = new BedrockRuntimeClient({
    region: modelRegion(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

const SYSTEM_PROMPT = `You convert video captions into Hinglish: spoken Hindi (and mixed Hindi-English) written in Latin script.

Rules:
- Romanize Hindi. Never output Devanagari. Example: क्या कर रहे हो → kya kar rahe ho
- Keep English words as English. Example: "this video is amazing" stays English
- Casual spoken register, the way Indians type in chats
- Input is a numbered list. Return ONLY a JSON array of strings — same length, same order
- Do not merge or drop items. If one Hindi word needs multiple romanized tokens, put them all in that same slot
- No markdown, no explanation`;

function extractText(response: ConverseCommandOutput): string {
  const blocks = response.output?.message?.content ?? [];
  return blocks.map((b) => ("text" in b ? b.text : "") ?? "").filter(Boolean).join("\n");
}

function parseWordArray(text: string, expected: number, originals: string[]): string[] {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence?.[1]?.trim() ?? trimmed;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return originals;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return originals;
  }
  if (!Array.isArray(parsed)) return originals;

  const words = parsed.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && typeof (item as { word?: unknown }).word === "string") {
      return (item as { word: string }).word;
    }
    return String(item ?? "");
  });

  if (words.length === expected) return words;
  return originals.map((orig, i) => words[i] || orig);
}

async function translateBatch(words: string[]): Promise<string[]> {
  const numbered = words.map((w, i) => `${i}: ${w}`).join("\n");
  const command = new ConverseCommand({
    modelId: modelId(),
    system: [{ text: SYSTEM_PROMPT }],
    messages: [{
      role: "user",
      content: [{ text: `Convert each numbered caption word to Hinglish. Return a JSON array of ${words.length} strings.\n\n${numbered}` }],
    }],
    inferenceConfig: { maxTokens: 8192 },
    additionalModelRequestFields: { thinking: { type: "disabled" } },
  });

  const response = await modelClient().send(command);
  return parseWordArray(extractText(response), words.length, words);
}

export async function translateCaptionsToHinglish(captions: ICaptionWord[]): Promise<ICaptionWord[]> {
  const translated: ICaptionWord[] = [];

  for (let i = 0; i < captions.length; i += BATCH) {
    const batch = captions.slice(i, i + BATCH);
    const hinglish = await translateBatch(batch.map((w) => w.word));
    batch.forEach((w, idx) => {
      translated.push({ word: hinglish[idx] || w.word, start: w.start, end: w.end });
    });
    logger.info("Hinglish caption batch translated", { offset: i, count: batch.length });
  }

  return translated;
}
