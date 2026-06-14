"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApiFetch } from "@/lib/apiFetch";
import { ArrowLeft, Loader2, Volume2, VolumeX, Download, X, Play, Pause, Wand2, Sparkles, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useRouter as _useRouter } from "next/navigation";
import Sidebar from "../../_components/sidebar";
import Topbar from "../../_components/topbar";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Full-screen video modal — carousel with Use / Download ───────────────────
function VideoModal({ slides, startIdx, onClose, onUse }: {
  slides: any[]; startIdx: number; onClose: () => void; onUse: (clip: any) => void;
}) {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const [idx, setIdx]   = useState(startIdx);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted]     = useState(false);

  const current  = slides[idx];
  const isEdited = !!current?.originalClipId;
  const hasMany  = slides.length > 1;

  // Close on Escape / arrow keys
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && idx < slides.length - 1) setIdx(i => i + 1);
      if (e.key === "ArrowLeft"  && idx > 0)                 setIdx(i => i - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, idx, slides.length]);

  // Reload + autoplay when slide changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    v.play().catch(() => setPlaying(false));
    setPlaying(true);
  }, [idx]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" />

      {/* Content — stop propagation so clicking inside doesn't close */}
      <div
        className="relative z-10 flex flex-col items-center gap-4 px-4 w-full"
        style={{ maxWidth: "min(380px, 90vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video card — no overflow-hidden on wrapper so arrows aren't clipped */}
        <div className="relative w-full rounded-2xl shadow-2xl shadow-black/80 bg-[#111]" style={{ aspectRatio: "9/16" }}>

          {/* Video layer with overflow-hidden only here */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden cursor-pointer" onClick={togglePlay}>
            <video
              ref={videoRef}
              src={current?.s3Url}
              muted={muted}
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          {/* Play/pause overlay — z-10, pointer-events-none so arrows stay clickable */}
          {!playing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="h-16 w-16 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border border-white/20">
                <Play className="h-7 w-7 fill-white text-white ml-1" />
              </div>
            </div>
          )}

          {/* Top bar — z-30, badge + sound + close */}
          <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between">
            <span className="rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-semibold text-white/70 flex items-center gap-1.5">
              {isEdited
                ? <><Sparkles className="h-3 w-3 text-white/70" /> Edited</>
                : `#${current?.index} · Score ${current?.score}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Bottom bar — z-30 */}
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-black/70 to-transparent px-3 pt-10 pb-3">
            {isEdited ? (
              <a
                href={current?.s3Url}
                download
                onClick={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[13px] font-semibold text-black hover:bg-white/90 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onUse(current); onClose(); }}
                className="w-full flex items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[13px] font-semibold text-black hover:bg-white/90 transition-colors cursor-pointer"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Use this clip
              </button>
            )}
          </div>

          {/* Side arrows — inset-0 flex for reliable vertical centering */}
          {hasMany && (
            <div className="absolute inset-0 z-40 flex items-center justify-between px-2" style={{ pointerEvents: "none" }}>
              <button
                onClick={(e) => { e.stopPropagation(); setIdx(i => i - 1); }}
                style={{ pointerEvents: "auto" }}
                className={`h-9 w-9 flex items-center justify-center rounded-full bg-black/70 backdrop-blur-sm hover:bg-black/90 text-white transition-all cursor-pointer ${idx === 0 ? "invisible" : ""}`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIdx(i => i + 1); }}
                style={{ pointerEvents: "auto" }}
                className={`h-9 w-9 flex items-center justify-center rounded-full bg-black/70 backdrop-blur-sm hover:bg-black/90 text-white transition-all cursor-pointer ${idx === slides.length - 1 ? "invisible" : ""}`}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* Dots */}
        {hasMany && (
          <div className="flex justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`rounded-full transition-all duration-200 ${i === idx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30 hover:bg-white/50"}`}
              />
            ))}
          </div>
        )}

        {/* Reason text */}
        {current?.reason && !isEdited && (
          <p className="text-[12px] text-white/45 text-center leading-relaxed px-2">
            {current.reason}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Clip card — full-width, arrows inside at mid-height, dots below ───────────
function ClipCard({ clip, editedClips, onExpand, onUse }: {
  clip: any; editedClips: any[]; onExpand: (c: any) => void; onUse: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const [muted, setMuted]     = useState(true);
  const [loaded, setLoaded]   = useState(false);

  const slides   = [clip, ...editedClips];
  const hasMany  = slides.length > 1;
  const [idx, setIdx] = useState(0);
  const current  = slides[idx];
  const isEdited = idx > 0;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    if (hovered) v.play().catch(() => {});
  }, [idx]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hovered) { v.currentTime = 0; v.play().catch(() => {}); }
    else         { v.pause(); v.currentTime = 0; }
  }, [hovered]);

  return (
    <div
      className="flex flex-col gap-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMuted(true); }}
    >
      {/* Card: no overflow-hidden so arrows at mid-height aren't clipped */}
      <div
        className="relative w-full rounded-2xl border border-white/10 hover:border-white/25 transition-all duration-200 bg-[#111]"
        style={{ aspectRatio: "9/16" }}
      >
        {/* Video layer — overflow-hidden only here for rounded corners */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden cursor-pointer"
          onClick={() => onExpand(current)}
        >
          <video
            ref={videoRef}
            src={current.s3Url}
            muted={muted}
            loop
            playsInline
            preload="metadata"
            onLoadedData={() => setLoaded(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {!loaded && <div className="absolute inset-0 bg-white/4 animate-pulse" />}
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${hovered ? "opacity-0" : "opacity-100"}`} />
        </div>

        {/* Overlays (badges, mute, bottom bar) — above video, below arrows */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between pointer-events-none z-10">
          {isEdited ? (
            <div className="flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 px-2 py-0.5">
              <Sparkles className="h-2.5 w-2.5 text-white/80" />
              <span className="text-[9px] font-semibold text-white/80">Edited</span>
            </div>
          ) : (
            <div className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/60">
              #{current.index}
            </div>
          )}
          <button
            className={`pointer-events-auto cursor-pointer h-7 w-7 flex items-center justify-center rounded-full bg-black/60 text-white/80 hover:text-white transition-all ${hovered ? "opacity-100" : "opacity-0"}`}
            onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent px-2.5 pt-8 pb-2.5 z-10">
          {!isEdited && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-[8px] uppercase tracking-widest text-white/40">Score</span>
              <span className="text-[13px] font-bold text-white">{current.score}</span>
            </div>
          )}
          {isEdited ? (
            <a
              href={current.s3Url}
              download
              onClick={(e) => e.stopPropagation()}
              className="w-full cursor-pointer flex items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-[11px] font-semibold text-black hover:bg-white/90 active:scale-95 transition-all"
            >
              <Download className="h-3 w-3" />
              Download
            </a>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onUse(); }}
              className="w-full cursor-pointer flex items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-[11px] font-semibold text-black hover:bg-white/90 active:scale-95 transition-all"
            >
              <Wand2 className="h-3 w-3" />
              Use this clip
            </button>
          )}
        </div>

        {/* Arrows — inset-0 flex for reliable vertical centering */}
        {hasMany && (
          <div className="absolute inset-0 z-30 flex items-center justify-between px-1.5" style={{ pointerEvents: "none" }}>
            <button
              onClick={(e) => { e.stopPropagation(); setIdx(i => i - 1); }}
              style={{ pointerEvents: "auto" }}
              className={`h-7 w-7 flex items-center justify-center rounded-full bg-black/70 backdrop-blur-sm hover:bg-black/90 text-white transition-all cursor-pointer ${idx === 0 ? "invisible" : ""}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIdx(i => i + 1); }}
              style={{ pointerEvents: "auto" }}
              className={`h-7 w-7 flex items-center justify-center rounded-full bg-black/70 backdrop-blur-sm hover:bg-black/90 text-white transition-all cursor-pointer ${idx === slides.length - 1 ? "invisible" : ""}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Dots below */}
      {hasMany && (
        <div className="flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`rounded-full transition-all duration-200 ${i === idx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30 hover:bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const nav    = _useRouter();
  const [project, setProject]           = useState<any>(null);
  const [clips, setClips]               = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal] = useState<{ slides: any[]; startIdx: number } | null>(null);
  const [retrying, setRetrying]         = useState(false);
  const apiFetch = useApiFetch();

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const res = await apiFetch(`${API_URL}/api/projects/${projectId}/retry`, { method: "POST" });
      if (res.ok) {
        const [projRes, clipsRes] = await Promise.all([
          apiFetch(`${API_URL}/api/projects/${projectId}`),
          apiFetch(`${API_URL}/api/projects/${projectId}/clips`),
        ]);
        if (projRes.ok)  setProject(await projRes.json());
        if (clipsRes.ok) setClips(await clipsRes.json());
      }
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    let stopped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchAll = async () => {
      try {
        const [projRes, clipsRes] = await Promise.all([
          apiFetch(`${API_URL}/api/projects/${projectId}`),
          apiFetch(`${API_URL}/api/projects/${projectId}/clips`),
        ]);
        if (stopped) return null;
        let proj = null;
        if (projRes.ok)  { proj = await projRes.json(); setProject(proj); }
        if (clipsRes.ok) setClips(await clipsRes.json());
        return proj;
      } finally {
        if (!stopped) setLoading(false);
      }
    };

    fetchAll().then((proj) => {
      if (stopped) return;
      if (proj?.status && ["done", "failed"].includes(proj.status)) return;
      // Poll every 4s until done/failed
      intervalId = setInterval(async () => {
        const updated = await fetchAll();
        if (updated?.status && ["done", "failed"].includes(updated.status)) {
          clearInterval(intervalId!);
          intervalId = null;
        }
      }, 4000);
    });

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [projectId]);

  // Separate original clips from edited exports, group by parent
  const originalClips = clips.filter((c: any) => !c.originalClipId);
  const editedByParent: Record<string, any[]> = {};
  clips.filter((c: any) => c.originalClipId).forEach((c: any) => {
    (editedByParent[c.originalClipId] ??= []).push(c);
  });

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <Topbar />
      <main className="md:ml-14 mt-12 flex-1 px-6 py-10 pb-24 md:pb-10">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">

          {/* Back + header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard/projects")}
              className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white transition-colors"
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
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/50 hover:text-white hover:border-white/20 transition-colors disabled:opacity-40"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Retrying…" : "Retry"}
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 text-[13px] text-white/30">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading clips…
            </div>
          )}

          {/* Still processing — no clips yet */}
          {!loading && originalClips.length === 0 && project?.status && !["done", "failed"].includes(project.status) && (
            <div className="flex items-center gap-2 text-[13px] text-white/30">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing video, clips will appear here shortly…
            </div>
          )}

          {/* Clips count */}
          {!loading && originalClips.length > 0 && (
            <p className="text-[13px] text-white/40">
              {originalClips.length} clip{originalClips.length !== 1 ? "s" : ""} ready
            </p>
          )}

          {/* Clips grid */}
          {originalClips.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {originalClips.map((clip: any) => {
                const edited = editedByParent[clip._id] ?? [];
                const slides = [clip, ...edited];
                return (
                  <ClipCard
                    key={clip._id}
                    clip={clip}
                    editedClips={edited}
                    onExpand={(c) => {
                      const startIdx = slides.findIndex(s => s._id === c._id);
                      setModal({ slides, startIdx: startIdx >= 0 ? startIdx : 0 });
                    }}
                    onUse={() => nav.push(`/dashboard/clips/${clip._id}?src=${encodeURIComponent(clip.s3Url)}&score=${clip.score}&index=${clip.index}&projectId=${projectId}`)}
                  />
                );
              })}
            </div>
          )}

          {/* Empty — only after job is fully done */}
          {!loading && originalClips.length === 0 && ["done", "failed"].includes(project?.status) && (
            <p className="text-[13px] text-white/30">No clips found for this project.</p>
          )}
        </div>
      </main>

      {/* Video expand modal */}
      {modal && (
        <VideoModal
          slides={modal.slides}
          startIdx={modal.startIdx}
          onClose={() => setModal(null)}
          onUse={(clip) => nav.push(`/dashboard/clips/${clip._id}?src=${encodeURIComponent(clip.s3Url)}&score=${clip.score}&index=${clip.index}&projectId=${projectId}`)}
        />
      )}
    </div>
  );
}
