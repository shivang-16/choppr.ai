import { Request, Response, NextFunction } from "express";
import { Clip } from "../model/clip.model.js";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";

const translate = new TranslateClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// ── GET /api/clips/:clipId/captions ─────────────────────────────────────────
export async function getClipCaptions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id;
    const clip   = await Clip.findById(req.params.clipId).lean();
    if (!clip)                  { res.status(404).json({ error: "Not found" });  return; }
    if (clip.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
    res.json({ captions: clip.captions ?? [], lang: clip.captionLang ?? "" });
  } catch (err) { next(err); }
}

// ── GET /api/clips/:clipId/captions/translate/:lang ──────────────────────────
export async function translateClipCaptions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId     = (req as any).user?._id;
    const targetLang = String(req.params.lang);
    const clip       = await Clip.findById(req.params.clipId).lean();
    if (!clip)                  { res.status(404).json({ error: "Not found" });  return; }
    if (clip.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (!clip.captions?.length) { res.json({ captions: [], lang: targetLang }); return; }

    const sourceLang = (clip.captionLang ?? "auto").split("-")[0] ?? "auto";
    const BATCH = 100;
    const words  = clip.captions;
    const translated: typeof words = [];

    for (let i = 0; i < words.length; i += BATCH) {
      const batch = words.slice(i, i + BATCH);
      const text  = batch.map(w => w.word).join("\n");
      const cmd   = new TranslateTextCommand({
        Text:               text,
        SourceLanguageCode: sourceLang,
        TargetLanguageCode: targetLang,
      });
      const result         = await translate.send(cmd);
      const translatedWords = (result.TranslatedText ?? "").split("\n");
      batch.forEach((w, idx) => {
        translated.push({ word: translatedWords[idx] ?? w.word, start: w.start, end: w.end });
      });
    }
    res.json({ captions: translated, lang: targetLang });
  } catch (err) { next(err); }
}
