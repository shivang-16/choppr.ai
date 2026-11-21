import type { Metadata } from "next";
import Navbar from "./_components/navbar";
import HeroSection from "./_components/hero-section";
import LayoutDemoSection from "./_components/layout-demo-section";
import AiModelsSection from "./_components/ai-models-section";
import Footer from "./_components/footer";
import { GTA_LAUNCH_MODE, PAGE_BG } from "@/lib/gta-launch";

export const metadata: Metadata = {
  title: {
    absolute: "Choppr AI - Turn Long Videos into Viral Clips with AI",
  },
  description:
    "Choppr AI automatically finds the best moments in any video, cuts clips, adds captions, and reframes for TikTok, Reels, and YouTube Shorts. Start free - no credit card required.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Choppr AI - Turn Long Videos into Viral Clips with AI",
    description:
      "Drop a video. Choppr AI finds the hooks, cuts clips, adds captions, and hands you content that stops the scroll.",
    url: "/",
    type: "website",
  },
};

export default function Home() {
  return (
    <main
      className="relative"
      style={{ backgroundColor: PAGE_BG, ["--page-bg" as string]: GTA_LAUNCH_MODE ? "transparent" : PAGE_BG }}
    >
      {GTA_LAUNCH_MODE && (
        <>
          {/* GTA 6 launch backdrop: dimmed key-art sunset (indigo > purple > pink > warm horizon) */}
          <div
            className="pointer-events-none absolute inset-0 z-0"
            aria-hidden
            style={{
              background:
                "linear-gradient(180deg, #1a0b3a 0%, #2a1050 12%, #351458 28%, #3a1a62 44%, #531e66 58%, #5a1f5c 70%, #6a2652 80%, #703040 90%, #4a1c30 100%)",
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-full overflow-hidden" aria-hidden>
            <div className="absolute -left-40 top-[0%] h-[640px] w-[640px] rounded-full bg-[#ff4fa0]/[0.18] blur-[170px]" />
            <div className="absolute -right-44 top-[2%] h-[640px] w-[640px] rounded-full bg-[#e0409a]/[0.20] blur-[170px]" />
            <div className="absolute left-[38%] top-[-4%] h-[420px] w-[620px] rounded-full bg-[#5b6cf0]/[0.14] blur-[160px]" />
            <div className="absolute left-[10%] top-[30%] h-[560px] w-[560px] rounded-full bg-[#b23dc9]/[0.16] blur-[170px]" />
            <div className="absolute -right-32 top-[48%] h-[620px] w-[620px] rounded-full bg-[#ff4fa0]/[0.16] blur-[170px]" />
            <div className="absolute -left-32 top-[68%] h-[620px] w-[620px] rounded-full bg-[#ff6a8a]/[0.12] blur-[170px]" />
            <div className="absolute left-[20%] top-[86%] h-[560px] w-[900px] rounded-full bg-[#ff9a5a]/[0.11] blur-[170px]" />
            {/* glass sheen + vignette to keep it dark */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-white/[0.02]" />
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(6,3,20,0.55) 100%)" }} />
          </div>
        </>
      )}
      {/* Continuous page texture — no seams between sections */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
        aria-hidden
      />
      <div className="relative z-10">
        <Navbar />
        <HeroSection />
        <LayoutDemoSection />
        <AiModelsSection />
        <Footer />
      </div>
    </main>
  );
}
