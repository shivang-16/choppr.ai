import type { CaptionWord } from "./caption-renderer";

const PREFIX = "choppr-translate:";

interface TranslateCache {
  version: 1;
  sourceSig: string;
  langs: Record<string, CaptionWord[]>;
}

function storageKey(clipId: string) {
  return `${PREFIX}${clipId}`;
}

/** Cheap fingerprint so a re-transcribe invalidates cached translations. */
export function captionSourceSig(words: CaptionWord[]): string {
  if (!words.length) return "0";
  const first = words[0]!;
  const last = words[words.length - 1]!;
  return `${words.length}:${first.word}:${last.word}:${Math.round(first.start * 100)}:${Math.round(last.end * 100)}`;
}

function readCache(clipId: string): TranslateCache | null {
  if (typeof window === "undefined" || !clipId) return null;
  try {
    const raw = localStorage.getItem(storageKey(clipId));
    if (!raw) return null;
    const data = JSON.parse(raw) as TranslateCache;
    if (data?.version !== 1 || !data.langs) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(clipId: string, cache: TranslateCache) {
  if (typeof window === "undefined" || !clipId) return;
  try {
    localStorage.setItem(storageKey(clipId), JSON.stringify(cache));
  } catch {
    /* quota — ignore */
  }
}

export function loadCachedTranslation(
  clipId: string,
  lang: string,
  sourceWords: CaptionWord[],
): CaptionWord[] | null {
  const cache = readCache(clipId);
  if (!cache) return null;
  if (cache.sourceSig !== captionSourceSig(sourceWords)) return null;
  const words = cache.langs[lang];
  return words?.length ? words : null;
}

export function saveCachedTranslation(
  clipId: string,
  lang: string,
  sourceWords: CaptionWord[],
  captions: CaptionWord[],
) {
  if (!clipId || !lang || !captions.length) return;
  const sig = captionSourceSig(sourceWords);
  const prev = readCache(clipId);
  const langs = prev?.sourceSig === sig ? { ...prev.langs } : {};
  langs[lang] = captions;
  writeCache(clipId, { version: 1, sourceSig: sig, langs });
}
