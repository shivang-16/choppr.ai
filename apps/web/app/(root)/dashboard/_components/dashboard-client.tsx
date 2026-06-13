"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApiFetch } from "@/lib/apiFetch";
import { Link2, Upload, Zap, Scissors, Captions, Crop, AudioLines, Film, Sparkles, X, Loader2, CheckCircle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TOOLS = [
  { icon: Sparkles,  label: "Long to shorts" },
  { icon: Scissors,  label: "Video editor" },
];


type VideoMeta = {
  url: string;
  thumbnail: string;
  title: string;
  duration: string;
};

function extractYouTubeId(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return match?.[1] ?? null;
}

async function fetchVideoMeta(url: string): Promise<VideoMeta | null> {
  const ytId = extractYouTubeId(url);
  if (ytId) {
    // Use oEmbed to get title + duration info
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        return {
          url,
          thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
          title: data.title ?? "YouTube Video",
          duration: "0:00",
        };
      }
    } catch {}
  }
  // Fallback for non-YouTube: use a placeholder
  return {
    url,
    thumbnail: `https://picsum.photos/seed/${encodeURIComponent(url)}/640/360`,
    title: new URL(url).hostname,
    duration: "0:00",
  };
}

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiFetch = useApiFetch();
  const paymentSuccess = searchParams.get("success") === "1";
  const paidPlan = searchParams.get("plan");
  const [inputUrl, setInputUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoMeta | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch(`${API_URL}/api/projects`)
      .then((r) => r.ok ? r.json() : [])
      .then(setProjects)
      .catch(() => {});
  }, []);

  const [clipModel, setClipModel] = useState("Auto");
  const [genre, setGenre] = useState("Auto");
  const [clipLength, setClipLength] = useState("Auto (0m-3m)");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [prompt, setPrompt] = useState("");

  const handleFetch = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      new URL(trimmed);
      const meta = await fetchVideoMeta(trimmed);
      setVideo(meta);
    } catch {
      setError("Please enter a valid video URL.");
    } finally {
      setLoading(false);
    }
  };

  // Pre-populate URL from landing page hero (?url=...)
  useEffect(() => {
    const prefilledUrl = searchParams.get("url");
    if (prefilledUrl) {
      setInputUrl(prefilledUrl);
      handleFetch(prefilledUrl);
    }
  }, []);

  const handleUrlChange = (value: string) => {
    setInputUrl(value);
    setVideo(null);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (!trimmed) return;
    // Auto-fetch after 600ms pause in typing
    debounceRef.current = setTimeout(() => {
      handleFetch(trimmed);
    }, 600);
  };

  // Step 2: user clicks "Get clips in 1 click" — create job via API
  const handleSubmit = async () => {
    if (!video) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url:         video.url,
          query:       prompt,
          clipModel,
          genre,
          clipLength,
          aspectRatio,
          maxClips:    10,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create job");
      }

      const { projectId } = await res.json();
      // Redirect to project page
      router.push(`/dashboard/projects/${projectId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = () => {
    setVideo(null);
    setInputUrl("");
    setError(null);
  };

  return (
    <div className="flex flex-col items-center w-full px-6 py-10 min-h-screen">

      {/* ── Payment success banner ── */}
      {paymentSuccess && (
        <div className="w-full max-w-2xl mb-6 flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 px-5 py-4">
          <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-green-300">
              Payment successful! {paidPlan ? `Welcome to ${paidPlan.charAt(0).toUpperCase() + paidPlan.slice(1)}!` : ""}
            </p>
            <p className="text-[12px] text-green-400/70">Your credits are being added — refresh in a moment if the balance hasn't updated yet.</p>
          </div>
        </div>
      )}

      {/* ── URL input card ── */}
      <div className="w-full max-w-2xl">
        <div className="relative rounded-2xl overflow-hidden p-[1.5px]">
          {/* Animated border sweep */}
          {inputUrl && !video ? (
            <div
              className="absolute"
              style={{
                width: "200%",
                height: "200%",
                top: "-50%",
                left: "-50%",
                background: "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.85) 15%, transparent 30%)",
                animation: "spin 1s linear infinite",
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-white/10" />
          )}
        <div className="relative flex items-center rounded-[14px] bg-[#141414] px-4 py-3.5 gap-3 z-10">
          <Link2 className="h-4 w-4 text-white/30 shrink-0" />
          {video ? (
            <span className="flex-1 text-[13px] text-white/70 truncate">{video.url}</span>
          ) : (
            <input
              type="url"
              value={inputUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  handleFetch(inputUrl);
                }
              }}
              placeholder="Drop a video link (YouTube, Loom…)"
              className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white/25 outline-none"
            />
          )}
          {video ? (
            <button
              onClick={handleRemove}
              className="shrink-0 text-[13px] text-white/50 hover:text-white transition-colors flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/70 transition-colors">
                <Upload className="h-3.5 w-3.5" /> Upload
              </button>
            </div>
          )}
        </div>
        </div>

        {/* Loading indicator while auto-fetching */}
        {!video && loading && (
          <div className="mt-3 flex items-center justify-center gap-2 text-[13px] text-white/40 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading preview…
          </div>
        )}

        {/* Manual fetch fallback */}
        {!video && !loading && inputUrl.trim() && (
          <button
            onClick={() => handleFetch(inputUrl)}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/4 py-3 text-[13px] text-white/50 hover:text-white/80 hover:border-white/20 hover:bg-white/6 transition-all"
          >
            Fetch video manually
          </button>
        )}
        {error && (
          <p className="mt-2 text-[12px] text-red-400 text-center">{error}</p>
        )}
      </div>

      {/* ── Empty state ── */}
      {!video && !loading && (
        <div className="flex flex-col items-center gap-10 mt-16 w-full max-w-3xl">
          {/* Tool icons */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            {TOOLS.map(({ icon: Icon, label, badge }) => (
              <button
                key={label}
                className="group flex flex-col items-center gap-2"
              >
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-[#141414] group-hover:bg-white/8 transition-colors">
                  <Icon className="h-6 w-6 text-white/60 group-hover:text-white transition-colors" />
                  {badge && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-black">
                      {badge}
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-white/45 group-hover:text-white/70 transition-colors">{label}</span>
              </button>
            ))}
          </div>

          {/* Projects section */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-medium text-white">
                All projects ({projects.length})
              </span>
              {projects.length > 0 && (
                <Link href="/dashboard/projects" className="text-[12px] text-white/35 hover:text-white/60 transition-colors">
                  View all →
                </Link>
              )}
            </div>

            {projects.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8 bg-[#141414]">
                  <FolderIcon />
                </div>
                <p className="text-[14px] text-white/40">No projects yet. Drop a video link above to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {projects.slice(0, 8).map((project) => (
                  <Link
                    key={project._id}
                    href={`/dashboard/projects/${project._id}`}
                    className="group flex flex-col gap-2 rounded-2xl border border-white/8 bg-[#141414] p-3 hover:border-white/16 transition-all"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-[#1e1e1e] border border-white/6 flex items-center justify-center">
                      {project.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={project.thumbnailUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film className="h-6 w-6 text-white/10" />
                      )}
                    </div>
                    {/* Info */}
                    <p className="text-[12px] font-medium text-white/80 line-clamp-1 leading-snug">
                      {project.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                      {project.status === "done"
                        ? <CheckCircle className="h-3 w-3 text-white/40" />
                        : project.status === "processing" || project.status === "pending"
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Clock className="h-3 w-3" />
                      }
                      <span>
                        {project.status === "done"
                          ? `${project.totalClips} clips`
                          : project.status === "processing"
                          ? "Processing…"
                          : project.status === "pending"
                          ? "Queued"
                          : "Failed"}
                      </span>
                      <span className="text-white/15">·</span>
                      <span>{timeAgo(project.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Video loaded state ── */}
      {video && (
        <div className="flex flex-col items-center gap-6 mt-8 w-full max-w-2xl">

          {/* Meta row */}
          <div className="flex items-center gap-4 text-[12.5px] text-white/40">
            <span>Speech language: <span className="text-white/70 font-medium">English ▾</span></span>
            <span className="text-white/20">|</span>
            <span>Credit usage: <span className="text-white/70 font-medium">⚡ 11</span></span>
          </div>

          {/* Thumbnail */}
          <div className="relative w-64 rounded-xl overflow-hidden border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnail} alt={video.title} className="w-full aspect-video object-cover" />
            <div className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/70 font-mono">720p</div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
              <p className="text-[11px] text-white/70 truncate">{video.title}</p>
            </div>
          </div>

          <p className="text-[12px] text-white/30 text-center max-w-sm">
            Using video you don't own may violate copyright laws. By continuing, you confirm this is your own original content.
          </p>

          {/* AI Clipping settings */}
          <div className="w-full rounded-2xl border border-white/8 bg-[#111] p-5 flex flex-col gap-5">
            {/* Tabs */}
            <div className="flex gap-1">
              {["AI clipping", "Don't clip"].map((t) => (
                <button
                  key={t}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                    t === "AI clipping"
                      ? "bg-white/10 text-white"
                      : "text-white/35 hover:text-white/60"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Settings row */}
            <div className="flex flex-wrap gap-4 text-[13px]">
              {[
                { label: "Clip model", value: clipModel, set: setClipModel, opts: ["Auto", "Viral", "Educational"] },
                { label: "Genre", value: genre, set: setGenre, opts: ["Auto", "Gaming", "Podcast", "Sports"] },
                { label: "Clip Length", value: clipLength, set: setClipLength, opts: ["Auto (0m-3m)", "Short (0-60s)", "Long (1-3m)"] },
              ].map(({ label, value, set, opts }) => (
                <label key={label} className="flex items-center gap-2 text-white/50">
                  {label}
                  <select
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="bg-transparent text-white/80 border-b border-white/15 outline-none cursor-pointer"
                  >
                    {opts.map((o) => <option key={o} value={o} className="bg-[#111]">{o}</option>)}
                  </select>
                </label>
              ))}
            </div>

            {/* Prompt */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-white/50">Include specific moments</span>
                <span className="text-[12px] text-white/25">Not sure how to prompt? <span className="underline cursor-pointer">learn more</span></span>
              </div>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Example: find all the moments when someone scored"
                className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
              />
            </div>

            {/* Aspect ratio */}
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-white/50">Choose aspect ratio</span>
              {["9:16", "1:1", "16:9"].map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={cn(
                    "px-3 py-1 rounded-lg border text-[12px] transition-colors",
                    aspectRatio === r
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/8 text-white/35 hover:text-white/60"
                  )}
                >
                  □ {r}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-2xl bg-white py-3.5 text-[14px] font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mb-8"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Creating job…" : "Get clips in 1 click"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardClient() {
  return (
    <Suspense>
      <DashboardInner />
    </Suspense>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-white/25 fill-none stroke-current" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}
