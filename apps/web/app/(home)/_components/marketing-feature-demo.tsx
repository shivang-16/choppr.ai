"use client";

import { useEffect, useRef, useState } from "react";
import HeroVideoDemo from "./hero-video-demo";
import HeroCaptionDemo from "./hero-caption-demo";
import { ClipVisual, ReframeVisual } from "./ai-models-section";

export type MarketingDemoKind = "clipping" | "clip-prompt" | "captions" | "reframe";

const DESIGN_W = 980;
const DESIGN_H = 640;
const CARD_MAX = 1080;

function ScaledHeroDemo({ children }: { children: React.ReactNode }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageW, setStageW] = useState(0);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cardW = Math.min(CARD_MAX, Math.max(stageW, 240));
  const cardH = Math.round(cardW / (DESIGN_W / DESIGN_H));
  const scale = cardW / DESIGN_W;

  return (
    <div ref={stageRef} className="relative w-full" style={{ height: stageW > 0 ? cardH : undefined }}>
      {stageW > 0 && (
        <div className="mx-auto overflow-hidden" style={{ width: cardW, height: cardH }}>
          <div
            style={{
              width: DESIGN_W,
              height: DESIGN_H,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketingFeatureDemo({ kind }: { kind: MarketingDemoKind }) {
  if (kind === "reframe") {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="relative h-[300px] overflow-hidden rounded-3xl border border-white/8 bg-[#0e0e0f] sm:h-[320px]">
          <ReframeVisual />
        </div>
      </div>
    );
  }

  if (kind === "clip-prompt") {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="relative h-[300px] overflow-hidden rounded-3xl border border-white/8 bg-[#0e0e0f] sm:h-[320px]">
          <ClipVisual />
        </div>
      </div>
    );
  }

  if (kind === "captions") {
    return (
      <ScaledHeroDemo>
        <HeroCaptionDemo active />
      </ScaledHeroDemo>
    );
  }

  return (
    <ScaledHeroDemo>
      <HeroVideoDemo />
    </ScaledHeroDemo>
  );
}
