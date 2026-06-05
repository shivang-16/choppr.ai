"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, XCircle, Volume2, VolumeX, Download, Pencil, X, Play, Pause } from "lucide-react";
import Link from "next/link";
import Sidebar from "../../_components/sidebar";
import Topbar from "../../_components/topbar";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STATUS_LABELS: Record<string, string> = {
  pending:    "Queued…",
  processing: "Processing…",
  done:       "Done",
  failed:     "Failed",
};

// ── Full-screen video modal ───────────────────────────────────────────────────
function VideoModal({ clip, onClose }: { clip: any; onClose: () => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted]     = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Auto-play on open
  useEffect(() => {
    videoRef.current?.play().catch(() => setPlaying(false));
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Blurry backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />

      {/* Modal content */}
      <div
        className="relative z-10 flex flex-col items-center gap-4 px-4 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video */}
        <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl shadow-black/80 bg-[#111]">
          <video
            ref={videoRef}
            src={clip.s3Url}
            muted={muted}
            loop
            playsInline
            className="w-full"
            onClick={togglePlay}
          />

          {/* Play/pause overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={togglePlay}
          >
            {!playing && (
              <div className="h-16 w-16 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border border-white/20">
                <Play className="h-7 w-7 fill-white text-white ml-1" />
              </div>
            )}
          </div>

          {/* Top controls */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-semibold text-white/70">
              #{clip.index}  ·  Score {clip.score}
            </span>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-black/60 text-white/70 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <button
              onClick={() => { setMuted(m => !m); if (videoRef.current) videoRef.current.muted = !muted; }}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-black/60 text-white/70 hover:text-white transition-colors"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <a
              href={clip.s3Url}
              download
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-black hover:bg-white/90 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </div>
        </div>

        {/* Reason */}
        {clip.reason && (
          <p className="text-[12px] text-white/50 text-center max-w-xs leading-relaxed">
            {clip.reason}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Clip card with hover-to-play ─────────────────────────────────────────────
function ClipCard({ clip, onExpand }: { clip: any; onExpand: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const [muted, setMuted]     = useState(true);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hovered) { v.currentTime = 0; v.play().catch(() => {}); }
    else         { v.pause(); v.currentTime = 0; }
  }, [hovered]);

  return (
    <div
      className="group relative aspect-[9/16] rounded-2xl overflow-hidden border border-white/10 bg-[#111] hover:border-white/25 transition-all duration-200 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMuted(true); }}
      onClick={onExpand}
    >
      <video
        ref={videoRef}
        src={clip.s3Url}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        onLoadedData={() => setLoaded(true)}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {!loaded && <div className="absolute inset-0 bg-white/4 animate-pulse" />}
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${hovered ? "opacity-0" : "opacity-100"}`} />

      {/* Controls */}
      <div
        className={`absolute top-2 right-2 flex gap-1.5 transition-opacity duration-150 ${hovered ? "opacity-100" : "opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
          className="h-7 w-7 flex items-center justify-center rounded-full bg-black/60 text-white/80 hover:text-white transition-colors"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
        <a
          href={clip.s3Url}
          download
          onClick={(e) => e.stopPropagation()}
          className="h-7 w-7 flex items-center justify-center rounded-full bg-black/60 text-white/80 hover:text-white transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Score + reason */}
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

      <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/60">
        #{clip.index}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject]       = useState<any>(null);
  const [clips, setClips]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expandedClip, setExpandedClip] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [projRes, clipsRes] = await Promise.all([
        fetch(`${API_URL}/api/projects/${projectId}`, { credentials: "include" }),
        fetch(`${API_URL}/api/projects/${projectId}/clips`, { credentials: "include" }),
      ]);
      if (projRes.ok)  setProject(await projRes.json());
      if (clipsRes.ok) setClips(await clipsRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    fetchData();

    // Poll while processing
    const interval = setInterval(async () => {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, { credentials: "include" });
      if (!res.ok) return;
      const p = await res.json();
      setProject(p);
      if (p.status === "done") {
        const cr = await fetch(`${API_URL}/api/projects/${projectId}/clips`, { credentials: "include" });
        if (cr.ok) setClips(await cr.json());
        clearInterval(interval);
      }
      if (p.status === "failed") clearInterval(interval);
    }, 3000);

    return () => clearInterval(interval);
  }, [projectId]);

  const isDone       = project?.status === "done";
  const isFailed     = project?.status === "failed";
  const isProcessing = project?.status === "processing" || project?.status === "pending";

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <Topbar />
      <main className="ml-14 mt-12 flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">

          {/* Back + header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard/projects")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-[16px] font-semibold text-white truncate">
                {loading ? "Loading…" : project?.title ?? "Project"}
              </h1>
              {project?.sourceUrl && (
                <p className="text-[11px] text-white/25 truncate">{project.sourceUrl}</p>
              )}
            </div>
            {/* Edit button */}
            {isDone && clips.length > 0 && (
              <Link
                href={`/dashboard/editor/${projectId}`}
                className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-black hover:bg-white/90 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit with AI
              </Link>
            )}

            {/* Status badge */}
            {project && (
              <div className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-3 py-1 text-[12px] text-white/50">
                {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
                {isDone       && <CheckCircle className="h-3 w-3 text-white/60" />}
                {isFailed     && <XCircle className="h-3 w-3 text-red-400" />}
                {STATUS_LABELS[project.status] ?? project.status}
              </div>
            )}
          </div>

          {/* Processing state */}
          {isProcessing && (
            <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-[#111] p-5">
              <p className="text-[13px] text-white/50">Your video is being processed…</p>
              <div className="h-1 w-full rounded-full bg-white/8 overflow-hidden">
                <div className="h-full bg-white/40 rounded-full animate-pulse w-2/3" />
              </div>
              <p className="text-[11px] text-white/25">This can take a few minutes depending on video length.</p>
            </div>
          )}

          {/* Failed state */}
          {isFailed && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-[13px] text-red-400">
              Processing failed. Please try again from the dashboard.
            </div>
          )}

          {/* Clips count */}
          {isDone && clips.length > 0 && (
            <p className="text-[13px] text-white/40">
              {clips.length} clip{clips.length !== 1 ? "s" : ""} ready
            </p>
          )}

          {/* Clips grid */}
          {clips.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {clips.map((clip) => (
                <ClipCard
                  key={clip._id}
                  clip={clip}
                  onExpand={() => setExpandedClip(clip)}
                />
              ))}
            </div>
          )}

          {/* Empty done */}
          {isDone && clips.length === 0 && (
            <p className="text-[13px] text-white/30">No clips were found for this video. Try a different query.</p>
          )}
        </div>
      </main>

      {/* Video expand modal */}
      {expandedClip && (
        <VideoModal
          clip={expandedClip}
          onClose={() => setExpandedClip(null)}
        />
      )}
    </div>
  );
}
