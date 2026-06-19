"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApiFetch } from "@/lib/apiFetch";
import { Link2, Upload, Zap, Scissors, Captions, Crop, AudioLines, Film, Sparkles, X, Loader2, CheckCircle, Clock, XCircle, AlertCircle, Info } from "lucide-react";
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
  durationSecs?: number;
  platform?: PlatformInfo | null;
};

type PlatformInfo = {
  name: string;
  color: string;
  icon: React.ReactNode;
};

const PLATFORM_MAP: { match: (h: string, p: string) => boolean; info: PlatformInfo }[] = [
  {
    match: (h) => h.includes("instagram.com"),
    info: {
      name: "Instagram",
      color: "#E1306C",
      icon: <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
    },
  },
  {
    match: (h) => h.includes("x.com") || h.includes("twitter.com"),
    info: {
      name: "X / Twitter",
      color: "#e5e5e5",
      icon: <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.732-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    },
  },
  {
    match: (h) => h.includes("tiktok.com"),
    info: {
      name: "TikTok",
      color: "#69C9D0",
      icon: <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.88a8.27 8.27 0 004.84 1.55V7a4.85 4.85 0 01-1.07-.31z"/></svg>,
    },
  },
  {
    match: (h) => h.includes("twitch.tv"),
    info: {
      name: "Twitch",
      color: "#9146FF",
      icon: <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>,
    },
  },
  {
    match: (h) => h.includes("facebook.com") || h.includes("fb.com") || h.includes("fb.watch"),
    info: {
      name: "Facebook",
      color: "#1877F2",
      icon: <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    },
  },
  {
    match: (h) => h.includes("vimeo.com"),
    info: {
      name: "Vimeo",
      color: "#1AB7EA",
      icon: <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.612-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.478 4.807z"/></svg>,
    },
  },
  {
    match: (h) => h.includes("reddit.com"),
    info: {
      name: "Reddit",
      color: "#FF4500",
      icon: <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>,
    },
  },
  {
    match: (h, p) => h.includes("youtube.com") || h.includes("youtu.be"),
    info: {
      name: "YouTube",
      color: "#FF0000",
      icon: <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.8zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z"/></svg>,
    },
  },
];

function getPlatformInfo(url: string): PlatformInfo | null {
  try {
    const u = new URL(url);
    return PLATFORM_MAP.find(p => p.match(u.hostname, u.pathname))?.info ?? null;
  } catch {
    return null;
  }
}

function extractYouTubeId(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return match?.[1] ?? null;
}

async function fetchVideoMeta(url: string, apiFetch: (u: string, o?: RequestInit) => Promise<Response>): Promise<VideoMeta | null> {
  const platform = getPlatformInfo(url);
  const ytId = extractYouTubeId(url);
  if (ytId) {
    const [oembedRes, metaRes] = await Promise.all([
      fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`),
      apiFetch(`${API_URL}/api/video-meta?url=${encodeURIComponent(url)}`),
    ]);
    const title = oembedRes.ok ? (await oembedRes.json()).title ?? "YouTube Video" : "YouTube Video";
    if (!metaRes.ok) throw new Error("Failed to fetch video metadata. Please try again.");
    const metaJson = await metaRes.json();
    const durationSecs: number | null = metaJson.durationSecs ?? null;
    if (!durationSecs || durationSecs <= 0) throw new Error("Could not load video metadata. Please try again.");
    const dur = `${Math.floor(durationSecs / 3600) > 0 ? Math.floor(durationSecs / 3600) + ":" : ""}${String(Math.floor((durationSecs % 3600) / 60)).padStart(2, "0")}:${String(durationSecs % 60).padStart(2, "0")}`;
    return {
      url,
      thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      title,
      duration: dur,
      durationSecs,
      platform,
    };
  }
  // Non-YouTube: no real thumbnail available before processing
  let hostname = url;
  try { hostname = new URL(url).hostname.replace("www.", ""); } catch {}
  return {
    url,
    thumbnail: "",
    title: platform?.name ?? hostname,
    duration: "0:00",
    platform,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTriggeredRef = useRef(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null); // null = not uploading, 0-100 = %
  const [uploadedS3Key, setUploadedS3Key] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${API_URL}/api/projects`)
      .then((r) => r.ok ? r.json() : [])
      .then(setProjects)
      .catch(() => {});
  }, []);

  const [clipModel, setClipModel] = useState("Auto");
  const [genre, setGenre] = useState("Auto");
  const [clipLength, setClipLength] = useState("Short (0-60s)");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [backgroundFill, setBackgroundFill] = useState("blur");
  const [bgInfoOpen, setBgInfoOpen] = useState(false);
  const bgInfoRef = useRef<HTMLDivElement>(null);

  // Close background info popover on outside click
  useEffect(() => {
    if (!bgInfoOpen) return;
    const handler = (e: MouseEvent) => {
      if (bgInfoRef.current && !bgInfoRef.current.contains(e.target as Node)) {
        setBgInfoOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bgInfoOpen]);
  const [maxClips, setMaxClips] = useState(10);
  const [prompt, setPrompt] = useState("");

  // Derive available clip count options from video duration
  const maxClipsLimit = (() => {
    const mins = (video?.durationSecs ?? 0) / 60;
    if (mins <= 5)  return 5;
    if (mins <= 10) return 10;
    if (mins <= 20) return 15;
    if (mins <= 30) return 20;
    if (mins <= 60) return 20;
    return 20;
  })();
  const clipCountOptions = [5, 10, 15, 20].filter((n) => n <= maxClipsLimit);
  const [maxVideoLengthMins, setMaxVideoLengthMins] = useState<number | null>(null);

  useEffect(() => {
    apiFetch(`${API_URL}/api/plans/me`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        const currentPlan = d.plans?.find((p: any) => p.slug === d.currentPlanId || p._id === d.currentPlanId);
        if (currentPlan?.maxVideoLengthMins != null) setMaxVideoLengthMins(currentPlan.maxVideoLengthMins);
      })
      .catch(() => {});
  }, []);

  const handleFetch = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      new URL(trimmed);
      const meta = await fetchVideoMeta(trimmed, apiFetch);
      setVideo(meta);
      // Set default clip count based on video length
      if (meta?.durationSecs) {
        const mins = meta.durationSecs / 60;
        const suggested = mins <= 5 ? 5 : 10;
        setMaxClips(suggested);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please enter a valid video URL.");
      setInputUrl("");
      setVideo(null);
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
    // Auto-open file picker if redirected from landing page upload button
    if (searchParams.get("upload") === "1" && !uploadTriggeredRef.current) {
      uploadTriggeredRef.current = true;
      setTimeout(() => fileInputRef.current?.click(), 300);
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

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    const MAX_SIZE = 500 * 1024 * 1024; // 500 MB
    if (file.size > MAX_SIZE) {
      setError("File too large. Maximum size is 500 MB.");
      return;
    }
    setError(null);
    setUploadProgress(0);
    setUploadedS3Key(null);

    try {
      // 1. Get presigned URL
      const presignRes = await apiFetch(`${API_URL}/api/uploads/presign`, { method: "POST" });
      if (!presignRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, s3Key } = await presignRes.json();

      // 2. PUT directly to S3 with XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      setUploadedS3Key(s3Key);
      setUploadProgress(null);

      // Read local duration from the file so we can show an accurate credit estimate
      const durationSecs = await new Promise<number>((resolve) => {
        const tmp = document.createElement("video");
        tmp.preload = "metadata";
        tmp.src = URL.createObjectURL(file);
        tmp.onloadedmetadata = () => { URL.revokeObjectURL(tmp.src); resolve(tmp.duration || 0); };
        tmp.onerror = () => resolve(0);
      });
      const dur = durationSecs > 0 ? `${Math.floor(durationSecs / 60)}:${String(Math.floor(durationSecs % 60)).padStart(2, "0")}` : "0:00";
      setVideo({ url: `[Uploaded] ${file.name}`, thumbnail: "", title: file.name, duration: dur, durationSecs });
    } catch (err: unknown) {
      setUploadProgress(null);
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  // Step 2: user clicks "Get clips in 1 click" — create job via API
  const handleSubmit = async () => {
    if (!video) return;

    // Client-side plan limit check
    if (maxVideoLengthMins != null && video.durationSecs && video.durationSecs > maxVideoLengthMins * 60) {
      setError(`Your plan allows videos up to ${maxVideoLengthMins} minutes. Upgrade to process longer videos.`);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        query: prompt,
        clipModel,
        genre,
        clipLength,
        aspectRatio,
        backgroundFill,
        maxClips,
        ...(video.durationSecs && video.durationSecs > 0 ? { durationSecs: video.durationSecs } : {}),
      };
      if (uploadedS3Key) {
        body.s3Key = uploadedS3Key;
      } else {
        body.url = video.url;
      }

      const res = await apiFetch(`${API_URL}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? data.error ?? "Failed to create job");
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
    setUploadedS3Key(null);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col items-center w-full px-6 py-10">

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
          {/* Border: sweep while typing, fill while uploading, static otherwise */}
          {uploadProgress !== null ? (
            <div
              className="absolute"
              style={{
                width: "200%",
                height: "200%",
                top: "-50%",
                left: "-50%",
                background: `conic-gradient(from 0deg, rgba(255,255,255,0.9) ${uploadProgress * 3.6}deg, rgba(255,255,255,0.12) ${uploadProgress * 3.6}deg)`,
                transition: "background 0.3s ease-out",
              }}
            />
          ) : inputUrl && !video ? (
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
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
              {uploadProgress !== null ? (
                <span className="text-[12px] text-white/50 flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {uploadProgress}%
                </span>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/70 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" /> Upload
                </button>
              )}
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
            {TOOLS.map(({ icon: Icon, label }) => (
              <button
                key={label}
                className="group flex flex-col items-center gap-2"
              >
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-[#141414] group-hover:bg-white/8 transition-colors">
                  <Icon className="h-6 w-6 text-white/60 group-hover:text-white transition-colors" />
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
                    {(() => {
                      const pl = getPlatformInfo(project.sourceUrl ?? "");
                      return (
                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-[#1e1e1e] border border-white/6 flex items-center justify-center">
                          {project.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={project.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          ) : pl ? (
                            <div
                              className="w-full h-full flex flex-col items-center justify-center gap-1.5"
                              style={{ background: `radial-gradient(ellipse at center, ${pl.color}20 0%, #1e1e1e 70%)` }}
                            >
                              <span style={{ color: pl.color }} className="opacity-70">{pl.icon}</span>
                              <span className="text-[9px] text-white/25">{pl.name}</span>
                            </div>
                          ) : (
                            <Film className="h-6 w-6 text-white/10" />
                          )}
                        </div>
                      );
                    })()}
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

          {/* Plan limit — only show when we know the video is too long */}
          {maxVideoLengthMins != null && video.durationSecs && video.durationSecs > maxVideoLengthMins * 60 && (
            <div className="w-full flex items-center gap-3 rounded-2xl border border-yellow-500/40 bg-yellow-500/15 px-5 py-3.5">
              <AlertCircle className="h-4 w-4 text-yellow-300 shrink-0" />
              <p className="text-[13px] text-yellow-200 font-medium">
                This video exceeds your plan's {maxVideoLengthMins}-minute limit.
              </p>
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-4 text-[12.5px] text-white/40">
            {video.durationSecs && video.durationSecs > 0 ? (
              <span>
                Credit usage:{" "}
                <span className="text-white/70 font-medium">
                  ⚡ {Math.ceil(video.durationSecs / 60) * 2} credits
                </span>
                <span className="text-white/25 text-[11px]"> ({Math.ceil(video.durationSecs / 60)} min × 2)</span>
              </span>
            ) : (
              <span>
                Credit usage:{" "}
                <span className="text-white/70 font-medium">⚡ 2 credits / min</span>
              </span>
            )}
          </div>

          {/* Thumbnail / platform placeholder */}
          <div className="relative w-64 rounded-xl overflow-hidden border border-white/10">
            {video.thumbnail ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={video.thumbnail} alt={video.title} className="w-full aspect-video object-cover" />
                <div className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/70 font-mono">720p</div>
              </>
            ) : video.platform ? (
              <div
                className="w-full aspect-video flex flex-col items-center justify-center gap-3"
                style={{ background: `radial-gradient(ellipse at center, ${video.platform.color}22 0%, #111 70%)` }}
              >
                <div style={{ color: video.platform.color }} className="opacity-80">
                  {video.platform.icon}
                </div>
                <span className="text-[11px] font-medium text-white/40">{video.platform.name} video</span>
              </div>
            ) : (
              <div className="w-full aspect-video bg-[#1a1a1a] flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
              <p className="text-[11px] text-white/70 truncate">{video.title}</p>
            </div>
          </div>

          <p className="text-[12px] text-white/30 text-center max-w-sm">
            Using video you don't own may violate copyright laws. By continuing, you confirm this is your own original content.
          </p>

          {/* Clipping settings */}
          <div className="w-full rounded-2xl border border-white/8 bg-[#111] p-5 flex flex-col gap-5">
            {/* Settings row */}
            <div className="flex flex-wrap gap-4 text-[13px]">
              {[
                {
                  label: "Clip model",
                  value: clipModel,
                  set: setClipModel,
                  opts: ["Auto", "Viral", "Educational", "Highlights", "Storytelling", "Motivational"],
                },
                {
                  label: "Genre",
                  value: genre,
                  set: setGenre,
                  opts: ["Auto", "Gaming", "Podcast", "Sports", "Finance", "Fitness", "News", "Comedy", "Interview", "Tutorial", "Vlog", "Music"],
                },
                {
                  label: "Clip Length",
                  value: clipLength,
                  set: setClipLength,
                  opts: ["Auto (0m-3m)", "Short (0-60s)", "Long (1-3m)"],
                },
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
              <label className="flex items-center gap-2 text-white/50">
                Max clips
                <select
                  value={Math.min(maxClips, maxClipsLimit)}
                  onChange={(e) => setMaxClips(Number(e.target.value))}
                  className="bg-transparent text-white/80 border-b border-white/15 outline-none cursor-pointer"
                >
                  {clipCountOptions.map((n) => (
                    <option key={n} value={n} className="bg-[#111]">{n} clips</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Prompt */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] text-white/50">Include specific moments</span>
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

            {/* Background fill */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Label + info button */}
              <div className="relative flex items-center gap-1.5" ref={bgInfoRef}>
                <span className="text-[12px] text-white/50">Background</span>
                <button
                  onClick={() => setBgInfoOpen((o) => !o)}
                  className="text-white/30 hover:text-white/60 transition-colors"
                  aria-label="Background fill info"
                >
                  <Info size={13} />
                </button>

                {/* Popover */}
                {bgInfoOpen && (
                  <div className="absolute left-0 bottom-full mb-2 z-50 w-64 rounded-xl border border-white/10 bg-[#1a1a1a] p-3 shadow-lg">
                    <p className="text-[11px] font-medium text-white/80 mb-2">Background fill modes</p>
                    <ul className="flex flex-col gap-2">
                      {[
                        { label: "Blurry BG", desc: "A blurred copy of your video fills the empty space — polished, no dead space." },
                        { label: "Black",     desc: "Solid black bars on the sides or top/bottom — classic letterbox look." },
                        { label: "White",     desc: "Same as black but white — great for screen recordings or tutorial content." },
                        { label: "Crop",      desc: "Center-crops the video to fill the frame — no bars, but edges may be cut off." },
                      ].map(({ label, desc }) => (
                        <li key={label}>
                          <span className="text-[11px] font-semibold text-white/70">{label} — </span>
                          <span className="text-[11px] text-white/40">{desc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {(
                [
                  { id: "blur",  label: "Blurry BG" },
                  { id: "black", label: "Black" },
                  { id: "white", label: "White" },
                  { id: "none",  label: "Crop" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setBackgroundFill(id)}
                  className={cn(
                    "px-3 py-1 rounded-lg border text-[12px] transition-colors",
                    backgroundFill === id
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/8 text-white/35 hover:text-white/60"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {maxVideoLengthMins != null && video.durationSecs && video.durationSecs > maxVideoLengthMins * 60 ? (
            <a
              href="/dashboard/billing"
              className="w-full rounded-2xl bg-white py-3.5 text-[14px] font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.99] flex items-center justify-center gap-2 mb-8"
            >
              Upgrade your plan to continue →
            </a>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-2xl bg-white py-3.5 text-[14px] font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-8"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Creating job…" : "Get clips"}
            </button>
          )}
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
