"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useApiFetch } from "@/lib/apiFetch";
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX,
  Captions, Gauge, Scissors, Sparkles, Check, Loader2, Languages, CheckCircle, AlertCircle, X, Layers,
} from "lucide-react";
import Sidebar from "../../_components/sidebar";
import Topbar from "../../_components/topbar";
import { cn } from "@/lib/utils";
import CaptionRenderer, { type CaptionStyle, type CaptionWord } from "./_components/caption-renderer";
import BackgroundRenderer, { STICKERS, type PlacedSticker, type ImageSegmenterRef } from "./_components/background-renderer";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Open the exported video in a new tab AND force a download to the local machine.
 * The `download` attribute is ignored for cross-origin URLs (S3), so we fetch
 * the file as a blob and download via an object URL. Falls back to a direct
 * anchor click if the blob fetch is blocked (e.g. CORS).
 */
async function openAndDownload(url: string, filename: string) {
  // Open the exported video in a new tab
  window.open(url, "_blank", "noopener,noreferrer");

  // Force a real local download
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob    = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a       = document.createElement("a");
    a.href        = blobUrl;
    a.download    = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  } catch {
    // Fallback: best-effort direct download (may open instead of saving)
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.target   = "_blank";
    a.rel      = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "captions",    icon: Captions,  label: "Captions" },
  { id: "stickers",    icon: Layers,    label: "Stickers" },
  { id: "speed",       icon: Gauge,     label: "Speed" },
  { id: "trim",        icon: Scissors,  label: "Trim" },
  { id: "enhance",     icon: Sparkles,  label: "Enhance" },
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

// ── Sticker preview thumbnail (renders on a tiny canvas) ─────────────────────
function StickerPreview({ stickerId, size }: { stickerId: string; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const def = STICKERS.find(s => s.id === stickerId);
    if (!def) return;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    def.draw(ctx, size * 0.9, 0);
    ctx.restore();
  }, [stickerId, size]);
  return <canvas ref={canvasRef} width={size} height={size} className="shrink-0" />;
}

// ── Shared edit panel (desktop sidebar + mobile drawer) ─────────────────────
interface EditPanelProps {
  activeTab: string;
  captionStyle: CaptionStyle;
  setCaptionStyle: (s: CaptionStyle) => void;
  captionWords: CaptionWord[];
  captionFontSize: number;
  setCaptionFontSize: (n: number) => void;
  captionPosY: number;
  setCaptionPosY: (n: number) => void;
  captionLang: string;
  activeLang: string;
  translating: boolean;
  handleTranslate: (lang: string) => void;
  speed: number;
  setSpeed: (n: number) => void;
  trimStart: number;
  setTrimStart: (n: number) => void;
  effectiveTrimEnd: number;
  setTrimEnd: (n: number) => void;
  duration: number;
  fmt: (s: number) => string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  brightness: number;
  setBrightness: (n: number) => void;
  contrast: number;
  setContrast: (n: number) => void;
  saturation: number;
  setSaturation: (n: number) => void;
  exportPhase: "idle" | "exporting" | "done" | "error";
  exportProgress: number;
  exportUrl: string | null;
  handleExport: () => void;
  setExportPhase: (p: "idle" | "exporting" | "done" | "error") => void;
  setExportUrl: (u: string | null) => void;
  styleGridMaxHeight?: number | string;
  // Background overlay
  placedStickers: PlacedSticker[];
  setPlacedStickers: (s: PlacedSticker[]) => void;
  segmentationReady: boolean;
}

function EditPanelContent({
  activeTab, captionStyle, setCaptionStyle, captionWords, captionFontSize, setCaptionFontSize,
  captionPosY, setCaptionPosY,
  captionLang, activeLang, translating, handleTranslate,
  speed, setSpeed, trimStart, setTrimStart, effectiveTrimEnd, setTrimEnd, duration, fmt, videoRef,
  brightness, setBrightness, contrast, setContrast, saturation, setSaturation,
  exportPhase, exportProgress, exportUrl, handleExport, setExportPhase, setExportUrl,
  styleGridMaxHeight = 360,
  placedStickers, setPlacedStickers, segmentationReady,
}: EditPanelProps) {
  return (
    <>
      {activeTab === "captions" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-white/70">Animation style</p>
            <span className="text-[10px] text-white/25">
              {captionWords.length > 0 ? `${captionWords.length} words` : "No captions yet"}
            </span>
          </div>

          <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: styleGridMaxHeight }}>
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

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-white/50">Font size</span>
              <span className="text-[11px] font-semibold text-white/60">{captionFontSize}px</span>
            </div>
            <input
              type="range" min={14} max={72} step={2}
              value={captionFontSize}
              onChange={e => setCaptionFontSize(Number(e.target.value))}
              className="w-full accent-white cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-white/20">
              <span>14px</span><span>72px</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-white/50">Vertical position</span>
              <span className="text-[11px] font-semibold text-white/60">
                {captionPosY === 0 ? "Default" : `${captionPosY > 0 ? "+" : ""}${captionPosY}`}
              </span>
            </div>
            <input
              type="range" min={-100} max={100} step={5}
              value={captionPosY}
              onChange={e => setCaptionPosY(Number(e.target.value))}
              className="w-full accent-white cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-white/20">
              <span>Higher</span><span>Lower</span>
            </div>
          </div>

          <div className="h-px bg-white/6" />

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

      {activeTab === "stickers" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-white/70">Stickers</p>
            {placedStickers.length > 0 && (
              <span className={cn(
                "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full",
                segmentationReady
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-white/8 text-white/30"
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", segmentationReady ? "bg-emerald-400" : "bg-white/30 animate-pulse")} />
                {segmentationReady ? "Behind person" : "Loading AI…"}
              </span>
            )}
          </div>

          <p className="text-[10px] text-white/30">Tap to add. Stickers appear behind the person.</p>

          <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: styleGridMaxHeight }}>
            <div className="grid grid-cols-2 gap-2 pr-0.5">
              {STICKERS.map(s => {
                const isPlaced = placedStickers.some(ps => ps.stickerId === s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (isPlaced) {
                        setPlacedStickers(placedStickers.filter(ps => ps.stickerId !== s.id));
                      } else {
                        setPlacedStickers([...placedStickers, {
                          stickerId: s.id,
                          x: 0.15 + Math.random() * 0.7,
                          y: 0.15 + Math.random() * 0.7,
                          scale: 1,
                        }]);
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 transition-all",
                      isPlaced ? "border-white/40 bg-white/10" : "border-white/8 bg-white/3 hover:border-white/16"
                    )}
                  >
                    <StickerPreview stickerId={s.id} size={40} />
                    <span className="text-[10px] text-white/50 truncate w-full text-center">{s.label}</span>
                    {isPlaced && <Check className="h-3 w-3 text-white/50" />}
                  </button>
                );
              })}
            </div>
          </div>

          {placedStickers.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="h-px bg-white/6" />
              <p className="text-[10px] font-medium text-white/50">Placed ({placedStickers.length})</p>
              {placedStickers.map((ps, i) => {
                const def = STICKERS.find(s => s.id === ps.stickerId);
                return (
                  <div key={ps.stickerId} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-2 py-1.5">
                    <StickerPreview stickerId={ps.stickerId} size={24} />
                    <span className="text-[10px] text-white/60 flex-1">{def?.label}</span>
                    <input
                      type="range" min={0.3} max={2} step={0.1}
                      value={ps.scale}
                      onChange={e => {
                        const updated = [...placedStickers];
                        updated[i] = { ...ps, scale: Number(e.target.value) };
                        setPlacedStickers(updated);
                      }}
                      className="w-16 accent-white cursor-pointer"
                      title="Size"
                    />
                    <button
                      onClick={() => setPlacedStickers(placedStickers.filter((_, j) => j !== i))}
                      className="text-white/30 hover:text-red-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => setPlacedStickers([])}
                className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
              >
                Remove all
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "speed" && (        <div className="flex flex-col gap-4">
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
    </>
  );
}

function ExportSection({
  exportPhase, exportProgress, exportUrl, handleExport, setExportPhase, setExportUrl,
  compact = false,
}: Pick<EditPanelProps, "exportPhase" | "exportProgress" | "exportUrl" | "handleExport" | "setExportPhase" | "setExportUrl"> & { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {exportPhase === "idle" && (
        <button
          onClick={handleExport}
          className="w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all"
        >
          Export clip
        </button>
      )}

      {exportPhase === "exporting" && (
        <>
          <div className="flex items-center justify-between text-[11px] text-white/40 mb-1">
            <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Rendering…</span>
            <span>{exportProgress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10">
            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${exportProgress}%` }} />
          </div>
        </>
      )}

      {exportPhase === "done" && exportUrl && (
        <>
          <div className="flex items-center gap-2 text-[12px] text-green-400">
            <CheckCircle className="h-4 w-4" /> Export ready!
          </div>
          <div className="flex gap-2">
            <a
              href={exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-2xl border border-white/15 py-3 text-center text-[13px] font-semibold text-white hover:bg-white/8 transition-all"
            >
              Open
            </a>
            <button
              onClick={() => openAndDownload(exportUrl, "clip.mp4")}
              className="flex-1 rounded-2xl bg-white py-3 text-[13px] font-semibold text-black hover:bg-white/90 transition-all"
            >
              Download
            </button>
          </div>
          <button onClick={() => { setExportPhase("idle"); setExportUrl(null); }} className="text-[11px] text-white/25 hover:text-white/50 transition-colors text-center">
            Export again
          </button>
        </>
      )}

      {exportPhase === "error" && (
        <>
          <div className="flex items-center gap-2 text-[12px] text-red-400 mb-1">
            <AlertCircle className="h-4 w-4" /> Export failed
          </div>
          <button
            onClick={() => setExportPhase("idle")}
            className="w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-black hover:bg-white/90 transition-all"
          >
            Try again
          </button>
        </>
      )}

      {!compact && exportPhase === "idle" && (
        <p className="text-[11px] text-white/20 text-center">Settings applied on export</p>
      )}
    </div>
  );
}

export default function ClipRefinePage() {
  const isMobile = useIsMobile();
  const { clipId }   = useParams<{ clipId: string }>();
  const sp           = useSearchParams();
  const router       = useRouter();
  const apiFetch     = useApiFetch();

  const src       = sp.get("src")       ?? "";
  const score     = sp.get("score")     ?? "–";
  const index     = sp.get("index")     ?? "?";
  const projectId = sp.get("projectId") ?? "";

  const [aspectRatio, setAspectRatio] = useState("9:16");

  const videoRef              = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [activeTab, setActiveTab]     = useState("captions");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);

  // Caption state
  const [captionStyle, setCaptionStyle]   = useState<CaptionStyle>("none");
  const [captionWords, setCaptionWords]   = useState<CaptionWord[]>([]);
  const [captionLang, setCaptionLang]     = useState("");
  const [captionFontSize, setCaptionFontSize] = useState(28);
  const [captionPosY, setCaptionPosY]         = useState(0);
  const [translating, setTranslating]     = useState(false);
  const [activeLang, setActiveLang]       = useState("");

  // Other settings
  const [speed, setSpeed]             = useState(1.0);
  const [trimStart, setTrimStart]     = useState(0);
  const [trimEnd, setTrimEnd]         = useState(0);
  const [brightness, setBrightness]   = useState(100);
  const [contrast, setContrast]       = useState(100);
  const [saturation, setSaturation]   = useState(100);

  // Background overlay
  const [placedStickers, setPlacedStickers]     = useState<PlacedSticker[]>([]);
  const [segmentationReady, setSegmentationReady] = useState(false);
  const segmenterRef = useRef<ImageSegmenterRef | null>(null);

  // Export state
  const [exportPhase, setExportPhase]       = useState<"idle" | "exporting" | "done" | "error">("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl]           = useState<string | null>(null);
  const exportPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sticker drag state — using refs so no stale closures
  const dragRef = useRef<{ idx: number; rectLeft: number; rectTop: number; rectW: number; rectH: number } | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Load project aspect ratio
  useEffect(() => {
    if (!projectId) return;
    apiFetch(`${API_URL}/api/projects/${projectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.aspectRatio) setAspectRatio(data.aspectRatio); })
      .catch(() => {});
  }, [projectId]);

  // Load clip (settings + captions) on mount — single fetch to avoid race conditions
  useEffect(() => {
    if (!clipId) return;

    apiFetch(`${API_URL}/api/clips/${clipId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;

        // Apply saved edit settings first
        const s = data.editSettings;
        if (s) {
          if (s.captionStyle)          setCaptionStyle(s.captionStyle);
          if (s.captionFontSize != null) setCaptionFontSize(s.captionFontSize);
          if (s.captionPosY != null) setCaptionPosY(s.captionPosY);
          if (s.speed      != null) setSpeed(s.speed);
          if (s.trimStart  != null) setTrimStart(s.trimStart);
          if (s.trimEnd    != null) setTrimEnd(s.trimEnd);
          if (s.brightness != null) setBrightness(s.brightness);
          if (s.contrast   != null) setContrast(s.contrast);
          if (s.saturation != null) setSaturation(s.saturation);

          // Use saved translated captions if present, else fall back to original
          if (s.captionWords?.length) {
            setCaptionWords(s.captionWords);
            setCaptionLang(s.captionLang ?? "");
            setActiveLang(s.captionLang ?? "");
            return; // don't overwrite with original below
          }
        }

        // No saved translation — use original captions from clip
        if (data.captions?.length) {
          setCaptionWords(data.captions);
          setCaptionLang(data.captionLang ?? "");
          setActiveLang((data.captionLang ?? "").split("-")[0]);
        }
      })
      .catch(() => {});
  }, [clipId]);

  // Debounced auto-save edit settings
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSettings = useCallback((settings: object) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      apiFetch(`${API_URL}/api/clips/${clipId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }).catch(() => {});
    }, 800);
  }, [clipId]);

  // Auto-save whenever any setting changes (captionWords saved too so translation persists)
  useEffect(() => {
    if (!clipId) return;
    saveSettings({ captionStyle, captionFontSize, captionPosY, captionLang: activeLang, captionWords, speed, trimStart, trimEnd, brightness, contrast, saturation });
  }, [captionStyle, captionFontSize, captionPosY, activeLang, captionWords, speed, trimStart, trimEnd, brightness, contrast, saturation]);

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

  // Cleanup export poll on unmount
  useEffect(() => () => { if (exportPollRef.current) clearInterval(exportPollRef.current); }, []);

  const handleExport = async () => {
    if (!src || exportPhase === "exporting") return;
    setExportPhase("exporting");
    setExportProgress(0);
    setExportUrl(null);

    try {
      // Build a single-clip timeline from this clip's current settings
      const effectiveEnd = trimEnd > 0 ? trimEnd : duration;
      const clipDuration = effectiveEnd - trimStart;

      const tracks = [
        {
          id: "track-video",
          items: [{
            id: clipId,
            type: "video",
            startTime: 0,
            duration: clipDuration,
            sourceDuration: duration,
            trimIn: trimStart,
            trimOut: duration - effectiveEnd,
            src,
          }],
        },
        { id: "track-audio", items: [] },
      ];

      const res = await apiFetch(`${API_URL}/api/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectId || clipId,
          tracks,
          volumes:      { [clipId]: 100 },
          speeds:       { [clipId]: speed },
          captionStyle,
          captionFontSize,
          captionPosY,
          captionMap:     captionWords.length ? { [clipId]: captionWords } : {},
          aspectRatio,
          brightness,
          contrast,
          saturation,
          originalClipId: clipId,
          stickers: placedStickers,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === "insufficient_credits") {
          alert(err.message ?? "Insufficient credits to export. Please upgrade your plan or purchase credits.");
          setExportPhase("idle");
          return;
        }
        throw new Error(err.error ?? "Export failed");
      }

      const { exportId } = await res.json();

      exportPollRef.current = setInterval(async () => {
        try {
          const r = await apiFetch(`${API_URL}/api/exports/${exportId}`);
          const data = await r.json();
          setExportProgress(data.progress ?? 0);
          if (data.status === "done") {
            clearInterval(exportPollRef.current!);
            setExportUrl(data.s3Url);
            setExportPhase("done");
            // Open the exported video in a new tab + force a local download.
            openAndDownload(data.s3Url, `clip-${index}.mp4`);
          } else if (data.status === "failed") {
            clearInterval(exportPollRef.current!);
            setExportPhase("error");
          }
        } catch { /* keep polling */ }
      }, 2500);
    } catch {
      setExportPhase("error");
    }
  };

  // Sync speed
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  // Load MediaPipe segmentation lazily when user picks an overlay
  useEffect(() => {
    if (placedStickers.length === 0 || segmenterRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );
        const seg = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
            delegate: "GPU",
          },
          outputCategoryMask: true,
          outputConfidenceMasks: false,
          runningMode: "VIDEO",
        });
        if (!cancelled) {
          segmenterRef.current = seg as unknown as ImageSegmenterRef;
          setSegmentationReady(true);
        }
      } catch {
        // GPU delegate might fail on some browsers — silently continue without segmentation
      }
    })();
    return () => { cancelled = true; };
  }, [placedStickers.length]);
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };

  const effectiveTrimEnd = trimEnd > 0 ? trimEnd : duration;

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const filterStyle = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  const editPanelProps: EditPanelProps = {
    activeTab, captionStyle, setCaptionStyle, captionWords, captionFontSize, setCaptionFontSize,
    captionPosY, setCaptionPosY,
    captionLang, activeLang, translating, handleTranslate,
    speed, setSpeed, trimStart, setTrimStart, effectiveTrimEnd, setTrimEnd, duration, fmt, videoRef,
    brightness, setBrightness, contrast, setContrast, saturation, setSaturation,
    exportPhase, exportProgress, exportUrl, handleExport, setExportPhase, setExportUrl,
    placedStickers, setPlacedStickers, segmentationReady,
  };
  const handleMobileTab = (id: string) => {
    if (activeTab === id && mobileDrawerOpen) {
      setMobileDrawerOpen(false);
    } else {
      setActiveTab(id);
      if (!drawerMounted) setDrawerMounted(true);
      setMobileDrawerOpen(true);
    }
  };

  const closeDrawer = () => setMobileDrawerOpen(false);

  const activeTabLabel = TABS.find(t => t.id === activeTab)?.label ?? "";

  // Height breakdown on mobile:
  //   system nav (MobileBottomBar): fixed bottom-0, h-12 = 48px
  //   bottom strip (tabs + export):  fixed bottom-12, ~96px
  //   total reserved at bottom:      ~144px = 9rem
  const MOBILE_STRIP_BOTTOM = "3rem";      // = bottom-12, above system nav
  const MOBILE_DRAWER_BOTTOM = "9rem";     // strip top edge = 48 + 96 = 144px

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <Topbar />

      <main
        className={cn(
          "mt-12 flex-1 flex overflow-hidden",
          isMobile ? "flex-col ml-0 pb-[9rem]" : "flex-row ml-14 pb-0"
        )}
        style={{ height: "calc(100vh - 48px)" }}
      >

        {/* ── Video preview ── */}
        <div className={cn(
          "flex flex-col flex-1 min-h-0 bg-black items-center justify-center relative",
          !isMobile && "border-r border-white/6"
        )}>
          <button
            onClick={() => router.back()}
            className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-2.5 py-1.5 text-[11px] text-white/50 hover:text-white transition-colors backdrop-blur-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>

          <div className="absolute top-3 right-3 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-sm">
            <span className="text-[10px] text-white/40">Clip #{index}</span>
            <span className="text-[10px] text-white/20">·</span>
            <span className="text-[10px] font-semibold text-white/70">Score {score}</span>
          </div>

          <div className={cn(
            "relative flex items-center justify-center w-full h-full",
            isMobile ? "px-3 py-3" : "px-8 py-16"
          )}>
            {src ? (
              <div
                ref={videoContainerRef}
                className="relative rounded-xl md:rounded-2xl shadow-2xl shadow-black/80 w-full h-full max-w-full"
                style={{
                  aspectRatio: aspectRatio === "16:9" ? "16/9" : aspectRatio === "1:1" ? "1/1" : "9/16",
                  maxHeight: "100%",
                  maxWidth: aspectRatio === "16:9"
                    ? "min(780px, 100%)"
                    : aspectRatio === "1:1"
                      ? "min(560px, 100%)"
                      : "min(380px, 100%)",
                }}
              >
                {/* Clip the video/canvas layers but NOT the drag handles */}
                <div className="absolute inset-0 rounded-xl md:rounded-2xl overflow-hidden">
                  <BackgroundRenderer
                    videoRef={videoRef}
                    placedStickers={placedStickers}
                    segmentationReady={segmentationReady}
                    segmenter={segmenterRef}
                    filterStyle={filterStyle}
                  />
                  <video
                    ref={videoRef}
                    src={src}
                    muted={muted}
                    playsInline
                    loop
                    className="w-full h-full object-cover"
                    style={{
                      filter: filterStyle,
                      opacity: placedStickers.length > 0 && segmentationReady ? 0 : 1,
                    }}
                    onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                    onLoadedMetadata={() => {
                      const d = videoRef.current?.duration ?? 0;
                      setDuration(d);
                      setTrimEnd(d);
                    }}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                  />
                  <CaptionRenderer videoRef={videoRef} words={captionWords} style={captionStyle} fontSize={captionFontSize} aspectRatio={aspectRatio} posOffset={captionPosY} />
                  {/* Play/pause tap target — only active when NO drag in progress */}
                  <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer"
                    style={{ zIndex: 3 }}
                    onClick={(e) => {
                      if (dragRef.current) return;
                      togglePlay();
                    }}
                  >
                    {!playing && (
                      <div className="h-14 w-14 flex items-center justify-center rounded-full bg-black/50 border border-white/20 backdrop-blur-sm pointer-events-none">
                        <Play className="h-6 w-6 fill-white text-white ml-1" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Draggable sticker handles — outside overflow-hidden so they can be dragged freely */}
                {placedStickers.map((ps, i) => (
                  <div
                    key={ps.stickerId}
                    className="absolute cursor-grab active:cursor-grabbing touch-none select-none"
                    style={{
                      left: `${ps.x * 100}%`,
                      top: `${ps.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      zIndex: 10,
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = videoContainerRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      dragRef.current = {
                        idx: i,
                        rectLeft: rect.left,
                        rectTop: rect.top,
                        rectW: rect.width,
                        rectH: rect.height,
                      };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (!dragRef.current) return;
                      const { idx, rectLeft, rectTop, rectW, rectH } = dragRef.current;
                      const nx = Math.max(0.04, Math.min(0.96, (e.clientX - rectLeft) / rectW));
                      const ny = Math.max(0.04, Math.min(0.96, (e.clientY - rectTop) / rectH));
                      setPlacedStickers(prev => {
                        const updated = [...prev];
                        const cur = updated[idx];
                        if (!cur) return prev;
                        updated[idx] = { ...cur, x: nx, y: ny };
                        return updated;
                      });
                    }}
                    onPointerUp={() => { dragRef.current = null; }}
                  >
                    <div className="relative pointer-events-none">
                      <StickerPreview stickerId={ps.stickerId} size={Math.round(48 * ps.scale)} />
                      <div className="absolute -inset-1 rounded-lg border border-dashed border-white/40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/20 text-[13px]">No clip source found.</p>
            )}
          </div>

          {/* Playback controls */}
          <div className={cn(
            "shrink-0 w-full flex flex-col gap-2",
            isMobile ? "px-4 pb-3" : "absolute bottom-0 left-0 right-0 px-6 pb-5"
          )}>
            <input
              type="range" min={0} max={duration || 1} step={0.01} value={currentTime}
              onChange={e => { const t = Number(e.target.value); setCurrentTime(t); if (videoRef.current) videoRef.current.currentTime = t; }}
              className="w-full accent-white cursor-pointer h-1"
            />
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
          </div>
        </div>

        {/* ── Desktop: right edit panel ── */}
        {!isMobile && <div className="flex w-[320px] shrink-0 flex-col bg-[#0f0f0f] overflow-hidden">
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
            <EditPanelContent {...editPanelProps} />
          </div>

          <div className="p-4 border-t border-white/6">
            <ExportSection
              exportPhase={exportPhase}
              exportProgress={exportProgress}
              exportUrl={exportUrl}
              handleExport={handleExport}
              setExportPhase={setExportPhase}
              setExportUrl={setExportUrl}
            />
          </div>
        </div>}
      </main>

      {/* ── MOBILE ONLY — outside <main> ── */}

      {/* Dimmed backdrop */}
      {isMobile && mobileDrawerOpen && (
        <button
          type="button"
          aria-label="Close panel"
          className="fixed inset-0 z-[45] bg-black/50"
          onClick={closeDrawer}
        />
      )}

      {/* Bottom drawer */}
      {isMobile && drawerMounted && (
        <div
          className={cn(
            "fixed left-0 right-0 z-[55] flex flex-col",
            "bg-[#111] rounded-t-[20px] border-t border-white/10 shadow-[0_-12px_48px_rgba(0,0,0,0.8)]",
            "transition-transform duration-300 ease-out",
            !mobileDrawerOpen && "pointer-events-none"
          )}
          style={{
            bottom: MOBILE_DRAWER_BOTTOM,
            maxHeight: "min(60vh, calc(100vh - 16rem))",
            transform: mobileDrawerOpen
              ? "translateY(0)"
              : `translateY(calc(100% + ${MOBILE_DRAWER_BOTTOM}))`,
          }}
        >
          {/* Drag handle pill */}
          <div className="flex justify-center pt-3 pb-0 shrink-0">
            <div className="h-[3px] w-9 rounded-full bg-white/25" />
          </div>

          {/* Header: title + close */}
          <div className="flex items-center justify-between px-4 pt-2 pb-2 shrink-0">
            <p className="text-[13px] font-semibold text-white">{activeTabLabel}</p>
            <button
              onClick={closeDrawer}
              className="h-7 w-7 flex items-center justify-center rounded-full bg-white/8 text-white/40 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Scrollable edit content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar min-h-0">
            <EditPanelContent {...editPanelProps} styleGridMaxHeight={200} />
          </div>
        </div>
      )}

      {/* ── Mobile bottom strip (tab icons + export button) ── */}
      {isMobile && <div
        className="fixed left-0 right-0 z-50 bg-[#0a0a0a]"
        style={{ bottom: MOBILE_STRIP_BOTTOM }}
      >
        {/* Tab row */}
        <div className="flex items-stretch border-b border-white/6">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => handleMobileTab(id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 h-11 text-[9px] font-medium transition-all",
                activeTab === id && mobileDrawerOpen
                  ? "text-white bg-white/8"
                  : "text-white/40 active:bg-white/5"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Export — compact, no helper text */}
        <div className="px-4 py-2">
          <ExportSection
            exportPhase={exportPhase}
            exportProgress={exportProgress}
            exportUrl={exportUrl}
            handleExport={handleExport}
            setExportPhase={setExportPhase}
            setExportUrl={setExportUrl}
            compact
          />
        </div>
      </div>}
    </div>
  );
}
