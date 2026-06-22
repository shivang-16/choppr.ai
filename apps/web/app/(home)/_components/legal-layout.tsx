import Link from "next/link";
import Navbar from "./navbar";
import Footer from "./footer";

type Props = {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
};

export default function LegalLayout({ title, lastUpdated, children }: Props) {
  return (
    <main className="min-h-screen bg-[#080808]">
      <Navbar />

      <div className="relative w-full overflow-hidden pt-24 pb-8">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl px-6 py-10">
          <p className="text-[12px] text-white/35 mb-3">Last updated: {lastUpdated}</p>
          <h1 className="text-[32px] sm:text-[38px] font-bold text-white tracking-tight mb-8">
            {title}
          </h1>

          <article className="flex flex-col gap-8 text-[14px] leading-relaxed text-white/60">
            {children}
          </article>

          <div className="mt-12 pt-8 border-t border-white/8">
            <p className="text-[13px] text-white/40">
              Questions? Contact us at{" "}
              <Link href="mailto:shivang@choppr.pro" className="text-white/70 hover:text-white transition-colors">
                shivang@choppr.pro
              </Link>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[18px] font-semibold text-white/90">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export { Section };
