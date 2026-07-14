"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useApiFetch } from "@/lib/apiFetch";
import { Loader2, CheckCircle, XCircle, Volume2, VolumeX, Download } from "lucide-react";
import Sidebar from "../../_components/sidebar";
import Topbar from "../../_components/topbar";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STATUS_LABELS: Record<string, string> = {
  pending:      "Queued…",
  downloading:  "Downloading video…",
  transcribing: "Transcribing audio…",
  analyzing:    "Analyzing viral moments…",
  clipping:     "Cutting clips…",
  done:         "Done!",
  failed:       "Failed",
};

const STATUS_PROGRESS: Record<string, number> = {
  pending:      5,
  downloading:  20,
  transcribing: 45,
  analyzing:    70,
  clipping:     90,
  done:         100,
  failed:       100,
};

// ── Individual clip card with hover-to-play ───────────────────────────────
function ClipCard({ clip }: { clip: any }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const [muted, setMuted] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hovered) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [hovered]);

  // Release video resources on unmount
  useEffect(() => {
    return () => {
      const v = videoRef.current;
      if (v) {
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
    };
  }, []);

  return (
    <div
      className="group relative aspect-[9/16] rounded-2xl overflow-hidden border border-white/10 bg-[#111] hover:border-white/25 transition-all duration-200 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMuted(true); }}
    >
      {/* Video element — always mounted so it loads fast on hover */}
      <video
        ref={videoRef}
        src={clip.s3Url}
        muted={muted}
        loop
        playsInline
        preload="none"
        onLoadedData={() => setLoaded(true)}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Loading shimmer before video loads */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-b from-white/4 to-transparent animate-pulse" />
      )}

      {/* Dark overlay when not hovered */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${hovered ? "opacity-0" : "opacity-100"}`}
      />

      {/* Controls bar — shown on hover */}
      <div
        className={`absolute top-2 right-2 flex items-center gap-1.5 transition-opacity duration-150 ${hovered ? "opacity-100" : "opacity-0"}`}
      >
        {/* Mute toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/80 hover:text-white transition-colors"
        >
          {muted
            ? <VolumeX className="h-3.5 w-3.5" />
            : <Volume2 className="h-3.5 w-3.5" />
          }
        </button>

        {/* Download */}
        <a
          href={clip.s3Url}
          download
          onClick={(e) => e.stopPropagation()}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/80 hover:text-white transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Bottom score bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pt-6 pb-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[8px] uppercase tracking-widest text-white/40">Score</span>
          <span className="text-[14px] font-bold text-white">{clip.score}</span>
        </div>
        {clip.reason && (
          <p className={`text-[10px] text-white/50 leading-tight mt-0.5 line-clamp-2 transition-opacity duration-150 ${hovered ? "opacity-100" : "opacity-0"}`}>
            {clip.reason}
          </p>
        )}
      </div>

      {/* Clip number badge */}
      <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/60">
        #{clip.index}
      </div>
    </div>
  );
}

// ── Skeleton clip card ────────────────────────────────────────────────────────
function ClipSkeleton() {
  return (
    <div className="relative aspect-[9/16] rounded-2xl overflow-hidden border border-white/10 bg-[#111]">
      <div className="absolute inset-0 bg-gradient-to-b from-white/4 to-transparent animate-pulse" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-white/20 animate-spin" />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function JobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job,   setJob]   = useState<any>(null);
  const [clips, setClips] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const apiFetch     = useApiFetch();
  const apiFetchRef  = useRef(apiFetch);
  const clipsRef = useRef<any[]>([]);
  // Keep apiFetchRef current on every render so the interval never uses a stale token
  apiFetchRef.current = apiFetch;

  useEffect(() => {
    if (!jobId) return;

    const pollJob = async () => {
      try {
        const res = await apiFetchRef.current(`${API_URL}/api/jobs/${jobId}`);
        if (!res.ok) throw new Error("Job not found");
        const data = await res.json();
        setJob(data);
        return data;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error fetching job");
        return null;
      }
    };

    const pollClips = async () => {
      try {
        const res = await apiFetchRef.current(`${API_URL}/api/clips?jobId=${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        clipsRef.current = data;
        setClips([...data]); // new array ref forces re-render
      } catch {}
    };

    const tick = async () => {
      const data = await pollJob();
      if (!data) { clearInterval(interval); return; }

      // Poll clips as soon as clipping starts — each clip appears as it's saved
      if (data.status === "clipping" || data.status === "done" || data.status === "failed") {
        await pollClips();
      }

      // Stop only when terminal AND all clips are fetched
      const total = data.totalClips ?? 0;
      const isTerminal = data.status === "done" || data.status === "failed";
      if (isTerminal && (total === 0 || clipsRef.current.length >= total)) {
        clearInterval(interval);
      }
    };

    tick();
    const interval = setInterval(tick, 2000);
    return () => clearInterval(interval);
  }, [jobId]);

  const progress    = job ? (STATUS_PROGRESS[job.status] ?? job.progress) : 0;
  const isDone      = job?.status === "done";
  const isFailed    = job?.status === "failed";
  const isClipping  = job?.status === "clipping";
  const totalClips  = job?.totalClips ?? 0;
  // Show skeletons while clipping — even on final tick before status flips to done
  const skeletonCount = (isClipping || (isDone && clips.length < totalClips))
    ? Math.max(0, totalClips - clips.length)
    : 0;

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <Topbar />
      <main className="ml-14 mt-12 flex-1 flex flex-col px-6 py-10">
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">

          {/* Status row */}
          <div className="flex items-center gap-3">
            {isFailed ? (
              <XCircle className="h-5 w-5 text-red-400 shrink-0" />
            ) : isDone ? (
              <CheckCircle className="h-5 w-5 text-white shrink-0" />
            ) : (
              <Loader2 className="h-5 w-5 text-white/50 animate-spin shrink-0" />
            )}
            <div className="flex flex-col gap-0.5">
              <h1 className="text-[16px] font-semibold text-white">
                {job ? STATUS_LABELS[job.status] ?? job.status : "Loading…"}
              </h1>
              {job?.status === "transcribing" && (
                <p className="text-[11px] text-white/35">
                  This step can take a while, longer videos take more time.
                </p>
              )}
            </div>
            {(isClipping || isDone) && totalClips > 0 && (
              <span className="ml-auto text-[13px] text-white/40">
                {clips.length} / {totalClips} clips ready
              </span>
            )}
          </div>

          {/* Progress bar */}
          {!isDone && (
            <div className="flex flex-col gap-1.5">
              <div className="h-1 w-full rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-white/25">{progress}%</p>
            </div>
          )}

          {/* Error — never surface raw agent/ffmpeg dumps to users */}
          {(isFailed || error) && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 flex flex-col gap-0.5">
              <p className="text-[13px] text-red-400">
                Processing failed. Please try again in a few minutes.
              </p>
              <p className="text-[11px] text-red-400/70">
                If this keeps happening, try a different video or upload the file directly.
              </p>
            </div>
          )}

          {/* Clips grid — shows ready clips + skeleton placeholders for pending ones */}
          {(clips.length > 0 || skeletonCount > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {clips.map((clip: any) => (
                <ClipCard key={clip._id ?? clip.index} clip={clip} />
              ))}
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <ClipSkeleton key={`skeleton-${i}`} />
              ))}
            </div>
          )}

          {/* Empty done state */}
          {isDone && clips.length === 0 && (
            <p className="text-[13px] text-white/35">No clips found. Try a different query.</p>
          )}

          {!isDone && !isFailed && (
            <p className="text-[12px] text-white/30 mt-1">
              Feel free to leave, your job will keep running in the background.
            </p>
          )}

          <p className="text-[10px] text-white/15 font-mono mt-2">Job ID: {jobId}</p>
        </div>
      </main>
    </div>
  );
}
