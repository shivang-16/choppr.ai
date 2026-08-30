export type VideoLayoutMode = "fill" | "fit" | "split";

export interface SourceCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SplitPane {
  crop: SourceCrop;
}

export interface SplitLayout {
  mode: "split";
  axis: "vertical";
  divider: number;
  panes: [SplitPane, SplitPane];
}

export const CROP_PRESETS = [
  { id: "custom",   label: "Custom",   aspect: null },
  { id: "original", label: "Original", aspect: "original" as const },
  { id: "9:16",     label: "9:16",     aspect: 9 / 16 },
  { id: "1:1",      label: "1:1",      aspect: 1 },
  { id: "16:9",     label: "16:9",     aspect: 16 / 9 },
  { id: "4:3",      label: "4:3",      aspect: 4 / 3 },
  { id: "9:8",      label: "9:8",      aspect: 9 / 8 },
] as const;

export type CropPresetId = (typeof CROP_PRESETS)[number]["id"];

export function aspectRatioToPair(aspectRatio: string): [number, number] {
  if (aspectRatio === "16:9") return [16, 9];
  if (aspectRatio === "1:1") return [1, 1];
  if (aspectRatio === "4:3") return [4, 3];
  return [9, 16];
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function clampCrop(c: SourceCrop): SourceCrop {
  const w = clamp(c.w, 0.05, 1);
  const h = clamp(c.h, 0.05, 1);
  return {
    x: clamp(c.x, 0, 1 - w),
    y: clamp(c.y, 0, 1 - h),
    w,
    h,
  };
}

/** Crop that covers `destAspect` (width/height) on a source of size srcW×srcH. */
export function coverCrop(srcW: number, srcH: number, destAspect: number, anchorX = 0.5): SourceCrop {
  const srcAspect = srcW / Math.max(srcH, 1);
  let w: number;
  let h: number;
  if (srcAspect > destAspect) {
    h = 1;
    w = destAspect / srcAspect;
  } else {
    w = 1;
    h = srcAspect / destAspect;
  }
  return clampCrop({
    x: clamp(anchorX - w / 2, 0, 1 - w),
    y: (1 - h) / 2,
    w,
    h,
  });
}

export function createDefaultSplitLayout(
  srcW: number,
  srcH: number,
  outW: number,
  outH: number,
): SplitLayout {
  const divider = 0.5;
  const paneAspect = outW / Math.max(outH * divider, 1);
  const left = coverCrop(srcW, srcH, paneAspect, 0.25);
  const right = coverCrop(srcW, srcH, paneAspect, 0.75);
  return {
    mode: "split",
    axis: "vertical",
    divider,
    panes: [{ crop: left }, { crop: right }],
  };
}

export function panCrop(crop: SourceCrop, dx: number, dy: number): SourceCrop {
  return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
}

export function paneRects(height: number, divider: number): [{ y: number; h: number }, { y: number; h: number }] {
  const h0 = Math.round(height * clamp(divider, 0.2, 0.8));
  return [
    { y: 0, h: h0 },
    { y: h0, h: height - h0 },
  ];
}

export function sourceCropPixels(crop: SourceCrop, srcW: number, srcH: number) {
  return {
    sx: crop.x * srcW,
    sy: crop.y * srcH,
    sw: Math.max(1, crop.w * srcW),
    sh: Math.max(1, crop.h * srcH),
  };
}

export function isSplitLayout(value: unknown): value is SplitLayout {
  if (!value || typeof value !== "object") return false;
  const v = value as SplitLayout;
  return v.mode === "split" && Array.isArray(v.panes) && v.panes.length === 2;
}

export function isSourceCrop(value: unknown): value is SourceCrop {
  if (!value || typeof value !== "object") return false;
  const v = value as SourceCrop;
  return [v.x, v.y, v.w, v.h].every(n => typeof n === "number" && Number.isFinite(n));
}
