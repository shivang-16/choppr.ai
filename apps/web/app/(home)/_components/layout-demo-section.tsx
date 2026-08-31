"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  ArrowLeft,
  Captions,
  Check,
  ChevronRight,
  Gauge,
  Layers,
  Play,
  Redo2,
  Repeat,
  Scissors,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  Volume2,
  Languages,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaptionWord } from "@/app/(root)/dashboard/clips/[clipId]/_components/caption-renderer";
import { renderProCaptionFrame } from "@/app/(root)/dashboard/clips/[clipId]/_components/pro-captions";

const SRC = "/demo/pod-mic-conversation.mp4";
const POSTER = "/demo/pod-mic-conversation-poster.jpg";
const TOP_SRC = "/demo/pod-women-studio.mp4";
const TOP_POSTER = "/demo/pod-women-studio-poster.jpg";
const BOT_SRC = "/demo/pod-talking-mic.mp4";
const BOT_POSTER = "/demo/pod-talking-mic-poster.jpg";

const LOOP_MS = 39200;
const DESIGN_W = 1180;
const DESIGN_H = 680;
const EASE = [0.22, 1, 0.36, 1] as const;
const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@800;900&family=Poppins:wght@700;800&display=swap";
const PF_MONT = "'Montserrat', sans-serif";
const PF_POPPINS = "'Poppins', sans-serif";
const PRO_STROKE =
  "[text-shadow:-1.5px_-1.5px_0_black,1.5px_-1.5px_0_black,-1.5px_1.5px_0_black,1.5px_1.5px_0_black]";
const CAPTION_ON_AT = 12940;
const EDIT_CLICK_AT = 19200;
const EDIT_TYPE_AT = 19680;
const EDIT_DONE_AT = 20880;
const CAPTION_RESTART_AT = 21040;
const TRANSLATE_CLICK_AT = 22900;
const TRANSLATE_OPEN_AT = 23080;
const HINGLISH_CLICK_AT = 24600;
const HINGLISH_ON_AT = 24780;
const EXPORT_CLICK_AT = 28600;
const EXPORT_START_AT = 28780;
const EXPORT_DONE_AT = 31400;
const VERSIONS_AT = 31400;
const EDIT1_CLICK_AT = 32800;
const EDIT1_ON_AT = 32980;
const RESET_AT = 37400;
const WORD_DUR = 0.48;
const EDITED_WORD = "greatest";

const TRANSCRIPT = [
  "The", "biggest", "mistake", "people", "make", "is", "waiting",
  "for", "the", "perfect", "moment.", "You", "just", "have", "to",
  "start", "right", "now.", "That", "is", "how", "you", "break",
  "through.", "Stop", "overthinking", "and", "ship", "the", "work.",
  "Your", "story", "is", "what", "makes", "people", "care.",
  "Launching", "a", "new", "product", "takes", "a", "real",
  "marketing", "strategy.",
];

const HINGLISH = [
  "Sabse", "badi", "galti", "log", "karte", "hain",
  "perfect", "moment", "ka", "wait", "karna.",
  "Tumhe", "bas", "abhi", "start", "karna", "hai.",
  "Yahi", "tareeka", "hai", "aage", "badhne", "ka.",
  "Overthinking", "band", "karo", "aur", "kaam", "ship", "karo.",
  "Tumhari", "story", "hi", "logon", "ko", "care", "karwati", "hai.",
  "Naya", "product", "launch", "karna", "asli", "marketing",
  "strategy", "maangta", "hai.",
];

const TRANSLATE_LANGS = [
  { code: "hinglish", label: "Hinglish", native: "Hindi in English" },
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिंदी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "fr", label: "French", native: "Français" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "pt", label: "Portuguese", native: "Português" },
] as const;

function wordsToCaptions(words: string[]): CaptionWord[] {
  return words.map((word, i) => ({
    word,
    start: i * WORD_DUR,
    end: (i + 1) * WORD_DUR,
  }));
}

function buildCaptionWords(secondWord: string): CaptionWord[] {
  return wordsToCaptions(TRANSCRIPT.map((word, i) => (i === 1 ? secondWord : word)));
}

function editedTranscriptText(t: number): { text: string; editing: boolean; committed: boolean } {
  if (t < EDIT_CLICK_AT) return { text: "biggest", editing: false, committed: false };
  if (t < EDIT_TYPE_AT) return { text: "biggest", editing: true, committed: false };
  const delEnd = EDIT_TYPE_AT + 700;
  if (t < delEnd) {
    const keep = Math.round("biggest".length * (1 - progress(t, EDIT_TYPE_AT, delEnd)));
    return { text: "biggest".slice(0, keep), editing: true, committed: false };
  }
  if (t < EDIT_DONE_AT) {
    const n = Math.round(EDITED_WORD.length * progress(t, delEnd, EDIT_DONE_AT));
    return { text: EDITED_WORD.slice(0, n), editing: true, committed: false };
  }
  return { text: EDITED_WORD, editing: false, committed: true };
}

const TABS = [
  { id: "captions", icon: Captions, label: "Captions" },
  { id: "upload", icon: Upload, label: "Upload" },
  { id: "overlays", icon: Layers, label: "Overlays" },
  { id: "speed", icon: Gauge, label: "Speed" },
  { id: "enhance", icon: Sparkles, label: "Enhance" },
] as const;

function ensureFonts() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-choppr-layout-demo-fonts]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_URL;
  link.setAttribute("data-choppr-layout-demo-fonts", "1");
  document.head.appendChild(link);
}

const TOP_CROP_A = { x: 0.08, y: 0.08, w: 0.42, h: 0.78 };
const TOP_CROP_B = { x: 0.28, y: 0.12, w: 0.44, h: 0.74 };
const BOT_CROP_A = { x: 0.48, y: 0.10, w: 0.44, h: 0.76 };
const BOT_CROP_B = { x: 0.36, y: 0.14, w: 0.48, h: 0.72 };

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.6, ease: EASE },
};

type Crop = { x: number; y: number; w: number; h: number };

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpCrop(a: Crop, b: Crop, t: number): Crop {
  const p = clamp01(t);
  return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) };
}

function progress(t: number, start: number, end: number) {
  if (end <= start) return 0;
  return clamp01((t - start) / (end - start));
}

function inRange(t: number, start: number, end: number) {
  return t >= start && t < end;
}

type Aim = "rest" | "layout" | "split" | "crop" | "next" | "apply" | "preview" | "captions" | "slidebox" | "captionDrag" | "editWord" | "translateTab" | "hinglish" | "exportBtn" | "edit1";

function sceneAt(t: number) {
  const layoutOpen = inRange(t, 1100, 2480);
  const modal = inRange(t, 2480, 9800);
  const pane: 0 | 1 = t >= 6180 ? 1 : 0;
  const resetting = t >= RESET_AT;
  const applied = t >= 9800 && !resetting;
  const panelOpen = t >= 11880 && !resetting;
  const translateOpen = t >= TRANSLATE_OPEN_AT && !resetting;
  const hinglishOn = t >= HINGLISH_ON_AT && !resetting;
  const exporting = inRange(t, EXPORT_START_AT, EXPORT_DONE_AT) && !resetting;
  const exportDone = t >= EXPORT_DONE_AT && !resetting;
  const exportProgress = exporting
    ? progress(t, EXPORT_START_AT, EXPORT_DONE_AT) * 100
    : exportDone ? 100 : 0;
  const showVersions = t >= VERSIONS_AT && !resetting;
  const viewingEdit = t >= EDIT1_ON_AT && !resetting;
  const viewingOriginal = showVersions && !viewingEdit;
  const captionOn = t >= CAPTION_ON_AT && !resetting && !viewingOriginal;
  const edit = editedTranscriptText(t);
  const restarted = t >= CAPTION_RESTART_AT && !resetting;
  const transcriptWords = hinglishOn ? HINGLISH : TRANSCRIPT;
  const captionWords = hinglishOn
    ? wordsToCaptions(HINGLISH)
    : buildCaptionWords(edit.committed ? EDITED_WORD : "biggest");
  const frozenAtTranslate = (TRANSLATE_OPEN_AT - CAPTION_RESTART_AT) / 1000;
  const captionElapsed = !captionOn ? -1
    : viewingEdit ? (t - EDIT1_ON_AT) / 1000
    : hinglishOn ? (t - HINGLISH_ON_AT) / 1000
    : translateOpen ? frozenAtTranslate
    : restarted ? (t - CAPTION_RESTART_AT) / 1000
    : edit.editing ? WORD_DUR + 0.12
    : (t - CAPTION_ON_AT) / 1000;
  const highlightIdx = edit.editing || inRange(t, EDIT_CLICK_AT, CAPTION_RESTART_AT)
    ? 1
    : captionOn
      ? captionWords.findIndex(w => captionElapsed >= w.start && captionElapsed < w.end)
      : -1;
  const posOffset = captionOn || viewingOriginal ? lerp(0, 72, progress(t, 15200, 17100)) : 0;
  const layout: "fit" | "split" = viewingOriginal ? "fit" : t >= 2480 && !resetting ? "split" : "fit";
  const clicking =
    inRange(t, 1100, 1280) ||
    inRange(t, 2320, 2500) ||
    inRange(t, 6180, 6360) ||
    inRange(t, 9580, 9760) ||
    inRange(t, 11720, 11900) ||
    inRange(t, 12800, 12980) ||
    inRange(t, 15040, 17120) ||
    inRange(t, 19200, 19380) ||
    inRange(t, TRANSLATE_CLICK_AT, TRANSLATE_OPEN_AT) ||
    inRange(t, HINGLISH_CLICK_AT, HINGLISH_ON_AT) ||
    inRange(t, EXPORT_CLICK_AT, EXPORT_START_AT) ||
    inRange(t, EDIT1_CLICK_AT, EDIT1_ON_AT);

  let aim: Aim = "rest";
  if (inRange(t, 400, 1600)) aim = "layout";
  else if (inRange(t, 1600, 2800)) aim = "split";
  else if (inRange(t, 2800, 5480)) aim = "crop";
  else if (inRange(t, 5480, 6400)) aim = "next";
  else if (inRange(t, 6400, 8880)) aim = "crop";
  else if (inRange(t, 8880, 10100)) aim = "apply";
  else if (inRange(t, 10100, 11200)) aim = "preview";
  else if (inRange(t, 11200, 12040)) aim = "captions";
  else if (inRange(t, 12040, 13200)) aim = "slidebox";
  else if (inRange(t, 13200, 14600)) aim = "preview";
  else if (inRange(t, 14600, 17800)) aim = "captionDrag";
  else if (inRange(t, 17800, 18200)) aim = "preview";
  else if (inRange(t, 18200, 21100)) aim = "editWord";
  else if (inRange(t, 21100, 22200)) aim = "preview";
  else if (inRange(t, 22200, 23200)) aim = "translateTab";
  else if (inRange(t, 23200, 24900) && !resetting) aim = "hinglish";
  else if (inRange(t, 24900, 27800)) aim = "preview";
  else if (inRange(t, 27800, 31600) && !resetting) aim = "exportBtn";
  else if (inRange(t, 31600, 32100)) aim = "preview";
  else if (inRange(t, 32100, 33100) && !resetting) aim = "edit1";
  else if (t >= 33100 && !resetting) aim = "preview";

  const topCrop = lerpCrop(TOP_CROP_A, TOP_CROP_B, progress(t, 3600, 5200));
  const botCrop = lerpCrop(BOT_CROP_A, BOT_CROP_B, progress(t, 7200, 8600));
  return {
    layoutOpen, modal, pane, applied, resetting, layout, clicking, aim,
    crop: pane === 0 ? topCrop : botCrop,
    panelOpen, captionOn, posOffset, captionElapsed, highlightIdx,
    captionWords, transcriptWords, translateOpen, hinglishOn,
    exporting, exportDone, exportProgress, showVersions, viewingEdit, viewingOriginal,
    editText: edit.text, editingWord: edit.editing, editCommitted: edit.committed,
  };
}

const DEMO_STYLES = [
  {
    id: "pro-spring",
    label: "Spring Pop",
    preview: (
      <div className="flex flex-col items-center gap-0.5" style={{ fontFamily: PF_MONT }}>
        <span className={cn("text-[15px] font-black leading-none text-white", PRO_STROKE)}>SPRING</span>
        <div className="h-[3px] w-8 rounded-full bg-[#FFE900]" />
      </div>
    ),
  },
  {
    id: "pro-slide-box",
    label: "Slide Box",
    preview: (
      <div className="flex items-center gap-1" style={{ fontFamily: PF_POPPINS }}>
        <span className="text-[10px] font-extrabold text-white/90">the</span>
        <span className="rounded-md bg-[#C6FF00] px-1.5 py-0.5 text-[11px] font-extrabold text-black">box</span>
        <span className="text-[10px] font-extrabold text-white/90">slides</span>
      </div>
    ),
  },
  {
    id: "pro-liquid",
    label: "Liquid Fill",
    preview: (
      <span className={cn("bg-clip-text text-[15px] font-black text-transparent", PRO_STROKE)} style={{ fontFamily: PF_MONT, backgroundImage: "linear-gradient(90deg,#22D3EE 0%,#A5F3FC 52%,rgba(255,255,255,0.4) 52%)" }}>
        LIQUID
      </span>
    ),
  },
  {
    id: "pro-focus",
    label: "Focus Blur",
    preview: (
      <div className="flex items-center gap-1" style={{ fontFamily: PF_POPPINS }}>
        <span className="text-[11px] font-extrabold text-white/50 blur-[1.5px]">into</span>
        <span className="text-[13px] font-extrabold text-white">focus</span>
      </div>
    ),
  },
  {
    id: "pro-rise",
    label: "Rise Mask",
    preview: (
      <div className="flex items-stretch gap-1.5" style={{ fontFamily: PF_MONT }}>
        <div className="w-[3px] rounded-full bg-[#4ADE80]" />
        <div className="flex flex-col gap-0.5 leading-none">
          <span className={cn("text-[10px] font-black text-white/45", PRO_STROKE)}>WORDS</span>
          <span className={cn("text-[12px] font-black text-white", PRO_STROKE)}>RISE</span>
        </div>
      </div>
    ),
  },
  {
    id: "pro-tilt",
    label: "Tilt Drop",
    preview: (
      <div className="flex items-center gap-1" style={{ fontFamily: PF_POPPINS }}>
        <span className={cn("inline-block -rotate-6 text-[11px] font-extrabold text-white/70", PRO_STROKE)}>TIP</span>
        <span className={cn("inline-block rotate-6 text-[14px] font-extrabold text-[#FFD166]", PRO_STROKE)}>TILT</span>
      </div>
    ),
  },
] as const;

function useMutedPlay(ref: React.RefObject<HTMLVideoElement | null>, active: boolean) {
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    const play = () => {
      if (!active) {
        v.pause();
        return;
      }
      const p = v.play();
      if (p) p.catch(() => {});
    };
    play();
    v.addEventListener("loadeddata", play);
    v.addEventListener("canplay", play);
    return () => {
      v.removeEventListener("loadeddata", play);
      v.removeEventListener("canplay", play);
    };
  }, [ref, active]);
}

function LayoutIcon({ kind, className }: { kind: "fill" | "fit" | "split"; className?: string }) {
  if (kind === "fill") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6V3h3M14 6V3h-3M2 10v3h3M14 10v3h-3" />
      </svg>
    );
  }
  if (kind === "fit") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3H2v3M11 3h3v3M5 13H2v-3M11 13h3v-3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <path d="M2 8h12" />
    </svg>
  );
}

function DemoCursor({ x, y, clicking, visible }: { x: number; y: number; clicking: boolean; visible: boolean }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute z-[60]"
      animate={{
        left: `${x}%`,
        top: `${y}%`,
        scale: clicking ? 0.86 : 1,
        opacity: visible ? 1 : 0,
      }}
      transition={{ duration: 0.55, ease: EASE }}
      style={{ translateX: "-6px", translateY: "-2px" }}
    >
      <svg width="22" height="24" viewBox="0 0 22 24" fill="none">
        <path
          d="M2.2 1.4 19.6 14.1l-7.4.4 3.2 7.2-3.3 1.5-3.1-7.1-5.2 4.8L2.2 1.4Z"
          fill="#fff"
          stroke="#111"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {clicking && (
        <span className="absolute left-1 top-1 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 bg-white/15" />
      )}
    </motion.div>
  );
}

function DemoSlideBoxCaption({ t, posOffset, words }: { t: number; posOffset: number; words: CaptionWord[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (t < 0) return;
    renderProCaptionFrame({
      ctx,
      canvasW: 1080,
      canvasH: 1920,
      words,
      style: "pro-slide-box",
      t,
      fontSize: 48,
      posOffset,
      hOffset: 0,
      montserrat: "'Montserrat', sans-serif",
      poppins: "'Poppins', sans-serif",
    });
  }, [t, posOffset, words]);

  return (
    <canvas
      ref={canvasRef}
      width={1080}
      height={1920}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ objectFit: "contain", zIndex: 2 }}
    />
  );
}

function GlassIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center text-white/70">
      {children}
    </span>
  );
}

function DemoWaterFill({ progress }: { progress: number }) {
  const p = Math.max(4, Math.min(100, progress));
  return (
    <span
      className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
      style={{ width: `${p}%` }}
      aria-hidden
    >
      <span className="absolute inset-0 bg-white" />
    </span>
  );
}

export default function LayoutDemoSection() {
  const frameWrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const layoutBtnRef = useRef<HTMLButtonElement>(null);
  const splitOptRef = useRef<HTMLButtonElement>(null);
  const cropHandleRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const applyBtnRef = useRef<HTMLButtonElement>(null);
  const captionsTabRef = useRef<HTMLDivElement>(null);
  const slideBoxRef = useRef<HTMLDivElement>(null);
  const captionDragRef = useRef<HTMLDivElement>(null);
  const editWordRef = useRef<HTMLSpanElement>(null);
  const translateTabRef = useRef<HTMLSpanElement>(null);
  const hinglishBtnRef = useRef<HTMLDivElement>(null);
  const exportBtnRef = useRef<HTMLDivElement>(null);
  const edit1Ref = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLVideoElement>(null);
  const fitFgRef = useRef<HTMLVideoElement>(null);
  const modalRef = useRef<HTMLVideoElement>(null);
  const splitTopRef = useRef<HTMLVideoElement>(null);
  const splitBotRef = useRef<HTMLVideoElement>(null);

  const inView = useInView(stageRef, { amount: 0.28 });
  const [reduceMotion, setReduceMotion] = useState(false);
  const [time, setTime] = useState(0);
  const [cursor, setCursor] = useState({ x: 62, y: 18 });
  const [scale, setScale] = useState(() => {
    if (typeof window === "undefined") return 1;
    return Math.min(1, Math.max(0.2, (window.innerWidth - 24) / DESIGN_W));
  });

  useEffect(() => {
    ensureFonts();
  }, []);

  useEffect(() => {
    const el = frameWrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setScale(w > 0 ? Math.min(1, w / DESIGN_W) : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const playing = inView && !reduceMotion;
  const scene = reduceMotion
    ? {
        layoutOpen: false,
        modal: false,
        pane: 1 as const,
        applied: true,
        resetting: false,
        layout: "split" as const,
        clicking: false,
        aim: "preview" as Aim,
        crop: TOP_CROP_B,
        panelOpen: true,
        captionOn: true,
        posOffset: 72,
        captionElapsed: 0,
        highlightIdx: 0,
        captionWords: wordsToCaptions(HINGLISH),
        transcriptWords: HINGLISH,
        translateOpen: true,
        hinglishOn: true,
        exporting: false,
        exportDone: true,
        exportProgress: 100,
        showVersions: true,
        viewingEdit: true,
        viewingOriginal: false,
        editText: EDITED_WORD,
        editingWord: false,
        editCommitted: true,
      }
    : sceneAt(time);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const start = performance.now() - (time % LOOP_MS);
    const tick = (now: number) => {
      setTime((now - start) % LOOP_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useMutedPlay(fitRef, playing && (!scene.applied || scene.viewingOriginal) && !scene.modal);
  useMutedPlay(fitFgRef, playing && (!scene.applied || scene.viewingOriginal) && !scene.modal);
  useMutedPlay(modalRef, playing && scene.modal);
  useMutedPlay(splitTopRef, playing && scene.applied && !scene.viewingOriginal);
  useMutedPlay(splitBotRef, playing && scene.applied && !scene.viewingOriginal);

  useEffect(() => {
    if (scene.highlightIdx < 0) return;
    const el = transcriptRef.current?.querySelector(`[data-transcript-word="${scene.highlightIdx}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [scene.highlightIdx]);

  useEffect(() => {
    const v = modalRef.current;
    if (!v || !playing || !scene.modal) return;
    v.muted = true;
    const p = v.play();
    if (p) p.catch(() => {});
  }, [playing, scene.modal, scene.pane]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const aimEl =
      scene.aim === "layout" ? layoutBtnRef.current
      : scene.aim === "split" ? splitOptRef.current
      : scene.aim === "crop" ? cropHandleRef.current
      : scene.aim === "next" ? nextBtnRef.current
      :       scene.aim === "apply" ? applyBtnRef.current
      : scene.aim === "captions" ? captionsTabRef.current
      : scene.aim === "slidebox" ? slideBoxRef.current
      : scene.aim === "captionDrag" ? captionDragRef.current
      : scene.aim === "editWord" ? editWordRef.current
      : scene.aim === "translateTab" ? translateTabRef.current
      : scene.aim === "hinglish" ? hinglishBtnRef.current
      : scene.aim === "exportBtn" ? exportBtnRef.current
      : scene.aim === "edit1" ? edit1Ref.current
      : scene.aim === "preview" ? previewRef.current
      : null;
    if (!aimEl) return;
    const s = stage.getBoundingClientRect();
    const r = aimEl.getBoundingClientRect();
    if (s.width < 1 || s.height < 1) return;
    setCursor({
      x: ((r.left + r.width * 0.55 - s.left) / s.width) * 100,
      y: ((r.top + r.height * 0.55 - s.top) / s.height) * 100,
    });
  }, [scene.aim, scene.crop.x, scene.crop.y, scene.modal, scene.layoutOpen, scene.pane, scene.applied, scene.panelOpen, scene.captionOn, scene.posOffset, scene.translateOpen, scene.hinglishOn, scene.exporting, scene.showVersions, scene.viewingEdit, scale]);

  const modalSrc = scene.pane === 0 ? TOP_SRC : BOT_SRC;
  const modalPoster = scene.pane === 0 ? TOP_POSTER : BOT_POSTER;
  const playhead = 8 + (time / LOOP_MS) * 42;

  return (
    <section className="relative overflow-hidden px-3 py-20 sm:px-4 sm:py-28">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-[46%] h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c48a4a]/28 blur-[130px]" />
        <div className="absolute left-[18%] top-[30%] h-[280px] w-[280px] rounded-full bg-white/[0.04] blur-[90px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-[1180px] flex-col items-center">
        <motion.div {...reveal} className="flex max-w-3xl flex-col items-center gap-4 text-center">
          <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70 backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-white/70" strokeWidth={2.5} />
            AI editor
          </span>
          <h2 className="text-[clamp(1.7rem,3.6vw,3.1rem)] font-normal leading-[1.08] tracking-[-0.01em] text-white">
            AI that works with you, not just for you
          </h2>
          <p className="max-w-xl text-balance text-[clamp(0.95rem,2vw,1.05rem)] leading-relaxed text-white/55">
            Stay in control of every cut, or let AI finish it. Either way, it stays effortless.
          </p>
        </motion.div>

        <motion.div {...reveal} className="relative mt-12 w-full">
          <div ref={frameWrapRef} className="w-full">
          <div
            ref={stageRef}
            className="relative w-full overflow-hidden rounded-[20px] border border-white/10 bg-black/55 shadow-[0_40px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-[28px]"
            style={{ height: DESIGN_H * scale }}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-black/20" />

            <div
              className="pointer-events-none absolute top-0 left-0 flex select-none flex-col"
              style={{
                width: DESIGN_W,
                height: DESIGN_H,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              {/* Main row */}
              <div className="flex min-h-0 flex-1">
                {/* Transcript */}
                <div className="flex w-[220px] shrink-0 flex-col border-r border-white/8 bg-black/40 backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <p className="text-[12px] font-semibold text-white/70">Transcript</p>
                    <span className="text-[10px] text-white/35">{scene.transcriptWords.length} words</span>
                  </div>
                  <div ref={transcriptRef} className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar">
                    <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                      {scene.transcriptWords.map((word, i) => {
                        const shown = !scene.hinglishOn && i === 1 ? scene.editText : word;
                        const editing = !scene.hinglishOn && i === 1 && scene.editingWord;
                        return (
                          <span
                            key={`${word}-${i}`}
                            ref={!scene.hinglishOn && i === 1 ? editWordRef : undefined}
                            data-transcript-word={i}
                            className={cn(
                              "rounded px-1 text-[14px] font-semibold leading-5",
                              editing
                                ? "bg-white/12 text-white ring-1 ring-white/35"
                                : i === scene.highlightIdx
                                  ? "bg-violet-500/45 text-white"
                                  : "text-white/85",
                            )}
                          >
                            {shown}
                            {editing && (
                              <span className="ml-px inline-block h-[13px] w-[1.5px] translate-y-[1px] animate-pulse bg-white align-middle" />
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Resize grip */}
                <div className="relative flex w-4 shrink-0 items-center justify-center">
                  <div className="absolute inset-y-0 left-[7px] w-px bg-white/10" />
                  <div className="relative z-10 flex flex-col items-center gap-[4px] rounded-full border border-white/15 bg-black/50 px-[3px] py-2 backdrop-blur-md">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className="h-[3px] w-[3px] rounded-full bg-white/50" />
                    ))}
                  </div>
                </div>

                {/* Preview workspace */}
                <div className="relative flex min-w-0 flex-1 flex-col bg-black/25">
                  <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 text-[11px] text-white/70 backdrop-blur-md">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </div>

                  <div className="relative flex min-h-0 flex-1 items-center justify-center">
                  <div
                    ref={previewRef}
                    className="relative overflow-hidden rounded-xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
                    style={{ height: "86%", aspectRatio: "9 / 16", maxWidth: "100%" }}
                  >
                    <div className={cn("absolute inset-0", scene.applied && !scene.viewingOriginal && "opacity-0")}>
                      <video
                        ref={fitRef}
                        className="absolute inset-0 h-full w-full scale-110 object-cover"
                        poster={POSTER}
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        style={{ filter: "blur(20px) brightness(0.55)" }}
                        src={SRC}
                      />
                      <video
                        ref={fitFgRef}
                        className="absolute inset-0 h-full w-full object-contain"
                        poster={POSTER}
                        muted
                        loop
                        playsInline
                        preload="auto"
                        src={SRC}
                      />
                    </div>

                    <div className={cn("absolute inset-0 flex flex-col", (!scene.applied || scene.viewingOriginal) && "opacity-0")}>
                      <div className="relative min-h-0 flex-1 overflow-hidden border-b border-white/25">
                        <video
                          ref={splitTopRef}
                          className="absolute inset-0 h-full w-full object-cover"
                          style={{ objectPosition: "32% 28%" }}
                          poster={TOP_POSTER}
                          muted
                          loop
                          playsInline
                          preload="auto"
                          src={TOP_SRC}
                        />
                      </div>
                      <div className="relative min-h-0 flex-1 overflow-hidden">
                        <video
                          ref={splitBotRef}
                          className="absolute inset-0 h-full w-full object-cover"
                          style={{ objectPosition: "60% 30%" }}
                          poster={BOT_POSTER}
                          muted
                          loop
                          playsInline
                          preload="auto"
                          src={BOT_SRC}
                        />
                      </div>
                      {scene.captionOn && (
                        <DemoSlideBoxCaption
                          t={scene.captionElapsed}
                          posOffset={scene.posOffset}
                          words={scene.captionWords}
                        />
                      )}
                      {scene.captionOn && (
                        <div
                          ref={captionDragRef}
                          className="absolute left-1/2 z-30 h-8 w-36 -translate-x-1/2 -translate-y-1/2"
                          style={{ top: `${58 + scene.posOffset * 0.38}%` }}
                        />
                      )}
                    </div>

                    {!scene.applied && !scene.modal && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md">
                          <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
                        </div>
                      </div>
                    )}

                    {!scene.viewingEdit && (
                    <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
                      <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/55 px-2.5 py-1.5 backdrop-blur-md">
                        <svg viewBox="0 0 10 18" className="h-3.5 w-2 shrink-0 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="1" y="1" width="8" height="16" rx="1.5" />
                        </svg>
                        <span className="text-[11px] font-semibold text-white/80">9:16</span>
                      </div>
                      <div className="relative">
                        <button
                          ref={layoutBtnRef}
                          type="button"
                          tabIndex={-1}
                          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/55 px-2.5 py-1.5 backdrop-blur-md"
                        >
                          <LayoutIcon kind={scene.layout} className="h-3 w-3 shrink-0 text-white/70" />
                          <span className="text-[11px] font-semibold text-white/80">
                            Layout: {scene.layout === "split" ? "Split" : "Fit"}
                          </span>
                          <svg viewBox="0 0 10 6" className="h-2 w-2.5 shrink-0 text-white/40" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M1 1l4 4 4-4" />
                          </svg>
                        </button>
                        <AnimatePresence>
                          {scene.layoutOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.18 }}
                              className="absolute right-0 top-full z-30 mt-1.5 flex min-w-[180px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/70 py-1.5 shadow-2xl backdrop-blur-2xl"
                            >
                              {([
                                { id: "fill" as const, label: "Fill" },
                                { id: "fit" as const, label: "Fit" },
                                { id: "split" as const, label: "Split" },
                              ]).map(opt => (
                                <button
                                  key={opt.id}
                                  ref={opt.id === "split" ? splitOptRef : undefined}
                                  type="button"
                                  tabIndex={-1}
                                  className={cn(
                                    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px]",
                                    opt.id === "split" && scene.aim === "split"
                                      ? "bg-white/10 font-semibold text-white"
                                      : opt.id === "fit"
                                        ? "bg-white/8 font-semibold text-white"
                                        : "text-white/65",
                                  )}
                                >
                                  <LayoutIcon kind={opt.id} className="h-3.5 w-3.5 shrink-0" />
                                  <span>{opt.label}</span>
                                  {opt.id === "fit" && (
                                    <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-white" />
                                  )}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    )}
                  </div>
                  </div>

                  <AnimatePresence>
                    {scene.showVersions && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.28, ease: EASE }}
                        className="shrink-0 border-t border-white/8 bg-black/40 px-3 py-2"
                      >
                        <div className="flex items-start justify-center gap-3">
                          <div className="flex shrink-0 flex-col items-center gap-1">
                            <div
                              className={cn(
                                "relative overflow-hidden rounded-lg bg-black transition-all",
                                scene.viewingOriginal ? "ring-1 ring-white" : "ring-1 ring-white/10",
                              )}
                              style={{ height: 56, width: 56 }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={POSTER} alt="" className="h-full w-full object-cover" />
                            </div>
                            <span className={cn("text-[9px] font-medium leading-none", scene.viewingOriginal ? "text-white" : "text-white/40")}>
                              Original
                            </span>
                          </div>
                          <button
                            ref={edit1Ref}
                            type="button"
                            tabIndex={-1}
                            className="flex shrink-0 flex-col items-center gap-1"
                          >
                            <div
                              className={cn(
                                "relative overflow-hidden rounded-lg bg-black transition-all",
                                scene.viewingEdit ? "ring-1 ring-white" : "ring-1 ring-white/10",
                              )}
                              style={{ height: 56, width: 56 }}
                            >
                              <div className="flex h-full w-full flex-col">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={TOP_POSTER} alt="" className="h-1/2 w-full object-cover" />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={BOT_POSTER} alt="" className="h-1/2 w-full object-cover" />
                              </div>
                            </div>
                            <span className={cn("text-[9px] font-medium leading-none", scene.viewingEdit ? "text-white" : "text-white/40")}>
                              Edit 1
                            </span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div
                  className={cn(
                    "relative flex shrink-0 flex-col border-l border-white/8 bg-black/40 backdrop-blur-xl",
                    scene.panelOpen ? "w-[280px]" : "w-16",
                  )}
                >
                  {!scene.panelOpen && (
                    <>
                      <div className="absolute top-1/2 left-0 z-20 flex h-9 w-4 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-white/10 bg-black/50 text-white/70">
                        <ChevronRight className="h-3 w-3" />
                      </div>
                      {TABS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <div
                            key={tab.id}
                            ref={tab.id === "captions" ? captionsTabRef : undefined}
                            className="flex w-full flex-col items-center gap-1 py-3 text-white/55"
                          >
                            <Icon className="h-4 w-4" strokeWidth={1.8} />
                            <span className="text-[9px] font-medium">{tab.label}</span>
                          </div>
                        );
                      })}
                      <div className="mt-auto flex flex-col items-center gap-1.5 pb-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-lg">
                          <Upload className="h-4 w-4" />
                        </div>
                      </div>
                    </>
                  )}

                  {scene.panelOpen && (
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="flex shrink-0 border-b border-white/8">
                        {TABS.map(({ id, icon: Icon, label }) => (
                          <div
                            key={id}
                            className={cn(
                              "flex flex-1 flex-col items-center gap-1 border-b-2 py-2.5 text-[9px] font-medium",
                              id === "captions" ? "border-white text-white" : "border-transparent text-white/55",
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                          </div>
                        ))}
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-3">
                        <div className="mb-3 flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
                          {(["Styles", "Adjustment", "Translate"] as const).map(label => {
                            const active = scene.translateOpen ? label === "Translate" : label === "Styles";
                            return (
                              <span
                                key={label}
                                ref={label === "Translate" ? translateTabRef : undefined}
                                className={cn(
                                  "flex-1 rounded-full px-2 py-1.5 text-center text-[10px] font-semibold",
                                  active ? "bg-white text-black shadow-sm" : "text-white/45",
                                )}
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                        {scene.translateOpen ? (
                          <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
                            <div className="mb-3 flex items-start gap-2">
                              <Languages className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
                              <div>
                                <p className="text-[13px] font-semibold text-white">Translate captions</p>
                                <p className="mt-1 text-[11px] leading-snug text-white/50">
                                  Styles already on the timeline keep their look and switch to the new language.
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pb-2">
                              {TRANSLATE_LANGS.map(l => {
                                const selected = scene.hinglishOn
                                  ? l.code === "hinglish"
                                  : l.code === "en";
                                return (
                                  <div
                                    key={l.code}
                                    ref={l.code === "hinglish" ? hinglishBtnRef : undefined}
                                    className={cn(
                                      "rounded-xl border px-3 py-2.5 text-left transition-all",
                                      selected
                                        ? "border-white bg-white text-black shadow-sm"
                                        : "border-white/20 bg-white/[0.08] text-white",
                                    )}
                                  >
                                    <span className="block text-[12px] font-semibold leading-tight">{l.label}</span>
                                    <span className={cn(
                                      "mt-0.5 block text-[11px] leading-tight",
                                      selected ? "text-black/50" : "text-white/50",
                                    )}>
                                      {l.native}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                        <div className="min-h-0 flex-1 overflow-hidden">
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-white/70">Pro Animated</p>
                            <span className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-wider text-white">
                              New
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {DEMO_STYLES.map(s => (
                              <div
                                key={s.id}
                                ref={s.id === "pro-slide-box" ? slideBoxRef : undefined}
                                className={cn(
                                  "overflow-hidden rounded-xl border transition-all",
                                  scene.captionOn && s.id === "pro-slide-box"
                                    ? "border-white/50 ring-1 ring-white/20"
                                    : "border-white/8 bg-white/[0.03]",
                                )}
                              >
                                <div className="flex h-14 w-full items-center justify-center bg-[#111]">
                                  {s.preview}
                                </div>
                                <div className="flex items-center justify-between bg-[#181818] px-2 py-1">
                                  <span className="truncate text-[9px] font-semibold leading-tight text-white/60">{s.label}</span>
                                  {scene.captionOn && s.id === "pro-slide-box" && (
                                    <Check className="h-2.5 w-2.5 shrink-0 text-white/70" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        )}
                      </div>
                      <div className="shrink-0 border-t border-white/8 p-3">
                        <div
                          ref={exportBtnRef}
                          className={cn(
                            "relative overflow-hidden rounded-full px-5 py-3 text-center text-[13px] font-bold",
                            scene.exporting
                              ? "border border-white/20 bg-[#0d0d1a] text-white"
                              : "bg-white text-black",
                          )}
                        >
                          {scene.exporting && <DemoWaterFill progress={scene.exportProgress} />}
                          <span
                            className={cn(
                              "relative z-10 inline-flex items-center justify-center gap-1.5",
                              scene.exporting && "mix-blend-difference text-white",
                            )}
                          >
                            {scene.exportDone && !scene.exporting && <Download className="h-3.5 w-3.5" />}
                            {scene.exporting ? "Cancel" : scene.exportDone ? "Download" : "Export · 4 credits"}
                          </span>
                        </div>
                        <p className="mt-2.5 text-center text-[11px] font-medium text-white/80">
                          Reset all changes to original
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline + playback */}
              <div className="shrink-0 border-t border-white/8 bg-black/45 backdrop-blur-xl">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-1">
                    <GlassIcon><Volume2 className="h-4 w-4" /></GlassIcon>
                    <GlassIcon><Trash2 className="h-4 w-4" /></GlassIcon>
                    <GlassIcon><Scissors className="h-4 w-4" /></GlassIcon>
                    <GlassIcon><Undo2 className="h-4 w-4" /></GlassIcon>
                    <GlassIcon><Redo2 className="h-4 w-4" /></GlassIcon>
                  </div>
                  <div className="flex items-center gap-2 text-white/70">
                    <span className="text-[11px] font-medium text-white/50">30%</span>
                    <Repeat className="h-3.5 w-3.5" />
                    <SkipBack className="h-3.5 w-3.5" />
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
                      <Play className="ml-0.5 h-3.5 w-3.5 fill-black" />
                    </span>
                    <SkipForward className="h-3.5 w-3.5" />
                    <span className="font-mono text-[11px] text-white/70">00:02.00 / 00:58.03</span>
                  </div>
                </div>
                <div className="relative px-3 pb-3">
                  <div className="mb-1 flex gap-6 text-[9px] text-white/35">
                    {["0", "5", "10", "15", "20", "25", "30"].map(n => (
                      <span key={n} className="w-8">{n}s</span>
                    ))}
                  </div>
                  <AnimatePresence>
                    {scene.captionOn && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 22, marginBottom: 6 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex h-[22px] items-center rounded-md bg-violet-500/80 px-2">
                          <span className="text-[10px] font-semibold text-white">Slide Box</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="relative h-11 overflow-hidden rounded-lg border border-white/12">
                    <div className="flex h-full">
                      {[TOP_POSTER, POSTER, BOT_POSTER, TOP_POSTER, POSTER].map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={src} alt="" className="h-full w-1/5 object-cover opacity-80" />
                      ))}
                    </div>
                    <div
                      className="absolute top-0 bottom-0 w-px bg-white"
                      style={{ left: `${playhead}%` }}
                    >
                      <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Crop modal */}
              <AnimatePresence>
                {scene.modal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 p-3 backdrop-blur-md sm:p-6"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.22, ease: EASE }}
                      className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/70 shadow-2xl backdrop-blur-2xl"
                    >
                      <div className="flex items-center border-b border-white/12 px-4 pt-3">
                        {([
                          { id: 0 as const, label: "Top" },
                          { id: 1 as const, label: "Bottom" },
                        ]).map(tab => (
                          <div
                            key={tab.id}
                            className={cn(
                              "relative px-4 py-2 text-[12px] font-semibold",
                              scene.pane === tab.id ? "text-white" : "text-white/40",
                            )}
                          >
                            {tab.label}
                            {scene.pane === tab.id && (
                              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-white" />
                            )}
                          </div>
                        ))}
                        <div className="mb-1 ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-white/50">
                          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M3 3l10 10M13 3 3 13" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex items-center justify-center bg-black/30 px-4 py-4">
                        <div className="relative overflow-hidden" style={{ width: "min(100%, 300px)" }}>
                          <video
                            key={modalSrc}
                            ref={modalRef}
                            className="block w-full"
                            poster={modalPoster}
                            muted
                            loop
                            playsInline
                            preload="auto"
                            src={modalSrc}
                          />
                          <div
                            className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                            style={{
                              left: `${scene.crop.x * 100}%`,
                              top: `${scene.crop.y * 100}%`,
                              width: `${scene.crop.w * 100}%`,
                              height: `${scene.crop.h * 100}%`,
                            }}
                          >
                            <div ref={cropHandleRef} className="absolute inset-0 flex items-center justify-center">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
                                <svg viewBox="0 0 16 16" className="h-4 w-4 text-black" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M8 2v12M2 8h12M4.5 4.5 2 8l2.5 3.5M11.5 4.5 14 8l-2.5 3.5M4.5 11.5 8 14l3.5-2.5M4.5 4.5 8 2l3.5 2.5" />
                                </svg>
                              </div>
                            </div>
                            {(["nw", "ne", "sw", "se"] as const).map(h => (
                              <div
                                key={h}
                                className="absolute h-3 w-3 rounded-sm border border-black/40 bg-white"
                                style={{
                                  ...(h.includes("n") ? { top: -6 } : { bottom: -6 }),
                                  ...(h.includes("w") ? { left: -6 } : { right: -6 }),
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/12 px-4 py-3">
                        <span className="rounded-lg px-3 py-2 text-[13px] text-white/50">Close</span>
                        <div className="flex gap-2">
                          <span className="rounded-lg border border-white/20 px-3 py-2 text-[13px] text-white/70">Reset</span>
                          {scene.pane === 0 ? (
                            <span ref={nextBtnRef} className="rounded-lg bg-white px-5 py-2 text-[13px] font-semibold text-black">
                              Next
                            </span>
                          ) : (
                            <span ref={applyBtnRef} className="rounded-lg bg-white px-5 py-2 text-[13px] font-semibold text-black">
                              Apply
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <DemoCursor
              x={cursor.x}
              y={cursor.y}
              clicking={scene.clicking}
              visible={playing && scene.aim !== "rest"}
            />
          </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
