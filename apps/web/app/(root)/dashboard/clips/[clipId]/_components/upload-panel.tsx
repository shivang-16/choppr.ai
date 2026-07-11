"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Film, ImageIcon, Music, Trash2, Upload } from "lucide-react";
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

const TIMELINE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp3,audio/wav,audio/aac,audio/ogg";

const WATERMARK_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function twickMediaType(asset: UserAsset): "video" | "audio" | "image" {
  if (asset.assetType === "video") return "video";
  if (asset.assetType === "audio") return "audio";
  return "image";
}

function AssetIcon({ type }: { type: UserAsset["assetType"] }) {
  if (type === "video") return <Film className="h-4 w-4 text-white/40" />;
  if (type === "audio") return <Music className="h-4 w-4 text-white/40" />;
  return <ImageIcon className="h-4 w-4 text-white/40" />;
}

export function UploadPanel({
  usage,
  draggable = false,
  onSelectImage,
  onAddToTimeline,
  selectedUrl,
  title,
  hint,
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
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const accept = usage === "watermark" ? WATERMARK_ACCEPT : TIMELINE_ACCEPT;
  const maxMb = usage === "watermark" ? 20 : 200;

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

  const handleFileSelect = useCallback(async (file: File) => {
    if (usage === "watermark" && !file.type.startsWith("image/")) {
      alert("Watermark uploads must be images.");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      alert(`File must be under ${maxMb} MB`);
      return;
    }

    setUploading(true);
    setProgress(0);
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
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject());
        xhr.onerror = () => reject();
        xhr.send(file);
      });

      setAssets(prev => [asset, ...prev]);
      if (usage === "watermark" && onSelectImage) onSelectImage(asset.s3Url);
    } catch {
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [apiFetch, maxMb, onSelectImage, usage]);

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

    // Custom drag ghost so it feels like picking up the asset
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[12px] font-medium text-white/70 mb-1">
          {title ?? (usage === "timeline" ? "Media library" : "Your images")}
        </p>
        {hint && <p className="text-[10px] text-white/35 mb-2">{hint}</p>}

        <div
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void handleFileSelect(f);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-5 cursor-pointer transition-all",
            uploading
              ? "border-white/20 bg-white/5 cursor-not-allowed"
              : "border-white/12 bg-white/[0.03] hover:border-white/25 hover:bg-white/6",
          )}
        >
          {uploading ? (
            <>
              <div className="h-7 w-7 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
              <p className="text-[11px] text-white/40">Uploading… {progress}%</p>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-white/30" />
              <p className="text-[11px] text-white/50 text-center px-4">
                Click or drag files here
              </p>
              <p className="text-[10px] text-white/25 text-center px-4">
                {usage === "timeline"
                  ? "Videos, images, audio · max 200 MB"
                  : "JPG, PNG, WEBP · max 20 MB"}
              </p>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          multiple={usage === "timeline"}
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files ?? []);
            if (files[0]) void handleFileSelect(files[0]);
            e.target.value = "";
          }}
        />
      </div>

      {draggable && (
        <p className="text-[10px] text-white/30 -mt-2">
          Click an asset to add it at the playhead, or drag onto the timeline.
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <p className="text-[11px] text-white/25 text-center py-2">No uploads yet</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto no-scrollbar">
          {assets.map(asset => {
            const isImage = asset.assetType === "image";
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
                  "group relative flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-all duration-150 min-h-[64px]",
                  draggable && "cursor-grab active:cursor-grabbing",
                  selected
                    ? "border-white/50 bg-white/8"
                    : "border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/5",
                )}
              >
                <div className="shrink-0 h-10 w-10 rounded-md overflow-hidden bg-white/5 flex items-center justify-center">
                  {isImage ? (
                    <img src={asset.s3Url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <AssetIcon type={asset.assetType} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium text-white/75 truncate">{asset.name}</p>
                  <p className="text-[9px] text-white/35 capitalize">{asset.assetType}</p>
                </div>
                {selected && (
                  <Check className="h-3.5 w-3.5 text-white shrink-0" />
                )}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    void handleDelete(asset._id, asset.s3Url);
                  }}
                  disabled={deletingId === asset._id}
                  className="absolute top-1 right-1 h-5 w-5 rounded bg-black/70 text-white/60 hover:text-white items-center justify-center hidden group-hover:flex"
                >
                  {deletingId === asset._id ? (
                    <div className="h-2.5 w-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="h-2.5 w-2.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
