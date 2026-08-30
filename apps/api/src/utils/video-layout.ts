export interface SourceCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SplitLayout {
  mode: "split";
  axis: "vertical";
  divider: number;
  panes: [{ crop: SourceCrop }, { crop: SourceCrop }];
}

function even(n: number): number {
  return Math.max(2, Math.floor(n / 2) * 2);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Largest even 9:16 rect that fits inside w×h. */
function fitPortrait(w: number, h: number): { cw: number; ch: number; x: number; y: number } {
  const dest = 9 / 16;
  let cw: number;
  let ch: number;
  if (w / h > dest) {
    ch = even(h);
    cw = even(Math.round(h * dest));
  } else {
    cw = even(w);
    ch = even(Math.round(w / dest));
  }
  if (cw > w) { cw = even(w); ch = even(Math.round(cw / dest)); }
  if (ch > h) { ch = even(h); cw = even(Math.round(ch * dest)); }
  return {
    cw,
    ch,
    x: even(Math.round((w - cw) / 2)),
    y: even(Math.round((h - ch) / 2)),
  };
}

/** FFmpeg filter: 9:16 split stack, letterboxed into the output with blur/color. */
export function buildSplitFilter(w: number, h: number, layout: SplitLayout, fill = "blur"): string {
  const { cw, ch, x, y } = fitPortrait(w, h);
  const divider = clamp(layout.divider, 0.2, 0.8);
  const h0 = even(Math.round(ch * divider));
  const h1 = ch - h0;
  const c0 = layout.panes[0]?.crop ?? { x: 0, y: 0, w: 0.5, h: 1 };
  const c1 = layout.panes[1]?.crop ?? { x: 0.5, y: 0, w: 0.5, h: 1 };

  const cropExpr = (c: SourceCrop) =>
    `crop=trunc(iw*${c.w.toFixed(4)}/2)*2:trunc(ih*${c.h.toFixed(4)}/2)*2:trunc(iw*${c.x.toFixed(4)}/2)*2:trunc(ih*${c.y.toFixed(4)}/2)*2`;

  const stack =
    `[a]${cropExpr(c0)},scale=${cw}:${h0}:force_original_aspect_ratio=increase,crop=${cw}:${h0}[top];` +
    `[b]${cropExpr(c1)},scale=${cw}:${h1}:force_original_aspect_ratio=increase,crop=${cw}:${h1}[bot];` +
    `[top][bot]vstack=inputs=2[split]`;

  if (cw === w && ch === h) {
    return `[0:v]split=2[a][b];${stack.replace("[split]", "[out]")}`;
  }

  if (fill === "blur") {
    return (
      `[0:v]split=3[a][b][bg];${stack};` +
      `[bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},gblur=sigma=12[blurred];` +
      `[blurred][split]overlay=${x}:${y}[out]`
    );
  }

  const ffColor = fill.startsWith("#") ? fill.replace("#", "0x") : (fill === "white" ? "white" : "black");
  return `[0:v]split=2[a][b];${stack};[split]pad=${w}:${h}:${x}:${y}:${ffColor}[out]`;
}

/** FFmpeg filter: crop a source region then cover-scale into the output frame. */
export function buildFillFilter(w: number, h: number, crop: SourceCrop): string {
  const c = {
    x: clamp(crop.x, 0, 1),
    y: clamp(crop.y, 0, 1),
    w: clamp(crop.w, 0.05, 1),
    h: clamp(crop.h, 0.05, 1),
  };
  return (
    `[0:v]crop=trunc(iw*${c.w.toFixed(4)}/2)*2:trunc(ih*${c.h.toFixed(4)}/2)*2:` +
    `trunc(iw*${c.x.toFixed(4)}/2)*2:trunc(ih*${c.y.toFixed(4)}/2)*2,` +
    `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}[out]`
  );
}
