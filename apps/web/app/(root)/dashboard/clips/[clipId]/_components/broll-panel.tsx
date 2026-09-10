"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import Link from "next/link";
import { Check, Loader2, Sparkles, Trash2, Undo2, Wand2 } from "lucide-react";
import { useApiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { UploadPanel } from "./upload-panel";
import type { CaptionWord } from "./caption-renderer";
import type { TimelineBrollApi } from "./timeline-broll-bridge";
import { DEFAULT_BROLL_DUR, type BrollShot } from "./broll-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const FREE_MAX_MOMENTS = 4;
const FREE_MAX_GENERATES = 2;

type SuggestWindow = {
  start: number;
  end: number;
  phrase: string;
  prompt: string;
};

type GeneratedStill = {
  id: string;
  src: string;
  startTime: number;
  duration: number;
};

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function BrollPanel({
  clipId,
  captionWords,
  aspectRatio,
  brollApiRef,
  shots,
  isFreePlan = false,
  versionKey = "original",
  initialLibrary = [],
  onLibraryChange,
  onDismissSrc,
}: {
  clipId: string;
  captionWords: CaptionWord[];
  aspectRatio: string;
  brollApiRef: MutableRefObject<TimelineBrollApi | null>;
  shots: BrollShot[];
  isFreePlan?: boolean;
  versionKey?: string;
  initialLibrary?: BrollShot[];
  dismissedSrcs?: string[];
  onLibraryChange?: (items: BrollShot[]) => void;
  onDismissSrc?: (src: string) => void;
}) {
  const apiFetch = useApiFetch();
  const [subTab, setSubTab] = useState<"auto" | "media">("auto");
  const [windows, setWindows] = useState<SuggestWindow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [suggesting, setSuggesting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedStill[]>(() =>
    initialLibrary
      .filter(s => s.src)
      .map(s => ({ id: s.id, src: s.src, startTime: s.startTime, duration: s.duration })),
  );
  const [generatesUsed, setGeneratesUsed] = useState(0);
  const restoredRef = useRef(false);
  const suppressLibraryReportRef = useRef(true);

  const generateLimitReached = isFreePlan && generatesUsed >= FREE_MAX_GENERATES;
  const momentCapReached = isFreePlan && selected.size >= FREE_MAX_MOMENTS;

  useEffect(() => {
    suppressLibraryReportRef.current = true;
    setGenerated(
      initialLibrary
        .filter(s => s.src)
        .map(s => ({ id: s.id, src: s.src, startTime: s.startTime, duration: s.duration })),
    );
    // Parent applies this version's library in the same render as versionKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionKey]);

  useEffect(() => {
    setGenerated(prev => {
      if (initialLibrary.length === 0) return prev.length === 0 ? prev : [];
      const seen = new Set(prev.map(g => g.src));
      const extra = initialLibrary
        .filter(s => s.src && !seen.has(s.src))
        .map(s => ({ id: s.id, src: s.src, startTime: s.startTime, duration: s.duration }));
      return extra.length ? [...prev, ...extra] : prev;
    });
  }, [initialLibrary]);

  useEffect(() => {
    if (suppressLibraryReportRef.current) {
      suppressLibraryReportRef.current = false;
      return;
    }
    onLibraryChange?.(generated.map(g => ({
      id: g.id,
      src: g.src,
      startTime: g.startTime,
      duration: g.duration,
      mediaType: "image" as const,
      mode: "cutaway" as const,
      trimIn: 0,
      status: "ready" as const,
    })));
  }, [generated, onLibraryChange]);

  useEffect(() => {
    if (!clipId || restoredRef.current) return;
    restoredRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/clips/${clipId}/broll`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (typeof data.limits?.generatesUsed === "number") {
          setGeneratesUsed(data.limits.generatesUsed);
        }
        // Do not addBroll or merge jobs onto the timeline — that is per-version localStorage.
      } catch {
        /* ignore restore errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, clipId]);

  const runSuggest = useCallback(async () => {
    setError(null);
    setSuggesting(true);
    try {
      const res = await apiFetch(`${API_URL}/api/clips/${clipId}/broll/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aspectRatio }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Could not suggest B-roll");
      const next = (data.windows ?? []) as SuggestWindow[];
      setWindows(next);
      const used = typeof data.limits?.generatesUsed === "number" ? data.limits.generatesUsed : 0;
      setGeneratesUsed(used);
      const pick = isFreePlan ? Math.min(next.length, FREE_MAX_MOMENTS) : next.length;
      setSelected(new Set(next.slice(0, pick).map((_, i) => i)));
      if (next.length === 0) setError("No good B-roll moments in this clip.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suggest failed");
    } finally {
      setSuggesting(false);
    }
  }, [apiFetch, aspectRatio, clipId, isFreePlan]);

  const runGenerate = useCallback(async (toGenerate: SuggestWindow[]) => {
    if (toGenerate.length === 0) return;
    if (isFreePlan && generatesUsed >= FREE_MAX_GENERATES) {
      setError(`Free plan allows ${FREE_MAX_GENERATES} B-roll generations.`);
      return;
    }
    if (isFreePlan && toGenerate.length > FREE_MAX_MOMENTS) {
      setError(`Free plan can generate up to ${FREE_MAX_MOMENTS} moments at a time.`);
      return;
    }
    setError(null);
    setGenerating(true);
    setJobProgress("Starting…");
    try {
      const res = await apiFetch(`${API_URL}/api/clips/${clipId}/broll/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aspectRatio,
          windows: toGenerate.map(w => ({
            start: w.start,
            end: w.end,
            phrase: w.phrase,
            prompt: w.prompt,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        throw new Error(data.message ?? "Not enough credits to generate B-roll");
      }
      if (res.status === 403) {
        if (typeof data.generatesUsed === "number") setGeneratesUsed(data.generatesUsed);
        throw new Error(data.message ?? "Free plan limit reached");
      }
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Generate failed");

      setGeneratesUsed(n => n + 1);
      const jobId = data.jobId as string;
      const started = Date.now();
      while (Date.now() - started < 180_000) {
        await new Promise(r => setTimeout(r, 2500));
        const poll = await apiFetch(`${API_URL}/api/broll/${jobId}`);
        if (!poll.ok) continue;
        const job = await poll.json();
        setJobProgress(job.status === "generating" ? "Generating stills…" : job.status);
        if (job.status === "done" || job.status === "failed") {
          const shotsOut = (job.shots ?? []) as Array<{
            start: number;
            duration: number;
            s3Url?: string;
            prompt?: string;
            phrase?: string;
            status: string;
          }>;
          const added: GeneratedStill[] = [];
          for (const shot of shotsOut) {
            if (shot.status !== "ready" || !shot.s3Url) continue;
            const id = await brollApiRef.current?.addBroll({
              type: "image",
              url: shot.s3Url,
              name: shot.phrase || "AI B-roll",
              startTime: shot.start,
              duration: shot.duration,
              prompt: shot.prompt,
              phrase: shot.phrase,
              source: "canvas",
            });
            added.push({
              id: id ?? `still-${shot.start}-${shot.s3Url}`,
              src: shot.s3Url,
              startTime: shot.start,
              duration: shot.duration,
            });
          }
          if (added.length) {
            setGenerated(prev => {
              const seen = new Set(prev.map(s => s.src));
              return [...prev, ...added.filter(s => !seen.has(s.src))];
            });
          }
          if (job.status === "failed") {
            setError(job.error ?? "Some B-roll shots failed to generate");
          }
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerating(false);
      setJobProgress(null);
    }
  }, [apiFetch, aspectRatio, brollApiRef, clipId, generatesUsed, isFreePlan]);

  const displayStills = useMemo(() => {
    const fromGen = generated.map(g => ({
      ...g,
      onTimeline: shots.some(s => s.id === g.id || s.src === g.src),
    }));
    const extras = shots
      .filter(s => s.src && !fromGen.some(g => g.id === s.id || g.src === s.src))
      .map(s => ({
        id: s.id,
        src: s.src,
        startTime: s.startTime,
        duration: s.duration,
        onTimeline: true,
      }));
    return [...fromGen, ...extras];
  }, [generated, shots]);

  const removeFromTimeline = (still: GeneratedStill) => {
    brollApiRef.current?.removeById(still.id);
    const match = shots.find(s => s.src === still.src && s.id !== still.id);
    if (match) brollApiRef.current?.removeById(match.id);
  };

  const deletePermanently = (still: GeneratedStill) => {
    removeFromTimeline(still);
    setGenerated(prev => prev.filter(g => g.id !== still.id && g.src !== still.src));
    if (still.src) onDismissSrc?.(still.src);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto no-scrollbar px-0.5">
      <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-0.5">
        {(["auto", "media"] as const).map(id => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
              subTab === id ? "bg-white/12 text-white" : "text-white/45 hover:text-white/70",
            )}
          >
            {id === "auto" ? "Auto" : "My media"}
          </button>
        ))}
      </div>

      {subTab === "auto" && (
        <div className="flex min-h-0 flex-col gap-3">
          <p className="text-[12px] text-white/40">AI cutaways. Voice stays.</p>

          {windows.length === 0 && (
            <button
              type="button"
              disabled={suggesting || generating || captionWords.length === 0}
              onClick={() => void runSuggest()}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {suggesting ? "Finding moments…" : "Suggest B-roll"}
            </button>
          )}

          {windows.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="shrink-0 text-[12px] font-medium text-white/70">{windows.length} moments</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={suggesting || generating || captionWords.length === 0}
                    onClick={() => void runSuggest()}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-[#7c3aed] px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {suggesting ? "Finding…" : "Suggest"}
                  </button>
                  {generateLimitReached ? (
                    <a
                      href="/dashboard/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-black"
                    >
                      Upgrade for more
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={generating || selected.size === 0}
                      onClick={() => void runGenerate(windows.filter((_, i) => selected.has(i)))}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                      Generate{selected.size ? ` · ${selected.size} credit${selected.size === 1 ? "" : "s"}` : ""}
                    </button>
                  )}
                </div>
              </div>

              {isFreePlan && momentCapReached && (
                <p className="text-[11px] leading-snug text-white/45">
                  Only 4 can be selected on the free plan.{" "}
                  <Link href="/dashboard/billing" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-white/70 hover:text-white">
                    Upgrade
                  </Link>{" "}
                  for more.
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                {windows.map((w, i) => {
                  const on = selected.has(i);
                  return (
                    <button
                      key={`${w.start}-${i}`}
                      type="button"
                      onClick={() => {
                        setSelected(prev => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i);
                          else if (isFreePlan && next.size >= FREE_MAX_MOMENTS) return prev;
                          else next.add(i);
                          return next;
                        });
                      }}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                        on ? "border-white/20 bg-white/[0.06]" : "border-white/8 bg-transparent hover:bg-white/[0.03]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                          on ? "border-white bg-white" : "border-white/25 bg-transparent",
                        )}
                      >
                        {on && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[10px] tabular-nums text-white/40">
                          {fmt(w.start)} – {fmt(w.end)}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-white/85">
                          {w.phrase || w.prompt}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-white/30">1 credit each</p>
            </div>
          )}

          {(error || jobProgress) && (
            <p className={cn("text-[11px]", error ? "text-red-400" : "text-white/45")}>
              {error ?? jobProgress}
            </p>
          )}

          {(displayStills.length > 0 || generating) && (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-medium text-white/70">Generated</p>
              <div className="grid grid-cols-2 gap-2.5">
                {generating && displayStills.length === 0 && [0, 1, 2].map(i => (
                  <div key={`sk-${i}`} className="flex flex-col gap-1.5">
                    <div className="aspect-[4/3] animate-pulse rounded-lg bg-white/5" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
                  </div>
                ))}
                {displayStills.map(still => (
                  <div key={still.id} className="flex min-w-0 flex-col gap-1.5">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#1a1a22]">
                      <img src={still.src} alt="" className="h-full w-full object-cover" />
                      <div className="absolute right-1.5 top-1.5 flex gap-1">
                        <button
                          type="button"
                          disabled={!still.onTimeline}
                          onClick={() => removeFromTimeline(still)}
                          title="Remove from timeline"
                          aria-label="Remove from timeline"
                          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-black/70 text-white/80 hover:bg-black/85 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Undo2 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePermanently(still)}
                          title="Delete permanently"
                          aria-label="Delete permanently"
                          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-black/70 text-red-300 hover:bg-black/85 hover:text-red-200"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      {!still.onTimeline && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white/70">
                          Off timeline
                        </span>
                      )}
                    </div>
                    <p className="px-0.5 font-mono text-[10px] tabular-nums text-white/40">
                      {fmt(still.startTime)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === "media" && (
        <UploadPanel
          usage="timeline"
          draggable={false}
          title="Add as B-roll"
          onAddToTimeline={asset => {
            if (asset.type === "audio") return;
            void brollApiRef.current?.addBroll({
              type: asset.type,
              url: asset.url,
              name: asset.name,
              duration: DEFAULT_BROLL_DUR,
              source: "upload",
            });
          }}
        />
      )}
    </div>
  );
}
