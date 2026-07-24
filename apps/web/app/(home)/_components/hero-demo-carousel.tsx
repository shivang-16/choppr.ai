"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import HeroVideoDemo from "./hero-video-demo";
import HeroCaptionDemo from "./hero-caption-demo";
import HeroReframeDemo from "./hero-reframe-demo";

const SLIDES: { id: string; label: string; render: (active: boolean) => ReactNode }[] = [
  { id: "clipping", label: "AI clipping", render: () => <HeroVideoDemo /> },
  { id: "captioning", label: "AI captioning", render: (active) => <HeroCaptionDemo active={active} /> },
  { id: "reframe", label: "AI reframe", render: (active) => <HeroReframeDemo active={active} /> },
];

const CARD_MAX = 980;
const CARD_ASPECT = 980 / 640; // width / height — locked on every screen

export default function HeroDemoCarousel() {
  const [active, setActive] = useState(0);
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

  const go = (dir: number) => {
    setActive((i) => (i + dir + SLIDES.length) % SLIDES.length);
  };

  // Card width follows the viewport; leave room on both sides for the arrows.
  // Height is derived so the ratio never changes.
  const cardW = Math.min(CARD_MAX, Math.max(stageW - 72, 240));
  const cardH = Math.round(cardW / CARD_ASPECT);
  const gap = cardW * 0.04;

  // Inner demos are authored at a fixed design size, then uniformly scaled to fit
  const DESIGN_W = 980;
  const DESIGN_H = Math.round(DESIGN_W / CARD_ASPECT); // 640
  const scale = cardW / DESIGN_W;

  return (
    <div className="relative w-full">
      <div
        ref={stageRef}
        className="relative overflow-hidden"
        style={{ height: cardH }}
      >
        {stageW > 0 &&
          SLIDES.map((slide, i) => {
            const offset = i - active;
            const isActive = offset === 0;
            const left = stageW / 2 - cardW / 2 + offset * (cardW + gap);
            return (
              <div
                key={slide.id}
                className="absolute top-0 transition-[left] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  width: cardW,
                  height: cardH,
                  left,
                  zIndex: isActive ? 20 : 10,
                  pointerEvents: isActive ? "auto" : "none",
                }}
              >
                {/* Fixed design box scaled uniformly — keeps identical proportions on every screen */}
                <div className="h-full w-full overflow-hidden">
                  <div
                    style={{
                      width: DESIGN_W,
                      height: DESIGN_H,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    {slide.render(isActive)}
                  </div>
                </div>
                {!isActive && (
                  <div className="pointer-events-none absolute inset-0 z-30 rounded-3xl bg-black/55" />
                )}
              </div>
            );
          })}

        {/* Arrows — float beside the centered card on every screen */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-center"
          style={{ height: cardH }}
        >
          <div className="relative" style={{ width: cardW || CARD_MAX }}>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous"
              className="pointer-events-auto absolute left-0 top-1/2 -translate-x-[calc(100%+8px)] -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/80 shadow-lg shadow-black/40 backdrop-blur-md transition-all hover:border-white/35 hover:bg-black/70 hover:text-white active:scale-95 sm:h-11 sm:w-11 sm:-translate-x-[calc(100%+18px)]"
            >
              <ChevronLeft className="h-[15px] w-[15px] sm:h-5 sm:w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next"
              className="pointer-events-auto absolute right-0 top-1/2 translate-x-[calc(100%+8px)] -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/80 shadow-lg shadow-black/40 backdrop-blur-md transition-all hover:border-white/35 hover:bg-black/70 hover:text-white active:scale-95 sm:h-11 sm:w-11 sm:translate-x-[calc(100%+18px)]"
            >
              <ChevronRight className="h-[15px] w-[15px] sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setActive(i)}
            aria-label={slide.label}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === active ? 20 : 6,
              backgroundColor: i === active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.18)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
