import type { Metadata } from "next";
import Navbar from "./_components/navbar";
import HeroSection from "./_components/hero-section";
import AiModelsSection from "./_components/ai-models-section";
import Footer from "./_components/footer";

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
    <main className="relative bg-black">
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
        <AiModelsSection />
        <Footer />
      </div>
    </main>
  );
}
