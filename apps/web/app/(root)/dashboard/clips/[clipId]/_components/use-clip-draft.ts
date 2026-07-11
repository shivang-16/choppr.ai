"use client";

import { useCallback, useEffect, useRef } from "react";

const DRAFT_PREFIX = "choppr-draft:";
const SAVE_DEBOUNCE_MS = 2000;

export interface ClipDraftState {
  version: 2;
  savedAt: number;
  captionStyle: string;
  captionWords: unknown[];
  captionFontSize: number;
  captionPosX: number;
  captionPosY: number;
  speed: number;
  trimStart: number;
  trimEnd: number;
  brightness: number;
  contrast: number;
  saturation: number;
  textOverlays: unknown[];
  placedStickers: unknown[];
  aspectRatio: string;
  thumbnailOverlay: unknown | null;
  /** Serialized Twick timeline tracks (via track.serialize()) */
  timelineTracks: unknown[] | null;
}

function storageKey(clipId: string) {
  return `${DRAFT_PREFIX}${clipId}`;
}

function safeParse(raw: string | null): ClipDraftState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.version === 2) return data as ClipDraftState;
    return null;
  } catch {
    return null;
  }
}

/**
 * Load a previously saved draft from localStorage.
 * Returns null if no draft exists or it's corrupted.
 */
export function loadClipDraft(clipId: string): ClipDraftState | null {
  if (typeof window === "undefined") return null;
  try {
    return safeParse(localStorage.getItem(storageKey(clipId)));
  } catch {
    return null;
  }
}

/** Delete a draft (e.g. after successful export). */
export function clearClipDraft(clipId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(clipId));
  } catch { /* noop */ }
}

/**
 * Hook: auto-saves clip editing state to localStorage.
 * Call `saveDraft(state)` whenever state changes — it debounces internally.
 */
export function useClipDraftAutosave(clipId: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<Partial<ClipDraftState> | null>(null);

  const flush = useCallback(() => {
    if (!latestRef.current || !clipId) return;
    try {
      const payload: ClipDraftState = {
        version: 2,
        savedAt: Date.now(),
        captionStyle: "none",
        captionWords: [],
        captionFontSize: 50,
        captionPosX: 0,
        captionPosY: 0,
        speed: 1,
        trimStart: 0,
        trimEnd: 0,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        textOverlays: [],
        placedStickers: [],
        aspectRatio: "9:16",
        thumbnailOverlay: null,
        timelineTracks: null,
        ...latestRef.current,
      };
      localStorage.setItem(storageKey(clipId), JSON.stringify(payload));
    } catch { /* quota exceeded — ignore */ }
  }, [clipId]);

  const saveDraft = useCallback((state: Partial<ClipDraftState>) => {
    latestRef.current = { ...latestRef.current, ...state };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [flush]);

  // Flush on unmount / page hide
  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisChange);
    window.addEventListener("beforeunload", flush);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      flush();
      document.removeEventListener("visibilitychange", onVisChange);
      window.removeEventListener("beforeunload", flush);
    };
  }, [flush]);

  return { saveDraft, flush };
}
