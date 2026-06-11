"use client";

import { useRef, useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useApiFetch } from "@/lib/apiFetch";
import {
  ArrowLeft, Download, Play, Pause, Volume2, VolumeX,
  Captions, Gauge, Scissors, Sparkles, Check, Loader2, Languages,
} from "lucide-react";
import Sidebar from "../../_components/sidebar";
import Topbar from "../../_components/topbar";
import { cn } from "@/lib/utils";
import CaptionRenderer, { type CaptionStyle, type CaptionWord } from "./_components/caption-renderer";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "captions", icon: Captions,  label: "Captions" },
  { id: "speed",    icon: Gauge,     label: "Speed" },
  { id: "trim",     icon: Scissors,  label: "Trim" },
  { id: "enhance",  icon: Sparkles,  label: "Enhance" },
];

// ── Caption styles ────────────────────────────────────────────────────────────
const CAPTION_STYLES: { id: CaptionStyle; label: string; desc: string; preview: string | null; previewClass: string }[] = [
  { id: "none",           label: "None",          desc: "No captions",             preview: null,     previewClass: "" },
  { id: "word-pop",       label: "Word Pop",       desc: "Active word scales up",   preview: "BIG",    previewClass: "text-white font-black text-[9px]" },
  { id: "karaoke",        label: "Karaoke",        desc: "Yellow word highlight",   preview: "WORD",   previewClass: "text-yellow-400 font-black text-[9px]" },
  { id: "bold-center",    label: "Bold Center",    desc: "One word, centered pill", preview: "BOLD",   previewClass: "bg-white text-black font-black px-1 rounded text-[7px]" },
  { id: "neon",           label: "Neon",           desc: "Green neon glow",         preview: "GLOW",   previewClass: "text-[#00ff88] font-black text-[9px]" },
  { id: "bounce",         label: "Bounce",         desc: "Word springs in",         preview: "DROP",   previewClass: "text-white font-black text-[9px]" },
  { id: "subtitle",       label: "Subtitle",       desc: "Classic dark bar",        preview: "Sub",    previewClass: "bg-black/60 text-white px-1 rounded text-[8px]" },
  { id: "shadow",         label: "Shadow",         desc: "Heavy drop shadow",       preview: "SHADE",  previewClass: "text-white font-black text-[9px] [text-shadow:1px_1px_3px_black]" },
  { id: "fire",           label: "Fire",           desc: "Orange-red flame glow",   preview: "FIRE",   previewClass: "text-orange-500 font-black text-[9px]" },
  { id: "typewriter",     label: "Typewriter",     desc: "Matrix green on black",   preview: "TYPE",   previewClass: "text-[#00FF41] font-black text-[9px] bg-black/80 px-1 rounded" },
  { id: "glitch",         label: "Glitch",         desc: "Cyan/magenta glitch",     preview: "ERR",    previewClass: "text-fuchsia-400 font-black text-[9px]" },
  { id: "rainbow",        label: "Rainbow",        desc: "Full spectrum colors",    preview: "RGB",    previewClass: "font-black text-[9px] bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500 bg-clip-text text-transparent" },
  { id: "outline-white",  label: "Outline",        desc: "White stroke, no fill",   preview: "LINE",   previewClass: "text-transparent font-black text-[9px] [text-stroke:1px_white] outline outline-1 outline-white rounded" },
  { id: "outline-black",  label: "Impact",         desc: "White with thick border", preview: "MPCT",   previewClass: "text-white font-black text-[9px] [text-shadow:-1px_-1px_0_black,1px_-1px_0_black]" },
  { id: "highlight-box",  label: "Highlight",      desc: "Yellow box, black text",  preview: "HI",     previewClass: "bg-yellow-400 text-black font-black px-1 rounded text-[8px]" },
  { id: "wave",           label: "Wave",           desc: "Words oscillate up/down", preview: "~WVE~",  previewClass: "text-white font-black text-[9px]" },
  { id: "gradient-gold",  label: "Gold",           desc: "Shimmering gold gradient",preview: "GOLD",   previewClass: "text-yellow-400 font-black text-[9px]" },
  { id: "comic",          label: "Comic",          desc: "Blue pill, huge text",    preview: "POW!",   previewClass: "bg-blue-800 text-white font-black px-1 rounded text-[7px]" },
  { id: "minimal-top",    label: "Minimal Top",    desc: "Small text at top",       preview: "top",    previewClass: "text-white/70 font-normal text-[9px]" },
  { id: "beasty",         label: "Beasty",         desc: "Huge single word, bold",  preview: "BEAST",  previewClass: "text-white font-black text-[8px] [text-shadow:-2px_-2px_0_black,2px_-2px_0_black]" },
  { id: "hormozi",        label: "Hormozi",        desc: "Yellow emphasis, middle", preview: "HRMZ",   previewClass: "text-yellow-400 font-black text-[9px] [text-shadow:-2px_-2px_0_black,2px_-2px_0_black]" },
  { id: "mr-beast",       label: "MrBeast",        desc: "Big red active, center",  preview: "HUGE",   previewClass: "text-red-500 font-black text-[9px] [text-shadow:-2px_-2px_0_black,2px_-2px_0_black]" },
  { id: "stack-reveal",   label: "Stack",          desc: "Single word reveal, mid", preview: "STAK",   previewClass: "text-white font-black text-[9px] [text-shadow:-2px_-2px_0_black,2px_-2px_0_black]" },
  { id: "shake",          label: "Shake",          desc: "Vibrating active word",   preview: "SHKK",   previewClass: "text-red-400 font-black text-[9px] [text-shadow:-1px_-1px_0_black,1px_-1px_0_black]" },
  { id: "gradient-pop",   label: "Gradient Pop",   desc: "Purple-pink gradient",    preview: "GRAD",   previewClass: "font-black text-[9px] bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent" },
  { id: "clean-mid",      label: "Clean Mid",      desc: "Centered pill, minimal",  preview: "MID",    previewClass: "bg-black/50 text-white font-bold px-1 rounded text-[8px]" },
  { id: "electric-blue",  label: "Electric",       desc: "Bright blue glow, mid",   preview: "ELEC",   previewClass: "text-cyan-400 font-black text-[9px]" },
  { id: "solo-pop",       label: "Solo Pop",       desc: "One word, big & bold",    preview: "ONE",    previewClass: "text-white font-black text-[9px] [text-shadow:-2px_-2px_0_black,2px_-2px_0_black]" },
  { id: "solo-red",       label: "Solo Red",       desc: "One word, red glow",      preview: "RED",    previewClass: "text-red-500 font-black text-[9px] [text-shadow:-2px_-2px_0_black,2px_-2px_0_black]" },
  { id: "solo-glow",      label: "Solo Glow",      desc: "One word, green neon",    preview: "GLO",    previewClass: "text-[#00FF88] font-black text-[9px]" },
  { id: "solo-box",       label: "Solo Box",       desc: "One word, yellow pill",   preview: "BOX",    previewClass: "bg-yellow-400 text-black font-black px-1 rounded text-[8px]" },
  { id: "solo-gradient",  label: "Solo Grad",      desc: "One word, purple grad",   preview: "PRPL",   previewClass: "font-black text-[9px] bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent" },
  { id: "solo-shake",     label: "Solo Shake",     desc: "One word, shaking",       preview: "SHKK",   previewClass: "text-white font-black text-[9px] [text-shadow:-2px_-2px_0_red,2px_-2px_0_red]" },
];

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const TRANSLATE_LANGS = [
  { code: "en", label: "English"    },
  { code: "hi", label: "Hindi"      },
  { code: "ta", label: "Tamil"      },
  { code: "te", label: "Telugu"     },
  { code: "kn", label: "Kannada"    },
  { code: "ml", label: "Malayalam"  },
  { code: "es", label: "Spanish"    },
  { code: "fr", label: "French"     },
  { code: "de", label: "German"     },
  { code: "zh", label: "Chinese"    },
  { code: "ja", label: "Japanese"   },
  { code: "ko", label: "Korean"     },
  { code: "ar", label: "Arabic"     },
  { code: "pt", label: "Portuguese" },
];

export default function ClipRefinePage() {
  const { clipId }   = useParams<{ clipId: string }>();
  const sp           = useSearchParams();
  const router       = useRouter();
  const apiFetch     = useApiFetch();

  const src   = sp.get("src")   ?? "";
  const score = sp.get("score") ?? "–";
  const index = sp.get("index") ?? "?";

  const videoRef              = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [activeTab, setActiveTab]     = useState("captions");

  // Caption state
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("none");
  const [captionWords, setCaptionWords] = useState<CaptionWord[]>([]);
  const [captionLang, setCaptionLang]   = useState("");
  const [translating, setTranslating]   = useState(false);
  const [activeLang, setActiveLang]     = useState("");

  // Other settings
  const [speed, setSpeed]             = useState(1.0);
  const [trimStart, setTrimStart]     = useState(0);
  const [trimEnd, setTrimEnd]         = useState(0);
  const [brightness, setBrightness]   = useState(100);
  const [contrast, setContrast]       = useState(100);
  const [saturation, setSaturation]   = useState(100);

  // Load captions from API
  useEffect(() => {
    if (!clipId) return;
    apiFetch(`${API_URL}/api/clips/${clipId}/captions`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.captions?.length) {
          setCaptionWords(data.captions);
          setCaptionLang(data.lang ?? "");
          setActiveLang(data.lang?.split("-")[0] ?? "");
        }
      })
      .catch(() => {});
  }, [clipId]);

  const handleTranslate = async (lang: string) => {
    if (!lang || lang === activeLang || translating) return;
    setTranslating(true);
    try {
      const r = await apiFetch(`${API_URL}/api/clips/${clipId}/captions/translate/${lang}`);
      if (r.ok) {
        const data = await r.json();
        setCaptionWords(data.captions);
        setActiveLang(lang);
        setCaptionLang(lang);
      }
    } finally {
      setTranslating(false);
    }
  };

  // Sync speed
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };

  const effectiveTrimEnd = trimEnd > 0 ? trimEnd : duration;

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const filterStyle = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <Topbar />

      <main className="ml-14 mt-12 flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>

        {/* ── LEFT: Video ── */}
        <div className="flex flex-col flex-1 bg-black items-center justify-center relative border-r border-white/6">
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-[12px] text-white/50 hover:text-white transition-colors backdrop-blur-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>

          <div className="absolute top-4 right-4 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-[11px] text-white/40">Clip #{index}</span>
            <span className="text-[11px] text-white/20">·</span>
            <span className="text-[11px] font-semibold text-white/70">Score {score}</span>
          </div>

          <div className="relative flex items-center justify-center w-full h-full px-8 py-16">
            {src ? (
              <div
                className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/80"
                style={{ maxHeight: "calc(100vh - 200px)", maxWidth: "min(380px, 100%)", aspectRatio: "9/16" }}
              >
                <video
                  ref={videoRef}
                  src={src}
                  muted={muted}
                  playsInline
                  loop
                  className="w-full h-full object-cover"
                  style={{ filter: filterStyle }}
                  onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                  onLoadedMetadata={() => {
                    const d = videoRef.current?.duration ?? 0;
                    setDuration(d);
                    setTrimEnd(d);
                  }}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />

                {/* Caption canvas overlay */}
                <CaptionRenderer videoRef={videoRef} words={captionWords} style={captionStyle} />

                {/* Play/pause tap */}
                <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
                  {!playing && (
                    <div className="h-14 w-14 flex items-center justify-center rounded-full bg-black/50 border border-white/20 backdrop-blur-sm">
                      <Play className="h-6 w-6 fill-white text-white ml-1" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-white/20 text-[13px]">No clip source found.</p>
            )}
          </div>

          {/* Playback controls */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 flex flex-col gap-2">
            <input
              type="range" min={0} max={duration || 1} step={0.01} value={currentTime}
              onChange={e => { const t = Number(e.target.value); setCurrentTime(t); if (videoRef.current) videoRef.current.currentTime = t; }}
              className="w-full accent-white cursor-pointer h-1"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="h-8 w-8 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-colors">
                  {playing ? <Pause className="h-3.5 w-3.5 fill-black" /> : <Play className="h-3.5 w-3.5 fill-black ml-0.5" />}
                </button>
                <button onClick={() => setMuted(m => !m)} className="text-white/40 hover:text-white transition-colors">
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <span className="text-[11px] font-mono text-white/35">{fmt(currentTime)} / {fmt(duration)}</span>
                {speed !== 1 && <span className="text-[10px] font-semibold text-white/50 bg-white/8 px-1.5 py-0.5 rounded">{speed}×</span>}
              </div>
              <a
                href={src} download={`clip-${index}.mp4`}
                className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[12px] font-semibold text-black hover:bg-white/90 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Edit panel ── */}
        <div className="w-[320px] shrink-0 flex flex-col bg-[#0f0f0f] overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/6">
            {TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors border-b-2",
                  activeTab === id ? "border-white text-white" : "border-transparent text-white/30 hover:text-white/60"
                )}
              >
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 no-scrollbar">

            {/* ── Captions ── */}
            {activeTab === "captions" && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-medium text-white/70">Animation style</p>
                  <span className="text-[10px] text-white/25">
                    {captionWords.length > 0 ? `${captionWords.length} words` : "No captions yet"}
                  </span>
                </div>

                {/* Scrollable style grid — fixed height so translation stays visible */}
                <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: 360 }}>
                  <div className="grid grid-cols-2 gap-2 pr-0.5">
                    {CAPTION_STYLES.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setCaptionStyle(s.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all",
                          captionStyle === s.id ? "border-white/40 bg-white/8" : "border-white/8 bg-white/3 hover:border-white/16"
                        )}
                      >
                        <div className="h-8 w-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center shrink-0 overflow-hidden">
                          {s.preview
                            ? <span className={cn("leading-none text-center block truncate px-0.5", s.previewClass)}>{s.preview}</span>
                            : <span className="text-white/20 text-[11px]">⊘</span>
                          }
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-[10px] font-semibold text-white/80 leading-tight truncate">{s.label}</span>
                          <span className="text-[8px] text-white/30 leading-tight truncate">{s.desc}</span>
                        </div>
                        {captionStyle === s.id && <Check className="h-3 w-3 text-white/60 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-white/6" />

                {/* Translation */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Languages className="h-3.5 w-3.5 text-white/40" />
                    <p className="text-[12px] font-medium text-white/70">Translate captions</p>
                    {translating && <Loader2 className="h-3 w-3 animate-spin text-white/40 ml-auto" />}
                  </div>
                  {captionLang && (
                    <p className="text-[10px] text-white/25">
                      Current language: <span className="text-white/45">{captionLang}</span>
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {TRANSLATE_LANGS.map(l => (
                      <button
                        key={l.code}
                        onClick={() => handleTranslate(l.code)}
                        disabled={translating || l.code === activeLang}
                        className={cn(
                          "rounded-lg border py-1.5 text-[10px] font-medium transition-all disabled:opacity-40",
                          activeLang === l.code
                            ? "border-white/30 bg-white/10 text-white/80"
                            : "border-white/8 text-white/35 hover:border-white/20 hover:text-white/60"
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Speed ── */}
            {activeTab === "speed" && (
              <div className="flex flex-col gap-4">
                <p className="text-[12px] font-medium text-white/70">Playback speed</p>
                <div className="grid grid-cols-3 gap-2">
                  {SPEED_PRESETS.map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className={cn("rounded-xl border py-2.5 text-[13px] font-semibold transition-all",
                        speed === s ? "border-white/40 bg-white/10 text-white" : "border-white/8 text-white/35 hover:text-white/60"
                      )}>
                      {s}×
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span className="text-[12px] text-white/50">Custom</span>
                    <span className="text-[12px] font-semibold text-white/70">{speed}×</span>
                  </div>
                  <input type="range" min={0.25} max={3} step={0.05} value={speed}
                    onChange={e => setSpeed(Number(e.target.value))}
                    className="w-full accent-white cursor-pointer" />
                  <div className="flex justify-between text-[10px] text-white/20">
                    <span>0.25×</span><span>1×</span><span>3×</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Trim ── */}
            {activeTab === "trim" && (
              <div className="flex flex-col gap-4">
                <p className="text-[12px] font-medium text-white/70">Trim clip</p>
                {[
                  { label: "Start", value: trimStart, set: setTrimStart, other: effectiveTrimEnd, isStart: true },
                  { label: "End",   value: effectiveTrimEnd, set: (v: number) => setTrimEnd(Math.max(v, trimStart + 0.5)), other: trimStart, isStart: false },
                ].map(({ label, value, set, other, isStart }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] text-white/40">
                      <span>{label}</span><span>{fmt(value)}</span>
                    </div>
                    <input type="range" min={0} max={duration} step={0.1} value={value}
                      onChange={e => {
                        const v = Number(e.target.value);
                        set(isStart ? Math.min(v, other - 0.5) : Math.max(v, other + 0.5));
                        if (videoRef.current) videoRef.current.currentTime = v;
                      }}
                      className="w-full accent-white cursor-pointer" />
                  </div>
                ))}
                <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 flex justify-between">
                  <span className="text-[12px] text-white/40">Duration after trim</span>
                  <span className="text-[13px] font-semibold text-white/70">{fmt(effectiveTrimEnd - trimStart)}</span>
                </div>
              </div>
            )}

            {/* ── Enhance ── */}
            {activeTab === "enhance" && (
              <div className="flex flex-col gap-4">
                <p className="text-[12px] font-medium text-white/70">Visual adjustments</p>
                {[
                  { label: "Brightness", value: brightness, set: setBrightness, min: 50, max: 150 },
                  { label: "Contrast",   value: contrast,   set: setContrast,   min: 50, max: 150 },
                  { label: "Saturation", value: saturation, set: setSaturation, min: 0,  max: 200 },
                ].map(({ label, value, set, min, max }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] text-white/40">
                      <span>{label}</span><span>{value}%</span>
                    </div>
                    <input type="range" min={min} max={max} step={1} value={value}
                      onChange={e => set(Number(e.target.value))}
                      className="w-full accent-white cursor-pointer" />
                  </div>
                ))}
                <button
                  onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); }}
                  className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
                >
                  Reset to default
                </button>
              </div>
            )}
          </div>

          {/* Export */}
          <div className="p-4 border-t border-white/6">
            <button className="w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all">
              Export clip
            </button>
            <p className="text-[11px] text-white/20 text-center mt-2">Settings applied on export</p>
          </div>
        </div>
      </main>
    </div>
  );
}
