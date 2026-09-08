import type { Metadata } from "next";
import MarketingPage, { RELATED, faqJsonLd } from "../../_components/marketing-page";

const faqs = [
  {
    q: "Is Choppr an Opus Clip alternative?",
    a: "Yes, if what you want is an AI clipper that turns long videos into short, captioned, reframed clips in the browser. Choppr is not trying to be a copy of Opus. It is a clipping and finishing editor with prompted moment finding, captions, reframe, and a timeline.",
  },
  {
    q: "Does Choppr have ClipAnything?",
    a: "No. ClipAnything is Opus Clip’s product name. Choppr has its own prompted clipping: you can ask for a hook, a laugh, a hot take, or a similar moment, then finish the clip in the Choppr editor.",
  },
  {
    q: "Does Choppr have a virality score?",
    a: "No numbered 0–100 virality score. Choppr proposes clips from the video and lets you decide what to keep. You review in the editor instead of sorting on a score.",
  },
  {
    q: "Can Choppr auto-post to TikTok like some clippers?",
    a: "No. Choppr exports the file. You post it from TikTok, Instagram, YouTube, or your own scheduler. If native auto-post is the feature you need, Opus or another tool with a publisher may fit better.",
  },
  {
    q: "Is Choppr cheaper than Opus Clip?",
    a: "It depends on how many minutes you process. Choppr uses credits (2 per source minute for clipping, 2 per export). There is a free plan with 150 credits and no credit card. Compare live prices on both sites against your monthly minutes rather than a slogan.",
  },
  {
    q: "Who should pick Choppr instead?",
    a: "People who want prompted clipping plus a real finish: word-level captions, Hinglish and other translations, fill / fit / split reframe, overlays, and speed - then a downloaded MP4. Not people who need a mobile app or in-app social calendar as the main product.",
  },
];

export const metadata: Metadata = {
  title: {
    absolute: "Opus Clip Alternative | Choppr AI",
  },
  description:
    "Choppr is an Opus Clip alternative for AI video clipping in the browser: prompted highlights, captions, 9:16 reframe, split layouts, and a free plan. No auto-post.",
  alternates: { canonical: "/alternatives/opus-clip" },
  openGraph: {
    title: "Opus Clip Alternative | Choppr AI",
    description:
      "Compare Choppr with Opus Clip. Prompted clipping, captions, reframe, and a timeline - without claiming to be a clone.",
    url: "/alternatives/opus-clip",
    type: "website",
  },
};

export default function OpusClipAlternativePage() {
  return (
    <MarketingPage
      eyebrow="Opus Clip alternative"
      h1="An Opus Clip alternative that still lets you finish the edit."
      sub="Choppr clips long videos, captions them, and reframes to 9:16 in the browser. It is not ClipAnything, it does not auto-post, and it does not fake a virality score."
      demo="clipping"
      intro={[
        "People look for an Opus Clip alternative when the clipping pass is useful but the rest of the workflow is not. Maybe they want a lighter editor after the cut. Maybe they want caption translation that includes Hinglish. Maybe they want a free plan they can actually try without a card. Choppr is built for that shape of work.",
        "Opus Clip is the well-known AI clipper. ClipAnything, virality scoring, and a large creator footprint are their story. Choppr’s story is different on purpose: prompted moment finding, then a clip editor with captions, reframe, split layouts, overlays, and speed. You download an MP4. You post it yourself.",
        "If you need Choppr to pretend it is Opus, skip this page. If you need a clipper that does not trap you in the first AI export, keep reading and start on the free plan.",
      ]}
      stepsTitle="How a switch looks in practice"
      steps={[
        {
          title: "Same starting point",
          body: "Paste a YouTube link or upload a file, the way you would in any clipper. Choppr also accepts X, Drive, Loom, and Instagram URLs.",
        },
        {
          title: "Clips, then an editor",
          body: "Review proposed clips. Open one. Caption, reframe, split if two people are on camera, fix a word, export. That second half is the reason to switch.",
        },
        {
          title: "Post outside Choppr",
          body: "There is no Choppr social calendar. Export is the product. Use Shorts, TikTok, Reels, or whatever you already post from.",
        },
      ]}
      featuresTitle="Where Choppr is actually different"
      features={[
        {
          title: "Prompted clipping, Choppr’s own models",
          body: "Ask for a hook, a laugh, a take. We do not use Opus’s ClipAnything name or models. The clipper is Choppr’s.",
        },
        {
          title: "Captions with a translator that includes Hinglish",
          body: "Word-level styles, transcript edits, and a language list that includes Hinglish and several Indian languages - not only a Western default.",
        },
        {
          title: "Split layouts, not only a vertical crop",
          body: "Fill, fit, and split. Two-host podcasts are a first-class layout problem in Choppr, not an afterthought crop.",
        },
        {
          title: "Credits you can read",
          body: "2 credits per source minute to clip, 2 to export, 1 per minute for captions or reframe alone. Failed jobs refund. Free plan: 150 credits, 30-minute cap, 10 clips, 720p.",
        },
      ]}
      compareTitle="Choppr vs Opus Clip, without the brochure"
      compareOtherLabel="Opus Clip"
      compareRows={[
        {
          item: "Job",
          choppr: "Clip, caption, reframe, finish in a timeline, download MP4.",
          other: "Clip long videos into shorts; broader publishing and ecosystem.",
        },
        {
          item: "Moment finding",
          choppr: "Prompted clipping (hooks, laughs, takes) inside Choppr.",
          other: "ClipAnything and virality-oriented scoring are their flagship.",
        },
        {
          item: "Captions",
          choppr: "Word-level styles, transcript edit, translation including Hinglish.",
          other: "Animated captions and a mature clipper workflow.",
        },
        {
          item: "Reframe",
          choppr: "9:16 / 1:1 / 16:9, tracking, fill / fit / split.",
          other: "Vertical reframe and social-ready output.",
        },
        {
          item: "Posting",
          choppr: "Export only. You post from the platform or your scheduler.",
          other: "Publishing and scheduling exist on their plans.",
        },
        {
          item: "Try it",
          choppr: "Free plan, 150 credits / month, no credit card.",
          other: "Free or trial tiers - check their current limits and watermarks.",
        },
      ]}
      audienceTitle="Pick Choppr if this sounds like you"
      audience={[
        {
          title: "You want the editor after the AI cut",
          body: "Overlays, speed, split, transcript fixes. Not a folder of MP4s you have to reopen in CapCut every time.",
        },
        {
          title: "You record conversation",
          body: "Podcasts, interviews, webinars. Split layout and caption translation matter more than a virality number.",
        },
        {
          title: "You will post the files yourself",
          body: "If in-app auto-post is the requirement, stay on a tool that ships it. Choppr is honest about stopping at export.",
        },
      ]}
      faqs={faqs}
      related={[RELATED.clipMaker, RELATED.podcast, RELATED.captions, RELATED.pricing]}
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebPage",
            name: "Opus Clip Alternative | Choppr AI",
            url: "https://www.choppr.pro/alternatives/opus-clip",
            description:
              "Choppr as an Opus Clip alternative: prompted AI clipping, captions, reframe, and a timeline editor. No ClipAnything clone, no auto-post.",
          },
          faqJsonLd(faqs),
        ],
      }}
    />
  );
}
