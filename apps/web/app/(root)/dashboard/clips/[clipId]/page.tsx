"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import type React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
const ClipTimeline = dynamic(
  () => import("./_components/clip-timeline"),
  { ssr: false },
);
import { useApiFetch } from "@/lib/apiFetch";
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX,
  Captions, Gauge, Sparkles, Check, Loader2, Languages, CheckCircle, AlertCircle, X, Layers, Download, ChevronLeft, ChevronRight, Plus, Trash2, Smile, ImageIcon, Move, Upload,
} from "lucide-react";
import Link from "next/link";
import Sidebar from "../../_components/sidebar";
import Topbar from "../../_components/topbar";
import { cn } from "@/lib/utils";
import {
  EXPORT_POLL_INTERVAL_MS,
  EXPORT_TIMEOUT_MS,
  EXPORT_TIMEOUT_MINUTES,
} from "@/lib/export-polling";
import CaptionRenderer, { type CaptionStyle, type CaptionWord } from "./_components/caption-renderer";
import BackgroundRenderer, { STIPOP_KEY, fetchStipopStickers, fetchStipopTrendingPacks, fetchStipopPackStickers, type StipopSticker, type StipopPack, type PlacedSticker, type ImageSegmenterRef } from "./_components/background-renderer";
import { UploadPanel } from "./_components/upload-panel";
import type { ChopprTrack, TimelineOverlayApi, OverlayTimingItem, TimelineMediaApi, CaptionTrackApi, CaptionSegment } from "./_components/clip-timeline";
import { useClipDraftAutosave, loadClipDraft, clearClipDraft, type ClipDraftState } from "./_components/use-clip-draft";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
/** Free plan can only export clips up to this length (seconds). */
const FREE_EXPORT_MAX_SECS = 5 * 60;
const SPEED_MIN = 0.25;
const SPEED_MAX = 4;
const DEFAULT_OVERLAY_DUR = 4;

/** Trimmed source length before speed. */
function getTrimmedExportSecs(trimStart: number, trimEnd: number, duration: number): number {
  if (!(duration > 0)) return 0;
  const end = trimEnd > 0 ? Math.min(trimEnd, duration) : duration;
  const start = Math.min(Math.max(0, trimStart), end);
  return Math.max(0, end - start);
}

/** Final rendered length after playback speed (matches API / FFmpeg: duration / speed). */
function getRenderedExportSecs(
  trimStart: number,
  trimEnd: number,
  duration: number,
  speed: number,
): number {
  const trimmed = getTrimmedExportSecs(trimStart, trimEnd, duration);
  if (trimmed <= 0) return 0;
  const spd = Math.max(SPEED_MIN, Math.min(SPEED_MAX, speed || 1));
  return trimmed / spd;
}

/** Mirror of the backend computeExportCost — for display only. Backend is authoritative. */
function computeExportCostEstimate(
  captionStyle: string,
  stickers: { stickerId: string }[],
  tracks: { items: { type: string }[] }[],
): number {
  const BASE = 2;
  const MAX  = 6;
  let cost = BASE;
  if (captionStyle && captionStyle !== "none") cost += 1;
  if (stickers.length > 0) cost += 1;
  const videoItems = tracks.flatMap(t => t.items.filter(i => i.type === "video"));
  if (videoItems.length > 1) cost += 1;
  return Math.min(cost, MAX);
}

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
  /** Timeline start (seconds). Controls when text appears in preview. */
  startTime?: number;
  /** How long the text stays visible (seconds). */
  duration?: number;
}

// ── Thumbnail overlay type ────────────────────────────────────────────────────
interface ThumbnailOverlayState {
  imageUrl: string;
  x: number;        // 0-100 %
  y: number;        // 0-100 %
  width: number;    // 0-100 %
  height: number;   // 0-100 %
  styleId: string;  // shape: square | circle | rounded | wide | banner
  opacity: number;  // 0-100
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
  { id: "captions",  icon: Captions,  label: "Captions" },
  { id: "upload",    icon: Upload,    label: "Upload" },
  { id: "overlays",  icon: Layers,    label: "Overlays" },
  { id: "speed",     icon: Gauge,     label: "Speed" },
  { id: "enhance",   icon: Sparkles,  label: "Enhance" },
];

/** Mobile: edit tools in the bottom bar (Upload is desktop-only). */
const MOBILE_SIDE_TABS = TABS.filter(t => t.id !== "upload");

const OVERLAY_SUB_TABS = [
  { id: "text" as const, label: "Text" },
  { id: "stickers" as const, label: "Stickers" },
  { id: "thumbnail" as const, label: "Watermark" },
];

// ── Caption styles ────────────────────────────────────────────────────────────
type CaptionStyleEntry = {
  id: CaptionStyle;
  label: string;
  desc: string;
  preview: string | null;
  previewClass: string;
  renderPreview?: () => React.ReactNode;
};
type CaptionStyleCategory = { category: string; styles: CaptionStyleEntry[] };

// Font-family strings mirroring the server CFG
const PF_DEFAULT   = "system-ui, sans-serif";
const PF_ANTON     = "'Anton', Impact, sans-serif";
const PF_BANGERS   = "'Bangers', cursive";
const PF_OSWALD    = "'Oswald', sans-serif";
const PF_BEBAS     = "'Bebas Neue', 'Anton', sans-serif";
const PF_MARKER    = "'Permanent Marker', cursive";
const PF_PIXEL     = "'Press Start 2P', monospace";
const PF_SPACE     = "'Space Grotesk', sans-serif";
const PF_GOTHIC    = "'UnifrakturCook', cursive";
const PF_NUNITO    = "'Nunito', sans-serif";

// Helper: 3-row stacked preview
function stackPreview(
  activeText: string,
  activeClass: string,
  contextClass: string,
  font: string,
  bg = "transparent",
): React.ReactNode {
  return (
    <div className="flex flex-col items-center justify-center gap-0 w-full h-full px-1" style={{ background: bg, fontFamily: font }}>
      <span className={cn("text-[7px] leading-tight", contextClass)}>won&apos;t do</span>
      <span className={cn("text-[17px] leading-tight font-black", activeClass)}>{activeText}</span>
      <span className={cn("text-[7px] leading-tight", contextClass)}>to</span>
    </div>
  );
}

const CAPTION_STYLE_GROUPS: CaptionStyleCategory[] = [
  {
    category: "Classic",
    styles: [
      { id: "none",           label: "None",        desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="text-white/20 text-[11px]">⊘</span> },
      { id: "subtitle",       label: "Subtitle",    desc: "", preview: null, previewClass: "",
        renderPreview: () => <div className="flex items-end w-full h-full px-1 pb-1.5"><div className="w-full bg-black/70 text-white text-[9px] font-semibold text-center py-0.5 rounded" style={{ fontFamily: PF_DEFAULT }}>just be kind</div></div> },
      { id: "shadow",         label: "Shadow",      desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="text-white font-black text-[14px] [text-shadow:2px_2px_6px_black,2px_2px_12px_black]" style={{ fontFamily: PF_DEFAULT }}>SHADOW</span> },
      { id: "outline-black",  label: "Impact",      desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="text-white font-black text-[14px] [text-shadow:-1px_-1px_0_black,1px_-1px_0_black,-1px_1px_0_black,1px_1px_0_black]" style={{ fontFamily: PF_SPACE }}>IMPACT</span> },
      { id: "outline-white",  label: "Outline",     desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[14px] text-transparent" style={{ WebkitTextStroke: "1.5px white", fontFamily: PF_SPACE }}>OUTLINE</span> },
      { id: "bold-center",    label: "Bold Center", desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="bg-white text-black font-black text-[14px] px-2 py-0.5 rounded-lg" style={{ fontFamily: PF_ANTON }}>BOLD</span> },
      { id: "clean-mid",      label: "Clean Mid",   desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="bg-black/60 text-white font-bold text-[12px] px-2 py-0.5 rounded-lg" style={{ fontFamily: PF_SPACE }}>Clean</span> },
    ],
  },
  {
    category: "Viral",
    styles: [
      { id: "word-pop",      label: "Word Pop",   desc: "", preview: null, previewClass: "",
        renderPreview: () => <div className="flex items-center gap-1" style={{ fontFamily: PF_ANTON }}><span className="text-white/40 font-black text-[8px] [text-shadow:-1px_-1px_0_black]">just</span><span className="text-white font-black text-[16px] [text-shadow:-1px_-1px_0_black,1px_-1px_0_black]">BE</span><span className="text-white/40 font-black text-[8px] [text-shadow:-1px_-1px_0_black]">kind</span></div> },
      { id: "karaoke",       label: "Karaoke",    desc: "", preview: null, previewClass: "",
        renderPreview: () => <div className="flex items-center gap-1" style={{ fontFamily: PF_MARKER }}><span className="text-white/50 font-black text-[8px] [text-shadow:-1px_-1px_0_black]">just</span><span className="text-yellow-400 font-black text-[12px] [text-shadow:-1px_-1px_0_black]">BE</span><span className="text-white/50 font-black text-[8px] [text-shadow:-1px_-1px_0_black]">kind</span></div> },
      { id: "mr-beast",      label: "MrBeast",    desc: "", preview: null, previewClass: "",
        renderPreview: () => <div className="flex items-center gap-1" style={{ fontFamily: PF_OSWALD }}><span className="text-white font-black text-[8px] [text-shadow:-1px_-1px_0_black,1px_-1px_0_black]">just</span><span className="text-red-500 font-black text-[17px] [text-shadow:-2px_-2px_0_black,2px_-2px_0_black]">BE</span><span className="text-white font-black text-[8px] [text-shadow:-1px_-1px_0_black]">kind</span></div> },
      { id: "stack-reveal",  label: "Stack",      desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="text-white font-black text-[20px] [text-shadow:-2px_-2px_0_black,2px_-2px_0_black,-2px_2px_0_black,2px_2px_0_black]" style={{ fontFamily: PF_OSWALD }}>KIND</span> },
      { id: "highlight-box", label: "Highlight",  desc: "", preview: null, previewClass: "",
        renderPreview: () => <div className="flex items-center gap-1" style={{ fontFamily: PF_BANGERS }}><span className="text-white/50 font-black text-[8px]">just</span><span className="bg-yellow-400 text-black font-black text-[11px] px-1 rounded">BE</span><span className="text-white/50 font-black text-[8px]">kind</span></div> },
      { id: "comic",         label: "Comic",      desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="bg-blue-800 text-white font-black text-[15px] px-2 py-0.5 rounded [text-shadow:-1px_-1px_0_black]" style={{ fontFamily: PF_BANGERS }}>POW!</span> },
    ],
  },
  {
    category: "Full Line",
    styles: [
      { id: "full-line",     label: "Full Line",  desc: "", preview: null, previewClass: "",
        renderPreview: () => (
          <div className="flex flex-col items-center justify-center gap-0.5 px-1 w-full" style={{ fontFamily: PF_DEFAULT }}>
            <span className="text-white text-[8px] font-semibold [text-shadow:-1px_-1px_0_black] text-center leading-tight">just be kind</span>
            <span className="text-white text-[8px] font-semibold [text-shadow:-1px_-1px_0_black] text-center leading-tight">to others</span>
          </div>
        ) },
    ],
  },
  {
    category: "3-Row Stacked",
    styles: [
      { id: "gothic",       label: "Gothic",    desc: "", preview: null, previewClass: "",
        renderPreview: () => stackPreview("Kind", "text-white [text-shadow:-1px_-1px_0_black,1px_-1px_0_black,-1px_1px_0_black,1px_1px_0_black]", "text-white/80 [text-shadow:-1px_-1px_0_black,1px_-1px_0_black]", PF_GOTHIC) },
      { id: "word-stack",   label: "Word Stack",desc: "", preview: null, previewClass: "",
        renderPreview: () => stackPreview("good", "text-white [text-shadow:-1px_-1px_0_black,1px_-1px_0_black,-1px_1px_0_black,1px_1px_0_black]", "text-white/80 italic [text-shadow:-1px_-1px_0_black]", PF_NUNITO) },
      { id: "stack-shake",  label: "Shake",     desc: "", preview: null, previewClass: "",
        renderPreview: () => stackPreview("SHAKE", "text-red-400 [text-shadow:-1px_-1px_0_black,1px_-1px_0_black,0_0_8px_#FF3333]", "text-white/80 [text-shadow:-1px_-1px_0_black]", PF_OSWALD) },
      { id: "stack-wave",   label: "Wave",      desc: "", preview: null, previewClass: "",
        renderPreview: () => stackPreview("Wave", "text-white [text-shadow:-1px_-1px_0_black,1px_-1px_0_black]", "text-white/80 [text-shadow:-1px_-1px_0_black]", PF_MARKER) },
      { id: "stack-neon",   label: "Neon",      desc: "", preview: null, previewClass: "",
        renderPreview: () => stackPreview("NEON", "text-[#00FF88] [text-shadow:0_0_8px_#00FF88,0_0_16px_#00FF88]", "text-white/80", PF_BEBAS) },
      { id: "stack-fire",   label: "Fire",      desc: "", preview: null, previewClass: "",
        renderPreview: () => stackPreview("FIRE", "text-orange-400 [text-shadow:0_0_8px_#FF4500,0_0_16px_#FF4500,-1px_-1px_0_black]", "text-white/80 [text-shadow:-1px_-1px_0_black]", PF_ANTON) },
      { id: "stack-comic",  label: "Comic",     desc: "", preview: null, previewClass: "",
        renderPreview: () => stackPreview("POW!", "text-white [text-shadow:-1px_-1px_0_black,1px_-1px_0_black]", "text-white/80", PF_BANGERS, "rgba(20,20,200,0.85)") },
      { id: "stack-gold",   label: "Gold",      desc: "", preview: null, previewClass: "",
        renderPreview: () => stackPreview("GOLD", "text-yellow-400 [text-shadow:0_0_8px_#FFD700,0_0_14px_#FFD700,-1px_-1px_0_black]", "text-white/80 [text-shadow:-1px_-1px_0_black]", PF_OSWALD) },
      { id: "stack-sunny",  label: "Sunny",     desc: "", preview: null, previewClass: "",
        renderPreview: () => stackPreview("SUN", "text-yellow-300 [text-shadow:-1px_-1px_0_black,1px_-1px_0_black,-1px_1px_0_black,1px_1px_0_black]", "text-white/80 [text-shadow:-1px_-1px_0_black]", PF_ANTON) },
    ],
  },
  {
    category: "Animated",
    styles: [
      { id: "bounce",        label: "Bounce",     desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="text-white font-black text-[16px] [text-shadow:-1px_-1px_0_black,1px_-1px_0_black] -translate-y-1.5 inline-block" style={{ fontFamily: PF_ANTON }}>DROP</span> },
      { id: "wave",          label: "Wave",       desc: "", preview: null, previewClass: "",
        renderPreview: () => <div className="flex items-end gap-0.5" style={{ fontFamily: PF_MARKER }}>{"WAVE".split("").map((c, i) => <span key={i} className={cn("text-white font-black text-[12px]", i % 2 === 0 ? "-translate-y-1" : "translate-y-0.5")}>{c}</span>)}</div> },
      { id: "shake",         label: "Shake",      desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="text-red-400 font-black text-[16px] [text-shadow:-1px_-1px_0_black,1px_-1px_0_black] translate-x-0.5 inline-block" style={{ fontFamily: PF_OSWALD }}>SHAKE</span> },
      { id: "glitch",        label: "Glitch",     desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="relative font-black text-[15px]" style={{ fontFamily: PF_PIXEL }}><span className="absolute text-cyan-400/70 translate-x-0.5 -translate-y-px">ERR!</span><span className="relative text-fuchsia-400">ERR!</span></span> },
      { id: "typewriter",    label: "Typewriter", desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[11px] text-[#00FF41] bg-black/80 px-1.5 py-0.5 rounded [text-shadow:0_0_6px_#00FF41]" style={{ fontFamily: PF_PIXEL }}>TYPE_</span> },
    ],
  },
  {
    category: "Glowing",
    styles: [
      { id: "neon",          label: "Neon",       desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[16px] text-[#00ff88] [text-shadow:0_0_8px_#00ff88,0_0_20px_#00ff88]" style={{ fontFamily: PF_BEBAS }}>NEON</span> },
      { id: "fire",          label: "Fire",       desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[16px] text-orange-400 [text-shadow:0_0_8px_#FF4500,0_0_20px_#FF4500,-1px_-1px_0_black]" style={{ fontFamily: PF_OSWALD }}>FIRE</span> },
      { id: "electric-blue", label: "Electric",   desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[16px] text-cyan-400 [text-shadow:0_0_8px_#00D4FF,0_0_20px_#00D4FF]" style={{ fontFamily: PF_BEBAS }}>ELEC</span> },
      { id: "gradient-gold", label: "Gold",       desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[16px] bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent drop-shadow-[0_0_6px_#FFD700]" style={{ fontFamily: PF_OSWALD }}>GOLD</span> },
    ],
  },
  {
    category: "Gradient",
    styles: [
      { id: "rainbow",       label: "Rainbow",    desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[16px] bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500 bg-clip-text text-transparent" style={{ fontFamily: PF_BANGERS }}>RBOW</span> },
      { id: "gradient-pop",  label: "Grad Pop",   desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[16px] bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent" style={{ fontFamily: PF_BEBAS }}>POP!</span> },
    ],
  },
  {
    category: "Solo",
    styles: [
      { id: "solo-pop",      label: "Solo Pop",   desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[20px] text-white [text-shadow:-2px_-2px_0_black,2px_-2px_0_black,-2px_2px_0_black,2px_2px_0_black]" style={{ fontFamily: PF_ANTON }}>ONE</span> },
      { id: "solo-red",      label: "Solo Red",   desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[20px] text-red-500 [text-shadow:0_0_8px_#FF2D2D,-1px_-1px_0_black,1px_-1px_0_black]" style={{ fontFamily: PF_ANTON }}>RED</span> },
      { id: "solo-glow",     label: "Solo Glow",  desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[20px] text-[#00FF88] [text-shadow:0_0_10px_#00FF88,0_0_20px_#00FF88]" style={{ fontFamily: PF_BEBAS }}>GLO</span> },
      { id: "solo-box",      label: "Solo Box",   desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[16px] text-black bg-yellow-400 px-2 py-0.5 rounded-lg" style={{ fontFamily: PF_SPACE }}>BOX</span> },
      { id: "solo-gradient", label: "Solo Grad",  desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[20px] bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent" style={{ fontFamily: PF_BEBAS }}>PRPL</span> },
      { id: "solo-shake",    label: "Solo Shake", desc: "", preview: null, previewClass: "",
        renderPreview: () => <span className="font-black text-[20px] text-white [text-shadow:-2px_-2px_0_red,2px_-2px_0_red] translate-x-0.5 inline-block" style={{ fontFamily: PF_OSWALD }}>SHK</span> },
    ],
  },
  {
    category: "Exclusive",
    styles: [
      { id: "font-cycle", label: "Font Cycle", desc: "Solo word · rotating fonts", preview: null, previewClass: "",
        renderPreview: () => <span className="text-white font-normal text-[14px] [text-shadow:-1px_-1px_0_black]" style={{ fontFamily: PF_MARKER }}>word</span> },
    ],
  },
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

// ── Shared edit panel (desktop sidebar + mobile drawer) ─────────────────────
interface EditPanelProps {
  activeTab: string;
  hideTranscript?: boolean;
  captionStyle: CaptionStyle;
  setCaptionStyle: (s: CaptionStyle) => void;
  onAddCaptionSegment: (style: CaptionStyle, mode?: "add" | "replace") => void;
  /** Desktop only: ask Replace vs Add when timeline already has captions. */
  askCaptionApplyMode?: boolean;
  captionSegments: CaptionSegment[];
  captionWords: CaptionWord[];
  onCaptionWordsChange: (words: CaptionWord[]) => void;
  captionFontSize: number;
  setCaptionFontSize: (n: number) => void;
  captionPosY: number;
  setCaptionPosY: (n: number) => void;
  captionPosX: number;
  setCaptionPosX: (n: number) => void;
  onResetCaptionPos: () => void;
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
  exportPhase: "idle" | "exporting" | "done" | "error" | "no_credits" | "upgrade_required";
  exportProgress: number;
  exportUrl: string | null;
  exportError: string | null;
  handleExport: () => void;
  handleCancelExport: () => void;
  setExportPhase: (p: "idle" | "exporting" | "done" | "error" | "no_credits" | "upgrade_required") => void;
  setExportUrl: (u: string | null) => void;
  styleGridMaxHeight?: number | string;
  // Background overlay
  placedStickers: PlacedSticker[];
  setPlacedStickers: React.Dispatch<React.SetStateAction<PlacedSticker[]>>;
  segmentationReady: boolean;
  // Text overlays
  textOverlays: TextOverlay[];
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlay[]>>;
  selectedTextId: string | null;
  setSelectedTextId: (id: string | null) => void;
  onAddTextOverlay?: () => void;
  onRemoveTextOverlay?: (id: string) => void;
  onToggleSticker?: (s: StipopSticker) => void;
  onRemoveSticker?: (id: string) => void;
  onClearStickers?: () => void;
  /** Mobile: one sticker at a time (no timeline). */
  stickerSingleSelect?: boolean;
  onAddToTimeline?: (asset: {
    type: "video" | "audio" | "image";
    url: string;
    name?: string;
  }) => void;
  // Thumbnail overlay
  thumbnailOverlay: ThumbnailOverlayState | null;
  setThumbnailOverlay: (o: ThumbnailOverlayState | null) => void;
}

// ── Stipop Sticker Picker ─────────────────────────────────────────────────────
const STIPOP_CATEGORIES = [
  { label: "Trending", query: "" },
  { label: "Memes",    query: "meme" },
  { label: "Funny",    query: "funny" },
  { label: "Love",     query: "love" },
  { label: "Hype",     query: "hype" },
  { label: "Reactions",query: "reaction" },
  { label: "Happy",    query: "happy" },
  { label: "Cute",     query: "cute" },
];

function StipopStickerPicker({
  placedStickers, setPlacedStickers, segmentationReady, styleGridMaxHeight = 360, onToggleSticker, onRemoveSticker, onClearStickers, singleSelect = false,
}: {
  placedStickers: PlacedSticker[];
  setPlacedStickers: React.Dispatch<React.SetStateAction<PlacedSticker[]>>;
  segmentationReady: boolean;
  styleGridMaxHeight?: number | string;
  onToggleSticker?: (s: StipopSticker) => void;
  onRemoveSticker?: (id: string) => void;
  onClearStickers?: () => void;
  /** Mobile: one sticker at a time (no timeline to manage multi timing). */
  singleSelect?: boolean;
}) {
  // "trending" | "category" | "search" | "pack"
  type ViewMode = "trending" | "category" | "search" | "pack";

  const [mode, setMode]                     = useState<ViewMode>("trending");
  const [query, setQuery]                   = useState("");
  const [activecat, setActivecat]           = useState("");
  const [catResults, setCatResults]         = useState<StipopSticker[]>([]);
  const [searchResults, setSearchResults]   = useState<StipopSticker[]>([]);
  const [trendingPacks, setTrendingPacks]   = useState<StipopPack[]>([]);
  const [loading, setLoading]               = useState(false);
  const [expandedPack, setExpandedPack]     = useState<StipopPack | null>(null);
  const [packStickers, setPackStickers]     = useState<StipopSticker[]>([]);
  const [packLoading, setPackLoading]       = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load trending packs on mount
  useEffect(() => {
    if (!STIPOP_KEY) return;
    setLoading(true);
    fetchStipopTrendingPacks(20).then(packs => {
      setTrendingPacks(packs);
      setLoading(false);
    });
  }, []);

  // Search bar handler — never touches category state
  const handleSearchInput = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setSearchResults([]);
      // Go back to whichever tab was active before searching
      setMode(activecat ? "category" : "trending");
      return;
    }
    setMode("search");
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      fetchStipopStickers(q, 50).then(r => { setSearchResults(r); setLoading(false); });
    }, 400);
  };

  // Category chip click — clears search bar, never writes into it
  const handleCategoryClick = (catQuery: string) => {
    setQuery("");
    setActivecat(catQuery);
    setExpandedPack(null);
    if (!catQuery) {
      // "Trending" tab
      setMode("trending");
      setCatResults([]);
      return;
    }
    setMode("category");
    setLoading(true);
    fetchStipopStickers(catQuery, 50).then(r => { setCatResults(r); setLoading(false); });
  };

  const openPack = (pack: StipopPack) => {
    setMode("pack");
    setExpandedPack(pack);
    setPackLoading(true);
    fetchStipopPackStickers(pack.packageId).then(s => {
      setPackStickers(s);
      setPackLoading(false);
    });
  };

  const placeStickerFromResult = (s: StipopSticker) => {
    if (onToggleSticker) {
      onToggleSticker(s);
      return;
    }
    const key = `stipop:${s.id}`;
    const isPlaced = placedStickers.some(ps => ps.stickerId === key);
    if (isPlaced) {
      setPlacedStickers(placedStickers.filter(ps => ps.stickerId !== key));
    } else if (singleSelect) {
      setPlacedStickers([{
        stickerId:  key,
        stickerUrl: s.renderUrl,
        previewUrl: s.previewUrl,
        x: 0.5,
        y: 0.5,
        scale: 1,
      }]);
    } else {
      setPlacedStickers([...placedStickers, {
        stickerId:  key,
        stickerUrl: s.renderUrl,
        previewUrl: s.previewUrl,
        x: 0.15 + Math.random() * 0.7,
        y: 0.15 + Math.random() * 0.7,
        scale: 1,
        startTime: 0,
        duration: 4,
      }]);
    }
  };

  if (!STIPOP_KEY) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[12px] font-medium text-white/70">Stickers</p>
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 flex flex-col gap-2">
          <p className="text-[12px] font-semibold text-white/70">Add a Stipop API key</p>
          <p className="text-[11px] text-white/35 leading-relaxed">
            Get a free key at <span className="text-white/60">developers.stipop.io</span> then add it to your <span className="text-white/60">.env</span>:
          </p>
          <code className="text-[10px] bg-white/5 rounded-lg px-2 py-1.5 text-white/50 font-mono">
            NEXT_PUBLIC_STIPOP_API_KEY=your_key
          </code>
        </div>
      </div>
    );
  }

  // Shared sticker grid renderer
  const StickerGrid = ({ stickers }: { stickers: StipopSticker[] }) => (
    <div className="grid grid-cols-3 gap-1.5">
      {stickers.map(s => {
        const key = `stipop:${s.id}`;
        const isPlaced = placedStickers.some(ps => ps.stickerId === key);
        return (
          <button
            key={s.id}
            onClick={() => placeStickerFromResult(s)}
            className={cn(
              "relative rounded-xl overflow-hidden border transition-all aspect-square bg-white/3",
              isPlaced ? "border-white/50 ring-1 ring-white/30" : "border-white/8 hover:border-white/25"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.previewUrl} alt={s.title} className="w-full h-full object-contain p-1" loading="lazy" />
            {isPlaced && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  const loadingSkeleton = (
    <div className="grid grid-cols-3 gap-1.5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-xl bg-white/5 animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-white/70">Stickers</p>
        {placedStickers.length > 0 && (
          <span className={cn(
            "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full",
            segmentationReady ? "bg-emerald-500/15 text-emerald-400" : "bg-white/8 text-white/30"
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", segmentationReady ? "bg-emerald-400" : "bg-white/30 animate-pulse")} />
            {segmentationReady ? "Behind person" : "Loading AI…"}
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          value={query}
          placeholder="Search stickers…"
          onChange={e => handleSearchInput(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white placeholder:text-white/30 outline-none focus:border-white/25 transition-colors"
        />
        {loading && <Loader2 className="absolute right-2.5 top-2 h-3.5 w-3.5 animate-spin text-white/30" />}
      </div>

      {/* Category chips — always visible, search bar stays clean */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {STIPOP_CATEGORIES.map(cat => (
          <button
            key={cat.label}
            onClick={() => handleCategoryClick(cat.query)}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all",
              activecat === cat.query && mode !== "search"
                ? "bg-white text-black"
                : "bg-white/8 text-white/50 hover:bg-white/12 hover:text-white/80"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main grid area */}
      <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: styleGridMaxHeight }}>
        {loading && loadingSkeleton}

        {/* Search results */}
        {!loading && mode === "search" && (
          searchResults.length === 0
            ? <p className="text-[11px] text-white/25 text-center py-8">No stickers found</p>
            : <StickerGrid stickers={searchResults} />
        )}

        {/* Category stickers */}
        {!loading && mode === "category" && (
          catResults.length === 0
            ? <p className="text-[11px] text-white/25 text-center py-8">No stickers found</p>
            : <StickerGrid stickers={catResults} />
        )}

        {/* Trending pack covers */}
        {!loading && mode === "trending" && (
          <div className="grid grid-cols-3 gap-1.5">
            {trendingPacks.map(pack => (
              <button
                key={pack.packageId}
                onClick={() => openPack(pack)}
                className="relative rounded-xl overflow-hidden border border-white/8 hover:border-white/25 transition-all aspect-square bg-white/3"
                title={pack.packageName}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pack.packageImg} alt={pack.packageName} className="w-full h-full object-contain p-1" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {/* Expanded pack stickers */}
        {mode === "pack" && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setMode("trending"); setExpandedPack(null); }}
              className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/80 transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
              {expandedPack?.packageName ?? "Back"}
            </button>
            {packLoading
              ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              )
              : <StickerGrid stickers={packStickers} />
            }
          </div>
        )}
      </div>

      {/* Placed stickers list */}
      {placedStickers.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="h-px bg-white/6" />
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium text-white/50">
              {singleSelect ? "Selected" : `Placed (${placedStickers.length})`}
            </p>
            <button
              onClick={() => {
                if (onClearStickers) onClearStickers();
                else setPlacedStickers([]);
              }}
              className="text-[10px] text-white/25 hover:text-red-400 transition-colors"
            >
              {singleSelect ? "Remove" : "Remove all"}
            </button>
          </div>
          {placedStickers.map((ps, i) => (
            <div key={ps.stickerId} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-2 py-1.5">
              {ps.previewUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={ps.previewUrl} alt="" className="h-7 w-7 rounded object-contain shrink-0" />
                : <div className="h-7 w-7 rounded bg-white/10 shrink-0" />
              }
              <span className="text-[10px] text-white/50 flex-1 truncate">{ps.stickerId.replace("stipop:", "")}</span>
              <input
                type="range" min={0.3} max={2} step={0.1}
                value={ps.scale}
                onChange={e => {
                  setPlacedStickers(prev => {
                    const updated = [...prev];
                    const cur = updated[i];
                    if (!cur) return prev;
                    updated[i] = { ...cur, scale: Number(e.target.value) };
                    return updated;
                  });
                }}
                className="w-14 accent-white cursor-pointer"
                title="Size"
              />
              <button
                onClick={() => {
                  if (onRemoveSticker) onRemoveSticker(ps.stickerId);
                  else setPlacedStickers(prev => prev.filter((_, j) => j !== i));
                }}
                className="text-white/25 hover:text-red-400 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {singleSelect && (
            <p className="text-[10px] text-white/25 text-center">
              Tap another sticker to replace · drag on video to reposition
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Thumbnail tab content ─────────────────────────────────────────────────────
// borderRadius is CSS value applied to the image shape
const THUMBNAIL_STYLES_CONFIG = [
  { id: "square",  label: "Square",  borderRadius: "6px",  initW: 22, initH: 22, x: 5, y: 5 },
  { id: "circle",  label: "Circle",  borderRadius: "50%",  initW: 22, initH: 22, x: 5, y: 5 },
  { id: "rounded", label: "Rounded", borderRadius: "16px", initW: 28, initH: 20, x: 5, y: 5 },
  { id: "wide",    label: "Wide",    borderRadius: "6px",  initW: 40, initH: 22, x: 5, y: 5 },
  { id: "banner",  label: "Banner",  borderRadius: "6px",  initW: 70, initH: 12, x: 5, y: 3 },
];

function getShapeBorderRadius(styleId: string): string {
  return THUMBNAIL_STYLES_CONFIG.find(s => s.id === styleId)?.borderRadius ?? "6px";
}

function ThumbnailTabContent({
  thumbnailOverlay,
  setThumbnailOverlay,
}: {
  thumbnailOverlay: ThumbnailOverlayState | null;
  setThumbnailOverlay: (o: ThumbnailOverlayState | null) => void;
}) {
  const apiFetch   = useApiFetch();
  const fileRef    = useRef<HTMLInputElement>(null);
  const [assets, setAssets]         = useState<{ _id: string; name: string; s3Url: string }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [progress, setProgress]     = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedAssetUrl, setSelectedAssetUrl] = useState<string | null>(thumbnailOverlay?.imageUrl ?? null);
  const [selectedStyle, setSelectedStyle]       = useState<string>(thumbnailOverlay?.styleId ?? "full");

  useEffect(() => {
    apiFetch(`${API_URL}/api/user-assets?usage=watermark&type=image`)
      .then(r => r.json())
      .then(setAssets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const applyStyle = useCallback((styleId: string, imageUrl: string) => {
    const cfg = THUMBNAIL_STYLES_CONFIG.find(s => s.id === styleId) ?? THUMBNAIL_STYLES_CONFIG[0]!;
    setThumbnailOverlay({
      imageUrl,
      x: cfg.x, y: cfg.y,
      width: cfg.initW, height: cfg.initH,
      styleId,
      opacity: thumbnailOverlay?.opacity ?? 100,
    });
  }, [setThumbnailOverlay, thumbnailOverlay?.opacity]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
    if (file.size > 20 * 1024 * 1024)    { alert("Image must be under 20 MB"); return; }
    setUploading(true); setProgress(0);
    try {
      const presignRes = await apiFetch(`${API_URL}/api/user-assets/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: file.type, fileName: file.name, sizeBytes: file.size, usage: "watermark" }),
      });
      const { uploadUrl, asset } = await presignRes.json();
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)); };
        xhr.onload  = () => xhr.status < 300 ? resolve() : reject();
        xhr.onerror = () => reject();
        xhr.send(file);
      });
      setAssets(prev => [asset, ...prev]);
      setSelectedAssetUrl(asset.s3Url);
      applyStyle(selectedStyle, asset.s3Url);
    } catch { alert("Upload failed. Please try again."); }
    finally { setUploading(false); setProgress(0); }
  }, [apiFetch, selectedStyle, applyStyle]);

  const handleDelete = useCallback(async (id: string, url: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`${API_URL}/api/user-assets/${id}`, { method: "DELETE" });
      setAssets(prev => prev.filter(a => a._id !== id));
      if (selectedAssetUrl === url) { setSelectedAssetUrl(null); setThumbnailOverlay(null); }
    } catch { alert("Failed to delete"); }
    finally { setDeletingId(null); }
  }, [selectedAssetUrl, setThumbnailOverlay, apiFetch]);

  return (
    <div className="flex flex-col gap-4">
      {/* Upload zone */}
      <div>
        <p className="text-[12px] font-medium text-white/70 mb-2">Your images</p>
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-5 cursor-pointer transition-all",
            uploading ? "border-white/20 bg-white/5 cursor-not-allowed" : "border-white/12 bg-white/[0.03] hover:border-white/25 hover:bg-white/6"
          )}
        >
          {uploading ? (
            <>
              <div className="h-7 w-7 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
              <p className="text-[11px] text-white/40">Uploading… {progress}%</p>
            </>
          ) : (
            <>
              <ImageIcon className="h-5 w-5 text-white/30" />
              <p className="text-[11px] text-white/50 text-center">Click or drag image here</p>
              <p className="text-[10px] text-white/25">JPG, PNG, WEBP · max 20 MB</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
      </div>

      {/* Asset grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-1.5">
          {[1,2,3].map(i => <div key={i} className="aspect-video rounded-lg bg-white/5 animate-pulse" />)}
        </div>
      ) : assets.length === 0 ? (
        <p className="text-[11px] text-white/25 text-center py-2">No images yet — upload one above</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {assets.map(asset => (
            <div
              key={asset._id}
              onClick={() => { setSelectedAssetUrl(asset.s3Url); applyStyle(selectedStyle, asset.s3Url); }}
              className={cn(
                "group relative aspect-video rounded-lg overflow-hidden border cursor-pointer transition-all",
                selectedAssetUrl === asset.s3Url ? "border-white/60 ring-1 ring-white/30" : "border-white/8 hover:border-white/25"
              )}
            >
              <img src={asset.s3Url} alt={asset.name} className="w-full h-full object-cover" />
              {selectedAssetUrl === asset.s3Url && (
                <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                </div>
              )}
              <button
                onClick={e => { e.stopPropagation(); handleDelete(asset._id, asset.s3Url); }}
                disabled={deletingId === asset._id}
                className="absolute top-0.5 right-0.5 h-5 w-5 rounded bg-black/70 text-white/60 hover:text-white items-center justify-center hidden group-hover:flex"
              >
                {deletingId === asset._id
                  ? <div className="h-2.5 w-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                  : <Trash2 className="h-2.5 w-2.5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Style picker — only when an image is selected */}
      {selectedAssetUrl && (
        <>
          <div className="h-px bg-white/8" />
          <div>
            <p className="text-[12px] font-medium text-white/70 mb-2">Shape</p>
            <div className="grid grid-cols-5 gap-2">
              {THUMBNAIL_STYLES_CONFIG.map(cfg => (
                <button
                  key={cfg.id}
                  onClick={() => { setSelectedStyle(cfg.id); applyStyle(cfg.id, selectedAssetUrl); }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-2 rounded-xl border transition-all",
                    selectedStyle === cfg.id ? "border-white/50 bg-white/10" : "border-white/8 hover:border-white/25 hover:bg-white/5"
                  )}
                >
                  {/* Shape icon showing full image inside the shape */}
                  <div className="relative flex items-center justify-center" style={{
                    width:  cfg.id === "banner" ? 36 : cfg.id === "wide" ? 32 : 24,
                    height: cfg.id === "banner" ? 10 : cfg.id === "wide" ? 18 : 24,
                    borderRadius: cfg.borderRadius,
                    overflow: "hidden",
                    border: "1.5px solid rgba(255,255,255,0.3)",
                    flexShrink: 0,
                  }}>
                    <img
                      src={selectedAssetUrl}
                      alt=""
                      draggable={false}
                      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                    />
                  </div>
                  <span className="text-[8px] text-white/50 leading-none">{cfg.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Opacity slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-white/70">Opacity</span>
              <span className="text-[11px] text-white/40">{thumbnailOverlay?.opacity ?? 100}%</span>
            </div>
            <input
              type="range" min={10} max={100} step={1}
              value={thumbnailOverlay?.opacity ?? 100}
              onChange={e => {
                if (thumbnailOverlay) setThumbnailOverlay({ ...thumbnailOverlay, opacity: Number(e.target.value) });
              }}
              className="w-full accent-white cursor-pointer"
            />
          </div>

          {/* Remove background */}
          <RemoveBgButton
            imageUrl={selectedAssetUrl}
            onDone={(newUrl) => {
              setAssets(prev => {
                const already = prev.find(a => a.s3Url === newUrl);
                return already ? prev : [{ _id: newUrl, name: "bg-removed.png", s3Url: newUrl }, ...prev];
              });
              setSelectedAssetUrl(newUrl);
              applyStyle(selectedStyle, newUrl);
            }}
          />

          <div className="flex items-start gap-2 rounded-xl bg-white/5 border border-white/8 px-3 py-2.5">
            <Move className="h-3.5 w-3.5 text-white/40 shrink-0 mt-0.5" />
            <p className="text-[11px] text-white/40 leading-relaxed">Drag thumbnail to reposition · drag corners to resize</p>
          </div>

          <button
            onClick={() => { setThumbnailOverlay(null); setSelectedAssetUrl(null); }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-[12px] text-white/40 hover:bg-white/6 hover:text-white/70 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove watermark
          </button>
        </>
      )}
    </div>
  );
}

// ── Remove Background button ──────────────────────────────────────────────────
const REMOVE_BG_KEY = process.env.NEXT_PUBLIC_REMOVE_BG_API_KEY ?? "";

function RemoveBgButton({
  imageUrl,
  onDone,
}: {
  imageUrl: string | null;
  onDone: (newUrl: string) => void;
}) {
  const apiFetch = useApiFetch();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleRemoveBg = useCallback(async () => {
    if (!imageUrl || !REMOVE_BG_KEY) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Call remove.bg API with the image URL
      const form = new FormData();
      form.append("image_url", imageUrl);
      form.append("size", "auto");

      const bgRes = await fetch("https://api.remove.bg/v1.0/removebg", {
        method:  "POST",
        headers: { "X-Api-Key": REMOVE_BG_KEY },
        body:    form,
      });
      if (!bgRes.ok) {
        const t = await bgRes.text().catch(() => "");
        throw new Error(`remove.bg ${bgRes.status}: ${t.slice(0, 100)}`);
      }

      const blob = await bgRes.blob(); // transparent PNG
      const file = new File([blob], "thumbnail-nobg.png", { type: "image/png" });

      // 2. Get presigned S3 URL
      const presignRes = await apiFetch(`${API_URL}/api/user-assets/presign`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mimeType: "image/png", fileName: file.name, sizeBytes: file.size, usage: "watermark" }),
      });
      const { uploadUrl, asset } = await presignRes.json();

      // 3. Upload directly to S3
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: file });

      onDone(asset.s3Url);
    } catch (err: any) {
      setError(err?.message ?? "Failed to remove background");
    } finally {
      setLoading(false);
    }
  }, [imageUrl, apiFetch, onDone]);

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleRemoveBg}
        disabled={loading || !imageUrl}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-medium transition-all",
          loading || !imageUrl
            ? "bg-white/5 border border-white/8 text-white/25 cursor-not-allowed"
            : "bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 hover:text-white active:scale-[0.98]"
        )}
      >
        {loading ? (
          <><div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" /> Removing background…</>
        ) : (
          <><Sparkles className="h-3.5 w-3.5" /> Remove background</>
        )}
      </button>
      {error && <p className="text-[10px] text-red-400 px-1 leading-tight">{error}</p>}
    </div>
  );
}

function EditPanelContent({
  activeTab, hideTranscript = false, captionStyle, setCaptionStyle, onAddCaptionSegment, askCaptionApplyMode = false, captionSegments, captionWords, onCaptionWordsChange, captionFontSize, setCaptionFontSize,
  captionPosY, setCaptionPosY, captionPosX, setCaptionPosX, onResetCaptionPos,
  captionLang, activeLang, translating, handleTranslate,
  speed, setSpeed, trimStart, setTrimStart, effectiveTrimEnd, setTrimEnd, duration, fmt, videoRef,
  brightness, setBrightness, contrast, setContrast, saturation, setSaturation,
  exportPhase, exportProgress, exportUrl, handleExport, setExportPhase, setExportUrl,
  styleGridMaxHeight = undefined,
  placedStickers, setPlacedStickers, segmentationReady,
  textOverlays, setTextOverlays, selectedTextId, setSelectedTextId,
  onAddTextOverlay, onRemoveTextOverlay, onToggleSticker, onRemoveSticker, onClearStickers,
  stickerSingleSelect = false,
  onAddToTimeline,
  thumbnailOverlay, setThumbnailOverlay,
}: EditPanelProps) {
  const [emojiOpenId, setEmojiOpenId] = useState<string | null>(null);
  const [captionApplyMenu, setCaptionApplyMenu] = useState<CaptionStyle | null>(null);
  const captionApplyMenuRef = useRef<HTMLDivElement | null>(null);
  const [captionSubTab, setCaptionSubTab] = useState<"styles" | "adjust" | "transcript" | "translate">("styles");
  const [overlaySubTab, setOverlaySubTab] = useState<"text" | "stickers" | "thumbnail">("text");

  useEffect(() => {
    if (!captionApplyMenu) return;
    const onDown = (e: MouseEvent) => {
      if (captionApplyMenuRef.current?.contains(e.target as Node)) return;
      setCaptionApplyMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [captionApplyMenu]);

  useEffect(() => {
    if (activeTab !== "captions") setCaptionApplyMenu(null);
  }, [activeTab]);

  useEffect(() => {
    if (hideTranscript && captionSubTab === "transcript") setCaptionSubTab("styles");
  }, [hideTranscript, captionSubTab]);

  const CAPTION_SUB_TABS = [
    { id: "styles" as const, label: "Styles" },
    { id: "adjust" as const, label: "Adjustment" },
    ...(!hideTranscript ? [{ id: "transcript" as const, label: "Transcripts" }] : []),
    { id: "translate" as const, label: "Translate" },
  ];

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col",
        activeTab === "captions" && captionSubTab === "styles"
          ? "overflow-hidden"
          : "overflow-y-auto no-scrollbar",
      )}
    >
      {activeTab === "captions" && (
        <div className="flex h-full min-h-0 flex-col gap-3">
          {/* Capsule sub-tabs */}
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            {CAPTION_SUB_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setCaptionSubTab(t.id)}
                className={cn(
                  "flex-1 rounded-full px-2 py-1.5 text-[10px] font-semibold transition-all whitespace-nowrap",
                  captionSubTab === t.id
                    ? "bg-white text-black shadow-sm"
                    : "text-white/45 hover:text-white/70",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {captionSubTab === "styles" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div
                className={cn(
                  "overflow-y-auto no-scrollbar",
                  styleGridMaxHeight == null && "min-h-0 flex-1",
                )}
                style={
                  styleGridMaxHeight != null
                    ? { maxHeight: styleGridMaxHeight }
                    : undefined
                }
              >
                <div className="flex flex-col gap-4 pr-0.5">
                  {CAPTION_STYLE_GROUPS.map(group => (
                    <div key={group.category}>
                      <p className="text-[9px] font-semibold text-white/30 uppercase tracking-widest mb-1.5">{group.category}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {group.styles.map(s => {
                          const onTimeline = captionSegments.some(seg => seg.style === s.id);
                          const menuOpen = captionApplyMenu === s.id;
                          return (
                            <div
                              key={s.id}
                              ref={menuOpen ? captionApplyMenuRef : undefined}
                              className={cn(
                                "relative rounded-xl border transition-all overflow-hidden",
                                menuOpen
                                  ? "border-white ring-2 ring-white/40 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_8px_24px_rgba(0,0,0,0.55)] z-10 scale-[1.02]"
                                  : onTimeline
                                    ? "border-white/50 ring-1 ring-white/20"
                                    : "border-white/8 bg-white/3 hover:border-white/20",
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  // "None" clears captions — never add a None block to the timeline
                                  if (s.id === "none") {
                                    setCaptionApplyMenu(null);
                                    onAddCaptionSegment("none");
                                    return;
                                  }
                                  if (onTimeline) {
                                    // Toggle off: remove from timeline AND clear preview style
                                    // (otherwise CaptionRenderer falls back to captionStyle and
                                    // keeps drawing the caption + checkmark)
                                    const remaining = captionSegments.filter(seg => seg.style !== s.id);
                                    onAddCaptionSegment(s.id);
                                    setCaptionStyle(
                                      remaining.length === 0
                                        ? "none"
                                        : (captionStyle === s.id ? remaining[0]!.style : captionStyle),
                                    );
                                    setCaptionApplyMenu(null);
                                    return;
                                  }
                                  if (askCaptionApplyMode && captionSegments.length > 0) {
                                    setCaptionApplyMenu(menuOpen ? null : s.id);
                                    return;
                                  }
                                  setCaptionStyle(s.id);
                                  onAddCaptionSegment(s.id, "add");
                                  setCaptionApplyMenu(null);
                                }}
                                className="relative w-full cursor-pointer text-left"
                              >
                                <div className="h-14 w-full bg-[#111] flex items-center justify-center overflow-hidden">
                                  {s.renderPreview ? s.renderPreview() : (
                                    s.preview
                                      ? <span className={cn("leading-none text-center block px-1", s.previewClass)}>{s.preview}</span>
                                      : <span className="text-white/20 text-[11px]">⊘</span>
                                  )}
                                </div>
                                <div className="px-2 py-1 flex items-center justify-between bg-[#181818]">
                                  <span className="text-[9px] font-semibold text-white/60 truncate leading-tight">{s.label}</span>
                                  {captionStyle === s.id && <Check className="h-2.5 w-2.5 text-white/70 shrink-0 ml-1" />}
                                  {onTimeline && <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0 ml-1" />}
                                </div>
                              </button>

                              {menuOpen && (
                                <div className="absolute inset-0 z-20 flex flex-col bg-black/90 backdrop-blur-sm ring-1 ring-inset ring-white/25">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCaptionStyle(s.id);
                                      onAddCaptionSegment(s.id, "replace");
                                      setCaptionApplyMenu(null);
                                    }}
                                    className="flex-1 px-2 text-[11px] font-semibold text-white hover:bg-white/15 active:bg-white/20 transition-colors"
                                  >
                                    Replace current
                                  </button>
                                  <div className="h-px bg-white/20 shrink-0" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCaptionStyle(s.id);
                                      onAddCaptionSegment(s.id, "add");
                                      setCaptionApplyMenu(null);
                                    }}
                                    className="flex-1 px-2 text-[11px] font-semibold text-white hover:bg-white/15 active:bg-white/20 transition-colors"
                                  >
                                    Add to timeline
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {captionSubTab === "adjust" && (
            <div className="flex flex-col gap-5 overflow-y-auto no-scrollbar min-h-0 flex-1">
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
                  <span className="text-[12px] text-white/50">Position</span>
                  {(captionPosX !== 0 || captionPosY !== 0) && (
                    <button
                      onClick={onResetCaptionPos}
                      className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-white/30 leading-snug">
                  {captionSegments.length > 1
                    ? "Scrub to each caption segment, then drag on the preview — each style keeps its own position."
                    : "Drag the caption directly on the preview to reposition it."}
                </p>
              </div>
            </div>
          )}

          {captionSubTab === "transcript" && !hideTranscript && (
            <div className="flex flex-col gap-2">
              {captionWords.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-medium text-white/70">Transcript</p>
                    <span className="text-[10px] text-white/30">Tap any word to edit</span>
                  </div>
                  <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 rounded-xl bg-white/[0.03] p-3 max-h-[240px] overflow-y-auto no-scrollbar">
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
                        className="text-[15px] font-semibold text-white/90 rounded px-1 -mx-0.5 outline-none hover:bg-white/8 focus:bg-white/12 focus:text-white cursor-text leading-5 transition-colors"
                      >
                        {w.word}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-white/30 text-center py-8">No transcript available yet.</p>
              )}
            </div>
          )}

          {captionSubTab === "translate" && (
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
          )}
        </div>
      )}

      {activeTab === "overlays" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            {OVERLAY_SUB_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setOverlaySubTab(t.id)}
                className={cn(
                  "flex-1 rounded-full px-2 py-1.5 text-[10px] font-semibold transition-all whitespace-nowrap",
                  overlaySubTab === t.id
                    ? "bg-white text-black shadow-sm"
                    : "text-white/45 hover:text-white/70",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {overlaySubTab === "text" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-white/70">Text overlays</p>
            <button
              onClick={() => {
                if (onAddTextOverlay) {
                  onAddTextOverlay();
                  return;
                }
                const id = `txt-${Date.now()}`;
                setTextOverlays(prev => [...prev, {
                  id, text: "Your text", x: 0.5, y: 0.5, fontSize: 20, color: "#ffffff",
                  bold: false, italic: false, startTime: 0, duration: 4,
                }]);
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
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onRemoveTextOverlay) onRemoveTextOverlay(t.id);
                      else {
                        setTextOverlays(prev => prev.filter(o => o.id !== t.id));
                        if (selectedTextId === t.id) setSelectedTextId(null);
                      }
                    }}
                    className="ml-auto text-white/25 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {textOverlays.length > 0 && (
            <p className="text-[10px] text-white/25 text-center">
              Drag text on the video to reposition · trim on the timeline to control when it shows
            </p>
          )}
        </div>
          )}

          {overlaySubTab === "stickers" && (
        <StipopStickerPicker
          placedStickers={placedStickers}
          setPlacedStickers={setPlacedStickers}
          segmentationReady={segmentationReady}
          styleGridMaxHeight={styleGridMaxHeight}
          onToggleSticker={onToggleSticker}
          onRemoveSticker={onRemoveSticker}
          onClearStickers={onClearStickers}
          singleSelect={stickerSingleSelect}
        />
          )}

          {overlaySubTab === "thumbnail" && (
        <ThumbnailTabContent
          thumbnailOverlay={thumbnailOverlay}
          setThumbnailOverlay={setThumbnailOverlay}
        />
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

      {activeTab === "upload" && (
        <UploadPanel
          usage="timeline"
          draggable
          onAddToTimeline={onAddToTimeline}
          title="My media"
        />
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
    </div>
  );
}

/**
 * Water-fill SVG layer.
 * direction="horizontal" (default) — fills left→right; wave on the right edge scrolls vertically.
 * direction="vertical"             — rises bottom→top; wave on the top edge scrolls horizontally.
 * The wave animates continuously even when progress is fixed.
 */
function WaterFill({ progress, direction = "horizontal" }: { progress: number; direction?: "horizontal" | "vertical" }) {
  const p = Math.max(0, Math.min(100, progress));

  if (direction === "vertical") {
    // Water rises from bottom; start at ~5% so first fill is visible
    const fillHeight = Math.max(5, p);
    return (
      <span
        className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden transition-[height] duration-500 ease-out"
        style={{ height: `${fillHeight}%` }}
        aria-hidden
      >
        <span className="absolute inset-0 bg-white" />
        {/* Horizontal wave scrolls left continuously */}
        <svg
          className="absolute -top-[10px] left-0 w-[200%] animate-[chopprWaterScroll_2.2s_linear_infinite]"
          style={{ height: 20 }}
          viewBox="0 0 400 20"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0 10 C25 0, 50 20, 75 10 C100 0, 125 20, 150 10 C175 0, 200 20, 225 10 C250 0, 275 20, 300 10 C325 0, 350 20, 375 10 C400 0, 400 20, 400 20 L0 20 Z"
            fill="white"
          />
        </svg>
      </span>
    );
  }

  // Horizontal: fills left→right; wave on the right edge scrolls vertically
  const fillWidth = Math.max(3, p);
  return (
    <span
      className="absolute inset-y-0 left-0 pointer-events-none overflow-hidden transition-[width] duration-300 ease-out"
      style={{ width: `${fillWidth}%` }}
      aria-hidden
    >
      <span className="absolute inset-0 bg-white" />
      {/* Vertical wave on right edge — tall SVG, scrolls upward */}
      <svg
        className="absolute top-0 right-0 h-[200%] w-4 animate-[chopprWaterScrollV_1.6s_linear_infinite]"
        viewBox="0 0 16 200"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M8 0 C13 12, 3 24, 8 36 C13 48, 3 60, 8 72 C13 84, 3 96, 8 108 C13 120, 3 132, 8 144 C13 156, 3 168, 8 180 C13 192, 8 200, 8 200 L0 200 L0 0 Z"
          fill="white"
        />
      </svg>
    </span>
  );
}

function ExportClipButton({
  exportPhase,
  exportProgress,
  exportReadyToDownload,
  onExport,
  onCancel,
  onDownload,
  size = "default",
  className,
  creditCost,
}: {
  exportPhase: "idle" | "exporting" | "done" | "error" | "no_credits" | "upgrade_required";
  exportProgress: number;
  exportReadyToDownload: boolean;
  onExport: () => void;
  onCancel: () => void;
  onDownload: () => void;
  size?: "default" | "compact" | "circle";
  className?: string;
  creditCost?: number;
}) {
  const exporting = exportPhase === "exporting";
  const progress = Math.max(0, Math.min(100, exportProgress));

  const handleClick = () => {
    if (exporting) { onCancel(); return; }
    if (exportReadyToDownload) { onDownload(); return; }
    if (exportPhase === "no_credits") { window.location.href = "/pricing"; return; }
    onExport();
  };

  /* ── Circle variant (collapsed sidebar) ── */
  if (size === "circle") {
    const icon = exporting
      ? <X className="h-4 w-4 relative z-10" />
      : exportReadyToDownload
        ? <Download className="h-4 w-4 relative z-10" />
        : <Upload className="h-4 w-4 relative z-10" />;
    const title = exporting ? "Cancel export" : exportReadyToDownload ? "Download" : "Export clip";
    return (
      <button
        type="button"
        onClick={handleClick}
        title={title}
        aria-label={title}
        className={cn(
          "relative h-11 w-11 flex items-center justify-center rounded-full overflow-hidden transition-all active:scale-[0.94] cursor-pointer",
          exporting
            ? "bg-[#1a1a2e] border border-white/20 text-white"
            : "bg-white text-black hover:bg-white/85",
          className,
        )}
      >
        {exporting && <WaterFill progress={progress} direction="vertical" />}
        <span className={cn("relative z-10", exporting && "mix-blend-difference text-white")}>
          {icon}
        </span>
      </button>
    );
  }

  /* ── Default / compact variant ── */
  const label = exporting
    ? "Cancel"
    : exportReadyToDownload
      ? "Download"
      : exportPhase === "no_credits"
        ? "Get credits"
        : creditCost !== undefined
          ? `Export · ${creditCost} credit${creditCost === 1 ? "" : "s"}`
          : "Export clip";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "relative overflow-hidden font-semibold transition-all active:scale-[0.98] cursor-pointer",
        size === "compact"
          ? "rounded-xl px-3 py-1.5 text-[11px] min-w-[5.5rem]"
          : "w-full rounded-2xl py-3 text-[14px]",
        exporting
          ? "bg-[#0d0d1a] border border-white/20 text-white"
          : exportReadyToDownload
            ? "bg-white text-black hover:bg-white/90"
            : "bg-white text-black hover:bg-white/90",
        className,
      )}
      aria-label={label}
    >
      {exporting && <WaterFill progress={progress} />}
      <span
        className={cn(
          "relative z-10 inline-flex items-center justify-center gap-1.5",
          exporting && "mix-blend-difference text-white",
        )}
      >
        {exportReadyToDownload && !exporting && <Download className="h-3.5 w-3.5" />}
        {label}
      </span>
    </button>
  );
}

function ExportSection({
  exportPhase, exportProgress, exportUrl, exportError, handleExport, handleCancelExport,
  handlePrimaryExportAction, setExportPhase, setExportUrl,
  exportReadyToDownload,
  downloadMode = false,
  onDownloadEdit,
  onResetAll,
  compact = false,
  exportRequiresUpgrade = false,
  exportCreditCost,
}: Pick<EditPanelProps, "exportPhase" | "exportProgress" | "exportUrl" | "exportError" | "handleExport" | "handleCancelExport" | "setExportPhase" | "setExportUrl"> & {
  handlePrimaryExportAction: () => void;
  exportReadyToDownload: boolean;
  downloadMode?: boolean;
  onDownloadEdit?: () => void;
  onResetAll?: () => void;
  compact?: boolean;
  exportRequiresUpgrade?: boolean;
  exportCreditCost?: number;
}) {
  const ResetLink = onResetAll ? (
    <button
      onClick={onResetAll}
      className="text-[11px] text-white hover:text-white/70 transition-colors text-center py-0.5"
    >
      Reset all changes to original
    </button>
  ) : null;

  // Previewing an already-exported version → the action is a straight download
  if (downloadMode) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={onDownloadEdit}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-[14px] font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all"
        >
          <Download className="h-4 w-4" /> Download
        </button>
        {ResetLink}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", compact && "gap-1.5")}>
      {(exportPhase === "idle" || exportPhase === "exporting" || (exportPhase === "done" && !exportReadyToDownload)) && (
        exportRequiresUpgrade && exportPhase !== "exporting" ? (
          <div className="flex flex-col gap-1.5">
            <Link
              href="/dashboard/billing"
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-[14px] font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all"
            >
              <Sparkles className="h-4 w-4" />
              Upgrade to Pro
            </Link>
            {!compact && (
              <p className="text-[10px] text-white/40 text-center leading-snug">
                Upgrade to export clips greater than 5 min
              </p>
            )}
          </div>
        ) : (
          <>
            <ExportClipButton
              exportPhase={exportPhase}
              exportProgress={exportProgress}
              exportReadyToDownload={exportReadyToDownload}
              onExport={handleExport}
              onCancel={handleCancelExport}
              onDownload={handlePrimaryExportAction}
              size={compact ? "compact" : "default"}
              creditCost={exportCreditCost}
            />
            {exportPhase === "exporting" && (
              <p className="text-[10px] text-white/25 text-center">
                Times out after {EXPORT_TIMEOUT_MINUTES} minutes if stuck.
              </p>
            )}
          </>
        )
      )}

      {exportReadyToDownload && exportUrl && (
        <>
          <div className="flex items-center gap-2 text-[12px] text-green-400 mb-1">
            <CheckCircle className="h-4 w-4" /> Export ready!
          </div>
          <button
            onClick={handlePrimaryExportAction}
            className="w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all"
          >
            Download
          </button>
          {!compact && (
            <button
              onClick={handleExport}
              className="text-[11px] text-white/35 hover:text-white/60 transition-colors text-center py-1"
            >
              Export again
            </button>
          )}
        </>
      )}

      {exportPhase === "error" && (
        <>
          <div className="flex flex-col gap-1 text-[12px] text-red-400 mb-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" /> Export failed
            </div>
            {exportError && (
              <p className="text-[11px] text-red-400/80 leading-snug pl-6">{exportError}</p>
            )}
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
          <button onClick={() => setExportPhase("idle")} className="text-[11px] text-white/25 hover:text-white/50 transition-colors text-center cursor-pointer">
            Cancel
          </button>
        </>
      )}

      {exportPhase === "upgrade_required" && (
        <>
          <div className="flex flex-col gap-1 text-[12px] text-amber-400 mb-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" /> Upgrade required
            </div>
            <p className="text-[11px] text-white/45 leading-snug pl-6">
              {exportError ?? "Upgrade to export clips greater than 5 min"}
            </p>
          </div>
          <Link
            href="/dashboard/billing"
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-[14px] font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro
          </Link>
          <button onClick={() => setExportPhase("idle")} className="text-[11px] text-white/25 hover:text-white/50 transition-colors text-center cursor-pointer">
            Cancel
          </button>
        </>
      )}

      {ResetLink}
    </div>
  );
}

// ── Draggable thumbnail overlay on the video preview ─────────────────────────
function DraggableThumbnailOverlay({
  overlay,
  containerRef,
  onMove,
}: {
  overlay: ThumbnailOverlayState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onMove: (o: ThumbnailOverlayState) => void;
}) {
  const [selected, setSelected] = useState(false);
  const [moveDragging, setMoveDragging] = useState(false);
  const moveStart = useRef<{ mx: number; my: number; ox: number; oy: number; rectW: number; rectH: number } | null>(null);
  const resizeStart = useRef<{ mx: number; my: number; snap: ThumbnailOverlayState; rectW: number; rectH: number; dir: string } | null>(null);

  // Tap/click outside to deselect (pointer events so touch works on mobile)
  useEffect(() => {
    if (!selected) return;
    const handler = (e: PointerEvent) => {
      const el = document.getElementById("thumb-overlay-box");
      if (el && !el.contains(e.target as Node)) setSelected(false);
    };
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, [selected]);

  // Move the whole overlay — pointer events for mouse + finger drag
  const handleMovePointerDown = (e: React.PointerEvent) => {
    // Ignore secondary buttons; let resize handles own their events
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.stopPropagation();
    e.preventDefault();
    setSelected(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    moveStart.current = {
      mx: e.clientX, my: e.clientY,
      ox: overlay.x, oy: overlay.y,
      rectW: rect.width, rectH: rect.height,
    };
    setMoveDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleMovePointerMove = (e: React.PointerEvent) => {
    if (!moveStart.current) return;
    const { mx, my, ox, oy, rectW, rectH } = moveStart.current;
    const dx = ((e.clientX - mx) / rectW) * 100;
    const dy = ((e.clientY - my) / rectH) * 100;
    onMove({
      ...overlay,
      x: Math.min(100 - overlay.width,  Math.max(0, ox + dx)),
      y: Math.min(100 - overlay.height, Math.max(0, oy + dy)),
    });
  };

  const handleMovePointerUp = () => {
    moveStart.current = null;
    setMoveDragging(false);
  };

  // Resize from a handle
  const handleResizePointerDown = (e: React.PointerEvent, dir: string) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    resizeStart.current = {
      mx: e.clientX, my: e.clientY,
      snap: { ...overlay },
      rectW: rect.width, rectH: rect.height,
      dir,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeStart.current) return;
    const { mx, my, snap, rectW, rectH, dir } = resizeStart.current;
    const dx = ((e.clientX - mx) / rectW) * 100;
    const dy = ((e.clientY - my) / rectH) * 100;
    let { x, y, width, height } = snap;
    const MIN = 5;
    if (dir.includes("l")) { const nw = Math.max(MIN, width - dx);  x = x + width - nw;  width = nw; }
    if (dir.includes("r")) {                                          width  = Math.max(MIN, width  + dx); }
    if (dir.includes("t")) { const nh = Math.max(MIN, height - dy); y = y + height - nh; height = nh; }
    if (dir.includes("b")) {                                          height = Math.max(MIN, height + dy); }
    x = Math.max(0, Math.min(100 - width,  x));
    y = Math.max(0, Math.min(100 - height, y));
    onMove({ ...overlay, x, y, width, height });
  };

  const handleResizePointerUp = () => { resizeStart.current = null; };

  const br = getShapeBorderRadius(overlay.styleId);

  // 4 corner handles only — slightly larger hit targets for touch
  const HANDLES = [
    { dir: "tl", style: { top: -8,    left: -8  }, cursor: "nwse-resize" },
    { dir: "tr", style: { top: -8,    right: -8 }, cursor: "nesw-resize" },
    { dir: "bl", style: { bottom: -8, left: -8  }, cursor: "nesw-resize" },
    { dir: "br", style: { bottom: -8, right: -8 }, cursor: "nwse-resize" },
  ];

  return (
    <div
      id="thumb-overlay-box"
      className="touch-none select-none"
      onPointerDown={handleMovePointerDown}
      onPointerMove={handleMovePointerMove}
      onPointerUp={handleMovePointerUp}
      onPointerCancel={handleMovePointerUp}
      style={{
        position:   "absolute",
        left:       `${overlay.x}%`,
        top:        `${overlay.y}%`,
        width:      `${overlay.width}%`,
        height:     `${overlay.height}%`,
        zIndex:     5,
        opacity:    (overlay.opacity ?? 100) / 100,
        cursor:     moveDragging ? "grabbing" : "grab",
        userSelect: "none",
        touchAction: "none",
      }}
      title="Tap to select · drag to move"
    >
      {/* Full image — never cropped */}
      <img
        src={overlay.imageUrl}
        alt=""
        draggable={false}
        style={{
          width: "100%", height: "100%",
          objectFit:    "contain",
          borderRadius: br,
          display:      "block",
          pointerEvents: "none",
        }}
      />

      {/* Selection box + resize handles */}
      {selected && (
        <>
          <div style={{
            position:      "absolute",
            inset:         0,
            border:        "1.5px solid rgba(255,255,255,0.85)",
            borderRadius:  br,
            pointerEvents: "none",
            boxShadow:     "0 0 0 1px rgba(0,0,0,0.4)",
          }} />
          {HANDLES.map(h => (
            <div
              key={h.dir}
              className="touch-none"
              onPointerDown={e => handleResizePointerDown(e, h.dir)}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              style={{
                position:        "absolute",
                width:           16,
                height:          16,
                background:      "white",
                border:          "1.5px solid rgba(0,0,0,0.5)",
                borderRadius:    2,
                cursor:          h.cursor,
                zIndex:          6,
                touchAction:     "none",
                ...h.style,
              }}
            />
          ))}
        </>
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

  // ── Draft persistence ─────────────────────────────────────────────────────
  // Edited/exported clips derived from this clip + which one is previewed
  // Declared here (before useClipDraftAutosave) so we can scope the draft key to the active version.
  const [editedClips, setEditedClips] = useState<any[]>([]);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);

  const { saveDraft, flush: flushDraft } = useClipDraftAutosave(clipId ?? "", activeEditId);
  const draftRestoredRef = useRef(false);
  const [draftTracks, setDraftTracks] = useState<unknown[] | null>(null);
  const [timelineResetKey, setTimelineResetKey] = useState(0);

  // Restore draft on mount (once)
  useEffect(() => {
    if (!clipId || draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    const draft = loadClipDraft(clipId);
    if (!draft) return;
    if (draft.aspectRatio) setAspectRatio(draft.aspectRatio);
    if (draft.speed != null) { setSpeed(draft.speed); prevSpeedRef.current = draft.speed; }
    if (draft.trimStart != null) setTrimStart(draft.trimStart);
    if (draft.trimEnd != null) setTrimEnd(draft.trimEnd);
    if (draft.brightness != null) setBrightness(draft.brightness);
    if (draft.contrast != null) setContrast(draft.contrast);
    if (draft.saturation != null) setSaturation(draft.saturation);
    if (draft.captionStyle) setCaptionStyle(draft.captionStyle as any);
    if (draft.captionWords?.length) setCaptionWords(draft.captionWords as any);
    if (draft.captionFontSize) setCaptionFontSize(draft.captionFontSize);
    if (draft.captionPosX != null) setCaptionPosX(draft.captionPosX);
    if (draft.captionPosY != null) setCaptionPosY(draft.captionPosY);
    if (draft.textOverlays?.length) setTextOverlays(draft.textOverlays as any);
    if (draft.placedStickers?.length) setPlacedStickers(draft.placedStickers as any);
    if (draft.thumbnailOverlay) setThumbnailOverlay(draft.thumbnailOverlay as any);
    if (draft.timelineTracks?.length) setDraftTracks(draft.timelineTracks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipId]);

  const videoRef              = useRef<HTMLVideoElement>(null);
  const timelineToggleRef     = useRef<(() => void) | null>(null);
  const exportTracksRef       = useRef<ChopprTrack[] | null>(null);
  const overlayApiRef         = useRef<TimelineOverlayApi | null>(null);
  const mediaApiRef           = useRef<TimelineMediaApi | null>(null);
  const captionApiRef         = useRef<CaptionTrackApi | null>(null);
  const captionWordsRef       = useRef<import("./_components/caption-renderer").CaptionWord[]>([]);
  const [captionSegments, setCaptionSegments] = useState<CaptionSegment[]>([]);
  const timelineOverlayIdsRef = useRef<Set<string>>(new Set());
  const lastOverlayReportRef  = useRef<Set<string>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Raw timeline cursor position — used for overlay visibility (different from currentTime
  // which is source time after trimStart + speed conversion)
  const [timelineTime, setTimelineTime] = useState(0);
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

  // Upload tab is desktop-only — leave it if somehow active on phone
  useEffect(() => {
    if (isMobile && activeTab === "upload") setActiveTab("captions");
  }, [isMobile, activeTab]);

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
  const [captionPosX, setCaptionPosX]         = useState(0);

  // Keep the ref in sync so timeline-caption-bridge can access latest words
  useEffect(() => { captionWordsRef.current = captionWords; }, [captionWords]);
  const [translating, setTranslating]     = useState(false);
  const [activeLang, setActiveLang]       = useState("");

  // Other settings
  const [speed, setSpeed]             = useState(1.0);
  // Track previous speed for rescaling overlays when speed changes
  const prevSpeedRef = useRef(1.0);
  const [trimStart, setTrimStart]     = useState(0);
  const [trimEnd, setTrimEnd]         = useState(0);
  const [brightness, setBrightness]   = useState(100);
  const [contrast, setContrast]       = useState(100);
  const [saturation, setSaturation]   = useState(100);
  const [thumbnailOverlay, setThumbnailOverlay] = useState<ThumbnailOverlayState | null>(null);

  // Background overlay
  const [placedStickers, setPlacedStickers]     = useState<PlacedSticker[]>([]);
  const [textOverlays, setTextOverlays]         = useState<TextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId]     = useState<string | null>(null);
  const textDragRef = useRef<{ id: string; rectLeft: number; rectTop: number; rectW: number; rectH: number } | null>(null);
  const [segmentationReady, setSegmentationReady] = useState(false);
  const segmenterRef = useRef<ImageSegmenterRef | null>(null);

  // Export state
  const [exportPhase, setExportPhase]       = useState<"idle" | "exporting" | "done" | "error" | "no_credits" | "upgrade_required">("idle");
  /** null = plan not loaded yet (avoid button flicker) */
  const [isFreePlan, setIsFreePlan]         = useState<boolean | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl]           = useState<string | null>(null);
  const [exportError, setExportError]       = useState<string | null>(null);
  const exportPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exportIdRef = useRef<string | null>(null);
  const exportPollStartedRef = useRef<number | null>(null);
  const exportSnapshotRef = useRef<string | null>(null);

  // Sticker drag state — using refs so no stale closures
  const dragRef = useRef<{ idx: number; rectLeft: number; rectTop: number; rectW: number; rectH: number } | null>(null);
  // Caption position drag state
  const captionDragRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    rectW: number;
    rectH: number;
    segmentId: string | null;
  } | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // ── Auto-save page-level settings to draft ─────────────────────────────────
  useEffect(() => {
    if (!clipId || !draftRestoredRef.current) return;
    saveDraft({
      captionStyle,
      captionWords: captionWords as unknown[],
      captionFontSize,
      captionPosX,
      captionPosY,
      speed,
      trimStart,
      trimEnd,
      brightness,
      contrast,
      saturation,
      textOverlays: textOverlays as unknown[],
      placedStickers: placedStickers as unknown[],
      aspectRatio,
      thumbnailOverlay: thumbnailOverlay as unknown,
    });
  }, [
    clipId, saveDraft, captionStyle, captionWords, captionFontSize,
    captionPosX, captionPosY, speed, trimStart, trimEnd, brightness,
    contrast, saturation, textOverlays, placedStickers, aspectRatio, thumbnailOverlay,
  ]);

  // Load project aspect ratio
  const [arDropdownOpen, setArDropdownOpen] = useState(false);
  const arDropdownRef = useRef<HTMLDivElement>(null);
  const [backgroundFill, setBackgroundFill] = useState<string>("blur");

  useEffect(() => {
    if (!projectId) return;
    apiFetch(`${API_URL}/api/projects/${projectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.aspectRatio) setAspectRatio(data.aspectRatio);
        else if (data?.editFull) setAspectRatio("16:9");
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    apiFetch(`${API_URL}/api/plans/me`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) {
          setIsFreePlan(true);
          return;
        }
        const planId = d.currentPlanId ?? "free";
        const plan = d.plans?.find((p: any) => p.slug === planId || p._id === planId);
        setIsFreePlan(!plan || plan.slug === "free" || planId === "free");
      })
      .catch(() => setIsFreePlan(true));
  }, []);

  // Close AR dropdown on outside click
  useEffect(() => {
    if (!arDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (arDropdownRef.current && !arDropdownRef.current.contains(e.target as Node)) {
        setArDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [arDropdownOpen]);

  // Load clip captions + duration on mount (duration from API avoids Export↔Upgrade flicker)
  useEffect(() => {
    if (!clipId) return;

    apiFetch(`${API_URL}/api/clips/${clipId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        if (typeof data.duration === "number" && data.duration > 0) {
          setDuration(data.duration);
          setTrimEnd((prev) => (prev > 0 ? prev : data.duration));
        }
        if (data.captions?.length) {
          setCaptionWords(data.captions);
          setCaptionLang(data.captionLang ?? "");
          setActiveLang((data.captionLang ?? "").split("-")[0]);
        }
        // Prefer API duration so timeline isn't stuck waiting on <video> metadata
        const apiDur = Number(data.duration) || (Number(data.endTime) - Number(data.startTime)) || 0;
        if (apiDur > 0 && duration <= 0) {
          setDuration(apiDur);
          // Only reset trimEnd if it hasn't been restored from a draft
          setTrimEnd((prev) => (prev > 0 ? prev : apiDur));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipId]);

  // Load edited/exported versions of this clip (blocks shown below the preview)
  // NOTE: apiFetch is recreated every render, so it's intentionally excluded from
  // the deps to keep loadEdits stable and avoid an infinite fetch loop.
  const loadEdits = useCallback(() => {
    if (!clipId) return;
    apiFetch(`${API_URL}/api/clips/${clipId}/edits`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (Array.isArray(data)) setEditedClips(data); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipId]);

  useEffect(() => { loadEdits(); }, [loadEdits]);

  // Which video the preview shows: the original clip or a selected edited clip
  const activeEdit    = activeEditId ? editedClips.find(c => c._id === activeEditId) ?? null : null;
  const activeSrc     = activeEdit?.s3Url ?? src;
  const isViewingEdit = !!activeEdit;

  // Whether any edit setting has been applied on top of the active (base) video.
  // Used to decide Download (untouched selected version) vs Export (has new changes).
  const hasChanges =
    captionStyle !== "none" ||
    speed !== 1 ||
    trimStart > 0.05 ||
    (duration > 0 && trimEnd < duration - 0.05) ||
    brightness !== 100 || contrast !== 100 || saturation !== 100 ||
    placedStickers.length > 0 ||
    textOverlays.length > 0 ||
    thumbnailOverlay !== null ||
    backgroundFill !== "blur";

  // Selecting an edited version → show a straight Download until the user tweaks something
  const downloadMode = isViewingEdit && !hasChanges;

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

  const buildExportSnapshot = useCallback(() => JSON.stringify({
    aspectRatio, backgroundFill, captionStyle, captionFontSize, captionPosY, captionPosX,
    speed, trimStart, trimEnd, brightness, contrast, saturation,
    placedStickers, textOverlays, captionWords,
  }), [aspectRatio, backgroundFill, captionStyle, captionFontSize, captionPosY, captionPosX, speed, trimStart, trimEnd, brightness, contrast, saturation, placedStickers, textOverlays, captionWords]);

  const invalidateExport = useCallback(() => {
    if (exportPollRef.current) {
      clearInterval(exportPollRef.current);
      exportPollRef.current = null;
    }
    exportIdRef.current = null;
    exportPollStartedRef.current = null;
    exportSnapshotRef.current = null;
    setExportPhase("idle");
    setExportProgress(0);
    setExportUrl(null);
    setExportError(null);
  }, []);

  const markExportCurrent = useCallback(() => {
    exportSnapshotRef.current = buildExportSnapshot();
  }, [buildExportSnapshot]);

  const isExportStale = useCallback(() => {
    if (!exportSnapshotRef.current) return true;
    return exportSnapshotRef.current !== buildExportSnapshot();
  }, [buildExportSnapshot]);

  // Reset export when any edit setting changes after a successful export
  useEffect(() => {
    if (exportPhase === "done") invalidateExport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only invalidate when settings change, not when exportPhase flips to done
  }, [captionStyle, captionFontSize, captionPosY, captionPosX, captionWords, speed, trimStart, trimEnd, brightness, contrast, saturation, placedStickers, textOverlays, aspectRatio, backgroundFill]);

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

  const stopExportPolling = useCallback(() => {
    if (exportPollRef.current) {
      clearInterval(exportPollRef.current);
      exportPollRef.current = null;
    }
  }, []);

  const failExport = useCallback((message: string) => {
    stopExportPolling();
    exportIdRef.current = null;
    exportPollStartedRef.current = null;
    setExportError(message);
    setExportPhase("error");
  }, [stopExportPolling]);

  const handleCancelExport = useCallback(async () => {
    const exportId = exportIdRef.current;
    stopExportPolling();
    exportIdRef.current = null;
    exportPollStartedRef.current = null;
    setExportError(null);
    setExportProgress(0);
    setExportPhase("idle");
    if (exportId) {
      try {
        await apiFetch(`${API_URL}/api/exports/${exportId}/cancel`, { method: "POST" });
      } catch {
        /* UI already reset */
      }
    }
  }, [apiFetch, stopExportPolling]);

  const handleExport = async () => {
    if (!src || exportPhase === "exporting") return;
    if (duration <= 0) return;

    const clipDuration = getTrimmedExportSecs(trimStart, trimEnd, duration);
    if (clipDuration <= 0) return;
    const renderedSecs = getRenderedExportSecs(trimStart, trimEnd, duration, speed);
    if (isFreePlan === true && renderedSecs > FREE_EXPORT_MAX_SECS) {
      setExportError("Upgrade to export clips greater than 5 min");
      setExportPhase("upgrade_required");
      return;
    }

    const effectiveEnd = trimEnd > 0 ? Math.min(trimEnd, duration) : duration;
    const safeTrimStart = Math.min(Math.max(0, trimStart), effectiveEnd);

    setExportPhase("exporting");
    setExportProgress(0);
    setExportUrl(null);
    setExportError(null);
    stopExportPolling();

    try {
      const timelineTracks = exportTracksRef.current;
      const hasTimelineClips = (timelineTracks?.[0]?.items?.length ?? 0) > 0;

      const tracks = hasTimelineClips ? timelineTracks! : (() => {
        const effectiveEnd = trimEnd > 0 ? trimEnd : duration;
        const clipDuration = effectiveEnd - trimStart;
        return [
          {
            id: "track-video",
            items: [{
              id: clipId,
              clipId,
              type: "video" as const,
              startTime: 0,
              duration: clipDuration,
              sourceDuration: duration,
              trimIn: safeTrimStart,
              trimOut: Math.max(0, duration - effectiveEnd),
              src: activeSrc,
            }],
          },
          { id: "track-audio", items: [] },
        ];
      })();

      const volumes: Record<string, number> = { [clipId]: 100 };
      const speedsMap: Record<string, number> = { [clipId]: speed };
      for (const track of tracks) {
        for (const item of track.items) {
          volumes[item.id] = volumes[item.id] ?? 100;
          speedsMap[item.id] = item.id === clipId ? speed : (speedsMap[item.id] ?? 1);
        }
      }

      const res = await apiFetch(`${API_URL}/api/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectId || clipId,
          tracks,
          volumes,
          speeds: speedsMap,
          captionStyle,
          captionFontSize,
          captionPosY,
          captionPosX,
          captionMap:     captionWords.length ? { [clipId]: captionWords } : {},
          captionSegments: captionSegments.length
            ? captionSegments.map(s => ({
                style: s.style,
                start: s.start,
                end: s.end,
                posX: s.posX,
                posY: s.posY,
                words: s.words,
              }))
            : [],
          aspectRatio,
          backgroundFill,
          brightness,
          contrast,
          saturation,
          originalClipId: clipId,
          stickers: placedStickers,
          textOverlays,
          thumbnailOverlay: thumbnailOverlay ?? null,
          previewWidth: videoContainerRef.current?.clientWidth || 380,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === "insufficient_credits") {
          setExportPhase("no_credits");
          return;
        }
        if (err.error === "export_duration_limit") {
          setExportError(err.message ?? "Upgrade to export clips greater than 5 min");
          setExportPhase("upgrade_required");
          return;
        }
        throw new Error(err.message ?? err.error ?? "Export failed");
      }

      const { exportId } = await res.json();
      exportIdRef.current = exportId;
      exportPollStartedRef.current = Date.now();

      exportPollRef.current = setInterval(async () => {
        if (
          exportPollStartedRef.current != null &&
          Date.now() - exportPollStartedRef.current > EXPORT_TIMEOUT_MS
        ) {
          const timedOutId = exportIdRef.current;
          stopExportPolling();
          exportIdRef.current = null;
          exportPollStartedRef.current = null;
          if (timedOutId) {
            void apiFetch(`${API_URL}/api/exports/${timedOutId}/cancel`, { method: "POST" }).catch(() => {});
          }
          failExport(`Export timed out after ${EXPORT_TIMEOUT_MINUTES} minutes`);
          return;
        }

        try {
          const r = await apiFetch(`${API_URL}/api/exports/${exportId}`);
          if (!r.ok) return;
          const data = await r.json();
          setExportProgress(data.progress ?? 0);
          if (data.status === "done") {
            stopExportPolling();
            exportIdRef.current = null;
            exportPollStartedRef.current = null;
            setExportUrl(data.s3Url);
            setExportPhase("done");
            if (clipId) clearClipDraft(clipId, activeEditId);
            markExportCurrent();
            loadEdits();
            openAndDownload(data.s3Url, `clip-${index}.mp4`);
          } else if (data.status === "failed") {
            failExport(data.error ?? "Export failed on server");
          } else if (data.status === "cancelled") {
            stopExportPolling();
            exportIdRef.current = null;
            exportPollStartedRef.current = null;
            setExportError(null);
            setExportProgress(0);
            setExportPhase("idle");
          }
        } catch (err) {
          console.warn("[export] poll failed, retrying…", err);
        }
      }, EXPORT_POLL_INTERVAL_MS);
    } catch (err) {
      failExport(err instanceof Error ? err.message : "Export failed");
    }
  };

  const handlePrimaryExportAction = () => {
    // Previewing an untouched exported version → the primary action is a download
    if (downloadMode && activeEdit?.s3Url) {
      openAndDownload(activeEdit.s3Url, `clip-${index}.mp4`);
      return;
    }
    if (exportPhase === "exporting") return;
    if (exportPhase === "done" && exportUrl && !isExportStale()) {
      openAndDownload(exportUrl, `clip-${index}.mp4`);
      return;
    }
    handleExport();
  };

  // Download the currently-selected edited version
  const handleDownloadEdit = () => {
    if (activeEdit?.s3Url) openAndDownload(activeEdit.s3Url, `clip-${index}.mp4`);
  };

  // Reset the edit panel to a clean slate (does NOT change which version is active)
  const applyDefaults = useCallback(() => {
    setCaptionStyle("none");
    setCaptionFontSize(50);
    setCaptionPosY(0);
    setCaptionPosX(0);
    setSpeed(1.0);
    setTrimStart(0);
    setTrimEnd(videoRef.current?.duration ?? 0);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setThumbnailOverlay(null);
    setPlacedStickers([]);
    setTextOverlays([]);
    setBackgroundFill("blur");
    setCaptionSegments([]);
    // Restore the original (untranslated) captions
    apiFetch(`${API_URL}/api/clips/${clipId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.captions?.length) {
          setCaptionWords(data.captions);
          setCaptionLang(data.captionLang ?? "");
          setActiveLang((data.captionLang ?? "").split("-")[0]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipId]);

  // Switch which version (original or an edit) the preview + edits are based on
  const selectVersion = useCallback((id: string | null) => {
    if (id === activeEditId) return;
    // Flush current draft before switching so unsaved changes are persisted
    flushDraft();
    // Reset overlay tracking refs so the new version starts fresh
    lastOverlayReportRef.current = new Set();
    timelineOverlayIdsRef.current = new Set();
    setActiveEditId(id);
    setPlaying(false);
    setCurrentTime(0);
    setDraftTracks(null);
    setTimelineResetKey(k => k + 1);
    // Restore the target version's draft (keyed by editId or null for Original)
    if (clipId) {
      const draft = loadClipDraft(clipId, id);
      if (draft) {
        if (draft.aspectRatio) setAspectRatio(draft.aspectRatio);
        if (draft.speed != null) { setSpeed(draft.speed); prevSpeedRef.current = draft.speed; }
        if (draft.trimStart != null) setTrimStart(draft.trimStart);
        if (draft.trimEnd != null) setTrimEnd(draft.trimEnd);
        if (draft.brightness != null) setBrightness(draft.brightness);
        if (draft.contrast != null) setContrast(draft.contrast);
        if (draft.saturation != null) setSaturation(draft.saturation);
        if (draft.captionStyle) setCaptionStyle(draft.captionStyle as any);
        if (draft.captionWords?.length) setCaptionWords(draft.captionWords as any);
        if (draft.captionFontSize) setCaptionFontSize(draft.captionFontSize);
        if (draft.captionPosX != null) setCaptionPosX(draft.captionPosX);
        if (draft.captionPosY != null) setCaptionPosY(draft.captionPosY);
        if (draft.textOverlays?.length) setTextOverlays(draft.textOverlays as any);
        if (draft.placedStickers?.length) setPlacedStickers(draft.placedStickers as any);
        if (draft.thumbnailOverlay) setThumbnailOverlay(draft.thumbnailOverlay as any);
        if (draft.timelineTracks?.length) setDraftTracks(draft.timelineTracks);
      } else {
        applyDefaults();
      }
    } else {
      applyDefaults();
    }
  }, [activeEditId, applyDefaults, clipId, flushDraft]);

  // Reset every edit setting AND go back to the original video
  const resetAll = useCallback(() => {
    clearClipDraft(clipId, activeEditId);
    setDraftTracks(null);
    setActiveEditId(null);
    setTimelineResetKey(k => k + 1);
    applyDefaults();
  }, [applyDefaults, clipId, activeEditId]);

  // Sync speed
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    const oldSpeed = prevSpeedRef.current;
    prevSpeedRef.current = newSpeed;
    setSpeed(newSpeed);
    if (oldSpeed === newSpeed || oldSpeed <= 0) return;
    // Rescale factor: how much the rendered clip duration changes.
    // oldDuration/speed = rendered duration, so factor = oldSpeed / newSpeed
    const factor = oldSpeed / newSpeed;
    // Rescale timeline overlay elements (text + stickers)
    overlayApiRef.current?.rescaleTimings(factor);
    // Rescale caption track elements
    captionApiRef.current?.rescaleTimings(factor);
    // Rescale React state for text overlays and placed stickers
    setTextOverlays(prev => prev.map(t => ({
      ...t,
      startTime: (t.startTime ?? 0) * factor,
      duration:  (t.duration  ?? DEFAULT_OVERLAY_DUR) * factor,
    })));
    setPlacedStickers(prev => prev.map(ps => ({
      ...ps,
      startTime: (ps.startTime ?? 0) * factor,
      duration:  (ps.duration  ?? DEFAULT_OVERLAY_DUR) * factor,
    })));
  }, []);

  // Load the main clip into the preview <video>. Timeline may swap src for other clips;
  // do not bind src= in JSX or React will overwrite those swaps on every re-render.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSrc) return;
    let target = activeSrc;
    try {
      target = new URL(activeSrc, window.location.href).href;
    } catch {
      /* keep raw string */
    }
    const current = video.currentSrc || video.src || "";
    if (current && (current === target || current === activeSrc)) return;
    video.src = activeSrc;
    video.load();
    setCurrentTime(0);
    setPlaying(false);
    // Don't zero duration here — that unmounts ClipTimeline and causes "Loading…" stuck state.
    // Duration is refreshed from onLoadedMetadata / API when available.
  }, [activeSrc]);

  // Release the main video's resources on unmount to free a WebMediaPlayer slot
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, []);

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
    // Mobile: timeline is hidden — drive the preview video directly
    if (isMobile) {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        void v.play().catch(() => {});
        setPlaying(true);
      } else {
        v.pause();
        setPlaying(false);
      }
      return;
    }
    timelineToggleRef.current?.();
  };

  const registerTimelineToggle = useCallback((toggle: (() => void) | null) => {
    timelineToggleRef.current = toggle;
  }, []);

  const handleTimelineTrimChange = useCallback((start: number, end: number) => {
    setTrimStart(start);
    setTrimEnd(end);
  }, []);

  const handleTimelinePlayingChange = useCallback((next: boolean) => {
    setPlaying(next);
  }, []);

  const handleExportTracksChange = useCallback((tracks: ChopprTrack[]) => {
    exportTracksRef.current = tracks;
  }, []);

  const timelineSerializedRef = useRef<unknown[] | null>(null);
  const handleTimelineSerialize = useCallback((serializedTracks: unknown[]) => {
    timelineSerializedRef.current = serializedTracks;
    saveDraft({ timelineTracks: serializedTracks });
  }, [saveDraft]);

  const handleTimelineTimeChange = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleRawTimelineTimeChange = useCallback((time: number) => {
    setTimelineTime(time);
  }, []);

  const isOverlayVisible = useCallback((startTime: number | undefined, duration: number | undefined) => {
    // If no startTime defined, always show (mobile single-select / backwards compat)
    if (startTime === undefined || startTime === null) return true;
    // On mobile there is no timeline — drive visibility from the scrubber clock.
    const t = isMobile ? currentTime : timelineTime;
    const dur = duration ?? DEFAULT_OVERLAY_DUR;
    return t >= startTime - 0.05 && t < startTime + dur + 0.05;
  }, [isMobile, currentTime, timelineTime]);

  const handleOverlayTimingChange = useCallback((items: OverlayTimingItem[]) => {
    // Cap duration: if timeline reports a duration >= video duration, it's a Twick default
    // that spans the whole video. Cap it to DEFAULT_OVERLAY_DUR.
    const videoDur = videoRef.current?.duration ?? Infinity;
    const cappedItems = items.map(item => ({
      ...item,
      duration: item.duration >= videoDur - 0.5 ? DEFAULT_OVERLAY_DUR : item.duration,
    }));
    const textById = new Map(cappedItems.filter(i => i.kind === "text").map(i => [i.id, i]));
    const stickerById = new Map(cappedItems.filter(i => i.kind === "sticker").map(i => [i.id, i]));
    const reported = new Set([...textById.keys(), ...stickerById.keys()]);

    // Ids that were on the timeline last report but are gone now → deleted on timeline
    const removed: string[] = [];
    for (const id of lastOverlayReportRef.current) {
      if (!reported.has(id)) removed.push(id);
    }
    lastOverlayReportRef.current = reported;
    for (const id of reported) timelineOverlayIdsRef.current.add(id);
    for (const id of removed) timelineOverlayIdsRef.current.delete(id);

    if (removed.length) {
      setTextOverlays(prev => prev.filter(t => !removed.includes(t.id)));
      setPlacedStickers(prev => prev.filter(ps => !removed.includes(ps.stickerId)));
    }

    // Update timing on existing overlays
    setTextOverlays(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      // Re-add any text elements that exist on the timeline but were lost from state
      // (e.g. after page refresh where draftTracks restored the timeline but textOverlays was empty)
      const missing: TextOverlay[] = [];
      for (const [id, timing] of textById) {
        if (!existingIds.has(id)) {
          missing.push({
            id,
            text: timing.text ?? "Text",
            x: 0.5,
            y: 0.5,
            fontSize: 20,
            color: "#ffffff",
            bold: false,
            italic: false,
            startTime: timing.startTime,
            duration: timing.duration,
          });
          timelineOverlayIdsRef.current.add(id);
        }
      }
      const updated = prev.map(t => {
        const timing = textById.get(t.id);
        if (!timing) return t;
        if (
          Math.abs((t.startTime ?? 0) - timing.startTime) < 0.02 &&
          Math.abs((t.duration ?? DEFAULT_OVERLAY_DUR) - timing.duration) < 0.02
        ) return t;
        return { ...t, startTime: timing.startTime, duration: timing.duration };
      });
      return missing.length ? [...updated, ...missing] : updated;
    });

    setPlacedStickers(prev =>
      prev.map(ps => {
        const timing = stickerById.get(ps.stickerId);
        if (!timing) return ps;
        if (
          Math.abs((ps.startTime ?? 0) - timing.startTime) < 0.02 &&
          Math.abs((ps.duration ?? DEFAULT_OVERLAY_DUR) - timing.duration) < 0.02
        ) return ps;
        return { ...ps, startTime: timing.startTime, duration: timing.duration };
      }),
    );
  }, [videoRef]);

  const handleAddTextOverlay = useCallback(() => {
    const id = `txt-${Date.now()}`;
    // Place the new overlay after all existing overlays (not at cursor position).
    // This prevents overlap when the cursor sits on an existing overlay.
    const lastEnd = textOverlays.reduce((acc, t) => {
      const end = (t.startTime ?? 0) + (t.duration ?? DEFAULT_OVERLAY_DUR);
      return Math.max(acc, end);
    }, 0);
    const start = lastEnd;
    const overlay: TextOverlay = {
      id,
      text: "Your text",
      x: 0.5,
      y: 0.5,
      fontSize: 20,
      color: "#ffffff",
      bold: false,
      italic: false,
      startTime: start,
      duration: DEFAULT_OVERLAY_DUR,
    };
    setTextOverlays(prev => [...prev, overlay]);
    setSelectedTextId(id);
    timelineOverlayIdsRef.current.add(id);
    void overlayApiRef.current?.addText({
      id,
      text: overlay.text,
      color: overlay.color,
      fontSize: overlay.fontSize,
      bold: overlay.bold,
      italic: overlay.italic,
      startTime: start,
      duration: DEFAULT_OVERLAY_DUR,
    });
  }, [textOverlays]);

  const handleRemoveTextOverlay = useCallback((id: string) => {
    setTextOverlays(prev => prev.filter(o => o.id !== id));
    setSelectedTextId(prev => (prev === id ? null : prev));
    timelineOverlayIdsRef.current.delete(id);
    overlayApiRef.current?.removeById(id);
  }, []);

  const handleToggleSticker = useCallback((s: StipopSticker) => {
    const key = `stipop:${s.id}`;
    setPlacedStickers(prev => {
      const isPlaced = prev.some(ps => ps.stickerId === key);
      if (isPlaced) {
        timelineOverlayIdsRef.current.delete(key);
        overlayApiRef.current?.removeById(key);
        return prev.filter(ps => ps.stickerId !== key);
      }

      // Mobile: one sticker only (no timeline to manage multi timing) — same as captions.
      if (isMobile) {
        for (const ps of prev) {
          timelineOverlayIdsRef.current.delete(ps.stickerId);
          overlayApiRef.current?.removeById(ps.stickerId);
        }
        return [{
          stickerId: key,
          stickerUrl: s.renderUrl,
          previewUrl: s.previewUrl,
          x: 0.5,
          y: 0.5,
          scale: 1,
          // Always visible for the whole clip on mobile
        }];
      }

      const start = overlayApiRef.current?.getCurrentTime() ?? currentTime;
      void overlayApiRef.current?.addSticker({
        id: key,
        url: s.renderUrl,
        name: s.title || "Sticker",
        startTime: start,
        duration: DEFAULT_OVERLAY_DUR,
      });
      timelineOverlayIdsRef.current.add(key);
      return [...prev, {
        stickerId: key,
        stickerUrl: s.renderUrl,
        previewUrl: s.previewUrl,
        x: 0.15 + Math.random() * 0.7,
        y: 0.15 + Math.random() * 0.7,
        scale: 1,
        startTime: start,
        duration: DEFAULT_OVERLAY_DUR,
      }];
    });
  }, [currentTime, isMobile]);

  const handleRemoveSticker = useCallback((id: string) => {
    setPlacedStickers(prev => prev.filter(ps => ps.stickerId !== id));
    timelineOverlayIdsRef.current.delete(id);
    overlayApiRef.current?.removeById(id);
  }, []);

  const handleClearStickers = useCallback(() => {
    setPlacedStickers(prev => {
      for (const ps of prev) {
        timelineOverlayIdsRef.current.delete(ps.stickerId);
        overlayApiRef.current?.removeById(ps.stickerId);
      }
      return [];
    });
  }, []);

  // Keep timeline text clip label/style in sync when panel edits text
  useEffect(() => {
    const api = overlayApiRef.current;
    if (!api) return;
    for (const t of textOverlays) {
      if (!timelineOverlayIdsRef.current.has(t.id)) continue;
      api.updateText({
        id: t.id,
        text: t.text,
        color: t.color,
        fontSize: t.fontSize,
        bold: t.bold,
        italic: t.italic,
      });
    }
    // Only re-sync when text content/style changes — not timing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textOverlays.map(t => `${t.id}:${t.text}:${t.color}:${t.fontSize}:${t.bold}:${t.italic}`).join("|")]);

  const handleAddCaptionSegment = useCallback((
    style: CaptionStyle,
    mode: "add" | "replace" = "add",
  ) => {
    const effectiveDur = (trimEnd > 0 ? trimEnd : duration) - trimStart;
    if (!captionApiRef.current) return;

    // "None" means clear all caption segments — never place a None block on the timeline
    if (style === "none") {
      captionApiRef.current.resetSegments([], captionWordsRef.current, effectiveDur);
      setCaptionStyle("none");
      return;
    }

    if (effectiveDur <= 0) return;

    // Toggle: if a segment with this style exists, remove it and re-split remaining equally
    const existing = captionSegments.find(seg => seg.style === style);
    if (existing) {
      captionApiRef.current.removeSegment(existing.id, effectiveDur);
      // Keep preview in sync — empty timeline should not keep rendering this style
      const remaining = captionSegments.filter(seg => seg.id !== existing.id);
      setCaptionStyle(prev => {
        if (prev !== style) return prev;
        return remaining[0]?.style ?? "none";
      });
      return;
    }

    if (mode === "replace") {
      captionApiRef.current.resetSegments([style], captionWordsRef.current, effectiveDur);
      return;
    }

    captionApiRef.current.addSegment(style, captionWordsRef.current, effectiveDur);
  }, [trimStart, trimEnd, duration, captionSegments]);

  const activeCaptionSegment = useMemo(
    () => captionSegments.find(s => currentTime >= s.start - 0.001 && currentTime < s.end + 0.001) ?? null,
    [captionSegments, currentTime],
  );

  // Keep panel X/Y knobs in sync with the caption segment under the playhead
  useEffect(() => {
    if (!activeCaptionSegment) return;
    setCaptionPosX(activeCaptionSegment.posX);
    setCaptionPosY(activeCaptionSegment.posY);
  }, [activeCaptionSegment?.id, activeCaptionSegment?.posX, activeCaptionSegment?.posY]);

  const handleResetCaptionPos = useCallback(() => {
    if (activeCaptionSegment && captionApiRef.current) {
      captionApiRef.current.updateSegmentPosition(activeCaptionSegment.id, 0, 0);
    }
    setCaptionPosX(0);
    setCaptionPosY(0);
    if (activeCaptionSegment) {
      setCaptionSegments(prev =>
        prev.map(s => s.id === activeCaptionSegment.id ? { ...s, posX: 0, posY: 0 } : s),
      );
    }
  }, [activeCaptionSegment]);

  const effectiveTrimEnd = trimEnd > 0 ? Math.min(trimEnd, duration || trimEnd) : duration;
  // Gate on rendered length (trim ÷ speed) — same as API / FFmpeg output
  const exportClipDurationSecs = getRenderedExportSecs(trimStart, trimEnd, duration, speed);
  const exportGateReady = isFreePlan !== null && duration > 0;
  const exportRequiresUpgrade =
    exportGateReady && isFreePlan === true && exportClipDurationSecs > FREE_EXPORT_MAX_SECS;

  // Estimated credit cost shown in the Export button (mirrors backend computeExportCost)
  const exportCreditCost = computeExportCostEstimate(
    captionStyle,
    placedStickers,
    exportTracksRef.current ?? [],
  );

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const filterStyle = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  const exportReadyToDownload = exportPhase === "done" && !!exportUrl && !isExportStale();

  const editPanelProps: EditPanelProps = {
    activeTab, captionStyle, setCaptionStyle,
    onAddCaptionSegment: handleAddCaptionSegment,
    askCaptionApplyMode: !isMobile,
    captionSegments,
    captionWords,
    onCaptionWordsChange: setCaptionWords,
    captionFontSize, setCaptionFontSize,
    captionPosY, setCaptionPosY,
    captionPosX, setCaptionPosX,
    onResetCaptionPos: handleResetCaptionPos,
    captionLang, activeLang, translating, handleTranslate,
    speed, setSpeed: handleSpeedChange, trimStart, setTrimStart, effectiveTrimEnd, setTrimEnd, duration, fmt, videoRef,
    brightness, setBrightness, contrast, setContrast, saturation, setSaturation,
    exportPhase, exportProgress, exportUrl, exportError, handleExport, handleCancelExport,
    setExportPhase, setExportUrl,
    placedStickers, setPlacedStickers, segmentationReady,
    textOverlays, setTextOverlays, selectedTextId, setSelectedTextId,
    onAddTextOverlay: handleAddTextOverlay,
    onRemoveTextOverlay: handleRemoveTextOverlay,
    onToggleSticker: handleToggleSticker,
    onRemoveSticker: handleRemoveSticker,
    onClearStickers: handleClearStickers,
    stickerSingleSelect: isMobile,
    onAddToTimeline: (asset) => {
      void mediaApiRef.current?.addMedia(asset);
    },
    thumbnailOverlay, setThumbnailOverlay,
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

  const renderMobileSideTab = ({ id, icon: Icon, label }: typeof TABS[number]) => (
    <button
      key={id}
      type="button"
      onClick={() => handleMobileTab(id)}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 h-12 rounded-lg transition-colors cursor-pointer",
        activeTab === id && mobileDrawerOpen
          ? "text-white"
          : "text-white/35 active:text-white/70",
      )}
      aria-label={label}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      <span className="text-[9px] font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-[100svh] max-h-[100svh] overflow-hidden bg-[#0a0a0a]">
      <style>{`
        @keyframes chopprAurora {
          0%   { transform: translate(0%,0%) scale(1.1); }
          33%  { transform: translate(5%,-8%) scale(1.15); }
          66%  { transform: translate(-6%,6%) scale(1.08); }
          100% { transform: translate(3%,-4%) scale(1.13); }
        }
        @keyframes chopprMesh {
          0%   { background-position: 0% 0%; }
          25%  { background-position: 100% 0%; }
          50%  { background-position: 100% 100%; }
          75%  { background-position: 0% 100%; }
          100% { background-position: 0% 0%; }
        }
        @keyframes chopprConic {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes chopprGrain {
          0%,100% { transform: translate(0,0); }
          10%     { transform: translate(-3%,-4%); }
          20%     { transform: translate(-6%,2%); }
          30%     { transform: translate(4%,-5%); }
          40%     { transform: translate(3%,6%); }
          50%     { transform: translate(-5%,1%); }
          60%     { transform: translate(5%,-2%); }
          70%     { transform: translate(-2%,4%); }
          80%     { transform: translate(2%,-6%); }
          90%     { transform: translate(-4%,3%); }
        }
        @keyframes chopprNeon {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes chopprWaterScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes chopprWaterScrollV {
          from { transform: translateY(0); }
          to   { transform: translateY(-50%); }
        }
      `}</style>
      <Sidebar hideMobileBar />
      <Topbar
        left={
          isMobile ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[13px] font-medium text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          ) : null
        }
      />

      <main
        className={cn(
          "mt-12 flex-1 flex overflow-hidden relative",
          isMobile ? "flex-col ml-0" : "flex-row ml-14 pb-0"
        )}
        style={{ height: "calc(100svh - 48px)" }}
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
                    <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
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
                            "text-[15px] font-semibold rounded px-1 -mx-0.5 outline-none cursor-text leading-5 transition-colors",
                            currentTime >= w.start && currentTime <= w.end
                              ? "bg-violet-500/45 text-white"
                              : "text-white/90 hover:bg-white/8 focus:bg-white/12"
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
          {/* Desktop only — Back stays on the preview */}
          {!isMobile && (
            <button
              onClick={() => router.back()}
              className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-2.5 py-1.5 text-[11px] text-white/50 hover:text-white transition-colors backdrop-blur-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
          )}

          {/* Mobile edit tools moved to bottom bar — sheet rendered next to the bar */}

          {/* Aspect ratio — left on mobile (replaces Back), right on desktop with export */}
          <div className={cn(
            "absolute top-3 z-20 flex items-center gap-1.5",
            isMobile ? "left-3" : "right-3",
          )}>
            <div ref={arDropdownRef} className="relative">
            <button
              onClick={() => setArDropdownOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 px-2.5 py-1.5 backdrop-blur-sm hover:border-white/20 transition-colors"
            >
              {aspectRatio === "9:16" && (
                <svg viewBox="0 0 10 18" className="h-3.5 w-2 shrink-0 text-white/60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="8" height="16" rx="1.5" /></svg>
              )}
              {aspectRatio === "1:1" && (
                <svg viewBox="0 0 14 14" className="h-3 w-3 shrink-0 text-white/60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="12" height="12" rx="1.5" /></svg>
              )}
              {aspectRatio === "16:9" && (
                <svg viewBox="0 0 18 11" className="h-2 w-3.5 shrink-0 text-white/60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="16" height="9" rx="1.5" /></svg>
              )}
              <span className="text-[11px] font-semibold text-white/70">{aspectRatio}</span>
              <svg viewBox="0 0 10 6" className="h-2 w-2.5 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4 4-4" /></svg>
            </button>

            {arDropdownOpen && (
              <div
                className={cn(
                  "absolute top-full mt-1.5 flex flex-col rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden",
                  isMobile ? "left-0" : "right-0",
                )}
                style={{ minWidth: 200 }}
              >

                {/* Aspect ratio section */}
                <div className="px-3 pt-3 pb-1.5">
                  <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Aspect ratio</p>
                  <div className="flex flex-col gap-0.5">
                    {([
                      { r: "9:16",  label: "9:16 · Vertical",   icon: <svg viewBox="0 0 10 18" className="h-3 w-1.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="8" height="16" rx="1.5" /></svg> },
                      { r: "1:1",   label: "1:1 · Square",      icon: <svg viewBox="0 0 14 14" className="h-2.5 w-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="12" height="12" rx="1.5" /></svg> },
                      { r: "16:9",  label: "16:9 · Landscape",  icon: <svg viewBox="0 0 18 11" className="h-1.5 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="16" height="9" rx="1.5" /></svg> },
                    ] as const).map(({ r, label, icon }) => (
                      <button
                        key={r}
                        onClick={() => { invalidateExport(); setAspectRatio(r); }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors w-full text-left ${
                          aspectRatio === r ? "bg-white/10 text-white font-semibold" : "text-white/50 hover:bg-white/6 hover:text-white/80"
                        }`}
                      >
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-white/8 mx-3" />

                {/* Background fill section */}
                <div className="px-3 pt-1.5 pb-3">
                  <p className="text-[9px] uppercase tracking-widest text-white/25 mb-2">Background</p>

                  {/* Blur + Crop quick options */}
                  <div className="flex gap-1.5 mb-2">
                    <button
                      onClick={() => { invalidateExport(); setBackgroundFill("blur"); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] transition-colors ${backgroundFill === "blur" ? "bg-white/15 text-white font-semibold" : "bg-white/4 text-white/50 hover:bg-white/8 hover:text-white/80"}`}
                    >
                      <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5" strokeOpacity="0.6"/><circle cx="8" cy="8" r="2.5" strokeOpacity="0.3"/></svg>
                      Blur
                    </button>
                    <button
                      onClick={() => { invalidateExport(); setBackgroundFill("none"); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] transition-colors ${backgroundFill === "none" ? "bg-white/15 text-white font-semibold" : "bg-white/4 text-white/50 hover:bg-white/8 hover:text-white/80"}`}
                    >
                      <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 14L14 2M4 4h8v8H4z" strokeLinejoin="round"/></svg>
                      Crop
                    </button>
                  </div>

                  {/* Live backgrounds — disabled for now, implement later
                  <p className="text-[9px] uppercase tracking-widest text-white/20 mb-1.5 mt-0.5">Live backgrounds</p>
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {([
                      { id: "anim-aurora",   label: "Aurora",   preview: "linear-gradient(135deg,#0ea5e9,#8b5cf6,#ec4899,#0ea5e9)" },
                      { id: "anim-mesh",     label: "Mesh",     preview: "linear-gradient(135deg,#f97316,#ec4899,#8b5cf6,#06b6d4)" },
                      { id: "anim-conic",    label: "Conic",    preview: "conic-gradient(from 0deg,#f97316,#ec4899,#8b5cf6,#06b6d4,#f97316)" },
                      { id: "anim-grain",    label: "Grain",    preview: "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)" },
                      { id: "anim-sunset",   label: "Sunset",   preview: "linear-gradient(135deg,#ff6b6b,#feca57,#ff9ff3,#54a0ff)" },
                      { id: "anim-neon",     label: "Neon",     preview: "linear-gradient(135deg,#00ff88,#00d4ff,#ff00ff,#00ff88)" },
                    ] as { id: string; label: string; preview: string }[]).map(({ id, label, preview }) => (
                      <button
                        key={id}
                        onClick={() => setBackgroundFill(id)}
                        className={`relative flex items-end justify-start p-2 rounded-xl h-10 overflow-hidden text-[10px] font-medium transition-all ${backgroundFill === id ? "ring-2 ring-white/70 ring-offset-1 ring-offset-[#111]" : "hover:ring-1 hover:ring-white/20"}`}
                        style={{ background: preview }}
                      >
                        <span className="relative z-10 text-white drop-shadow-md">{label}</span>
                      </button>
                    ))}
                  </div>
                  */}

                  {/* Color swatches grid */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {[
                      "#000000","#1a1a1a","#ffffff","#f0f0f0",
                      "#0f172a","#1e3a5f","#312e81","#3b0764",
                      "#1a1a2e","#0d2137","#134e4a","#14532d",
                      "#450a0a","#431407","#78350f","#1c1917",
                      "#f97316","#eab308","#22c55e","#06b6d4",
                      "#3b82f6","#8b5cf6","#ec4899","#ef4444",
                      "#fbbf24","#a3e635","#34d399","#818cf8",
                    ].map((color) => (
                      <button
                        key={color}
                        onClick={() => { invalidateExport(); setBackgroundFill(color); }}
                        title={color}
                        className={`w-full aspect-square rounded-md transition-all ${backgroundFill === color ? "ring-2 ring-white ring-offset-1 ring-offset-[#111] scale-110" : "hover:scale-110"}`}
                        style={{ background: color, border: color === "#ffffff" || color === "#f0f0f0" ? "1px solid rgba(255,255,255,0.15)" : "none" }}
                      />
                    ))}
                  </div>

                  {/* Custom color picker */}
                  <label className="flex items-center gap-2 w-full cursor-pointer group">
                    <div
                      className="w-7 h-7 rounded-lg border border-white/20 shrink-0 overflow-hidden"
                      style={{ background: backgroundFill.startsWith("#") ? backgroundFill : "#000000" }}
                    >
                      <input
                        type="color"
                        value={backgroundFill.startsWith("#") ? backgroundFill : "#000000"}
                        onChange={(e) => { invalidateExport(); setBackgroundFill(e.target.value); }}
                        className="w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                    <span className="text-[11px] text-white/40 group-hover:text-white/70 transition-colors">Custom color</span>
                    {backgroundFill.startsWith("#") && (
                      <span className="text-[10px] text-white/30 font-mono ml-auto">{backgroundFill.toUpperCase()}</span>
                    )}
                  </label>
                </div>

                {/* Done button */}
                <div className="px-3 pb-3">
                  <button
                    onClick={() => setArDropdownOpen(false)}
                    className="w-full rounded-xl bg-white/8 hover:bg-white/12 text-white/70 hover:text-white text-[11px] font-medium py-1.5 transition-colors"
                  >
                    Done
                  </button>
                </div>

              </div>
            )}
            </div>
          </div>

          {/* Mobile export — stays top-right */}
          {isMobile && (
            <div className="absolute top-3 right-3 z-20">
              <ExportClipButton
                exportPhase={exportPhase === "error" ? "idle" : exportPhase}
                exportProgress={exportProgress}
                exportReadyToDownload={exportReadyToDownload}
                onExport={handleExport}
                onCancel={handleCancelExport}
                onDownload={handlePrimaryExportAction}
                size="compact"
                className="backdrop-blur-sm shadow-lg"
                creditCost={exportCreditCost}
              />
            </div>
          )}

          <div className={cn(
            "relative flex items-center justify-center w-full flex-1 min-h-0 overflow-hidden",
            !isMobile && "px-6 py-8",
            isMobile && "px-3 py-3"
          )}>
            {src ? (
              <div
                ref={videoContainerRef}
                className={cn(
                  "relative overflow-hidden shadow-2xl shadow-black/80 shrink-0 border border-white/[0.12]",
                  !isMobile && "md:rounded-2xl",
                  isMobile && "rounded-xl"
                )}
                style={isMobile ? (
                  aspectRatio === "9:16" ? {
                    // Portrait: fill available height, width follows aspect ratio
                    aspectRatio: "9/16",
                    height: "100%",
                    width: "auto",
                    maxWidth: "100%",
                    maxHeight: "100%",
                  } : aspectRatio === "1:1" ? {
                    // Square: full width, height capped — clearly shorter than 9:16
                    aspectRatio: "1/1",
                    width: "100%",
                    height: "auto",
                    maxWidth: "100%",
                    maxHeight: "100%",
                  } : {
                    // Landscape: full width, height shrinks — letterbox visible above/below
                    aspectRatio: "16/9",
                    width: "100%",
                    height: "auto",
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }
                ) : aspectRatio === "9:16" ? {
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
                <div className="absolute inset-0 overflow-hidden">
                  {/* Background fill layer — visible when video has letterbox space */}
                  {backgroundFill === "blur" && (
                    <video
                      key={`blur-${activeSrc}`}
                      src={activeSrc}
                      muted
                      playsInline
                      loop
                      ref={(el) => {
                        if (el && videoRef.current) {
                          el.currentTime = videoRef.current.currentTime;
                          if (!videoRef.current.paused) el.play().catch(() => {});
                        }
                      }}
                      className="absolute inset-0 w-full h-full object-cover scale-110"
                      style={{ filter: "blur(20px) brightness(0.5)", transform: "scale(1.15)" }}
                    />
                  )}
                  {backgroundFill === "black" && (
                    <div className="absolute inset-0 bg-black" />
                  )}
                  {backgroundFill === "white" && (
                    <div className="absolute inset-0 bg-white" />
                  )}
                  {backgroundFill === "anim-aurora" && (
                    <div className="absolute inset-0 overflow-hidden" style={{ background: "#0a0a18" }}>
                      <div className="absolute -inset-1/4 opacity-70" style={{ background: "radial-gradient(ellipse 80% 60% at 20% 30%, #8b5cf6cc 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 70%, #06b6d4cc 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 50% 90%, #ec4899cc 0%, transparent 60%)", filter: "blur(32px)", animation: "chopprAurora 8s ease-in-out infinite alternate" }} />
                    </div>
                  )}
                  {backgroundFill === "anim-mesh" && (
                    <div className="absolute inset-0 overflow-hidden" style={{ background: "#0f0518" }}>
                      <div className="absolute -inset-1/4" style={{ backgroundImage: "radial-gradient(ellipse 60% 50% at 10% 20%, #f97316cc 0%, transparent 55%), radial-gradient(ellipse 55% 65% at 90% 10%, #ec4899cc 0%, transparent 55%), radial-gradient(ellipse 65% 55% at 80% 90%, #8b5cf6cc 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 20% 80%, #06b6d4cc 0%, transparent 55%)", backgroundSize: "300% 300%", filter: "blur(28px)", animation: "chopprMesh 12s ease-in-out infinite" }} />
                    </div>
                  )}
                  {backgroundFill === "anim-conic" && (
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute inset-[-50%]" style={{ background: "conic-gradient(from 0deg, #f97316, #ec4899, #8b5cf6, #06b6d4, #22c55e, #f97316)", filter: "blur(16px) brightness(0.8)", animation: "chopprConic 6s linear infinite", transformOrigin: "center" }} />
                    </div>
                  )}
                  {backgroundFill === "anim-grain" && (
                    <div className="absolute inset-0 overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)" }}>
                      <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, opacity: 0.18, animation: "chopprGrain 0.4s steps(8) infinite" }} />
                    </div>
                  )}
                  {backgroundFill === "anim-sunset" && (
                    <div className="absolute inset-0 overflow-hidden" style={{ background: "#1a0520" }}>
                      <div className="absolute -inset-1/4" style={{ backgroundImage: "radial-gradient(ellipse 70% 55% at 15% 25%, #ff6b6bcc 0%, transparent 55%), radial-gradient(ellipse 60% 70% at 85% 15%, #feca57cc 0%, transparent 55%), radial-gradient(ellipse 65% 60% at 75% 85%, #ff9ff3cc 0%, transparent 55%), radial-gradient(ellipse 55% 65% at 25% 75%, #54a0ffcc 0%, transparent 55%)", backgroundSize: "280% 280%", filter: "blur(30px)", animation: "chopprMesh 10s ease-in-out infinite reverse" }} />
                    </div>
                  )}
                  {backgroundFill === "anim-neon" && (
                    <div className="absolute inset-0 overflow-hidden" style={{ background: "#050510" }}>
                      <div className="absolute -inset-1/4" style={{ backgroundImage: "radial-gradient(ellipse 50% 60% at 20% 40%, #00ff8899 0%, transparent 50%), radial-gradient(ellipse 60% 50% at 80% 30%, #00d4ff99 0%, transparent 50%), radial-gradient(ellipse 55% 55% at 50% 80%, #ff00ff99 0%, transparent 50%)", backgroundSize: "250% 250%", filter: "blur(24px)", animation: "chopprNeon 7s ease-in-out infinite alternate" }} />
                    </div>
                  )}
                  {backgroundFill !== "blur" && backgroundFill !== "black" && backgroundFill !== "white" && backgroundFill !== "none" && !backgroundFill.startsWith("anim-") && (
                    <div className="absolute inset-0" style={{ background: backgroundFill }} />
                  )}
                  <BackgroundRenderer
                    videoRef={videoRef}
                    placedStickers={placedStickers.filter(ps => isOverlayVisible(ps.startTime, ps.duration))}
                    segmentationReady={segmentationReady}
                    segmenter={segmenterRef}
                    filterStyle={filterStyle}
                    aspectRatio={aspectRatio}
                    backgroundFill={backgroundFill}
                  />
                  <video
                    key={activeSrc}
                    ref={videoRef}
                    data-keep="1"
                    crossOrigin={placedStickers.length > 0 ? "anonymous" : undefined}
                    muted={muted}
                    playsInline
                    preload="auto"
                    className="w-full h-full"
                    style={{
                      objectFit: backgroundFill === "none" ? "cover" : "contain",
                      filter: filterStyle,
                      opacity: placedStickers.some(ps => isOverlayVisible(ps.startTime, ps.duration)) && segmentationReady ? 0 : 1,
                    }}
                    onLoadedData={() => {
                      const v = videoRef.current;
                      if (v && v.paused && v.currentTime < 0.05) {
                        try { v.currentTime = 0; } catch { /* ignore */ }
                      }
                    }}
                    onLoadedMetadata={() => {
                      const d = videoRef.current?.duration ?? 0;
                      if (!Number.isFinite(d) || d <= 0) return;
                      // Always trust metadata for the main clip when duration is missing/stale
                      setDuration(prev => (prev > 0 && Math.abs(prev - d) < 0.5 ? prev : d));
                      // Only update trimEnd if it hasn't been set from a draft or trim operation
                      setTrimEnd(prev => (prev > 0 ? prev : d));
                    }}
                    onTimeUpdate={() => {
                      // Mobile has no timeline clock — sync scrubber from the video element
                      if (isMobile) setCurrentTime(videoRef.current?.currentTime ?? 0);
                    }}
                    onPlay={() => { if (isMobile) setPlaying(true); }}
                    onPause={() => { if (isMobile) setPlaying(false); }}
                    onError={() => {
                      // Metadata failed (CORS / bad URL) — keep any API duration so timeline still mounts
                      console.warn("[clip] preview video failed to load metadata");
                    }}
                  />
                  <CaptionRenderer
                    videoRef={videoRef}
                    words={captionWords}
                    style={captionStyle}
                    fontSize={captionFontSize}
                    aspectRatio={aspectRatio}
                    posOffset={captionPosY}
                    hOffset={captionPosX}
                    language={activeLang}
                    segments={captionSegments.length > 0 ? captionSegments : undefined}
                    currentTime={currentTime}
                  />
                  {/* Thumbnail overlay — draggable, sits above captions overlay */}
                  {thumbnailOverlay && (
                    <DraggableThumbnailOverlay
                      overlay={thumbnailOverlay}
                      containerRef={videoContainerRef}
                      onMove={setThumbnailOverlay}
                    />
                  )}
                  {/* Caption drag + play/pause overlay — covers full preview */}
                  <div
                    className="absolute inset-0 flex items-center justify-center select-none"
                    style={{
                      zIndex: 4,
                      touchAction: "none", // prevent browser scroll/zoom hijacking touch events
                      cursor: captionStyle !== "none"
                        ? (captionDragRef.current ? "grabbing" : "grab")
                        : "pointer",
                    }}
                    onPointerDown={(e) => {
                      if (dragRef.current) return;
                      e.preventDefault(); // stop browser claiming the touch for scroll
                      const rect = videoContainerRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      captionDragRef.current = {
                        startX: e.clientX,
                        startY: e.clientY,
                        startPosX: activeCaptionSegment?.posX ?? captionPosX,
                        startPosY: activeCaptionSegment?.posY ?? captionPosY,
                        rectW: rect.width,
                        rectH: rect.height,
                        segmentId: activeCaptionSegment?.id ?? null,
                      };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (!captionDragRef.current) return;
                      if (captionStyle === "none") return;
                      const { startX, startY, startPosX, startPosY, rectW, rectH, segmentId } = captionDragRef.current;
                      const deltaX = e.clientX - startX;
                      const deltaY = e.clientY - startY;
                      // 8px threshold — large enough for finger jitter, small enough to feel instant
                      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
                      const dx = (deltaX / rectW) * 200;
                      const dy = (deltaY / rectH) * 200;
                      const nextX = Math.round(Math.max(-100, Math.min(100, startPosX + dx)));
                      const nextY = Math.round(Math.max(-100, Math.min(100, startPosY + dy)));
                      setCaptionPosX(nextX);
                      setCaptionPosY(nextY);
                      // Optimistic local update so preview tracks the drag immediately
                      if (segmentId) {
                        setCaptionSegments(prev =>
                          prev.map(s => s.id === segmentId ? { ...s, posX: nextX, posY: nextY } : s),
                        );
                      }
                    }}
                    onPointerUp={(e) => {
                      const ref = captionDragRef.current;
                      const wasDrag = ref
                        && captionStyle !== "none"
                        && (Math.abs(e.clientX - ref.startX) >= 8 || Math.abs(e.clientY - ref.startY) >= 8);
                      if (wasDrag && ref?.segmentId && captionApiRef.current) {
                        const deltaX = e.clientX - ref.startX;
                        const deltaY = e.clientY - ref.startY;
                        const nextX = Math.round(Math.max(-100, Math.min(100, ref.startPosX + (deltaX / ref.rectW) * 200)));
                        const nextY = Math.round(Math.max(-100, Math.min(100, ref.startPosY + (deltaY / ref.rectH) * 200)));
                        captionApiRef.current.updateSegmentPosition(ref.segmentId, nextX, nextY);
                      }
                      captionDragRef.current = null;
                      if (!wasDrag && !dragRef.current) togglePlay();
                    }}
                    onPointerCancel={() => { captionDragRef.current = null; }}
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
                  isOverlayVisible(ps.startTime, ps.duration) ? (
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
                      {ps.previewUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={ps.previewUrl} alt="" style={{ width: Math.round(48 * ps.scale), height: Math.round(48 * ps.scale) }} className="rounded object-cover" />
                        : <div style={{ width: Math.round(48 * ps.scale), height: Math.round(48 * ps.scale) }} className="rounded bg-white/10" />
                      }
                    </div>
                  </div>
                  ) : null
                ))}

                {/* Draggable text overlays */}
                {textOverlays.map((t) => (
                  isOverlayVisible(t.startTime, t.duration) ? (
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
                  ) : null
                ))}
              </div>
            ) : (
              <p className="text-white/20 text-[13px]">No clip source found.</p>
            )}
          </div>

          {/* ── Edited-clip blocks — switch the preview between original + exports ── */}
          {src && editedClips.length > 0 && (
            <div className="shrink-0 w-full border-t border-white/6 bg-black/40 px-3 py-2">
              <div className="overflow-x-auto no-scrollbar">
              <div className="flex items-start gap-3 w-max mx-auto px-1 py-1">
                {[{ id: null as string | null, url: src, label: "Original" },
                  ...[...editedClips].reverse().map((c, i) => ({ id: c._id as string | null, url: c.s3Url as string, label: `Edit ${i + 1}` }))
                ].map(({ id, url, label }) => {
                  const selected = activeEditId === id;
                  return (
                    <button
                      key={id ?? "original"}
                      onClick={() => selectVersion(id)}
                      className="shrink-0 flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <div
                        className={cn(
                          "relative overflow-hidden rounded-lg bg-black transition-all",
                          selected ? "ring-1 ring-white" : "ring-1 ring-white/10 hover:ring-white/40"
                        )}
                        style={{ height: 56, width: 56 }}
                      >
                        <video
                          src={`${url}#t=0.5`}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      </div>
                      <span className={cn(
                        "text-[9px] font-medium leading-none transition-colors",
                        selected ? "text-white" : "text-white/40"
                      )}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
              </div>
            </div>
          )}

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

          {/* ── Timeline (desktop) / simple playback (mobile, temporary) ── */}
          {isMobile ? (
            <div className="shrink-0 w-full flex flex-col gap-2 border-t border-white/6 bg-[#0a0a0a] px-4 pb-3 pt-2">
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.01}
                value={Math.min(currentTime, duration || 1)}
                onChange={e => {
                  const t = Number(e.target.value);
                  setCurrentTime(t);
                  if (videoRef.current) videoRef.current.currentTime = t;
                }}
                className="w-full accent-white cursor-pointer h-1"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-colors"
                >
                  {playing
                    ? <Pause className="h-3.5 w-3.5 fill-black" />
                    : <Play className="h-3.5 w-3.5 fill-black ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setMuted(m => !m)}
                  className="text-white hover:text-white/70 transition-colors"
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <span className="text-[11px] font-mono text-white/70">
                  {fmt(currentTime)} / {fmt(duration)}
                </span>
                {speed !== 1 && (
                  <span className="text-[10px] font-semibold text-white/50 bg-white/8 px-1.5 py-0.5 rounded">
                    {speed}×
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/45 text-center pt-0.5">
                Switch to large screen for editor mode
              </p>
            </div>
          ) : (
          <div className="shrink-0 w-full">
            {activeSrc ? (
              duration > 0 ? (
              <ClipTimeline
                clipId={clipId}
                clipLabel={index}
                src={activeSrc}
                aspectRatio={aspectRatio}
                duration={duration}
                trimStart={trimStart}
                trimEnd={effectiveTrimEnd}
                speed={speed}
                muted={muted}
                isMobile={false}
                videoRef={videoRef}
                onTrimChange={handleTimelineTrimChange}
                onCurrentTimeChange={handleTimelineTimeChange}
                onTimelineTimeChange={handleRawTimelineTimeChange}
                onPlayingChange={handleTimelinePlayingChange}
                onExportTracksChange={handleExportTracksChange}
                onTimelineSerialize={handleTimelineSerialize}
                draftTracks={draftTracks}
                onToggleMute={() => setMuted(m => !m)}
                onRegisterToggle={registerTimelineToggle}
                overlayApiRef={overlayApiRef}
                onOverlayTimingChange={handleOverlayTimingChange}
                mediaApiRef={mediaApiRef}
                captionApiRef={captionApiRef}
                captionWordsRef={captionWordsRef}
                onCaptionSegmentsChange={setCaptionSegments}
                onResetAll={resetAll}
                resetKey={timelineResetKey}
              />
              ) : (
              <div className="shrink-0 w-full flex flex-col gap-2 border-t border-white/6 bg-[#0a0a0a] px-6 py-3">
                <div className="h-1 w-full rounded bg-white/10 animate-pulse" />
                <div className="flex items-center gap-3 text-[11px] text-white/40">
                  Loading timeline…
                </div>
              </div>
              )
            ) : (
              <div className="shrink-0 w-full flex flex-col gap-2 border-t border-white/6 bg-[#0a0a0a] px-6 py-3">
                <div className="flex items-center gap-3 text-[11px] text-white/40">
                  No video source for this clip
                </div>
              </div>
            )}
          </div>
          )}

          {/* Mobile: bottom sheet rises from the editor bar (not from inside the video). */}
          {isMobile && (
            <div className="relative shrink-0 z-40">
              {mobileDrawerOpen && (
                <button
                  type="button"
                  aria-label="Close panel"
                  className="fixed inset-x-0 top-12 bottom-0 z-[44] bg-black/45"
                  onClick={closeDrawer}
                />
              )}
              {drawerMounted && (
                <div
                  className={cn(
                    "absolute left-0 right-0 bottom-full z-[45] flex flex-col bg-[#111] border-t border-white/10 rounded-t-2xl shadow-[0_0_48px_rgba(0,0,0,0.8)]",
                    "transition-transform duration-300 ease-out",
                    !mobileDrawerOpen && "pointer-events-none",
                  )}
                  style={{
                    height: "50svh",
                    maxHeight: "50svh",
                    transform: mobileDrawerOpen ? "translateY(0)" : "translateY(110%)",
                  }}
                >
                  <div className="mx-auto mt-1.5 mb-0.5 h-1 w-9 shrink-0 rounded-full bg-white/15" />
                  <div className="flex items-center justify-between px-3 pt-1.5 pb-2 shrink-0">
                    <p className="text-[13px] font-semibold text-white">{activeTabLabel}</p>
                    <button
                      onClick={closeDrawer}
                      className="h-7 w-7 flex items-center justify-center rounded-full bg-white/8 text-white/40 hover:text-white transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3">
                    {/* No fixed style-grid cap — styles fill the expanded sheet and scroll inside */}
                    <EditPanelContent {...editPanelProps} styleGridMaxHeight={undefined} />
                  </div>
                </div>
              )}

              <nav className="relative z-50 w-full border-t border-white/10 bg-[#0a0a0a]">
                <div
                  className="flex items-center px-2 pt-0.5"
                  style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
                >
                  {MOBILE_SIDE_TABS.map(renderMobileSideTab)}
                </div>
              </nav>
            </div>
          )}
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
                        "flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors border-b-2 cursor-pointer",
                        activeTab === id ? "border-white text-white" : "border-transparent text-white/70 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4" />{label}
                    </button>
                  ))}
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                  <EditPanelContent {...editPanelProps} hideTranscript={true} />
                </div>
                <div className="p-4 border-t border-white/6 shrink-0">
                  <ExportSection
                    exportPhase={exportPhase}
                    exportProgress={exportProgress}
                    exportUrl={exportUrl}
                    exportError={exportError}
                    handleExport={handleExport}
                    handleCancelExport={handleCancelExport}
                    handlePrimaryExportAction={handlePrimaryExportAction}
                    exportReadyToDownload={exportReadyToDownload}
                    downloadMode={downloadMode}
                    onDownloadEdit={handleDownloadEdit}
                    onResetAll={resetAll}
                    setExportPhase={setExportPhase}
                    setExportUrl={setExportUrl}
                    exportRequiresUpgrade={exportRequiresUpgrade}
                    exportCreditCost={exportCreditCost}
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
                    className="w-full flex flex-col items-center gap-1 py-3 text-[9px] font-medium text-white hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Icon className="h-4.5 w-4.5" />
                    <span>{label}</span>
                  </button>
                ))}
                <div className="mt-auto w-full px-2 pb-3 flex flex-col items-center gap-1.5">
                  {/* Circular export/download / upgrade button */}
                  {exportRequiresUpgrade && !exportReadyToDownload && exportPhase !== "exporting" ? (
                    <>
                      <Link
                        href="/dashboard/billing"
                        title="Upgrade to export clips greater than 5 min"
                        className="h-11 w-11 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/85 active:bg-white/70 transition-all"
                      >
                        <Sparkles className="h-4 w-4" />
                      </Link>
                      <span className="text-[9px] font-medium text-white/60 text-center leading-tight">
                        Upgrade
                      </span>
                    </>
                  ) : (
                    <ExportClipButton
                      exportPhase={exportPhase === "error" ? "idle" : exportPhase}
                      exportProgress={exportProgress}
                      exportReadyToDownload={exportReadyToDownload}
                      onExport={handleExport}
                      onCancel={handleCancelExport}
                      onDownload={handlePrimaryExportAction}
                      size="circle"
                      creditCost={exportCreditCost}
                    />
                  )}
                  {exportReadyToDownload && exportUrl && (
                    <button
                      onClick={handleExport}
                      className="text-[8px] text-white/30 hover:text-white/55 transition-colors leading-tight"
                    >
                      Export again
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

    </div>
  );
}
