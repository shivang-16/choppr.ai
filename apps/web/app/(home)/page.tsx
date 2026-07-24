import Navbar from "./_components/navbar";
import HeroSection from "./_components/hero-section";
import AiModelsSection from "./_components/ai-models-section";
import Footer from "./_components/footer";

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
