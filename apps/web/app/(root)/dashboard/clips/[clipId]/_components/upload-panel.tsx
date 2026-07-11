"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Film,
  ImageIcon,
  Music,
  Trash2,
} from "lucide-react";
import { TIMELINE_DROP_MEDIA_TYPE } from "@twick/video-editor";
import { useApiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type UserAssetUsage = "timeline" | "watermark";

export interface UserAsset {
  _id: string;
  name: string;
  s3Url: string;
  mimeType: string;
  assetType: "image" | "audio" | "video" | "other";
  usage: UserAssetUsage;
  sizeBytes?: number;
}

type PendingUpload = {
  id: string;
  name: string;
  previewUrl: string | null;
  assetType: UserAsset["assetType"];
  progress: number;
};

const TIMELINE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp3,audio/wav,audio/aac,audio/ogg";

const WATERMARK_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function twickMediaType(asset: UserAsset): "video" | "audio" | "image" {
  if (asset.assetType === "video") return "video";
  if (asset.assetType === "audio") return "audio";
  return "image";
}

function assetTypeFromFile(file: File): UserAsset["assetType"] {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  return "other";
}

function AssetGlyph({ type, className }: { type: UserAsset["assetType"]; className?: string }) {
  if (type === "video") return <Film className={cn("h-6 w-6 text-white/35", className)} />;
  if (type === "audio") return <Music className={cn("h-6 w-6 text-white/35", className)} />;
  return <ImageIcon className={cn("h-6 w-6 text-white/35", className)} />;
}

/** CapCut-style stacked media icons for empty drop zone */
function EmptyMediaIllustration() {
  return (
    <div className="relative h-[88px] w-[100px] mb-4" aria-hidden>
      {/* Video — glass play */}
      <div className="absolute left-1/2 top-0 z-30 -translate-x-1/2">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 100%)",
            boxShadow:
              "0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
            border: "1px solid rgba(255,255,255,0.18)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="ml-0.5 h-0 w-0"
            style={{
              borderTop: "9px solid transparent",
              borderBottom: "9px solid transparent",
              borderLeft: "15px solid #ff8a3d",
              filter: "drop-shadow(0 2px 4px rgba(255,100,40,0.5))",
            }}
          />
        </div>
      </div>

      {/* Audio — note */}
      <div className="absolute bottom-0 left-0 z-20">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 100%)",
            boxShadow: "0 6px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="noteGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff6bcb" />
                <stop offset="55%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#fb923c" />
              </linearGradient>
            </defs>
            <path
              d="M9 18V6l10-2v12"
              stroke="url(#noteGrad)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="7" cy="18" r="2.6" fill="url(#noteGrad)" />
            <circle cx="17" cy="16" r="2.6" fill="url(#noteGrad)" />
          </svg>
        </div>
      </div>

      {/* Image — landscape */}
      <div className="absolute bottom-1 right-0 z-10">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%)",
            boxShadow: "0 6px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.22)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#34d399" strokeWidth="1.8" opacity="0.9" />
            <path
              d="M3 16.5l5.5-5.5 4 4 3-3L21 16.5"
              stroke="#34d399"
              strokeWidth="1.8"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="8.5" cy="9" r="1.4" fill="#34d399" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function MediaThumb({
  assetType,
  url,
  className,
}: {
  assetType: UserAsset["assetType"];
  url: string | null;
  className?: string;
}) {
  if (assetType === "image" && url) {
    return (
      <img src={url} alt="" className={cn("h-full w-full object-cover", className)} draggable={false} />
    );
  }
  if (assetType === "video" && url) {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#1a1a22]">
      <AssetGlyph type={assetType} />
    </div>
  );
}

export function UploadPanel({
  usage,
  draggable = false,
  onSelectImage,
  onAddToTimeline,
  selectedUrl,
  title,
}: {
  usage: UserAssetUsage;
  /** Enable drag-to-timeline for timeline usage assets. */
  draggable?: boolean;
  onSelectImage?: (url: string) => void;
  /** Click-to-add onto the timeline (video / image / audio). */
  onAddToTimeline?: (asset: {
    type: "video" | "audio" | "image";
    url: string;
    name?: string;
  }) => void;
  selectedUrl?: string | null;
  title?: string;
  hint?: string;
}) {
  const apiFetch = useApiFetch();
  const fileRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<UserAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = usage === "watermark" ? WATERMARK_ACCEPT : TIMELINE_ACCEPT;
  const maxMb = usage === "watermark" ? 20 : 200;
  const panelTitle = title ?? (usage === "timeline" ? "My media" : "Your images");
  const isEmpty = !loading && assets.length === 0 && pending.length === 0;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    apiFetch(`${API_URL}/api/user-assets?usage=${usage}`)
      .then(async r => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setAssets([]);
          return;
        }
        setAssets(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [apiFetch, usage]);

  const uploadOne = useCallback(async (file: File) => {
    if (usage === "watermark" && !file.type.startsWith("image/")) {
      alert("Watermark uploads must be images.");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      alert(`File must be under ${maxMb} MB`);
      return;
    }

    const pendingId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const assetType = assetTypeFromFile(file);
    const previewUrl =
      assetType === "image" || assetType === "video" ? URL.createObjectURL(file) : null;

    setPending(prev => [
      { id: pendingId, name: file.name, previewUrl, assetType, progress: 0 },
      ...prev,
    ]);

    try {
      const presignRes = await apiFetch(`${API_URL}/api/user-assets/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mimeType: file.type || "application/octet-stream",
          fileName: file.name,
          sizeBytes: file.size,
          usage,
        }),
      });
      if (!presignRes.ok) throw new Error("Presign failed");
      const { uploadUrl, asset } = await presignRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = e => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          setPending(prev =>
            prev.map(p => (p.id === pendingId ? { ...p, progress: pct } : p)),
          );
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject());
        xhr.onerror = () => reject();
        xhr.send(file);
      });

      setAssets(prev => [asset as UserAsset, ...prev]);
      if (usage === "watermark" && onSelectImage) onSelectImage(asset.s3Url);
    } catch {
      alert(`Upload failed for ${file.name}. Please try again.`);
    } finally {
      setPending(prev => {
        const item = prev.find(p => p.id === pendingId);
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return prev.filter(p => p.id !== pendingId);
      });
    }
  }, [apiFetch, maxMb, onSelectImage, usage]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    if (usage === "watermark") {
      if (list[0]) void uploadOne(list[0]);
      return;
    }
    for (const f of list) void uploadOne(f);
  }, [uploadOne, usage]);

  const handleDelete = useCallback(async (id: string, url: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`${API_URL}/api/user-assets/${id}`, { method: "DELETE" });
      setAssets(prev => prev.filter(a => a._id !== id));
      if (selectedUrl === url && onSelectImage) onSelectImage("");
    } catch {
      alert("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }, [apiFetch, onSelectImage, selectedUrl]);

  const onDragStartAsset = (e: React.DragEvent, asset: UserAsset) => {
    if (!draggable) return;
    e.dataTransfer.setData(
      TIMELINE_DROP_MEDIA_TYPE,
      JSON.stringify({ type: twickMediaType(asset), url: asset.s3Url }),
    );
    e.dataTransfer.effectAllowed = "copy";

    const source = e.currentTarget as HTMLElement;
    source.style.opacity = "0.4";
    source.style.transform = "scale(0.96)";

    const ghost = document.createElement("div");
    ghost.className = "choppr-asset-drag-ghost";
    ghost.innerHTML = `
      <span class="choppr-asset-drag-ghost__badge">${twickMediaType(asset)}</span>
      <span class="choppr-asset-drag-ghost__name">${asset.name.replace(/[<>&]/g, "")}</span>
    `;
    Object.assign(ghost.style, {
      position: "fixed",
      top: "-9999px",
      left: "-9999px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 12px",
      borderRadius: "10px",
      background: "rgba(20,20,28,0.95)",
      border: "1px solid rgba(165,180,252,0.7)",
      boxShadow: "0 12px 32px rgba(0,0,0,0.5), 0 0 20px rgba(129,140,248,0.35)",
      color: "#fff",
      fontSize: "11px",
      fontWeight: "600",
      maxWidth: "200px",
      zIndex: "99999",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 24, 20);
    requestAnimationFrame(() => ghost.remove());

    document.body.classList.add("choppr-dragging-timeline-asset");
    const clear = () => {
      source.style.opacity = "";
      source.style.transform = "";
      document.body.classList.remove("choppr-dragging-timeline-asset");
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
  };

  const openPicker = () => fileRef.current?.click();

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <p className="text-[14px] font-semibold text-white tracking-tight">
        {panelTitle}
      </p>

      {/* Import media — CapCut-style split button */}
      <div className="flex w-full overflow-hidden rounded-lg shadow-[0_4px_16px_rgba(124,58,237,0.35)]">
        <button
          type="button"
          onClick={openPicker}
          className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] active:bg-[#5b21b6] px-3 py-2.5 text-[13px] font-semibold text-white transition-colors cursor-pointer"
        >
          Import media
        </button>
        <button
          type="button"
          onClick={openPicker}
          aria-label="Import options"
          className="flex w-10 items-center justify-center border-l border-white/20 bg-[#7c3aed] hover:bg-[#6d28d9] active:bg-[#5b21b6] transition-colors cursor-pointer"
        >
          <ChevronDown className="h-4 w-4 text-white" strokeWidth={2.5} />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        multiple={usage === "timeline"}
        className="hidden"
        onChange={e => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Empty state — large drop zone with media icons */}
      {isEmpty && (
        <div
          onClick={openPicker}
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={e => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
          }}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-1 min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-10 cursor-pointer transition-all",
            dragOver
              ? "border-[#a78bfa] bg-[#7c3aed]/10"
              : "border-white/18 bg-transparent hover:border-white/30 hover:bg-white/[0.02]",
          )}
        >
          <EmptyMediaIllustration />
          <p className="text-[13px] font-medium text-white text-center leading-snug max-w-[200px]">
            Drag &amp; drop media from your device to import
          </p>
          <p className="mt-2 text-[11px] text-white/40 text-center">
            {usage === "timeline"
              ? "Videos, audio, images, GIFs"
              : "JPG, PNG, WEBP · max 20 MB"}
          </p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-2 gap-2.5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="aspect-[4/3] rounded-lg bg-white/5 animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Media grid */}
      {!loading && (assets.length > 0 || pending.length > 0) && (
        <div
          className="grid grid-cols-2 gap-2.5 max-h-[min(420px,55vh)] overflow-y-auto no-scrollbar content-start"
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={e => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
          }}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
          }}
        >
          {pending.map(p => (
            <div key={p.id} className="flex flex-col gap-1.5 min-w-0">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#1a1a22]">
                <MediaThumb assetType={p.assetType} url={p.previewUrl} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-2 pb-2 pt-6">
                  <p className="text-[11px] font-semibold text-white tabular-nums">{p.progress}%</p>
                  <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-white transition-[width] duration-150"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-white/70 truncate px-0.5">{p.name}</p>
            </div>
          ))}

          {assets.map(asset => {
            const selected = selectedUrl === asset.s3Url;
            return (
              <div
                key={asset._id}
                draggable={draggable}
                onDragStart={e => onDragStartAsset(e, asset)}
                onClick={() => {
                  if (usage === "watermark" && onSelectImage) {
                    onSelectImage(asset.s3Url);
                    return;
                  }
                  if (usage === "timeline" && onAddToTimeline && asset.assetType !== "other") {
                    onAddToTimeline({
                      type: twickMediaType(asset),
                      url: asset.s3Url,
                      name: asset.name,
                    });
                  }
                }}
                className={cn(
                  "group relative flex flex-col gap-1.5 min-w-0 cursor-pointer",
                  draggable && "cursor-grab active:cursor-grabbing",
                )}
              >
                <div
                  className={cn(
                    "relative aspect-[4/3] overflow-hidden rounded-lg bg-[#1a1a22] ring-offset-1 ring-offset-[#0a0a0a] transition-all",
                    selected ? "ring-2 ring-white/70" : "ring-0 group-hover:ring-1 group-hover:ring-white/25",
                  )}
                >
                  <MediaThumb assetType={asset.assetType} url={asset.s3Url} />
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      void handleDelete(asset._id, asset.s3Url);
                    }}
                    disabled={deletingId === asset._id}
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md bg-black/70 text-white/70 hover:text-white items-center justify-center hidden group-hover:flex"
                  >
                    {deletingId === asset._id ? (
                      <div className="h-3 w-3 border border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-1 min-w-0 px-0.5">
                  <p className="flex-1 text-[11px] text-white/70 truncate">{asset.name}</p>
                  <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full border border-white/25">
                    <Check className="h-2.5 w-2.5 text-white/50" strokeWidth={3} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isEmpty && draggable && (
        <p className="text-[10px] text-white/30 leading-relaxed">
          Click an asset to add it at the playhead, or drag onto the timeline.
        </p>
      )}
    </div>
  );
}
