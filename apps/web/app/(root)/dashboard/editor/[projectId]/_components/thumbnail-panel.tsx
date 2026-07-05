"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { X, Upload, ImageIcon, Trash2, Check, Move } from "lucide-react";
import { useApiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ThumbnailOverlay {
  imageUrl: string;
  /** 0–100: percentage X from left */
  x: number;
  /** 0–100: percentage Y from top */
  y: number;
  /** 0–100: percentage of preview width */
  width: number;
  styleId: string;
}

interface UserAsset {
  _id: string;
  name: string;
  s3Url: string;
  mimeType: string;
  assetType: string;
  createdAt: string;
}

interface ThumbnailStyle {
  id: string;
  label: string;
  description: string;
  apply: (imageUrl: string) => Partial<ThumbnailOverlay>;
}

const THUMBNAIL_STYLES: ThumbnailStyle[] = [
  {
    id: "full",
    label: "Full frame",
    description: "Covers the whole video",
    apply: (imageUrl) => ({ imageUrl, x: 0, y: 0, width: 100, styleId: "full" }),
  },
  {
    id: "top-banner",
    label: "Top banner",
    description: "Stretches across top third",
    apply: (imageUrl) => ({ imageUrl, x: 0, y: 0, width: 100, styleId: "top-banner" }),
  },
  {
    id: "bottom-banner",
    label: "Bottom banner",
    description: "Stretches across bottom third",
    apply: (imageUrl) => ({ imageUrl, x: 0, y: 67, width: 100, styleId: "bottom-banner" }),
  },
  {
    id: "corner-br",
    label: "Corner (BR)",
    description: "Bottom-right corner",
    apply: (imageUrl) => ({ imageUrl, x: 70, y: 70, width: 28, styleId: "corner-br" }),
  },
  {
    id: "corner-tl",
    label: "Corner (TL)",
    description: "Top-left corner",
    apply: (imageUrl) => ({ imageUrl, x: 2, y: 2, width: 28, styleId: "corner-tl" }),
  },
  {
    id: "center",
    label: "Center",
    description: "Centered on video",
    apply: (imageUrl) => ({ imageUrl, x: 25, y: 25, width: 50, styleId: "center" }),
  },
];

interface Props {
  onClose: () => void;
  onApply: (overlay: ThumbnailOverlay | null) => void;
  currentOverlay: ThumbnailOverlay | null;
}

export default function ThumbnailPanel({ onClose, onApply, currentOverlay }: Props) {
  const apiFetch = useApiFetch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets]             = useState<UserAsset[]>([]);
  const [uploading, setUploading]       = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<UserAsset | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>("full");
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Load user image assets
  useEffect(() => {
    setLoadingAssets(true);
    apiFetch(`${API_URL}/api/user-assets?type=image`)
      .then((r) => r.json())
      .then((data: UserAsset[]) => {
        setAssets(data);
        // If there's already an applied overlay, try to pre-select matching asset
        if (currentOverlay) {
          const match = data.find((a) => a.s3Url === currentOverlay.imageUrl);
          if (match) setSelectedAsset(match);
          if (currentOverlay.styleId) setSelectedStyle(currentOverlay.styleId);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAssets(false));
  }, []);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file (JPG, PNG, WEBP, GIF)");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        alert("Image must be under 20 MB");
        return;
      }

      setUploading(true);
      setUploadProgress(0);

      try {
        // 1. Get presigned URL
        const presignRes = await apiFetch(`${API_URL}/api/user-assets/presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mimeType: file.type,
            fileName: file.name,
            sizeBytes: file.size,
          }),
        });
        const { uploadUrl, asset } = await presignRes.json();

        // 2. Upload directly to S3 with XHR for progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 PUT failed: ${xhr.status}`)));
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(file);
        });

        // 3. Add to assets list and auto-select
        setAssets((prev) => [asset, ...prev]);
        setSelectedAsset(asset);
      } catch (err) {
        console.error("Upload failed", err);
        alert("Upload failed. Please try again.");
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [apiFetch]
  );

  const handleDeleteAsset = useCallback(
    async (asset: UserAsset) => {
      setDeletingId(asset._id);
      try {
        await apiFetch(`${API_URL}/api/user-assets/${asset._id}`, { method: "DELETE" });
        setAssets((prev) => prev.filter((a) => a._id !== asset._id));
        if (selectedAsset?._id === asset._id) {
          setSelectedAsset(null);
          onApply(null);
        }
      } catch {
        alert("Failed to delete asset");
      } finally {
        setDeletingId(null);
      }
    },
    [selectedAsset, onApply, apiFetch]
  );

  const handleApplyStyle = useCallback(
    (styleId: string) => {
      setSelectedStyle(styleId);
      if (!selectedAsset) return;
      const style = THUMBNAIL_STYLES.find((s) => s.id === styleId);
      if (!style) return;
      onApply(style.apply(selectedAsset.s3Url) as ThumbnailOverlay);
    },
    [selectedAsset, onApply]
  );

  const handleSelectAsset = useCallback(
    (asset: UserAsset) => {
      setSelectedAsset(asset);
      const style = THUMBNAIL_STYLES.find((s) => s.id === selectedStyle) ?? THUMBNAIL_STYLES[0]!;
      onApply(style.apply(asset.s3Url) as ThumbnailOverlay);
    },
    [selectedStyle, onApply]
  );

  return (
    <div className="flex flex-col w-72 shrink-0 border-l border-white/8 bg-[#141414] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 shrink-0">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-white/60" />
          <span className="text-[14px] font-semibold text-white">Thumbnail</span>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:bg-white/8 hover:text-white transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Upload area */}
        <div className="px-4 pt-4 pb-3">
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2">
            Your images
          </p>

          {/* Drop zone */}
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFileSelect(file);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-5 cursor-pointer transition-all",
              uploading
                ? "border-white/20 bg-white/5 cursor-not-allowed"
                : "border-white/12 bg-white/[0.03] hover:border-white/25 hover:bg-white/6"
            )}
          >
            {uploading ? (
              <>
                <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
                <p className="text-[11px] text-white/40">Uploading… {uploadProgress}%</p>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 text-white/30" />
                <p className="text-[12px] text-white/50 text-center">
                  Click or drag an image here
                </p>
                <p className="text-[10px] text-white/25">JPG, PNG, WEBP · max 20 MB</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Asset grid */}
        <div className="px-4 pb-3">
          {loadingAssets ? (
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="aspect-video rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <ImageIcon className="h-6 w-6 text-white/10" />
              <p className="text-[11px] text-white/25">No images yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {assets.map((asset) => (
                <div
                  key={asset._id}
                  className={cn(
                    "group relative aspect-video rounded-lg overflow-hidden border cursor-pointer transition-all",
                    selectedAsset?._id === asset._id
                      ? "border-white/60 ring-1 ring-white/30"
                      : "border-white/8 hover:border-white/25"
                  )}
                  onClick={() => handleSelectAsset(asset)}
                >
                  <img
                    src={asset.s3Url}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                  {selectedAsset?._id === asset._id && (
                    <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white drop-shadow" />
                    </div>
                  )}
                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset); }}
                    disabled={deletingId === asset._id}
                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded bg-black/70 text-white/60 hover:text-white hover:bg-black/90 items-center justify-center hidden group-hover:flex transition-colors"
                  >
                    {deletingId === asset._id
                      ? <div className="h-2.5 w-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                      : <Trash2 className="h-2.5 w-2.5" />
                    }
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Styles section — only shown when an image is selected */}
        {selectedAsset && (
          <>
            <div className="h-px bg-white/6 mx-4" />
            <div className="px-4 pt-3 pb-4">
              <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2">
                Style
              </p>
              <div className="grid grid-cols-2 gap-2">
                {THUMBNAIL_STYLES.map((style) => (
                  <StyleCard
                    key={style.id}
                    style={style}
                    imageUrl={selectedAsset.s3Url}
                    selected={selectedStyle === style.id}
                    onSelect={() => handleApplyStyle(style.id)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Position hint */}
        {currentOverlay && (
          <>
            <div className="h-px bg-white/6 mx-4" />
            <div className="px-4 py-3">
              <div className="flex items-start gap-2 rounded-xl bg-white/5 border border-white/8 px-3 py-2.5">
                <Move className="h-3.5 w-3.5 text-white/40 shrink-0 mt-0.5" />
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Drag the thumbnail directly on the video preview to reposition it
                </p>
              </div>
            </div>
          </>
        )}

        {/* Remove thumbnail */}
        {currentOverlay && (
          <div className="px-4 pb-4">
            <button
              onClick={() => onApply(null)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent px-4 py-2.5 text-[12px] text-white/40 hover:bg-white/6 hover:text-white/70 hover:border-white/20 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove thumbnail
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Style card preview ───────────────────────────────────────────────────────
function StyleCard({
  style,
  imageUrl,
  selected,
  onSelect,
}: {
  style: ThumbnailStyle;
  imageUrl: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const overlay = style.apply(imageUrl);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-start rounded-lg overflow-hidden border transition-all text-left",
        selected
          ? "border-white/50 ring-1 ring-white/20"
          : "border-white/8 hover:border-white/25"
      )}
    >
      {/* Mini video preview with overlay positioned */}
      <div className="relative w-full aspect-video bg-[#1e1e1e] overflow-hidden">
        {/* Simulated video background */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/2" />
        {/* Overlay preview */}
        <StylePreviewOverlay overlay={overlay} styleId={style.id} />
        {selected && (
          <div className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-white flex items-center justify-center">
            <Check className="h-2 w-2 text-black" />
          </div>
        )}
      </div>
      <div className="px-1.5 py-1.5 bg-[#1a1a1a] w-full">
        <p className="text-[9px] font-medium text-white/60 truncate">{style.label}</p>
        <p className="text-[8px] text-white/30 truncate">{style.description}</p>
      </div>
    </button>
  );
}

function StylePreviewOverlay({
  overlay,
  styleId,
}: {
  overlay: Partial<ThumbnailOverlay>;
  styleId: string;
}) {
  const x     = overlay.x     ?? 0;
  const y     = overlay.y     ?? 0;
  const width = overlay.width ?? 100;

  const heightMap: Record<string, string> = {
    full:          "100%",
    "top-banner":  "33%",
    "bottom-banner": "33%",
    "corner-br":   "auto",
    "corner-tl":   "auto",
    center:        "auto",
  };

  return (
    <div
      style={{
        position: "absolute",
        left:     `${x}%`,
        top:      `${y}%`,
        width:    `${width}%`,
        height:   heightMap[styleId] ?? "auto",
        aspectRatio: heightMap[styleId] === "auto" ? "16/9" : undefined,
      }}
    >
      <img
        src={overlay.imageUrl}
        alt=""
        className="w-full h-full object-cover"
        draggable={false}
      />
    </div>
  );
}
