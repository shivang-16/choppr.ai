"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
import { useApiFetch } from "@/lib/apiFetch";
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX,
  Captions, Gauge, Scissors, Sparkles, Check, Loader2, Languages, CheckCircle, AlertCircle, X, Layers, Download, ChevronLeft, ChevronRight, Type, Plus, Trash2, Smile,
} from "lucide-react";
import Sidebar from "../../_components/sidebar";
import Topbar from "../../_components/topbar";
import { cn } from "@/lib/utils";
import CaptionRenderer, { type CaptionStyle, type CaptionWord } from "./_components/caption-renderer";
import BackgroundRenderer, { STICKERS, type PlacedSticker, type ImageSegmenterRef } from "./_components/background-renderer";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Text overlay type ─────────────────────────────────────────────────────────
interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

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
  { id: "text",        icon: Type,      label: "Text" },
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
  hideTranscript?: boolean;
  captionStyle: CaptionStyle;
  setCaptionStyle: (s: CaptionStyle) => void;
  captionWords: CaptionWord[];
  onCaptionWordsChange: (words: CaptionWord[]) => void;
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
  exportPhase: "idle" | "exporting" | "done" | "error" | "no_credits";
  exportProgress: number;
  exportUrl: string | null;
  handleExport: () => void;
  setExportPhase: (p: "idle" | "exporting" | "done" | "error" | "no_credits") => void;
  setExportUrl: (u: string | null) => void;
  styleGridMaxHeight?: number | string;
  // Background overlay
  placedStickers: PlacedSticker[];
  setPlacedStickers: (s: PlacedSticker[]) => void;
  segmentationReady: boolean;
  // Text overlays
  textOverlays: TextOverlay[];
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlay[]>>;
  selectedTextId: string | null;
  setSelectedTextId: (id: string | null) => void;
}

function EditPanelContent({
  activeTab, hideTranscript = false, captionStyle, setCaptionStyle, captionWords, onCaptionWordsChange, captionFontSize, setCaptionFontSize,
  captionPosY, setCaptionPosY,
  captionLang, activeLang, translating, handleTranslate,
  speed, setSpeed, trimStart, setTrimStart, effectiveTrimEnd, setTrimEnd, duration, fmt, videoRef,
  brightness, setBrightness, contrast, setContrast, saturation, setSaturation,
  exportPhase, exportProgress, exportUrl, handleExport, setExportPhase, setExportUrl,
  styleGridMaxHeight = 360,
  placedStickers, setPlacedStickers, segmentationReady,
  textOverlays, setTextOverlays, selectedTextId, setSelectedTextId,
}: EditPanelProps) {
  const [emojiOpenId, setEmojiOpenId] = useState<string | null>(null);
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
              type="range" min={14} max={90} step={2}
              value={captionFontSize}
              onChange={e => setCaptionFontSize(Number(e.target.value))}
              className="w-full accent-white cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-white/20">
              <span>14px</span><span>90px</span>
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

          {/* Editable transcript — only shown on mobile (desktop has its own left panel) */}
          {captionWords.length > 0 && !hideTranscript && (
            <div className="flex flex-col gap-2">
              <div className="h-px bg-white/6" />
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-white/70">Transcript</p>
                <span className="text-[10px] text-white/30">Click any word to edit</span>
              </div>
              <div className="flex flex-wrap gap-x-1 gap-y-1.5 rounded-xl border border-white/8 bg-white/3 p-3">
                {captionWords.map((w, i) => (
                  <span
                    key={i}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const newWord = e.currentTarget.textContent?.trim();
                      if (newWord !== undefined && newWord !== w.word) {
                        const updated = [...captionWords];
                        updated[i] = { ...w, word: newWord || w.word };
                        onCaptionWordsChange(updated);
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
                    className="text-[12px] text-white/75 rounded px-0.5 -mx-0.5 outline-none hover:bg-white/8 focus:bg-white/12 focus:text-white cursor-text leading-relaxed"
                  >
                    {w.word}
                  </span>
                ))}
              </div>
            </div>
          )}

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

      {activeTab === "text" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-white/70">Text overlays</p>
            <button
              onClick={() => {
                const id = `txt-${Date.now()}`;
                setTextOverlays(prev => [...prev, { id, text: "Your text", x: 0.5, y: 0.5, fontSize: 20, color: "#ffffff", bold: false, italic: false }]);
                setSelectedTextId(id);
              }}
              className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Add text
            </button>
          </div>

          {textOverlays.length === 0 && (
            <p className="text-[12px] text-white/25 text-center py-6">No text overlays yet.<br />Click "Add text" to start.</p>
          )}

          {textOverlays.map((t) => {
            const isSelected = selectedTextId === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTextId(isSelected ? null : t.id)}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-3 cursor-pointer transition-all",
                  isSelected ? "border-white/30 bg-white/6" : "border-white/8 bg-white/2 hover:border-white/15"
                )}
              >
                {/* Text input + emoji button */}
                <div className="flex items-center gap-1.5 border-b border-white/15 pb-1">
                  <input
                    id={`txt-input-${t.id}`}
                    value={t.text}
                    onChange={(e) => setTextOverlays(prev => prev.map(o => o.id === t.id ? { ...o, text: e.target.value } : o))}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/25"
                    placeholder="Enter text…"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setEmojiOpenId(emojiOpenId === t.id ? null : t.id); setSelectedTextId(t.id); }}
                    className={cn(
                      "flex items-center justify-center h-6 w-6 rounded transition-colors cursor-pointer shrink-0",
                      emojiOpenId === t.id ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/8"
                    )}
                    title="Insert emoji"
                  >
                    <Smile className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Emoji picker */}
                {emojiOpenId === t.id && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <EmojiPicker
                      onEmojiClick={(emojiData) => {
                        const em = emojiData.emoji;
                        const inputEl = document.getElementById(`txt-input-${t.id}`) as HTMLInputElement | null;
                        const pos = inputEl?.selectionStart ?? t.text.length;
                        const newText = t.text.slice(0, pos) + em + t.text.slice(pos);
                        setTextOverlays(prev => prev.map(o => o.id === t.id ? { ...o, text: newText } : o));
                        setEmojiOpenId(null);
                        requestAnimationFrame(() => { inputEl?.focus(); inputEl?.setSelectionRange(pos + em.length, pos + em.length); });
                      }}
                      theme={"dark" as import("emoji-picker-react").Theme}
                      width="100%"
                      height={300}
                      searchDisabled={false}
                      skinTonesDisabled
                      previewConfig={{ showPreview: false }}
                      style={{
                        "--epr-search-input-height": "28px",
                        "--epr-search-input-font-size": "12px",
                        "--epr-search-input-padding": "0 8px 0 30px",
                        "--epr-search-bar-height": "44px",
                        "--epr-category-label-height": "24px",
                        "--epr-emoji-size": "24px",
                        "--epr-emoji-padding": "4px",
                      } as React.CSSProperties}
                    />
                  </div>
                )}

                {/* Font size */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/50">Font size</span>
                    <span className="text-[11px] font-semibold text-white/60">{t.fontSize}px</span>
                  </div>
                  <input
                    type="range" min={12} max={120} step={2}
                    value={t.fontSize}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setTextOverlays(prev => prev.map(o => o.id === t.id ? { ...o, fontSize: Number(e.target.value) } : o))}
                    className="w-full accent-white cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-white/20"><span>12px</span><span>120px</span></div>
                </div>

                {/* Color circle + bold + italic + delete */}
                <div className="flex items-center gap-2">
                  {/* Circular color swatch */}
                  <div className="relative h-6 w-6 shrink-0">
                    <div
                      className="h-6 w-6 rounded-full border-2 border-white/20 cursor-pointer"
                      style={{ background: t.color }}
                      onClick={(e) => { e.stopPropagation(); (e.currentTarget.nextElementSibling as HTMLInputElement | null)?.click(); }}
                    />
                    <input
                      type="color"
                      value={t.color}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setTextOverlays(prev => prev.map(o => o.id === t.id ? { ...o, color: e.target.value } : o))}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  {/* Bold */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setTextOverlays(prev => prev.map(o => o.id === t.id ? { ...o, bold: !o.bold } : o)); }}
                    className={cn("px-2.5 py-1 rounded-lg text-[12px] font-bold transition-colors cursor-pointer", t.bold ? "bg-white/20 text-white" : "bg-white/5 text-white/40 hover:text-white/70")}
                    title="Bold"
                  >B</button>
                  {/* Italic */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setTextOverlays(prev => prev.map(o => o.id === t.id ? { ...o, italic: !o.italic } : o)); }}
                    className={cn("px-2.5 py-1 rounded-lg text-[12px] italic transition-colors cursor-pointer", t.italic ? "bg-white/20 text-white" : "bg-white/5 text-white/40 hover:text-white/70")}
                    title="Italic"
                  >I</button>
                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setTextOverlays(prev => prev.filter(o => o.id !== t.id)); if (selectedTextId === t.id) setSelectedTextId(null); }}
                    className="ml-auto text-white/25 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {textOverlays.length > 0 && (
            <p className="text-[10px] text-white/25 text-center">Drag text on the video to reposition</p>
          )}
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
          <div className="flex items-center gap-2 text-[12px] text-green-400 mb-1">
            <CheckCircle className="h-4 w-4" /> Export ready!
          </div>
          <button
            onClick={() => openAndDownload(exportUrl, "clip.mp4")}
            className="w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all"
          >
            Download
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

      {exportPhase === "no_credits" && (
        <>
          <div className="flex items-center gap-2 text-[12px] text-amber-400 mb-1">
            <AlertCircle className="h-4 w-4" /> Not enough credits to export
          </div>
          <a
            href="/pricing"
            className="w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all text-center block"
          >
            Get more credits →
          </a>
          <button onClick={() => setExportPhase("idle")} className="text-[11px] text-white/25 hover:text-white/50 transition-colors text-center">
            Cancel
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
  const [panelOpen, setPanelOpen]     = useState(true);

  const handleSidebarIconClick = (tabId: string) => {
    if (panelOpen && activeTab === tabId) {
      setPanelOpen(false);
    } else {
      setActiveTab(tabId);
      setPanelOpen(true);
    }
  };

  // Close panel on mobile (isMobile resolves after hydration)
  useEffect(() => { if (isMobile) setPanelOpen(false); }, [isMobile]);

  // Transcript panel resize
  const [transcriptWidth, setTranscriptWidth] = useState(300);
  const transcriptResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const handleTranscriptDragStart = (e: React.PointerEvent) => {
    e.preventDefault();
    transcriptResizeRef.current = { startX: e.clientX, startWidth: transcriptWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: PointerEvent) => {
      if (!transcriptResizeRef.current) return;
      const delta = ev.clientX - transcriptResizeRef.current.startX;
      setTranscriptWidth(Math.max(180, Math.min(520, transcriptResizeRef.current.startWidth + delta)));
    };
    const onUp = () => {
      transcriptResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Caption state
  const [captionStyle, setCaptionStyle]   = useState<CaptionStyle>("none");
  const [captionWords, setCaptionWords]   = useState<CaptionWord[]>([]);
  const [captionLang, setCaptionLang]     = useState("");
  const [captionFontSize, setCaptionFontSize] = useState(50);
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
  const [textOverlays, setTextOverlays]         = useState<TextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId]     = useState<string | null>(null);
  const textDragRef = useRef<{ id: string; rectLeft: number; rectTop: number; rectW: number; rectH: number } | null>(null);
  const [segmentationReady, setSegmentationReady] = useState(false);
  const segmenterRef = useRef<ImageSegmenterRef | null>(null);

  // Export state
  const [exportPhase, setExportPhase]       = useState<"idle" | "exporting" | "done" | "error" | "no_credits">("idle");
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

  // Load clip captions on mount — always start fresh with original captions
  useEffect(() => {
    if (!clipId) return;

    apiFetch(`${API_URL}/api/clips/${clipId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
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

  // Reset export button back to idle when user changes any setting after a successful export
  useEffect(() => {
    if (exportPhase === "done") { setExportPhase("idle"); setExportUrl(null); }
  }, [captionStyle, captionFontSize, captionPosY, captionWords, speed, trimStart, trimEnd, brightness, contrast, saturation, placedStickers, textOverlays]);

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

    // If nothing has been changed from defaults, skip the pipeline entirely
    // and directly download the original S3 clip — no credits consumed.
    const isUnchanged =
      captionStyle === "none" &&
      speed === 1.0 &&
      trimStart === 0 &&
      (trimEnd === 0 || trimEnd >= duration) &&
      brightness === 100 &&
      contrast === 100 &&
      saturation === 100 &&
      placedStickers.length === 0 &&
      textOverlays.length === 0;

    if (isUnchanged) {
      setExportPhase("done");
      setExportUrl(src);
      openAndDownload(src, `clip-${index}.mp4`);
      return;
    }

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
          textOverlays,
          previewWidth: videoContainerRef.current?.clientWidth || 380,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === "insufficient_credits") {
          setExportPhase("no_credits");
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
    activeTab, captionStyle, setCaptionStyle, captionWords,
    onCaptionWordsChange: setCaptionWords,
    captionFontSize, setCaptionFontSize,
    captionPosY, setCaptionPosY,
    captionLang, activeLang, translating, handleTranslate,
    speed, setSpeed, trimStart, setTrimStart, effectiveTrimEnd, setTrimEnd, duration, fmt, videoRef,
    brightness, setBrightness, contrast, setContrast, saturation, setSaturation,
    exportPhase, exportProgress, exportUrl, handleExport, setExportPhase, setExportUrl,
    placedStickers, setPlacedStickers, segmentationReady,
    textOverlays, setTextOverlays, selectedTextId, setSelectedTextId,
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
          "mt-12 flex-1 flex overflow-hidden relative",
          isMobile ? "flex-col ml-0 pb-[9rem]" : "flex-row ml-14 pb-0"
        )}
        style={{ height: "calc(100vh - 48px)" }}
      >

        {/* ── Video area: transcript (left) + drag handle + video preview (right) ── */}
        <div className={cn(
          "flex flex-col flex-1 min-h-0 overflow-hidden relative",
          !isMobile && "border-r border-white/6"
        )}>

          {/* Top row: transcript + video */}
          <div className="flex flex-row flex-1 min-h-0 overflow-hidden">

          {/* Transcript panel — desktop only */}
          {!isMobile && (
            <>
              <div
                style={{ width: transcriptWidth }}
                className="flex flex-col bg-black border-r border-white/8 shrink-0 overflow-hidden min-h-0"
              >
                <div className="px-4 py-3 border-b border-white/6 shrink-0 flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-white/60">Transcript</p>
                  {captionWords.length > 0 && (
                    <span className="text-[10px] text-white/25">{captionWords.length} words</span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-5 no-scrollbar">
                  {captionWords.length > 0 ? (
                    <div className="flex flex-wrap gap-x-2 gap-y-2">
                      {captionWords.map((w, i) => (
                        <span
                          key={i}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newWord = e.currentTarget.textContent?.trim();
                            if (newWord !== undefined && newWord !== w.word) {
                              const updated = [...captionWords];
                              updated[i] = { ...w, word: newWord || w.word };
                              setCaptionWords(updated);
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
                          className={cn(
                            "text-[15px] rounded px-1 -mx-0.5 outline-none cursor-text leading-8 transition-colors",
                            currentTime >= w.start && currentTime <= w.end
                              ? "bg-white/25 text-white"
                              : "text-white hover:bg-white/8 focus:bg-white/12"
                          )}
                        >
                          {w.word}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-white/20 text-center pt-10">No captions available</p>
                  )}
                </div>
              </div>

              {/* Drag handle */}
              <div
                onPointerDown={handleTranscriptDragStart}
                className="relative w-4 shrink-0 cursor-col-resize flex items-center justify-center group select-none"
              >
                {/* Background fill on hover */}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/4 transition-colors" />
                {/* Visible border line */}
                <div className="absolute left-[7px] inset-y-0 w-px bg-white/10 group-hover:bg-white/20 transition-colors" />
                {/* Always-visible grip pill */}
                <div className="relative z-10 flex flex-col items-center gap-[4px] bg-[#2a2a2a] group-hover:bg-[#3a3a3a] border border-white/15 group-hover:border-white/30 rounded-full px-[3px] py-2 transition-all shadow-sm">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className="w-[3px] h-[3px] rounded-full bg-white/40 group-hover:bg-white/70 transition-colors" />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Video preview */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-black items-center justify-center relative">
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
            "relative flex items-center justify-center w-full h-full overflow-hidden",
            !isMobile && "px-6 py-8"
          )}>
            {src ? (
              <div
                ref={videoContainerRef}
                className="relative md:rounded-2xl shadow-2xl shadow-black/80"
                style={isMobile ? {
                  aspectRatio: aspectRatio === "16:9" ? "16/9" : aspectRatio === "1:1" ? "1/1" : "9/16",
                  width: "100%",
                  height: "100%",
                  maxWidth: "100%",
                  maxHeight: "100%",
                } : aspectRatio === "9:16" ? {
                  // Portrait: height-driven — fill the tall container
                  aspectRatio: "9/16",
                  height: "100%",
                  maxHeight: "100%",
                  maxWidth: "100%",
                } : {
                  // Landscape / square: width-driven — fill the available width
                  aspectRatio: aspectRatio === "16:9" ? "16/9" : "1/1",
                  width: "100%",
                  maxWidth: aspectRatio === "16:9" ? "min(780px, 100%)" : "min(560px, 100%)",
                  maxHeight: "100%",
                }}
              >
                {/* Clip the video/canvas layers but NOT the drag handles */}
                <div className={cn("absolute inset-0 overflow-hidden", !isMobile && "rounded-2xl")}>
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

                {/* Draggable text overlays */}
                {textOverlays.map((t) => (
                  <div
                    key={t.id}
                    className="absolute cursor-grab active:cursor-grabbing touch-none select-none"
                    style={{
                      left: `${t.x * 100}%`,
                      top: `${t.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      zIndex: 12,
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = videoContainerRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      textDragRef.current = { id: t.id, rectLeft: rect.left, rectTop: rect.top, rectW: rect.width, rectH: rect.height };
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setSelectedTextId(t.id);
                    }}
                    onPointerMove={(e) => {
                      if (!textDragRef.current || textDragRef.current.id !== t.id) return;
                      const { rectLeft, rectTop, rectW, rectH } = textDragRef.current;
                      const nx = Math.max(0.02, Math.min(0.98, (e.clientX - rectLeft) / rectW));
                      const ny = Math.max(0.02, Math.min(0.98, (e.clientY - rectTop) / rectH));
                      setTextOverlays(prev => prev.map(o => o.id === t.id ? { ...o, x: nx, y: ny } : o));
                    }}
                    onPointerUp={() => { textDragRef.current = null; }}
                  >
                    <div
                      className="relative pointer-events-none px-1.5 py-0.5 rounded"
                      style={{
                        fontSize: t.fontSize,
                        color: t.color,
                        fontWeight: t.bold ? 700 : 400,
                        fontStyle: t.italic ? "italic" : "normal",
                        textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                        whiteSpace: "nowrap",
                        lineHeight: 1.2,
                        userSelect: "none",
                      }}
                    >
                      {t.text}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/20 text-[13px]">No clip source found.</p>
            )}
          </div>

          {/* ── Panel toggle arrow — sits on the right edge, vertically centered ── */}
          {!isMobile && (
            <button
              onClick={() => setPanelOpen(o => !o)}
              className="absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center h-10 w-5 rounded-l-lg bg-[#1a1a1a] border border-r-0 border-white/10 text-white/70 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
              title={panelOpen ? "Collapse panel" : "Expand panel"}
              style={{ right: 0, transition: "right 300ms ease-in-out" }}
            >
              {panelOpen ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          )}
          </div>{/* closes video preview div */}
          </div>{/* closes top row (flex-row) */}

          {/* ── Full-width playback controls ── */}
          <div className={cn(
            "shrink-0 w-full flex flex-col gap-2 border-t border-white/6 bg-[#0a0a0a]",
            isMobile ? "px-4 pb-3 pt-2" : "px-6 py-3"
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
              <button onClick={() => setMuted(m => !m)} className="text-white hover:text-white/70 transition-colors">
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <span className="text-[11px] font-mono text-white/70">{fmt(currentTime)} / {fmt(duration)}</span>
              {speed !== 1 && <span className="text-[10px] font-semibold text-white/50 bg-white/8 px-1.5 py-0.5 rounded">{speed}×</span>}
            </div>
          </div>
        </div>{/* closes outer flex-col (video area wrapper) */}

        {/* ── Desktop: collapsible icon sidebar + sliding panel ── */}
        {!isMobile && (
          <div
            className={cn(
              "shrink-0 flex flex-col bg-[#0f0f0f] border-l border-white/6 overflow-hidden transition-all duration-300 ease-in-out",
              panelOpen ? "w-[320px]" : "w-14"
            )}
          >
            {panelOpen ? (
              /* ── Full panel (tabs + content + export) ── */
              <>
                <div className="flex border-b border-white/6 shrink-0">
                  {TABS.map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => { if (activeTab === id) setPanelOpen(false); else setActiveTab(id); }}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors border-b-2",
                        activeTab === id ? "border-white text-white" : "border-transparent text-white/70 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4" />{label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                  <EditPanelContent {...editPanelProps} hideTranscript={true} />
                </div>
                <div className="p-4 border-t border-white/6 shrink-0">
                  <ExportSection
                    exportPhase={exportPhase}
                    exportProgress={exportProgress}
                    exportUrl={exportUrl}
                    handleExport={handleExport}
                    setExportPhase={setExportPhase}
                    setExportUrl={setExportUrl}
                  />
                </div>
              </>
            ) : (
              /* ── Collapsed icon sidebar ── */
              <div className="flex flex-col h-full items-center py-2 gap-1">
                {TABS.map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => handleSidebarIconClick(id)}
                    title={label}
                    className="w-full flex flex-col items-center gap-1 py-3 text-[9px] font-medium text-white hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Icon className="h-4.5 w-4.5" />
                    <span>{label}</span>
                  </button>
                ))}
                <div className="mt-auto w-full px-2 pb-3 flex flex-col items-center gap-1">
                  {/* Circular export/download button */}
                  <div className="relative h-11 w-11">
                    {/* Progress ring (visible while exporting) */}
                    {exportPhase === "exporting" && (
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="19" fill="none" stroke="white" strokeOpacity="0.12" strokeWidth="3" />
                        <circle
                          cx="22" cy="22" r="19" fill="none" stroke="white" strokeWidth="3"
                          strokeDasharray={`${2 * Math.PI * 19}`}
                          strokeDashoffset={`${2 * Math.PI * 19 * (1 - exportProgress / 100)}`}
                          strokeLinecap="round"
                          className="transition-all duration-500"
                        />
                      </svg>
                    )}
                    <button
                      onClick={exportPhase === "done" && exportUrl ? () => openAndDownload(exportUrl, "clip.mp4") : exportPhase === "idle" ? handleExport : undefined}
                      disabled={exportPhase === "exporting"}
                      title={exportPhase === "done" ? "Download" : exportPhase === "exporting" ? `${exportProgress}%` : "Export clip"}
                      className={cn(
                        "absolute inset-0 flex items-center justify-center rounded-full transition-all duration-150",
                        exportPhase === "done"
                          ? "bg-green-500 hover:bg-green-400 active:bg-green-600 text-white cursor-pointer"
                          : exportPhase === "exporting"
                            ? "bg-white/8 text-white/50 cursor-not-allowed"
                            : "bg-white hover:bg-white/85 active:bg-white/70 text-black cursor-pointer"
                      )}
                    >
                      {exportPhase === "exporting"
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : exportPhase === "done"
                          ? <Download className="h-4 w-4" />
                          : <Download className="h-4 w-4" />
                      }
                    </button>
                  </div>
                  <span className="text-[9px] font-medium text-white/60">
                    {exportPhase === "done" ? "Download" : exportPhase === "exporting" ? `${exportProgress}%` : "Export"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
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
