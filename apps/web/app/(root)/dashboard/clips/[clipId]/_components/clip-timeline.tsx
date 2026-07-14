"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  TimelineProvider,
  useTimelineContext,
  VideoElement,
  TrackElement,
  TRACK_TYPES,
  TIMELINE_ACTION,
  type TimelineEditor,
} from "@twick/timeline";
import { LivePlayerProvider, PLAYER_STATE, useLivePlayerContext } from "@twick/live-player";
import {
  TimelineManager,
  PlayerControls,
  useTimelineControl,
  DEFAULT_TIMELINE_TICK_CONFIGS,
  DEFAULT_ELEMENT_COLORS,
  type TimelineZoomConfig,
} from "@twick/video-editor";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildExportTracksFromEditor,
  findPrimaryVideoElement,
  type ChopprTrack,
} from "./timeline-export";
import {
  activeVideoAt,
  resolvePlaybackAt,
  sourceTimeFor,
  urlsMatch,
} from "./timeline-playback";
import { TimelineGapDelete } from "./timeline-gap-delete";
import { TimelineDropFixer } from "./timeline-drop-fixer";
import { TimelinePlayheadBridge } from "./timeline-playhead-bridge";
import { TimelineEmptyTrackRemove } from "./timeline-empty-track-remove";
import {
  TimelineOverlayBridge,
  type TimelineOverlayApi,
  type OverlayTimingItem,
} from "./timeline-overlay-bridge";
import {
  TimelineMediaBridge,
  type TimelineMediaApi,
} from "./timeline-media-bridge";
import { TimelineMediaLengthClamp } from "./timeline-media-length-clamp";
import {
  TimelineCaptionBridge,
  type CaptionTrackApi,
  type CaptionSegment,
} from "./timeline-caption-bridge";

import "@twick/video-editor/dist/video-editor.css";
import "./clip-timeline.css";

/**
 * Extra empty space after content so clips can be dragged right to create gaps.
 * Displayed duration in the controls uses content length only (not this pad).
 */
const TIMELINE_PAD_SEC = 60;

const CLIP_TIMELINE_ELEMENT_COLORS = {
  ...DEFAULT_ELEMENT_COLORS,
  video: "#818cf8",
  audio: "#2dd4bf",
  image: "#c084fc",
  text: "#a78bfa",
  caption: "#a78bfa",
  fragment: "#1a1a1a",
};

const DESKTOP_ZOOM: TimelineZoomConfig = {
  min: 0.1,
  max: 4,
  step: 0.1,
  default: 0.3,
};

const MOBILE_ZOOM: TimelineZoomConfig = {
  min: 0.1,
  max: 2,
  step: 0.1,
  default: 0.3,
};

function aspectToResolution(aspectRatio: string): { width: number; height: number } {
  if (aspectRatio === "16:9") return { width: 1920, height: 1080 };
  if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
  return { width: 1080, height: 1920 };
}

/** Prefer remote URL for filmstrips; blob fetch can hang on CORS/large files. */
async function toTimelineSrc(remoteSrc: string): Promise<string> {
  return remoteSrc;
}

function listVideoElements(editor: TimelineEditor): VideoElement[] {
  const out: VideoElement[] = [];
  for (const track of editor.getTimelineData()?.tracks ?? []) {
    for (const el of track.getElements()) {
      if (el instanceof VideoElement) out.push(el);
    }
  }
  return out;
}

function contentEndSec(editor: TimelineEditor): number {
  let max = 0;
  for (const track of editor.getTimelineData()?.tracks ?? []) {
    for (const el of track.getElements()) {
      max = Math.max(max, el.getEnd());
    }
  }
  return max;
}

function selectionContainsProtected(
  selectedIds: Set<string>,
  protectedId: string,
  editor: TimelineEditor,
): boolean {
  if (selectedIds.has(protectedId)) return true;
  for (const track of editor.getTimelineData()?.tracks ?? []) {
    if (selectedIds.has(track.getId())) {
      if (track.getElements().some(el => el.getId() === protectedId)) return true;
    }
  }
  return false;
}

export interface ClipTimelineProps {
  clipId: string;
  clipLabel: string;
  src: string;
  aspectRatio: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  speed: number;
  muted: boolean;
  isMobile: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onTrimChange: (trimStart: number, trimEnd: number) => void;
  onCurrentTimeChange: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onToggleMute: () => void;
  onExportTracksChange?: (tracks: ChopprTrack[]) => void;
  onTimelineSerialize?: (serializedTracks: unknown[]) => void;
  draftTracks?: unknown[] | null;
  onRegisterToggle?: (toggle: (() => void) | null) => void;
  overlayApiRef?: MutableRefObject<TimelineOverlayApi | null>;
  onOverlayTimingChange?: (items: OverlayTimingItem[]) => void;
  mediaApiRef?: MutableRefObject<TimelineMediaApi | null>;
  captionApiRef?: MutableRefObject<CaptionTrackApi | null>;
  captionWordsRef?: MutableRefObject<import("./caption-renderer").CaptionWord[]>;
  onCaptionSegmentsChange?: (segs: CaptionSegment[]) => void;
}

function ClipTimelineBridge({
  clipId,
  src,
  aspectRatio,
  trimStart,
  trimEnd,
  duration,
  speed,
  muted,
  videoRef,
  onTrimChange,
  onCurrentTimeChange,
  onPlayingChange,
  onExportTracksChange,
  onTimelineSerialize,
  draftTracks,
}: Pick<
  ClipTimelineProps,
  | "clipId"
  | "src"
  | "aspectRatio"
  | "trimStart"
  | "trimEnd"
  | "duration"
  | "speed"
  | "muted"
  | "videoRef"
  | "onTrimChange"
  | "onCurrentTimeChange"
  | "onPlayingChange"
  | "onExportTracksChange"
  | "onTimelineSerialize"
  | "draftTracks"
>) {
  const { changeLog, editor } = useTimelineContext();
  const {
    seekTime,
    currentTime,
    playerState,
    setSeekTime,
    setCurrentTime,
    setPlayerState,
  } = useLivePlayerContext();

  const effectiveTrimEnd = trimEnd > 0 ? trimEnd : duration;
  const syncingRef = useRef(false);
  const initializedRef = useRef(false);
  const lastSrcRef = useRef("");
  const playerStateRef = useRef(playerState);
  playerStateRef.current = playerState;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const seekTimeRef = useRef(seekTime);
  seekTimeRef.current = seekTime;

  const activeElementIdRef = useRef<string | null>(null);
  const videoMetaLoadedRef = useRef(new Set<string>());
  const switchingSrcRef = useRef(false);
  const timelineClockRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameTsRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /** Keep empty space after the last clip so horizontal drag can create gaps. */
  const ensurePadding = useCallback(() => {
    const end = contentEndSec(editor);
    if (end <= 0) return;
    const desired = end + TIMELINE_PAD_SEC;
    const ctx = editor.getContext();
    // Always refresh pad after edits — don't compare against stale totalDuration
    ctx.setTotalDuration(desired);
  }, [editor]);

  // Seed primary clip on first load / source change
  useEffect(() => {
    if (!src || duration <= 0) return;

    let cancelled = false;

    const rebuild = async () => {
      if (lastSrcRef.current === src && initializedRef.current) return;

      syncingRef.current = true;
      try {
        const end = trimEnd > 0 ? trimEnd : duration;
        const len = Math.max(0.1, end - trimStart);
        const resolution = aspectToResolution(aspectRatio);
        // Use remote URL directly — blob fetch was hanging and blocking timeline init
        const timelineSrc = await toTimelineSrc(src);
        if (cancelled) return;

        const existing = editor.getTimelineData()?.tracks ?? [];

        // --- Restore from draft if available ---
        if (draftTracks && Array.isArray(draftTracks) && draftTracks.length > 0 && !initializedRef.current) {
          for (const track of existing) editor.removeTrack(track);
          try {
            editor.loadProject({ tracks: draftTracks as any[], version: 0 });
          } catch (e) {
            console.warn("[ClipTimeline] failed to restore draft, seeding fresh", e);
          }
          editor.refresh();
          lastSrcRef.current = src;
          initializedRef.current = true;
          ensurePadding();
          syncingRef.current = false;
          return;
        }

        // Preserve Text / Stickers tracks across main-clip reseed
        const overlayTracks = existing.filter(
          t => t.getName() === "Text" || t.getName() === "Stickers",
        );
        for (const track of existing) {
          if (track.getName() === "Text" || track.getName() === "Stickers") continue;
          editor.removeTrack(track);
        }

        // ELEMENT track type is required for Twick cross-track drag/drop of clips
        const track = editor.addTrack("Video 1", TRACK_TYPES.ELEMENT);
        const element = new VideoElement(timelineSrc, resolution);
        element.setId(clipId);
        await element.updateVideoMeta();
        element.setName("Main clip");
        element.setStart(0).setEnd(len).setStartAt(trimStart);
        element.setPlaybackRate(speed);
        await editor.addElementToTrack(track, element);

        // Keep overlay tracks above video
        if (overlayTracks.length) {
          const all = editor.getTimelineData()?.tracks ?? [];
          const text = all.filter(t => t.getName() === "Text");
          const stickers = all.filter(t => t.getName() === "Stickers");
          const rest = all.filter(t => t.getName() !== "Text" && t.getName() !== "Stickers");
          editor.reorderTracks([...text, ...stickers, ...rest]);
        }

        editor.refresh();
        lastSrcRef.current = src;
        initializedRef.current = true;
        activeElementIdRef.current = clipId;
        videoMetaLoadedRef.current.add(clipId);
        ensurePadding();

        // Ensure preview shows main clip + paint first frame
        const video = videoRef.current;
        if (video) {
          let same = false;
          try {
            same = new URL(video.currentSrc || video.src, window.location.href).href
              === new URL(src, window.location.href).href;
          } catch {
            same = (video.currentSrc || video.src) === src;
          }
          if (!same) {
            video.src = src;
            video.load();
          }
          const syncFrame = () => {
            if (cancelled || !video) return;
            const target = element.getStartAt();
            video.playbackRate = element.getPlaybackRate() || speed;
            video.muted = muted;
            if (Math.abs(video.currentTime - target) > 0.12) {
              try { video.currentTime = target; } catch { /* ignore */ }
            }
          };
          if (video.readyState >= 2) syncFrame();
          else video.addEventListener("loadeddata", syncFrame, { once: true });
        }
      } catch (err) {
        console.error("[ClipTimeline] failed to seed main clip", err);
        // Still mark initialized so UI isn't stuck forever; user can refresh
        initializedRef.current = true;
        lastSrcRef.current = src;
      } finally {
        syncingRef.current = false;
      }
    };

    void rebuild();
    return () => { cancelled = true; };
    // Only re-seed when the source clip changes — not on every trim drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, duration, editor, clipId, aspectRatio]);

  // Sync primary clip trim length / in-point without resetting its timeline position
  useEffect(() => {
    if (!initializedRef.current || syncingRef.current) return;
    const element = findPrimaryVideoElement(editor, clipId);
    if (!element) return;

    const end = trimEnd > 0 ? trimEnd : duration;
    const len = Math.max(0.1, end - trimStart);
    const timelineStart = element.getStart();
    const currentLen = element.getEnd() - element.getStart();

    if (
      Math.abs(element.getStartAt() - trimStart) < 0.02 &&
      Math.abs(currentLen - len) < 0.02 &&
      Math.abs(element.getPlaybackRate() - speed) < 0.01
    ) {
      return;
    }

    syncingRef.current = true;
    element.setStart(timelineStart).setEnd(timelineStart + len).setStartAt(trimStart);
    element.setPlaybackRate(speed);
    editor.updateElement(element);
    editor.refresh();
    ensurePadding();
    syncingRef.current = false;
  }, [trimStart, trimEnd, duration, editor, clipId, speed, ensurePadding]);

  // Primary clip trim from timeline handles -> parent state (in-point + length only)
  useEffect(() => {
    if (!initializedRef.current || syncingRef.current) return;
    const element = findPrimaryVideoElement(editor, clipId);
    if (!element) return;

    const newTrimStart = element.getStartAt();
    const newTrimEnd = newTrimStart + (element.getEnd() - element.getStart());
    if (
      Math.abs(newTrimStart - trimStart) < 0.02 &&
      Math.abs(newTrimEnd - effectiveTrimEnd) < 0.02
    ) {
      return;
    }

    syncingRef.current = true;
    onTrimChange(newTrimStart, newTrimEnd);
    syncingRef.current = false;
  }, [changeLog, editor, clipId, effectiveTrimEnd, onTrimChange, trimStart]);

  // Push full timeline to parent for export + keep drag padding
  useEffect(() => {
    if (!initializedRef.current) return;
    ensurePadding();
    if (onExportTracksChange) {
      onExportTracksChange(buildExportTracksFromEditor(editor));
    }
    if (onTimelineSerialize) {
      const tracks = editor.getTimelineData()?.tracks ?? [];
      onTimelineSerialize(tracks.map(t => t.serialize()));
    }
  }, [changeLog, editor, onExportTracksChange, onTimelineSerialize, ensurePadding]);

  // Ensure dropped / split clips get filmstrip thumbnails in the timeline.
  useEffect(() => {
    if (!initializedRef.current) return;
    for (const el of listVideoElements(editor)) {
      const id = el.getId();
      if (videoMetaLoadedRef.current.has(id)) continue;
      videoMetaLoadedRef.current.add(id);
      void el.updateVideoMeta().then(() => editor.refresh());
    }
  }, [changeLog, editor]);

  const applyVideoToElement = useCallback(
    async (el: VideoElement, timelineTime: number, shouldPlay: boolean) => {
      const video = videoRef.current;
      if (!video) return;

      const nextSrc = el.getSrc();
      const target = sourceTimeFor(el, timelineTime);
      const switched = activeElementIdRef.current !== el.getId();

      if (switched) {
        switchingSrcRef.current = true;
        activeElementIdRef.current = el.getId();

        const currentSrc = video.currentSrc || video.src || video.getAttribute("src") || "";
        if (!urlsMatch(currentSrc, nextSrc)) {
          video.pause();
          video.src = nextSrc;
          video.load();
          await new Promise<void>(resolve => {
            const onReady = () => {
              video.removeEventListener("loadeddata", onReady);
              video.removeEventListener("error", onReady);
              resolve();
            };
            if (video.readyState >= 2) resolve();
            else {
              video.addEventListener("loadeddata", onReady, { once: true });
              video.addEventListener("error", onReady, { once: true });
              setTimeout(onReady, 4000);
            }
          });
        } else if (Math.abs(video.currentTime - target) > 0.08) {
          try {
            video.currentTime = target;
          } catch {
            /* ignore seek race */
          }
        }
        switchingSrcRef.current = false;
      }

      video.playbackRate = el.getPlaybackRate() || speed;
      video.muted = muted;

      if (Math.abs(video.currentTime - target) > 0.12) {
        try {
          video.currentTime = target;
        } catch {
          /* ignore seek race while loading */
        }
      }

      if (shouldPlay) {
        const playWhenReady = async () => {
          try {
            if (video.readyState < 2) {
              await new Promise<void>(resolve => {
                if (video.readyState >= 2) {
                  resolve();
                  return;
                }
                const done = () => {
                  video.removeEventListener("loadeddata", done);
                  video.removeEventListener("canplay", done);
                  resolve();
                };
                video.addEventListener("loadeddata", done, { once: true });
                video.addEventListener("canplay", done, { once: true });
                window.setTimeout(done, 800);
              });
            }
            if (video.paused) {
              await video.play();
            }
          } catch {
            setPlayerState(PLAYER_STATE.PAUSED);
          }
        };
        void playWhenReady();
      } else if (!video.paused) {
        video.pause();
      }
    },
    [muted, setPlayerState, speed, videoRef],
  );

  const applyVideoRef = useRef(applyVideoToElement);
  applyVideoRef.current = applyVideoToElement;

  const reportTime = useCallback(
    (timelineTime: number, active: VideoElement | null) => {
      if (active && active.getId() === clipId) {
        onCurrentTimeChange(sourceTimeFor(active, timelineTime));
      } else {
        onCurrentTimeChange(timelineTime);
      }
    },
    [clipId, onCurrentTimeChange],
  );
  const reportTimeRef = useRef(reportTime);
  reportTimeRef.current = reportTime;

  const lastSeekHandledRef = useRef<{ seek: number; state: string }>({
    seek: -1,
    state: "",
  });
  const seekGestureRef = useRef(false);

  // Freeze the play clock while the user is interacting with the seek track
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest?.(".clip-timeline-shell .twick-seek-track")) return;
      seekGestureRef.current = true;
    };
    const onUp = () => {
      if (!seekGestureRef.current) return;
      // Keep frozen briefly so onSeek can commit before the clock resumes
      window.setTimeout(() => {
        seekGestureRef.current = false;
      }, 0);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, []);

  // Play / pause — timeline clock drives preview across all clips
  useEffect(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameTsRef.current = null;

    if (playerState !== PLAYER_STATE.PLAYING) {
      videoRef.current?.pause();
      onPlayingChange(false);
      return;
    }

    onPlayingChange(true);

    let startAt = Math.max(0, currentTimeRef.current);
    const videos0 = listVideoElements(editor);
    const resolved0 = resolvePlaybackAt(videos0, startAt, true);
    startAt = resolved0.time;
    let active0 = resolved0.active;

    timelineClockRef.current = startAt;
    if (resolved0.active !== activeVideoAt(videos0, currentTimeRef.current)) {
      setCurrentTime(startAt);
      setSeekTime(startAt);
    }

    if (active0) void applyVideoRef.current(active0, startAt, true);
    else videoRef.current?.pause();
    reportTimeRef.current(startAt, active0);

    const tick = (ts: number) => {
      if (playerStateRef.current !== PLAYER_STATE.PLAYING) return;
      if (switchingSrcRef.current || seekGestureRef.current) {
        lastFrameTsRef.current = ts;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (lastFrameTsRef.current == null) lastFrameTsRef.current = ts;
      const dt = Math.min(0.08, (ts - lastFrameTsRef.current) / 1000);
      lastFrameTsRef.current = ts;

      const end = Math.max(contentEndSec(editor), 0.1);
      let next = timelineClockRef.current + dt;
      if (next >= end - 0.02) {
        timelineClockRef.current = 0;
        setCurrentTime(0);
        setSeekTime(0);
        setPlayerState(PLAYER_STATE.PAUSED);
        const first = resolvePlaybackAt(listVideoElements(editor), 0, false).active;
        if (first) void applyVideoRef.current(first, 0, false);
        else videoRef.current?.pause();
        reportTimeRef.current(0, first);
        onPlayingChange(false);
        return;
      }

      const videos = listVideoElements(editor);
      const resolved = resolvePlaybackAt(videos, next, true);
      if (resolved.time !== next) {
        next = resolved.time;
      }

      timelineClockRef.current = next;
      // Only advance currentTime during playback — seekTime is reserved for user gestures
      // so timeline clicks aren't immediately overwritten by the next clock tick.
      setCurrentTime(next);

      const active = resolved.active;
      if (active) void applyVideoRef.current(active, next, true);
      else videoRef.current?.pause();
      reportTimeRef.current(next, active);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // Only restart the clock when play state flips — not on every seekTime tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState]);

  // Scrub / seek: works while paused AND while playing (jump playhead mid-playback)
  useEffect(() => {
    if (!initializedRef.current) return;

    const playing = playerState === PLAYER_STATE.PLAYING;
    const seekChanged =
      Math.abs(seekTime - lastSeekHandledRef.current.seek) > 0.001;
    const stateChanged = playerState !== lastSeekHandledRef.current.state;

    // While playing, only react to an explicit user seek — not changeLog-only re-runs
    // which would snap the playhead back to a stale seekTime.
    if (playing && !seekChanged && !stateChanged) return;

    lastSeekHandledRef.current = { seek: seekTime, state: playerState };

    const t = Math.max(0, seekTimeRef.current);
    const videos = listVideoElements(editor);
    const resolved = resolvePlaybackAt(videos, t, playing);
    const seekTo = resolved.time;
    const active = resolved.active;

    timelineClockRef.current = seekTo;
    if (playing) lastFrameTsRef.current = null;

    if (Math.abs(seekTo - t) > 0.02) {
      lastSeekHandledRef.current.seek = seekTo;
      setSeekTime(seekTo);
      setCurrentTime(seekTo);
    } else if (playing) {
      setCurrentTime(seekTo);
    }

    if (active) void applyVideoToElement(active, seekTo, playing);
    else videoRef.current?.pause();
    reportTime(seekTo, active);
  }, [
    seekTime,
    playerState,
    editor,
    applyVideoToElement,
    reportTime,
    videoRef,
    changeLog,
    setSeekTime,
    setCurrentTime,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted, videoRef]);

  return null;
}

/** Mount Twick zoom controls into the edit toolbar row (desktop only).
 *  On mobile, leaving zoom as its own flex child avoids overlapping playback. */
function useMountTimelineToolbarZoom(enabled: boolean) {
  useEffect(() => {
    const controls = document.querySelector(
      ".clip-timeline-shell .clip-timeline-player-controls",
    ) as HTMLElement | null;
    const edit = document.querySelector(
      ".clip-timeline-shell .clip-timeline-player-controls .edit-controls",
    );
    const zoom = document.querySelector(
      ".clip-timeline-shell .clip-timeline-player-controls .twick-track-zoom-container",
    ) as HTMLElement | null;

    if (!enabled) {
      // Put zoom back under player-controls so mobile CSS can lay it out cleanly
      if (controls && zoom && zoom.parentElement !== controls) {
        controls.appendChild(zoom);
      }
      return;
    }

    const attach = () => {
      const editEl = document.querySelector(
        ".clip-timeline-shell .clip-timeline-player-controls .edit-controls",
      );
      const zoomEl = document.querySelector(
        ".clip-timeline-shell .clip-timeline-player-controls .twick-track-zoom-container",
      );
      if (editEl && zoomEl && zoomEl.parentElement !== editEl) {
        editEl.appendChild(zoomEl);
      }
    };

    attach();
    const t = window.setTimeout(attach, 0);

    const observer =
      typeof MutationObserver !== "undefined" && controls
        ? new MutationObserver(attach)
        : null;
    if (controls && observer) observer.observe(controls, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(t);
      observer?.disconnect();
    };
  }, [enabled]);
}

function ClipTimelineControls({
  zoomConfig,
  trackZoom,
  setTrackZoom,
  muted,
  speed,
  protectedClipId,
  onToggleMute,
  onRegisterToggle,
  isMobile = false,
}: {
  zoomConfig: TimelineZoomConfig;
  trackZoom: number;
  setTrackZoom: (z: number) => void;
  muted: boolean;
  speed: number;
  protectedClipId: string;
  onToggleMute: () => void;
  onRegisterToggle?: (toggle: (() => void) | null) => void;
  isMobile?: boolean;
}) {
  const {
    currentTime,
    playerState,
    setSeekTime,
    setCurrentTime,
    setPlayerState,
  } = useLivePlayerContext();
  const {
    canRedo,
    canUndo,
    selectedItem,
    selectedIds,
    followPlayheadEnabled,
    setFollowPlayheadEnabled,
    present,
    setTimelineAction,
    editor,
    changeLog,
  } = useTimelineContext();
  const { deleteItem, splitElement, handleUndo, handleRedo } = useTimelineControl();

  useMountTimelineToolbarZoom(!isMobile);

  // Actual content length (last clip end) — not the padded totalDuration used for drag space
  const contentDuration = useMemo(() => {
    const end = contentEndSec(editor);
    return Math.max(end, 0.1);
  }, [editor, changeLog]);

  const displayCurrent = Math.min(currentTime, contentDuration);

  const togglePlayback = useCallback(() => {
    if (playerState === PLAYER_STATE.PLAYING) {
      setPlayerState(PLAYER_STATE.PAUSED);
      return;
    }
    setSeekTime(displayCurrent);
    setTimelineAction(TIMELINE_ACTION.UPDATE_PLAYER_DATA, present);
    setPlayerState(PLAYER_STATE.PLAYING);
  }, [playerState, displayCurrent, present, setPlayerState, setSeekTime, setTimelineAction]);

  useEffect(() => {
    onRegisterToggle?.(togglePlayback);
    return () => onRegisterToggle?.(null);
  }, [onRegisterToggle, togglePlayback]);

  const handleSeek = useCallback(
    (time: number) => {
      // Seek within content only (ignore empty pad)
      const clamped = Math.max(0, Math.min(contentDuration, time));
      setCurrentTime(clamped);
      setSeekTime(clamped);
    },
    [setCurrentTime, setSeekTime, contentDuration],
  );

  const handleDelete = useCallback(() => {
    if (selectionContainsProtected(selectedIds, protectedClipId, editor)) {
      // Delete everything selected except the protected main clip
      const toRemove: string[] = [];
      for (const id of selectedIds) {
        if (id === protectedClipId) continue;
        const tracks = editor.getTimelineData()?.tracks ?? [];
        const isTrack = tracks.some(t => t.getId() === id);
        if (isTrack) {
          const track = tracks.find(t => t.getId() === id);
          if (!track) continue;
          // Don't remove a track that still holds the main clip
          if (track.getElements().some(el => el.getId() === protectedClipId)) {
            for (const el of track.getElements()) {
              if (el.getId() !== protectedClipId) toRemove.push(el.getId());
            }
            continue;
          }
          editor.removeTrack(track);
          continue;
        }
        toRemove.push(id);
      }
      if (toRemove.length) {
        editor.removeElements(toRemove);
        editor.refresh();
      }
      return;
    }
    deleteItem();
  }, [selectedIds, protectedClipId, editor, deleteItem]);

  // Block Delete/Backspace from removing the main clip via keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable) return;
      if (selectedIds.size === 0) return;
      e.preventDefault();
      e.stopPropagation();
      handleDelete();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [selectedIds, protectedClipId, editor, handleDelete]);

  const canDeleteSelection =
    selectedIds.size > 0 &&
    !(selectedIds.size === 1 && selectedIds.has(protectedClipId));

  return (
    <div className="clip-timeline-controls-wrap">
      <div className="clip-timeline-controls-row">
        <button
          type="button"
          onClick={onToggleMute}
          className="clip-timeline-mute-btn"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <PlayerControls
          className="clip-timeline-player-controls"
          selectedItem={selectedItem}
          selectedIds={canDeleteSelection ? selectedIds : new Set()}
          duration={contentDuration}
          currentTime={displayCurrent}
          playerState={playerState}
          togglePlayback={togglePlayback}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onDelete={handleDelete}
          onSplit={(item, splitTime) => {
            if (item instanceof TrackElement && item.getId() === protectedClipId) {
              // Allow split of main clip (creates a second piece) — both keep editing
              splitElement(item, splitTime);
              return;
            }
            splitElement(item, splitTime);
          }}
          zoomLevel={trackZoom}
          setZoomLevel={setTrackZoom}
          zoomConfig={zoomConfig}
          onSeek={handleSeek}
          followPlayheadEnabled={followPlayheadEnabled}
          onFollowPlayheadToggle={() => setFollowPlayheadEnabled(!followPlayheadEnabled)}
        />
        {speed !== 1 && (
          <span className="clip-timeline-speed-badge">{speed}×</span>
        )}
      </div>
      <TimelineManager
        trackZoom={trackZoom}
        timelineTickConfigs={DEFAULT_TIMELINE_TICK_CONFIGS}
        elementColors={CLIP_TIMELINE_ELEMENT_COLORS}
      />
      <TimelinePlayheadBridge />
      <TimelineDropFixer trackZoom={trackZoom} />
      <TimelineGapDelete trackZoom={trackZoom} />
      <TimelineEmptyTrackRemove />
    </div>
  );
}

function ClipTimelineInner(props: ClipTimelineProps) {
  const zoomConfig = props.isMobile ? MOBILE_ZOOM : DESKTOP_ZOOM;
  const [trackZoom, setTrackZoom] = useState(zoomConfig.default);
  const [externalDragging, setExternalDragging] = useState(false);

  useEffect(() => {
    const onStart = () => setExternalDragging(true);
    const onEnd = () => setExternalDragging(false);
    document.body.addEventListener("dragstart", onStart);
    window.addEventListener("dragend", onEnd);
    window.addEventListener("drop", onEnd);
    return () => {
      document.body.removeEventListener("dragstart", onStart);
      window.removeEventListener("dragend", onEnd);
      window.removeEventListener("drop", onEnd);
    };
  }, []);

  return (
    <div className={cn(
      "clip-timeline-shell",
      props.isMobile && "is-mobile",
      externalDragging && "is-external-dragging",
    )}>
      <ClipTimelineBridge
        clipId={props.clipId}
        src={props.src}
        aspectRatio={props.aspectRatio}
        trimStart={props.trimStart}
        trimEnd={props.trimEnd}
        duration={props.duration}
        speed={props.speed}
        muted={props.muted}
        videoRef={props.videoRef}
        onTrimChange={props.onTrimChange}
        onCurrentTimeChange={props.onCurrentTimeChange}
        onPlayingChange={props.onPlayingChange}
        onExportTracksChange={props.onExportTracksChange}
        onTimelineSerialize={props.onTimelineSerialize}
        draftTracks={props.draftTracks}
      />
      {props.overlayApiRef && (
        <TimelineOverlayBridge
          apiRef={props.overlayApiRef}
          onOverlayTimingChange={props.onOverlayTimingChange}
        />
      )}
      {props.mediaApiRef && (
        <TimelineMediaBridge apiRef={props.mediaApiRef} />
      )}
      <TimelineMediaLengthClamp />
      {props.captionApiRef && props.captionWordsRef && (
        <TimelineCaptionBridge
          apiRef={props.captionApiRef}
          wordsRef={props.captionWordsRef}
          onSegmentsChange={props.onCaptionSegmentsChange ?? (() => {})}
        />
      )}
      <div className="twick-editor-timeline-section clip-timeline-section">
        <ClipTimelineControls
          zoomConfig={zoomConfig}
          trackZoom={trackZoom}
          setTrackZoom={setTrackZoom}
          muted={props.muted}
          speed={props.speed}
          protectedClipId={props.clipId}
          onToggleMute={props.onToggleMute}
          onRegisterToggle={props.onRegisterToggle}
          isMobile={props.isMobile}
        />
      </div>
    </div>
  );
}

export type { TimelineOverlayApi, OverlayTimingItem, TimelineMediaApi, CaptionTrackApi, CaptionSegment };

export default function ClipTimeline(props: ClipTimelineProps) {
  const resolution = useMemo(
    () => aspectToResolution(props.aspectRatio),
    [props.aspectRatio],
  );

  return (
    <LivePlayerProvider>
      <TimelineProvider
        key={`${props.clipId}-${props.src}`}
        contextId={`clip-timeline-${props.clipId}`}
        resolution={resolution}
        initialData={{ tracks: [], version: 0 }}
        analytics={{ enabled: false }}
      >
        <ClipTimelineInner {...props} />
      </TimelineProvider>
    </LivePlayerProvider>
  );
}

export type { ChopprTrack };
