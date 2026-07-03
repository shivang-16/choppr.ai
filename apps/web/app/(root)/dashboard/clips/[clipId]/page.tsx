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
import BackgroundRenderer, { STIPOP_KEY, fetchStipopStickers, fetchStipopTrendingPacks, fetchStipopPackStickers, type StipopSticker, type StipopPack, type PlacedSticker, type ImageSegmenterRef } from "./_components/background-renderer";

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
  captionWords: CaptionWord[];
  onCaptionWordsChange: (words: CaptionWord[]) => void;
  captionFontSize: number;
  setCaptionFontSize: (n: number) => void;
  captionPosY: number;
  setCaptionPosY: (n: number) => void;
  captionPosX: number;
  setCaptionPosX: (n: number) => void;
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
  placedStickers, setPlacedStickers, segmentationReady, styleGridMaxHeight,
}: {
  placedStickers: PlacedSticker[];
  setPlacedStickers: (s: PlacedSticker[]) => void;
  segmentationReady: boolean;
  styleGridMaxHeight: number | string;
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
    const key = `stipop:${s.id}`;
    const isPlaced = placedStickers.some(ps => ps.stickerId === key);
    if (isPlaced) {
      setPlacedStickers(placedStickers.filter(ps => ps.stickerId !== key));
    } else {
      setPlacedStickers([...placedStickers, {
        stickerId:  key,
        stickerUrl: s.renderUrl,
        previewUrl: s.previewUrl,
        x: 0.15 + Math.random() * 0.7,
        y: 0.15 + Math.random() * 0.7,
        scale: 1,
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
            <p className="text-[10px] font-medium text-white/50">Placed ({placedStickers.length})</p>
            <button onClick={() => setPlacedStickers([])} className="text-[10px] text-white/25 hover:text-red-400 transition-colors">
              Remove all
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
                  const updated = [...placedStickers];
                  updated[i] = { ...ps, scale: Number(e.target.value) };
                  setPlacedStickers(updated);
                }}
                className="w-14 accent-white cursor-pointer"
                title="Size"
              />
              <button
                onClick={() => setPlacedStickers(placedStickers.filter((_, j) => j !== i))}
                className="text-white/25 hover:text-red-400 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditPanelContent({
  activeTab, hideTranscript = false, captionStyle, setCaptionStyle, captionWords, onCaptionWordsChange, captionFontSize, setCaptionFontSize,
  captionPosY, setCaptionPosY, captionPosX, setCaptionPosX,
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
            <div className="flex flex-col gap-4 pr-0.5">
              {CAPTION_STYLE_GROUPS.map(group => (
                <div key={group.category}>
                  <p className="text-[9px] font-semibold text-white/30 uppercase tracking-widest mb-1.5">{group.category}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.styles.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setCaptionStyle(s.id)}
                        className={cn(
                          "relative rounded-xl border transition-all overflow-hidden",
                          captionStyle === s.id ? "border-white/50 ring-1 ring-white/20" : "border-white/8 bg-white/3 hover:border-white/20"
                        )}
                      >
                        {/* Preview area */}
                        <div className="h-14 w-full bg-[#111] flex items-center justify-center overflow-hidden">
                          {s.renderPreview ? s.renderPreview() : (
                            s.preview
                              ? <span className={cn("leading-none text-center block px-1", s.previewClass)}>{s.preview}</span>
                              : <span className="text-white/20 text-[11px]">⊘</span>
                          )}
                        </div>
                        {/* Label */}
                        <div className="px-2 py-1 flex items-center justify-between bg-[#181818]">
                          <span className="text-[9px] font-semibold text-white/60 truncate leading-tight">{s.label}</span>
                          {captionStyle === s.id && <Check className="h-2.5 w-2.5 text-white/70 shrink-0 ml-1" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
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
              <span className="text-[12px] text-white/50">Position</span>
              {(captionPosX !== 0 || captionPosY !== 0) && (
                <button
                  onClick={() => { setCaptionPosX(0); setCaptionPosY(0); }}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
            <p className="text-[10px] text-white/30 leading-snug">
              Drag the caption directly on the preview to reposition it.
            </p>
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
        <StipopStickerPicker
          placedStickers={placedStickers}
          setPlacedStickers={setPlacedStickers}
          segmentationReady={segmentationReady}
          styleGridMaxHeight={styleGridMaxHeight}
        />
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
  exportPhase, exportProgress, exportUrl, handleExport, handlePrimaryExportAction, setExportPhase, setExportUrl,
  exportReadyToDownload,
  compact = false,
}: Pick<EditPanelProps, "exportPhase" | "exportProgress" | "exportUrl" | "handleExport" | "setExportPhase" | "setExportUrl"> & {
  handlePrimaryExportAction: () => void;
  exportReadyToDownload: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {(exportPhase === "idle" || (exportPhase === "done" && !exportReadyToDownload)) && (
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
          <button
            onClick={handleExport}
            className="text-[11px] text-white/35 hover:text-white/60 transition-colors text-center py-1"
          >
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

      {!compact && (exportPhase === "idle" || (exportPhase === "done" && !exportReadyToDownload)) && (
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
  const [captionPosX, setCaptionPosX]         = useState(0);
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
  const exportSnapshotRef = useRef<string | null>(null);

  // Sticker drag state — using refs so no stale closures
  const dragRef = useRef<{ idx: number; rectLeft: number; rectTop: number; rectW: number; rectH: number } | null>(null);
  // Caption position drag state
  const captionDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number; rectW: number; rectH: number } | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

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
    exportSnapshotRef.current = null;
    setExportPhase("idle");
    setExportProgress(0);
    setExportUrl(null);
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
          captionPosX,
          captionMap:     captionWords.length ? { [clipId]: captionWords } : {},
          aspectRatio,
          backgroundFill,
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
            markExportCurrent();
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

  const handlePrimaryExportAction = () => {
    if (exportPhase === "exporting") return;
    if (exportPhase === "done" && exportUrl && !isExportStale()) {
      openAndDownload(exportUrl, `clip-${index}.mp4`);
      return;
    }
    handleExport();
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

  const exportReadyToDownload = exportPhase === "done" && !!exportUrl && !isExportStale();

  const editPanelProps: EditPanelProps = {
    activeTab, captionStyle, setCaptionStyle, captionWords,
    onCaptionWordsChange: setCaptionWords,
    captionFontSize, setCaptionFontSize,
    captionPosY, setCaptionPosY,
    captionPosX, setCaptionPosX,
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
      `}</style>
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
          <button
            onClick={() => router.back()}
            className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-2.5 py-1.5 text-[11px] text-white/50 hover:text-white transition-colors backdrop-blur-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>

          {/* Aspect ratio + background fill picker */}
          <div ref={arDropdownRef} className="absolute top-3 right-3 z-10">
            <button
              onClick={() => setArDropdownOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-sm hover:border-white/20 transition-colors"
            >
              {aspectRatio === "9:16" && (
                <svg viewBox="0 0 10 18" className="h-3 w-1.5 shrink-0 text-white/60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="8" height="16" rx="1.5" /></svg>
              )}
              {aspectRatio === "1:1" && (
                <svg viewBox="0 0 14 14" className="h-2.5 w-2.5 shrink-0 text-white/60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="12" height="12" rx="1.5" /></svg>
              )}
              {aspectRatio === "16:9" && (
                <svg viewBox="0 0 18 11" className="h-1.5 w-3 shrink-0 text-white/60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="16" height="9" rx="1.5" /></svg>
              )}
              <span className="text-[10px] font-semibold text-white/70">{aspectRatio}</span>
              <svg viewBox="0 0 10 6" className="h-2 w-2 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4 4-4" /></svg>
            </button>

            {arDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 flex flex-col rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden" style={{ minWidth: 200 }}>

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

          <div className={cn(
            "relative flex items-center justify-center w-full h-full overflow-hidden",
            !isMobile && "px-6 py-8",
            isMobile && "px-2 py-3"
          )}>
            {src ? (
              <div
                ref={videoContainerRef}
                className={cn(
                  "relative overflow-hidden shadow-2xl shadow-black/80 shrink-0",
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
                      src={src}
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
                    placedStickers={placedStickers}
                    segmentationReady={segmentationReady}
                    segmenter={segmenterRef}
                    filterStyle={filterStyle}
                    aspectRatio={aspectRatio}
                    backgroundFill={backgroundFill}
                  />
                  <video
                    ref={videoRef}
                    src={src}
                    muted={muted}
                    playsInline
                    loop
                    className="w-full h-full"
                    style={{
                      objectFit: backgroundFill === "none" ? "cover" : "contain",
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
                  <CaptionRenderer videoRef={videoRef} words={captionWords} style={captionStyle} fontSize={captionFontSize} aspectRatio={aspectRatio} posOffset={captionPosY} hOffset={captionPosX} language={activeLang} />
                  {/* Caption drag + play/pause overlay — covers full preview */}
                  <div
                    className="absolute inset-0 flex items-center justify-center select-none"
                    style={{
                      zIndex: 4,
                      touchAction: "none", // prevent browser scroll/zoom hijacking touch events
                      cursor: activeTab === "captions" && captionStyle !== "none"
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
                        startPosX: captionPosX,
                        startPosY: captionPosY,
                        rectW: rect.width,
                        rectH: rect.height,
                      };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (!captionDragRef.current) return;
                      if (activeTab !== "captions" || captionStyle === "none") return;
                      const { startX, startY, startPosX, startPosY, rectW, rectH } = captionDragRef.current;
                      const deltaX = e.clientX - startX;
                      const deltaY = e.clientY - startY;
                      // 8px threshold — large enough for finger jitter, small enough to feel instant
                      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
                      const dx = (deltaX / rectW) * 200;
                      const dy = (deltaY / rectH) * 200;
                      setCaptionPosX(Math.round(Math.max(-100, Math.min(100, startPosX + dx))));
                      setCaptionPosY(Math.round(Math.max(-100, Math.min(100, startPosY + dy))));
                    }}
                    onPointerUp={(e) => {
                      const ref = captionDragRef.current;
                      const wasDrag = ref
                        && activeTab === "captions"
                        && captionStyle !== "none"
                        && (Math.abs(e.clientX - ref.startX) >= 8 || Math.abs(e.clientY - ref.startY) >= 8);
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
                    handlePrimaryExportAction={handlePrimaryExportAction}
                    exportReadyToDownload={exportReadyToDownload}
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
                      onClick={handlePrimaryExportAction}
                      disabled={exportPhase === "exporting"}
                      title={exportReadyToDownload ? "Download" : exportPhase === "exporting" ? `${exportProgress}%` : "Export clip"}
                      className={cn(
                        "absolute inset-0 flex items-center justify-center rounded-full transition-all duration-150",
                        exportReadyToDownload
                          ? "bg-green-500 hover:bg-green-400 active:bg-green-600 text-white cursor-pointer"
                          : exportPhase === "exporting"
                            ? "bg-white/8 text-white/50 cursor-not-allowed"
                            : "bg-white hover:bg-white/85 active:bg-white/70 text-black cursor-pointer"
                      )}
                    >
                      {exportPhase === "exporting"
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : exportReadyToDownload
                          ? <Download className="h-4 w-4" />
                          : <Download className="h-4 w-4" />
                      }
                    </button>
                  </div>
                  <span className="text-[9px] font-medium text-white/60">
                    {exportReadyToDownload ? "Download" : exportPhase === "exporting" ? `${exportProgress}%` : "Export"}
                  </span>
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
            handlePrimaryExportAction={handlePrimaryExportAction}
            exportReadyToDownload={exportReadyToDownload}
            setExportPhase={setExportPhase}
            setExportUrl={setExportUrl}
            compact
          />
        </div>
      </div>}
    </div>
  );
}
