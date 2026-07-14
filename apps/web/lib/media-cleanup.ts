"use client";

/**
 * Global video element lifecycle manager.
 *
 * Chrome caps WebMediaPlayers at ~75 per tab. Hitting the limit yields:
 *   [Intervention] Blocked attempt to create a WebMediaPlayer…
 *
 * Root causes we handle:
 * 1. @twick/timeline getVideoMeta() creates detached <video> elements and never
 *    releases them (clear src + load()).
 * 2. @twick/video-editor filmstrip cleanup removes nodes from the DOM but does
 *    NOT clear src/load — WebMediaPlayer slots stay occupied.
 * 3. Aggressive pruning of in-DOM offscreen (left:-9999) videos fights Twick and
 *    causes recreate storms (tens of thousands of interventions).
 *
 * Strategy: track every createElement("video"), dispose only true leaks
 * (detached / abandoned), never touch live in-DOM filmstrip extractors while
 * the timeline is mounted.
 */

const VIDEO_BUDGET = 35;
const CLEANUP_INTERVAL_MS = 5_000;
/** Don't dispose metadata probes until they've been idle this long — avoids racing getVideoMeta. */
const PROBE_GRACE_MS = 4_000;

const tracked = new Set<HTMLVideoElement>();
const probeReadyAt = new WeakMap<HTMLVideoElement, number>();
let trackingInstalled = false;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function isVideoTag(tagName: string): boolean {
  return String(tagName).toLowerCase() === "video";
}

/**
 * Monkey-patch document.createElement so we can find detached <video> nodes
 * that querySelectorAll cannot see (they still hold WebMediaPlayer slots).
 */
export function installVideoTracking() {
  if (trackingInstalled || typeof document === "undefined") return;
  trackingInstalled = true;

  const original = document.createElement.bind(document);
  document.createElement = function createElementPatched(
    tagName: string,
    options?: ElementCreationOptions,
  ): HTMLElement {
    const el = original(tagName, options);
    if (isVideoTag(tagName)) {
      tracked.add(el as HTMLVideoElement);
    }
    return el;
  } as typeof document.createElement;
}

/**
 * Release a WebMediaPlayer slot. Chrome requires clear src + load().
 */
function disposeVideo(video: HTMLVideoElement) {
  try {
    video.pause();
  } catch { /* ignore */ }
  try {
    video.removeAttribute("src");
    // srcObject clears MediaStream-backed players
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (video as any).srcObject = null;
    video.load();
  } catch { /* ignore */ }
  try {
    video.remove();
  } catch { /* ignore */ }
  tracked.delete(video);
}

function isProtected(video: HTMLVideoElement): boolean {
  return video.dataset.keep === "1" || video.dataset.keep === "true";
}

function isLiveOffscreenExtractor(video: HTMLVideoElement): boolean {
  if (!document.contains(video)) return false;
  const style = video.getAttribute("style") ?? "";
  return style.includes("left: -9999") || style.includes("left:-9999");
}

/**
 * Count tracked video elements (including detached).
 */
export function countVideoElements(): number {
  return tracked.size;
}

/**
 * Dispose abandoned / leaked players. Safe to call anytime.
 * Never touches:
 * - data-keep videos (main preview)
 * - in-DOM Twick filmstrip extractors (left:-9999) while they are still mounted
 */
export function pruneVideoElements(budget = VIDEO_BUDGET) {
  // Drop GC'd entries
  for (const v of [...tracked]) {
    // HTMLVideoElement with no owner — rare; still try dispose
    if (!v || typeof v.pause !== "function") {
      tracked.delete(v);
    }
  }

  // 1) Always free metadata-probe leaks (getVideoMeta / duration readers).
  //    These are detached, preload=metadata|none, and abandoned after load.
  //    Wait PROBE_GRACE_MS after metadata is ready so in-flight getVideoMeta
  //    handlers can read width/height/duration before we kill the element.
  const now = Date.now();
  for (const v of [...tracked]) {
    if (isProtected(v)) continue;
    if (document.contains(v)) continue;
    if (v.seeking || !v.paused) continue;

    const preload = v.preload;
    const isProbe = preload === "metadata" || preload === "none";
    if (!isProbe) continue;

    const hasMetaOrFailed = v.readyState >= 1 || !!v.error || !v.getAttribute("src");
    if (!hasMetaOrFailed) continue;

    if (!probeReadyAt.has(v)) probeReadyAt.set(v, now);
    if (now - (probeReadyAt.get(v) ?? now) < PROBE_GRACE_MS) continue;

    disposeVideo(v);
  }

  // 2) Free detached leftovers from Twick's incomplete cleanup (removed from DOM
  //    but src never cleared). Only when over budget, and never while playing.
  if (tracked.size <= budget) return;

  const detachedPaused = [...tracked].filter(
    (v) =>
      !isProtected(v) &&
      !document.contains(v) &&
      v.paused &&
      !v.seeking,
  );

  for (const v of detachedPaused) {
    if (tracked.size <= budget) break;
    disposeVideo(v);
  }

  // 3) Last resort: if STILL over budget, dispose oldest live offscreen
  //    extractors. Prefer not to — only when the tab is about to die.
  if (tracked.size <= budget * 1.5) return;

  const extractors = [...tracked].filter(
    (v) => !isProtected(v) && isLiveOffscreenExtractor(v) && v.paused,
  );
  for (const v of extractors) {
    if (tracked.size <= budget) break;
    disposeVideo(v);
  }
}

/**
 * On route change: free detached leaks only. Do NOT wipe live filmstrip
 * extractors — the new page may still be mounting the timeline.
 */
export function flushMediaElements() {
  pruneVideoElements(VIDEO_BUDGET);
}

/**
 * Hard cleanup when leaving the clip editor — releases filmstrip extractors too.
 */
export function disposeOffscreenExtractors() {
  for (const v of [...tracked]) {
    if (isProtected(v)) continue;
    if (isLiveOffscreenExtractor(v) || !document.contains(v)) {
      disposeVideo(v);
    }
  }
  // Also catch any untracked offscreen nodes still in the body
  document.querySelectorAll("video").forEach((node) => {
    const v = node as HTMLVideoElement;
    if (isProtected(v)) return;
    if (isLiveOffscreenExtractor(v)) disposeVideo(v);
  });
}

export function startMediaCleanup() {
  if (typeof window === "undefined") return;
  installVideoTracking();
  // Adopt any videos created before the patch was installed
  document.querySelectorAll("video").forEach((node) => {
    tracked.add(node as HTMLVideoElement);
  });
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    pruneVideoElements();
  }, CLEANUP_INTERVAL_MS);
  // Delay first prune so timeline seed / getVideoMeta can finish
  window.setTimeout(() => pruneVideoElements(), PROBE_GRACE_MS);
}

export function stopMediaCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
