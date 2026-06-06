"use client";

import { useEffect, useRef } from "react";

export type CaptionStyle =
  | "none"
  | "word-pop"
  | "karaoke"
  | "bold-center"
  | "neon"
  | "bounce"
  | "subtitle"
  | "shadow"
  | "fire"
  | "typewriter"
  | "glitch"
  | "rainbow"
  | "outline-white"
  | "outline-black"
  | "highlight-box"
  | "wave"
  | "gradient-gold"
  | "comic"
  | "minimal-top"
  | "beasty";

export interface CaptionWord {
  word:  string;
  start: number;
  end:   number;
}

interface Props {
  videoRef:  React.RefObject<HTMLVideoElement | null>;
  words:     CaptionWord[];
  style:     CaptionStyle;
  fontSize?: number;
}

const CFG: Record<CaptionStyle, {
  weight: string;
  activeColor: string | "gradient";
  inactiveColor: string;
  bg: string | null;
  showAll: boolean;
  yRatio: number;
  glow: string | null;
  outline: { color: string; width: number } | null;
}> = {
  none:            { weight:"900", activeColor:"#fff",      inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.80, glow:null,        outline:null },
  "word-pop":      { weight:"900", activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.35)", bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:3} },
  karaoke:         { weight:"900", activeColor:"#FFE600",   inactiveColor:"rgba(255,255,255,0.5)",  bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:3} },
  "bold-center":   { weight:"900", activeColor:"#fff",      inactiveColor:"transparent",           bg:"rgba(0,0,0,0.65)",  showAll:false, yRatio:0.76, glow:null,        outline:null },
  neon:            { weight:"900", activeColor:"#00ff88",   inactiveColor:"rgba(255,255,255,0.3)",  bg:null,                showAll:true,  yRatio:0.80, glow:"#00ff88",   outline:null },
  bounce:          { weight:"900", activeColor:"#fff",      inactiveColor:"transparent",           bg:null,                showAll:false, yRatio:0.78, glow:null,        outline:{color:"#000",width:3} },
  subtitle:        { weight:"bold",activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.6)",  bg:"rgba(0,0,0,0.7)",   showAll:true,  yRatio:0.88, glow:null,        outline:null },
  shadow:          { weight:"900", activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.4)",  bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:null },
  fire:            { weight:"900", activeColor:"#FF4500",   inactiveColor:"rgba(255,165,0,0.5)",    bg:null,                showAll:true,  yRatio:0.80, glow:"#FF4500",   outline:{color:"#000",width:2} },
  typewriter:      { weight:"900", activeColor:"#00FF41",   inactiveColor:"rgba(0,255,65,0.3)",     bg:"rgba(0,0,0,0.85)",  showAll:true,  yRatio:0.80, glow:"#00FF41",   outline:null },
  glitch:          { weight:"900", activeColor:"#ff00ff",   inactiveColor:"rgba(255,255,255,0.25)", bg:null,                showAll:true,  yRatio:0.80, glow:"#ff00ff",   outline:{color:"#00ffff",width:2} },
  rainbow:         { weight:"900", activeColor:"gradient",  inactiveColor:"rgba(255,255,255,0.35)", bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:2} },
  "outline-white": { weight:"900", activeColor:"transparent",inactiveColor:"transparent",          bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#fff",width:2} },
  "outline-black": { weight:"900", activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.3)",  bg:null,                showAll:true,  yRatio:0.80, glow:null,        outline:{color:"#000",width:4} },
  "highlight-box": { weight:"900", activeColor:"#000",      inactiveColor:"rgba(255,255,255,0.5)",  bg:"#FFE600",           showAll:true,  yRatio:0.80, glow:null,        outline:null },
  wave:            { weight:"900", activeColor:"#ffffff",   inactiveColor:"rgba(255,255,255,0.3)",  bg:null,                showAll:true,  yRatio:0.82, glow:null,        outline:{color:"#000",width:3} },
  "gradient-gold": { weight:"900", activeColor:"gradient",  inactiveColor:"rgba(255,215,0,0.3)",    bg:null,                showAll:true,  yRatio:0.80, glow:"#FFD700",   outline:{color:"#000",width:2} },
  comic:           { weight:"900", activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.4)",  bg:"rgba(30,30,200,0.85)",showAll:false,yRatio:0.78, glow:null,       outline:{color:"#000",width:4} },
  "minimal-top":   { weight:"400", activeColor:"#fff",      inactiveColor:"rgba(255,255,255,0.4)",  bg:null,                showAll:true,  yRatio:0.12, glow:null,        outline:null },
  beasty:          { weight:"900", activeColor:"#FFFFFF",   inactiveColor:"rgba(255,255,255,0.0)",  bg:null,                showAll:false, yRatio:0.80, glow:null,        outline:{color:"#000",width:5} },
};

// Rainbow colors cycle
const RAINBOW = ["#FF0000","#FF7F00","#FFFF00","#00FF00","#0000FF","#8B00FF"];
// Gold gradient stops
const GOLD    = ["#FFD700","#FFA500","#FFD700","#FFFACD","#FFD700"];

export default function CaptionRenderer({ videoRef, words, style, fontSize = 28 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef(0);
  const bounceRef = useRef<Record<string, number>>({});
  const waveRef   = useRef<Record<string, number>>({});

  useEffect(() => {
    if (style === "none") return;
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cfg = CFG[style];

    const draw = () => {
      const t  = video.currentTime;
      const cw = canvas.width;
      const ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);

      const activeIdx = words.findIndex(w => t >= w.start && t < w.end);
      if (activeIdx === -1) { rafRef.current = requestAnimationFrame(draw); return; }

      const active = words[activeIdx]!;
      const fs     = fontSize * (cw / 400);
      const cx     = cw / 2;
      const cy     = ch * cfg.yRatio;

      // Window of words to display
      const windowWords = cfg.showAll
        ? words.slice(Math.max(0, activeIdx - 2), Math.min(words.length, activeIdx + 3))
        : [active];

      ctx.font = `${cfg.weight} ${fs}px system-ui,-apple-system,sans-serif`;
      const measured = windowWords.map((w, wi) => ({
        ...w,
        isActive: w.start === active.start,
        wi,
        width: ctx.measureText(w.word + " ").width,
      }));

      const totalW = measured.reduce((s, m) => s + m.width, 0);
      let x = cx - totalW / 2;

      measured.forEach((m) => {
        const isA = m.isActive;

        // Font size variants per style
        let wfs = fs;
        if (style === "word-pop"  && isA)   wfs = fs * 1.5;
        if (style === "beasty"    && isA)   wfs = fs * 1.6;
        if (style === "comic"     && isA)   wfs = fs * 1.2;
        ctx.font = `${cfg.weight} ${wfs}px system-ui,-apple-system,sans-serif`;

        // Y animation
        let drawY = cy;

        // Bounce
        if (style === "bounce" && isA) {
          const key = String(m.start);
          if (!bounceRef.current[key]) bounceRef.current[key] = Date.now();
          const el = (Date.now() - bounceRef.current[key]!) / 1000;
          drawY    = cy - Math.max(0, Math.sin(el * 14) * 24 * Math.exp(-el * 7));
        }

        // Wave — each word oscillates at slightly different phase
        if (style === "wave") {
          const phase = m.wi * 0.6;
          drawY = cy + Math.sin(Date.now() / 200 + phase) * (isA ? 12 : 6);
        }

        // Glitch offset
        let glitchX = 0;
        if (style === "glitch" && isA) {
          glitchX = Math.random() > 0.85 ? (Math.random() - 0.5) * 8 : 0;
        }

        const color = isA ? cfg.activeColor : cfg.inactiveColor;
        if (color === "transparent" && !cfg.outline) { x += m.width; return; }

        // Background pill
        if (cfg.bg && isA) {
          const pad = 14;
          const bw  = ctx.measureText(m.word).width + pad * 2;
          const bh  = wfs * 1.35;
          ctx.fillStyle = cfg.bg;
          roundRect(ctx, x - pad, drawY - wfs, bw, bh, style === "comic" ? 4 : 10);
          ctx.fill();
        }

        // Shadow (shadow style)
        if (style === "shadow") {
          ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
        }

        // Glow
        if (cfg.glow && isA) {
          ctx.shadowColor = cfg.glow; ctx.shadowBlur = 24;
        }

        // Typewriter cursor blink
        if (style === "typewriter" && isA) {
          ctx.shadowColor = "#00FF41"; ctx.shadowBlur = 16;
        }

        // Outline / stroke
        if (cfg.outline) {
          ctx.strokeStyle   = cfg.outline.color;
          ctx.lineWidth     = cfg.outline.width;
          ctx.lineJoin      = "round";
          ctx.strokeText(m.word, x + glitchX, drawY);
        }

        // Glitch second layer (cyan offset)
        if (style === "glitch" && isA) {
          ctx.fillStyle = "rgba(0,255,255,0.6)";
          ctx.fillText(m.word, x + 3, drawY - 2);
        }

        // Fill color
        if (color === "gradient") {
          // Gradient per word
          const pal   = style === "gradient-gold" ? GOLD : RAINBOW;
          const grd   = ctx.createLinearGradient(x, drawY - wfs, x + ctx.measureText(m.word).width, drawY);
          pal.forEach((c, i) => grd.addColorStop(i / (pal.length - 1), c));
          ctx.fillStyle = isA ? grd : cfg.inactiveColor;
        } else if (style === "outline-white" && isA) {
          // Outline-only — no fill, just stroke was applied above
          ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
          x += m.width; return;
        } else {
          ctx.fillStyle = isA ? color : cfg.inactiveColor;
        }

        ctx.fillText(m.word, x + glitchX, drawY);

        // Reset
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

        x += m.width;
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef, words, style, fontSize]);

  if (style === "none") return null;

  return (
    <canvas
      ref={canvasRef}
      width={1080}
      height={1920}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ objectFit: "contain" }}
    />
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
