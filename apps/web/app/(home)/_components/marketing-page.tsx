import Link from "next/link";
import Navbar from "./navbar";
import Footer from "./footer";
import StartClipCta from "./start-clip-cta";
import MarketingFeatureDemo from "./marketing-feature-demo";

export type MarketingFaq = {
  q: string;
  a: string;
};

export type MarketingStep = {
  title: string;
  body: string;
};

export type MarketingFeature = {
  title: string;
  body: string;
};

export type MarketingPerson = {
  title: string;
  body: string;
};

export type MarketingRelated = {
  href: string;
  label: string;
  desc: string;
};

export type MarketingCompareRow = {
  item: string;
  choppr: string;
  other: string;
};

export type MarketingPageProps = {
  eyebrow: string;
  h1: string;
  sub: string;
  intro: string[];
  stepsTitle: string;
  steps: MarketingStep[];
  featuresTitle: string;
  features: MarketingFeature[];
  audienceTitle?: string;
  audience?: MarketingPerson[];
  compareTitle?: string;
  compareOtherLabel?: string;
  compareRows?: MarketingCompareRow[];
  faqs: MarketingFaq[];
  related: MarketingRelated[];
  demo: "clipping" | "clip-prompt" | "captions" | "reframe";
  ctaLabel?: string;
  jsonLd: Record<string, unknown>;
};

export const RELATED = {
  clipMaker: {
    href: "/tools/ai-clip-maker",
    label: "AI clip maker",
    desc: "Find highlight moments and cut shorts in one pass.",
  },
  automatic: {
    href: "/tools/automatic-video-clips",
    label: "Automatic video clips",
    desc: "Let Choppr pick, cut, and prepare clips for you.",
  },
  youtube: {
    href: "/tools/youtube-to-shorts",
    label: "YouTube to Shorts",
    desc: "Paste a YouTube link and export vertical clips.",
  },
  podcast: {
    href: "/tools/podcast-clip-maker",
    label: "Podcast clip maker",
    desc: "Turn long episodes into talking-head shorts.",
  },
  captions: {
    href: "/features/ai-captions",
    label: "AI captions",
    desc: "Word-level styles, edits, and translations.",
  },
  reframe: {
    href: "/features/ai-reframe",
    label: "AI reframe",
    desc: "Track subjects into 9:16, 1:1, or 16:9.",
  },
  opus: {
    href: "/alternatives/opus-clip",
    label: "Opus Clip alternative",
    desc: "Compare Choppr with Opus on clipping and editing.",
  },
  pricing: {
    href: "/pricing",
    label: "Pricing",
    desc: "Free plan included. Credits scale as you clip more.",
  },
} as const;

const PAGE_NOISE =
  `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`;

export default function MarketingPage(props: MarketingPageProps) {
  return (
    <main className="relative bg-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(props.jsonLd) }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.015]"
        style={{
          backgroundImage: PAGE_NOISE,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
        aria-hidden
      />
      <div className="relative z-10">
        <Navbar />

        <section className="relative flex flex-col items-center overflow-hidden px-4 pt-36 sm:pt-40 pb-10 sm:pb-12">
          <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
            <div className="absolute left-1/2 top-1/3 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.015] blur-[120px]" />
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center gap-6 text-center">
            <p className="text-[14px] font-semibold tracking-[0.18em] uppercase text-white/70">
              {props.eyebrow}
            </p>
            <h1 className="text-[2.15rem] sm:text-[clamp(2.3rem,4vw,3.4rem)] leading-[1.1] tracking-[-0.02em] text-white">
              {props.h1}
            </h1>
            <p className="max-w-xl text-[clamp(0.95rem,1.8vw,1.05rem)] font-normal leading-relaxed text-white/50">
              {props.sub}
            </p>
            <StartClipCta primaryLabel={props.ctaLabel} />
          </div>
        </section>

        <section className="px-4 pb-16 sm:pb-20">
          <div className="mx-auto w-full max-w-6xl">
            <MarketingFeatureDemo kind={props.demo} />
          </div>
        </section>

        <section className="px-4 pb-16 sm:pb-20">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {props.intro.map((p) => (
              <p
                key={p.slice(0, 40)}
                className="text-[15.5px] leading-[1.75] text-white/58"
              >
                {p}
              </p>
            ))}
          </div>
        </section>

        <section className="px-4 pb-16 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.15] tracking-[-0.02em] text-white">
              {props.stepsTitle}
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {props.steps.map((step, i) => (
                <div
                  key={step.title}
                  className="rounded-3xl border border-white/8 bg-[#0e0e0f] px-6 py-7"
                >
                  <p className="text-[12px] font-semibold tracking-[0.14em] uppercase text-white/35">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-3 text-[1.2rem] font-semibold tracking-[-0.02em] text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-[14.5px] leading-[1.65] text-white/50">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.15] tracking-[-0.02em] text-white">
              {props.featuresTitle}
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {props.features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-3xl border border-white/8 bg-[#0e0e0f] px-6 py-7"
                >
                  <h3 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2.5 text-[14.5px] leading-[1.65] text-white/50">
                    {feature.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {props.audience && props.audience.length > 0 && (
          <section className="px-4 pb-16 sm:pb-24">
            <div className="mx-auto max-w-6xl">
              <h2 className="text-center text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.15] tracking-[-0.02em] text-white">
                {props.audienceTitle}
              </h2>
              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {props.audience.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-3xl border border-white/8 bg-[#0e0e0f] px-6 py-7"
                  >
                    <h3 className="text-[1.1rem] font-semibold tracking-[-0.02em] text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2.5 text-[14.5px] leading-[1.65] text-white/50">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {props.compareRows && props.compareRows.length > 0 && (
          <section className="px-4 pb-16 sm:pb-24">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-center text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.15] tracking-[-0.02em] text-white">
                {props.compareTitle}
              </h2>
              <div className="mt-10 overflow-x-auto rounded-3xl border border-white/8 bg-[#0e0e0f]">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="px-5 py-4 text-[12px] font-semibold uppercase tracking-widest text-white/40">
                        What you need
                      </th>
                      <th className="px-5 py-4 text-[12px] font-semibold uppercase tracking-widest text-white/80">
                        Choppr
                      </th>
                      <th className="px-5 py-4 text-[12px] font-semibold uppercase tracking-widest text-white/40">
                        {props.compareOtherLabel}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.compareRows.map((row) => (
                      <tr key={row.item} className="border-b border-white/6 last:border-0">
                        <td className="px-5 py-4 text-[13.5px] font-medium text-white/75 align-top">
                          {row.item}
                        </td>
                        <td className="px-5 py-4 text-[13.5px] leading-relaxed text-white/70 align-top">
                          {row.choppr}
                        </td>
                        <td className="px-5 py-4 text-[13.5px] leading-relaxed text-white/40 align-top">
                          {row.other}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <section className="px-4 pb-16 sm:pb-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.15] tracking-[-0.02em] text-white">
              Common questions
            </h2>
            <div className="mt-10 flex flex-col gap-3">
              {props.faqs.map((faq) => (
                <div
                  key={faq.q}
                  className="rounded-2xl border border-white/6 bg-[#0d0d0d] px-5 py-4"
                >
                  <h3 className="text-[14.5px] font-semibold text-white/85">{faq.q}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/45">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-[clamp(1.4rem,2.6vw,1.8rem)] leading-[1.15] tracking-[-0.02em] text-white">
              Related
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {props.related.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border border-white/8 bg-[#0e0e0f] px-5 py-5 transition-colors hover:border-white/16 hover:bg-white/[0.04]"
                >
                  <p className="text-[14px] font-semibold text-white">{item.label}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">
                    {item.desc}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 sm:pb-32">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
            <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.15] tracking-[-0.02em] text-white">
              Start with a free clip
            </h2>
            <p className="text-[15px] leading-relaxed text-white/50">
              150 credits each month. No card. Export at 720p on the free plan.
            </p>
            <StartClipCta />
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}

export function faqJsonLd(faqs: MarketingFaq[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };
}
