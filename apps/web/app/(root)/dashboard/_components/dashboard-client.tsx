"use client";

import { useState } from "react";
import { Link2, Upload, Zap, Scissors, Captions, Crop, AudioLines, Film, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

const TOOLS = [
  { icon: Sparkles,  label: "Long to shorts" },
  { icon: Captions,  label: "AI Captions",   badge: null },
  { icon: Scissors,  label: "Video editor" },
  { icon: AudioLines,label: "Enhance speech" },
  { icon: Crop,      label: "AI Reframe" },
  { icon: Film,      label: "AI B-Roll",     badge: "New" },
  { icon: Zap,       label: "AI hook" },
];

const CAPTION_PRESETS = [
  { id: "none",       label: "No caption",  preview: null },
  { id: "beasty",     label: "Beasty",      preview: "TO GET" },
  { id: "youshaei",   label: "Youshaei",    preview: "TO GET STARTED" },
  { id: "mozi",       label: "Mozi",        preview: "TO GET\nSTARTED" },
  { id: "simple",     label: "Simple",      preview: "TO GET" },
  { id: "karaoke",    label: "Karaoke",     preview: "TO GET\nSTARTED" },
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

export default function DashboardClient() {
  const [inputUrl, setInputUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [video, setVideo] = useState<VideoMeta | null>(null);
  const [selectedPreset, setSelectedPreset] = useState("karaoke");
  const [clipModel, setClipModel] = useState("Auto");
  const [genre, setGenre] = useState("Auto");
  const [clipLength, setClipLength] = useState("Auto (0m-3m)");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [prompt, setPrompt] = useState("");

  const handleFetch = async () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      new URL(trimmed); // validate
      const meta = await fetchVideoMeta(trimmed);
      setVideo(meta);
    } catch {
      // invalid URL
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setVideo(null);
    setInputUrl("");
  };

  return (
    <div className="flex flex-col items-center w-full px-6 py-10 min-h-screen">

      {/* ── URL input card ── */}
      <div className="w-full max-w-2xl">
        <div className="relative flex items-center rounded-2xl border border-white/10 bg-[#141414] px-4 py-3.5 gap-3">
          <Link2 className="h-4 w-4 text-white/30 shrink-0" />
          {video ? (
            <span className="flex-1 text-[13px] text-white/70 truncate">{video.url}</span>
          ) : (
            <input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
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

        {/* Get clips button */}
        {!video && (
          <button
            onClick={handleFetch}
            disabled={loading || !inputUrl.trim()}
            className="mt-3 w-full rounded-2xl bg-white py-3.5 text-[14px] font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Fetching…" : "Get clips in 1 click"}
          </button>
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

          {/* Demo projects section */}
          <div className="w-full">
            <div className="flex items-center gap-4 mb-4">
              <button className="text-[13px] font-medium text-white border-b border-white pb-1">All projects (0)</button>
              <button className="text-[13px] text-white/35 hover:text-white/60 transition-colors">Saved projects (0)</button>
              <div className="ml-auto flex items-center gap-2 text-[12px] text-white/35">
                <span>0 GB / 100 GB</span>
                <span className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
                  Auto-save
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8 bg-[#141414]">
                <FolderIcon />
              </div>
              <p className="text-[14px] text-white/40">No projects yet. Drop a video link above to get started.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Video loaded state ── */}
      {video && (
        <div className="flex flex-col items-center gap-6 mt-8 w-full max-w-2xl">

          {/* Get clips in 1 click */}
          <button className="w-full rounded-2xl bg-white py-3.5 text-[14px] font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.99]">
            Get clips in 1 click
          </button>

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

          {/* Caption presets */}
          <div className="w-full rounded-2xl border border-white/8 bg-[#111] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {["Quick presets", "My templates"].map((t) => (
                  <button
                    key={t}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                      t === "Quick presets"
                        ? "bg-white/10 text-white"
                        : "text-white/35 hover:text-white/60"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] text-white/40 uppercase tracking-widest mb-3">Caption</p>
              <div className="grid grid-cols-5 gap-2">
                {CAPTION_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPreset(p.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all",
                      selectedPreset === p.id
                        ? "border-white/40 bg-white/8"
                        : "border-white/8 bg-white/3 hover:border-white/18"
                    )}
                  >
                    <div className="h-10 w-full rounded-lg bg-[#1a1a1a] flex items-center justify-center">
                      {p.preview ? (
                        <span className="text-[8px] font-black text-white text-center leading-tight whitespace-pre-line">{p.preview}</span>
                      ) : (
                        <span className="text-white/20 text-lg">⊘</span>
                      )}
                    </div>
                    <span className="text-[10px] text-white/45">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button className="w-full rounded-2xl bg-white py-3.5 text-[14px] font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.99] mb-8">
            Get clips in 1 click
          </button>
        </div>
      )}
    </div>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-white/25 fill-none stroke-current" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}
