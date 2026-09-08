import type { Metadata } from "next";
import MarketingPage, { RELATED, faqJsonLd } from "../../_components/marketing-page";

const faqs = [
  {
    q: "What is an AI clip maker?",
    a: "An AI clip maker finds the strongest moments inside a long video and cuts them into short clips. Choppr transcribes the footage, proposes clips, then lets you caption, reframe, and export them for TikTok, Reels, and YouTube Shorts.",
  },
  {
    q: "Can Choppr clip any kind of video, or only podcasts?",
    a: "Choppr is built for any talking or recorded footage you can upload or paste: interviews, vlogs, explainers, webinars, and podcasts. You can also tell the clipper what to look for with a prompt, such as a hot take, a laugh, or a strong opening hook.",
  },
  {
    q: "How do I start a clip for free?",
    a: "Create an account with no credit card. The free plan includes 150 credits each month, about 1.25 hours of AI clipping, up to 10 clips per video, a 30-minute source limit, and 720p exports.",
  },
  {
    q: "What happens after the AI makes clips?",
    a: "You land in the Choppr editor. Change caption style, edit words on the transcript, reframe to 9:16 / 1:1 / 16:9, use fill, fit, or split layouts, add overlays, adjust speed, then export.",
  },
  {
    q: "Which links can I paste into the AI clip maker?",
    a: "YouTube, X / Twitter, Google Drive, Loom, and Instagram. You can also upload a video file from your computer.",
  },
  {
    q: "How do credits work for clipping?",
    a: "AI clipping costs 2 credits per minute of source video. Exporting a clip costs 2 credits. Running captions or reframe on their own costs 1 credit per minute. Failed jobs are refunded.",
  },
];

export const metadata: Metadata = {
  title: {
    absolute: "AI Clip Maker | Choppr - Shorts from Long Videos",
  },
  description:
    "Choppr is an AI clip maker that finds highlight moments, cuts shorts, adds captions, and reframes for TikTok, Reels, and YouTube Shorts. Start free, no credit card.",
  alternates: { canonical: "/tools/ai-clip-maker" },
  openGraph: {
    title: "AI Clip Maker | Choppr",
    description:
      "Paste a link or upload a file. Choppr finds the moments, cuts clips, captions them, and reframes for short-form.",
    url: "/tools/ai-clip-maker",
    type: "website",
  },
};

export default function AiClipMakerPage() {
  return (
    <MarketingPage
      eyebrow="AI clip maker"
      h1="An AI clip maker that cuts shorts you can still edit."
      sub="Paste a link or drop a file. Choppr finds the moments, cuts clips, and hands you captions, reframe, and a real editor - not a locked export."
      demo="clip-prompt"
      intro={[
        "Most people searching for an AI clip maker already have the footage. A podcast episode, a YouTube video, a loom walkthrough, an interview. The missing piece is time: watching the whole thing, marking in and out points, resizing to 9:16, and burning captions that actually match the words.",
        "Choppr is built for that job. The clipper reads the video, proposes short clips from the strongest beats, and opens each one in the same editor we use on choppr.pro - captions, layout, overlays, speed, and export. You stay in control of the cut. The AI does the first pass.",
        "It is not a social scheduler and it does not post for you. It is a clipping and finishing tool: find the moment, make it vertical, style the captions, download the file.",
      ]}
      stepsTitle="How the Choppr clip maker works"
      steps={[
        {
          title: "Bring the video in",
          body: "Paste a YouTube, X, Drive, Loom, or Instagram URL, or upload a file. Free accounts can process videos up to 30 minutes. Paid plans go longer.",
        },
        {
          title: "Let AI propose clips",
          body: "Choppr analyzes the footage and cuts highlight moments. You can steer it with a prompt - a viral hook, a laugh, a plot twist - instead of accepting random slices.",
        },
        {
          title: "Finish in the editor",
          body: "Open a clip, pick a caption style, reframe the subject, switch fill / fit / split, add stickers if you want them, then export. 720p on free, 1080p on paid plans.",
        },
      ]}
      featuresTitle="What this clip maker actually includes"
      features={[
        {
          title: "Prompted moment finding",
          body: "Ask for the beat you care about. Choppr looks through the video for hooks, laughs, takes, and emotional peaks instead of chopping on a timer.",
        },
        {
          title: "Captions that stay on the words",
          body: "Speech is transcribed into word-level captions. Change the style, edit a word on the transcript, or translate - including Hinglish and several Indian languages.",
        },
        {
          title: "Reframe and split layouts",
          body: "Move between 9:16, 1:1, and 16:9 with subject tracking. Podcast and interview clips can use a split layout so two speakers stay on screen.",
        },
        {
          title: "A timeline, not a dead end",
          body: "Overlays, stickers, speed from 0.25x to 4x, and enhance live in the same clip editor. You are not stuck with whatever the first AI pass produced.",
        },
      ]}
      audienceTitle="Who uses an AI clip maker like this"
      audience={[
        {
          title: "YouTubers",
          body: "One long upload becomes a set of Shorts. Paste the YouTube URL, review the proposed clips, caption them, and export vertical files for the Shorts shelf.",
        },
        {
          title: "Podcasters",
          body: "A full episode hides the quotes that travel. Choppr cuts talking-head clips and can split the frame when two people are on mic.",
        },
        {
          title: "Teams with recordings",
          body: "Webinars, sales calls stored on Drive, and Loom walkthroughs can become short clips without a separate editor hire for every cut.",
        },
      ]}
      faqs={faqs}
      related={[RELATED.automatic, RELATED.youtube, RELATED.podcast, RELATED.captions]}
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "SoftwareApplication",
            name: "Choppr AI Clip Maker",
            applicationCategory: "MultimediaApplication",
            operatingSystem: "Web",
            url: "https://www.choppr.pro/tools/ai-clip-maker",
            description:
              "AI clip maker that finds highlight moments, cuts shorts, adds captions, and reframes for TikTok, Reels, and YouTube Shorts.",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              description: "Free plan with 150 credits per month",
            },
            isPartOf: {
              "@type": "WebSite",
              name: "Choppr AI",
              url: "https://www.choppr.pro",
            },
          },
          faqJsonLd(faqs),
        ],
      }}
    />
  );
}
