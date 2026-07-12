"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useApiFetch } from "@/lib/apiFetch";
import posthog from "posthog-js";
import {
  EXPORT_POLL_INTERVAL_MS,
  EXPORT_TIMEOUT_MS,
  EXPORT_TIMEOUT_MINUTES,
} from "@/lib/export-polling";
type CaptionStyle =
  | "none" | "word-pop" | "karaoke" | "bold-center" | "neon" | "bounce"
  | "subtitle" | "shadow" | "fire" | "typewriter" | "glitch" | "rainbow"
  | "outline-white" | "outline-black" | "highlight-box" | "wave" | "gradient-gold"
  | "comic" | "minimal-top" | "beasty" | "hormozi" | "mr-beast" | "stack-reveal"
  | "shake" | "gradient-pop" | "clean-mid" | "electric-blue" | "solo-pop"
  | "solo-red" | "solo-glow" | "solo-box" | "solo-gradient" | "solo-shake";
import { Track } from "./timeline";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CAPTION_STYLES: { label: string; value: CaptionStyle }[] = [
  { label: "None",           value: "none" },
  { label: "Hormozi",        value: "hormozi" },
  { label: "MrBeast",        value: "mr-beast" },
  { label: "Beasty",         value: "beasty" },
  { label: "Bold Center",    value: "bold-center" },
  { label: "Karaoke",        value: "karaoke" },
  { label: "Word Pop",       value: "word-pop" },
  { label: "Neon",           value: "neon" },
  { label: "Fire",           value: "fire" },
  { label: "Electric Blue",  value: "electric-blue" },
  { label: "Gradient Gold",  value: "gradient-gold" },
  { label: "Subtitle",       value: "subtitle" },
  { label: "Clean Mid",      value: "clean-mid" },
  { label: "Minimal Top",    value: "minimal-top" },
  { label: "Outline White",  value: "outline-white" },
  { label: "Outline Black",  value: "outline-black" },
  { label: "Highlight Box",  value: "highlight-box" },
  { label: "Shadow",         value: "shadow" },
  { label: "Typewriter",     value: "typewriter" },
  { label: "Glitch",         value: "glitch" },
  { label: "Rainbow",        value: "rainbow" },
  { label: "Bounce",         value: "bounce" },
  { label: "Wave",           value: "wave" },
  { label: "Shake",          value: "shake" },
  { label: "Solo Pop",       value: "solo-pop" },
  { label: "Solo Red",       value: "solo-red" },
  { label: "Solo Glow",      value: "solo-glow" },
  { label: "Solo Box",       value: "solo-box" },
  { label: "Solo Gradient",  value: "solo-gradient" },
  { label: "Solo Shake",     value: "solo-shake" },
  { label: "Stack Reveal",   value: "stack-reveal" },
  { label: "Gradient Pop",   value: "gradient-pop" },
  { label: "Comic",          value: "comic" },
];

interface Props {
  projectId:   string;
  tracks:      Track[];
  volumes:     Record<string, number>;
  aspectRatio: string;
  onClose:     () => void;
}

type Phase = "settings" | "exporting" | "done" | "error";

export default function ExportModal({ projectId, tracks, volumes, aspectRatio, onClose }: Props) {
  const apiFetch      = useApiFetch();
  const [phase, setPhase]           = useState<Phase>("settings");
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("hormozi");
  const [progress, setProgress]     = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]     = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exportIdRef = useRef<string | null>(null);
  const pollStartedRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  async function cancelExport() {
    const exportId = exportIdRef.current;
    stopPolling();
    exportIdRef.current = null;
    pollStartedRef.current = null;
    if (exportId) {
      try {
        await apiFetch(`${API_URL}/api/exports/${exportId}/cancel`, { method: "POST" });
      } catch {
        /* still reset UI */
      }
    }
    posthog.capture("export_cancelled", { project_id: projectId });
    setPhase("error");
    setErrorMsg("Export cancelled");
  }

async function startExport() {
    setPhase("exporting");
    setProgress(0);
    setErrorMsg("");
    stopPolling();

    try {
      const res = await apiFetch(`${API_URL}/api/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          tracks,
          volumes,
          captionStyle,
          captionMap: {},   // backend always fetches from DB
          aspectRatio,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Export request failed");
      }

      const { exportId } = await res.json();
      posthog.capture("export_started", {
        project_id: projectId,
        caption_style: captionStyle,
        aspect_ratio: aspectRatio,
        clip_count: tracks.flatMap((t) => t.items.filter((i) => i.type === "video")).length,
      });
      exportIdRef.current = exportId;
      pollStartedRef.current = Date.now();
      pollForCompletion(exportId);
    } catch (e: any) {
      setPhase("error");
      setErrorMsg(e.message ?? "Unknown error");
    }
  }

  function pollForCompletion(exportId: string) {
    pollRef.current = setInterval(async () => {
      if (
        pollStartedRef.current != null &&
        Date.now() - pollStartedRef.current > EXPORT_TIMEOUT_MS
      ) {
        const timedOutId = exportIdRef.current;
        stopPolling();
        exportIdRef.current = null;
        pollStartedRef.current = null;
        if (timedOutId) {
          void apiFetch(`${API_URL}/api/exports/${timedOutId}/cancel`, { method: "POST" }).catch(() => {});
        }
        setPhase("error");
        setErrorMsg(`Export timed out after ${EXPORT_TIMEOUT_MINUTES} minutes`);
        return;
      }

      try {
        const r = await apiFetch(`${API_URL}/api/exports/${exportId}`);
        if (!r.ok) return;
        const data = await r.json();
        setProgress(data.progress ?? 0);

        if (data.status === "done") {
          stopPolling();
          exportIdRef.current = null;
          pollStartedRef.current = null;
          setDownloadUrl(data.s3Url);
          posthog.capture("export_completed", {
            project_id: projectId,
            caption_style: captionStyle,
          });
          setPhase("done");
        } else if (data.status === "failed") {
          stopPolling();
          exportIdRef.current = null;
          pollStartedRef.current = null;
          setPhase("error");
          setErrorMsg(data.error ?? "Export failed on server");
        } else if (data.status === "cancelled") {
          stopPolling();
          exportIdRef.current = null;
          pollStartedRef.current = null;
          setPhase("error");
          setErrorMsg(data.error ?? "Export cancelled");
        }
      } catch (err) {
        console.warn("[export] poll failed, retrying…", err);
      }
    }, EXPORT_POLL_INTERVAL_MS);
  }

  useEffect(() => () => { stopPolling(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-[420px] rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-white/30 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="mb-1 text-[15px] font-semibold text-white">Export video</h2>
        <p className="mb-5 text-[12px] text-white/40">
          Renders your timeline through FFmpeg on the server.
        </p>

        {/* ── Settings phase ── */}
        {phase === "settings" && (
          <>
            <label className="mb-1.5 block text-[11px] font-medium text-white/50 uppercase tracking-wider">
              Caption style
            </label>
            <select
              value={captionStyle}
              onChange={(e) => setCaptionStyle(e.target.value as CaptionStyle)}
              className="mb-5 w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-[13px] text-white outline-none focus:border-white/30"
            >
              {CAPTION_STYLES.map((s) => (
                <option key={s.value} value={s.value} className="bg-[#222]">
                  {s.label}
                </option>
              ))}
            </select>

            <div className="mb-5 rounded-lg border border-white/6 bg-white/3 p-3 text-[12px] text-white/40">
              <span className="text-white/60">Aspect ratio:</span> {aspectRatio}
              &nbsp;·&nbsp;
              <span className="text-white/60">Clips:</span>{" "}
              {tracks.flatMap((t) => t.items.filter((i) => i.type === "video")).length}
            </div>

            <button
              onClick={startExport}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[13px] font-semibold text-black hover:bg-white/90 transition-colors active:scale-[0.98]"
            >
              <Download className="h-4 w-4" />
              Start export
            </button>
          </>
        )}

        {/* ── Exporting phase ── */}
        {phase === "exporting" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            <p className="text-[13px] text-white/60">Rendering your video…</p>
            <div className="w-full">
              <div className="mb-1 flex justify-between text-[11px] text-white/30">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void cancelExport()}
              className="w-full rounded-xl border border-white/15 py-2 text-[12px] font-medium text-white/55 hover:text-white/80 hover:border-white/25 transition-colors"
            >
              Cancel export
            </button>
            <p className="text-[11px] text-white/25 text-center">
              Times out after {EXPORT_TIMEOUT_MINUTES} minutes if stuck.
            </p>
          </div>
        )}

        {/* ── Done phase ── */}
        {phase === "done" && downloadUrl && (
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle className="h-10 w-10 text-green-400" />
            <p className="text-[14px] font-medium text-white">Export complete!</p>
            <a
              href={downloadUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[13px] font-semibold text-black hover:bg-white/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download video
            </a>
            <p className="text-[10px] text-white/25">Link valid for 7 days.</p>
          </div>
        )}

        {/* ── Error phase ── */}
        {phase === "error" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-[13px] text-white/60 text-center">{errorMsg}</p>
            <button
              onClick={() => setPhase("settings")}
              className="text-[12px] text-white/40 underline hover:text-white"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
