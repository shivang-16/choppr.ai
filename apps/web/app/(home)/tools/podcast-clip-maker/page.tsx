import type { Metadata } from "next";
import MarketingPage, { RELATED, faqJsonLd } from "../../_components/marketing-page";

const faqs = [
  {
    q: "What is a podcast clip maker?",
    a: "A podcast clip maker turns a long episode into short vertical clips for TikTok, Reels, and YouTube Shorts. Choppr transcribes the episode, cuts highlight moments, captions the speech, and can split the frame when two hosts are on camera.",
  },
  {
    q: "Do I need a video podcast, or does audio work?",
    a: "Choppr is a video clipper. Use a video episode (YouTube, a file, Drive, Loom). Pure audio-only RSS feeds are not a source. If you record video even as a simple talking head, that is enough.",
  },
  {
    q: "Can it handle two hosts?",
    a: "Yes. After a clip is cut you can use a split layout so each speaker stays in their own pane, instead of a single crop that jumps or leaves someone off-screen.",
  },
  {
    q: "How long can an episode be?",
    a: "Free plans accept videos up to 30 minutes. Core accepts up to 2 hours per job. Growth and Scale do not cap length the same way. Credits still scale with minutes processed.",
  },
  {
    q: "Can captions match how we actually talk?",
    a: "You can edit any word on the transcript. You can also translate captions, including Hinglish, Hindi, Tamil, Telugu, and other languages supported in the caption translator.",
  },
  {
    q: "Will Choppr post clips to Instagram or TikTok?",
    a: "No. Export the MP4 and post it from those apps or your usual scheduler. Choppr stops at a finished file.",
  },
];

export const metadata: Metadata = {
  title: {
    absolute: "Podcast Clip Maker | Choppr AI",
  },
  description:
    "Turn podcast episodes into vertical clips. Choppr finds quotes, adds captions, reframes talking heads, and supports split layouts for two speakers. Start free.",
  alternates: { canonical: "/tools/podcast-clip-maker" },
  openGraph: {
    title: "Podcast Clip Maker | Choppr AI",
    description:
      "Cut podcast episodes into captioned shorts with talking-head reframe and split layouts.",
    url: "/tools/podcast-clip-maker",
    type: "website",
  },
};

export default function PodcastClipMakerPage() {
  return (
    <MarketingPage
      eyebrow="Podcast clip maker"
      h1="Turn one podcast episode into clips people can watch on mute."
      sub="Choppr cuts quotes from long video episodes, captions every word, and reframes talking heads - including split layouts when two people share the mic."
      demo="clip-prompt"
      intro={[
        "Podcast growth on social is not a trailer of the whole show. It is a single exchange that still makes sense if the viewer never hits play on the episode. That clip has to be vertical, the faces have to be readable, and the captions have to carry the joke when the phone is silenced.",
        "Choppr’s own product demos are podcast footage for a reason. The clipper is aimed at conversation: find the take, cut it clean, track the speaker, caption the line. If two people are in the shot, split layout keeps both of them instead of gambling on a single crop.",
        "Bring the episode as a YouTube URL, a Drive file, a Loom, or an upload. Process time and clip count follow your plan. Then you pick the clips that can live without the previous ten minutes of context.",
      ]}
      stepsTitle="Episode to social clip"
      steps={[
        {
          title: "Drop the episode in",
          body: "Paste the YouTube link for the video podcast, or upload the recording. Audio-only shows need a picture - even a simple dual-cam or single talking head.",
        },
        {
          title: "Cut the lines that travel",
          body: "Ask for a hot take, a laugh, or a hook, or let the default pass propose moments. Open each clip and listen once. If it needs the last segment to land, skip it.",
        },
        {
          title: "Frame the conversation",
          body: "Reframe to 9:16, use split for two hosts, style captions, fix a word if the transcript missed slang, then export.",
        },
      ]}
      featuresTitle="What podcasters actually get"
      features={[
        {
          title: "Conversation-aware clipping",
          body: "The useful unit is a complete thought, not a loud spike. Prompts help you pull laughs, takes, or a cold-open hook from the same episode.",
        },
        {
          title: "Split layout for two speakers",
          body: "Fill, fit, or split. Split is the one that matters on interview shows: each pane gets its own crop so a guest does not disappear when the host talks.",
        },
        {
          title: "Captions built for speech",
          body: "Word-level timing, dozens of styles, transcript edits, and translation. Hinglish is there if that is how your audience reads.",
        },
        {
          title: "Editor after the AI pass",
          body: "Speed, overlays, stickers, and enhance sit on the same clip. You can tighten a pause without sending the episode back through a second tool.",
        },
      ]}
      audienceTitle="Shows this is for"
      audience={[
        {
          title: "Interview and panel podcasts",
          body: "Two or more faces. Split layout and speaker-aware reframe matter more here than on a solo cam.",
        },
        {
          title: "Solo talking-head shows",
          body: "One person, 16:9 original, many shorts. Reframe to 9:16 and caption. That is the whole loop.",
        },
        {
          title: "Video podcasts already on YouTube",
          body: "If the episode is public on your channel, paste the link. No extra ingest pipeline.",
        },
      ]}
      faqs={faqs}
      related={[RELATED.youtube, RELATED.clipMaker, RELATED.reframe, RELATED.captions]}
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebPage",
            name: "Podcast Clip Maker | Choppr AI",
            url: "https://www.choppr.pro/tools/podcast-clip-maker",
            description:
              "Turn podcast video episodes into captioned vertical clips with Choppr, including split layouts for two speakers.",
          },
          faqJsonLd(faqs),
        ],
      }}
    />
  );
}
