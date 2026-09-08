import type { Metadata } from "next";
import MarketingPage, { RELATED, faqJsonLd } from "../../_components/marketing-page";

const faqs = [
  {
    q: "What are automatic video clips?",
    a: "Automatic video clips are short segments an AI cuts from a longer video without you setting every in and out point. Choppr transcribes the source, proposes clips from the strongest moments, then lets you review, caption, reframe, and export them.",
  },
  {
    q: "Will Choppr publish the clips for me?",
    a: "No. Choppr generates and finishes the files. You download them and post to TikTok, Reels, Shorts, or anywhere else. There is no in-app social scheduler.",
  },
  {
    q: "How automatic is the first pass?",
    a: "You paste a link or upload a file and start a job. Choppr finds candidate moments and cuts clips. You still choose which clips to keep, how they are captioned, and how they are framed before export.",
  },
  {
    q: "How many automatic clips do I get from one video?",
    a: "The free plan allows up to 10 clips per video. Core allows up to 30. Growth and Scale do not cap clips per video. The number of useful clips still depends on how much distinct material is in the source.",
  },
  {
    q: "Can I steer what gets clipped automatically?",
    a: "Yes. You can prompt the clipper for a type of moment - a hook, a laugh, a hot take - instead of taking a generic highlight pass.",
  },
  {
    q: "What if an automatic job fails?",
    a: "Failed jobs cost nothing. Credits for that run are refunded in full.",
  },
];

export const metadata: Metadata = {
  title: {
    absolute: "Automatic Video Clips | Choppr AI",
  },
  description:
    "Generate automatic video clips from long recordings. Choppr finds the moments, cuts shorts, adds captions, and reframes for TikTok, Reels, and Shorts. Free plan, no card.",
  alternates: { canonical: "/tools/automatic-video-clips" },
  openGraph: {
    title: "Automatic Video Clips | Choppr AI",
    description:
      "Stop scrubbing the timeline. Choppr cuts automatic clips from long videos, then you finish captions and framing.",
    url: "/tools/automatic-video-clips",
    type: "website",
  },
};

export default function AutomaticVideoClipsPage() {
  return (
    <MarketingPage
      eyebrow="Automatic video clips"
      h1="Automatic video clips from the footage you already have."
      sub="Choppr watches the long cut, proposes shorts, and leaves you an editor for captions, reframe, and export - so automation does not mean giving up the last 10%."
      demo="clipping"
      intro={[
        "“Automatic video clips” usually means one of two things. Either the tool slices the file on a clock, which wastes the good moments, or it locks you into whatever it exported, which wastes the edit. Choppr is the middle path: the first pass is automatic, the finish is yours.",
        "You start a job from a URL or an upload. Choppr reads speech and picture, cuts candidate clips, and puts them in your project. From there the work is review, not archaeology. Keep the ones that stand alone. Drop the ones that need the full episode to make sense.",
        "Credits are tied to source minutes, not a mystery token. Clipping is 2 credits per minute of the original video. Exports are 2 credits each. If you only need captions or reframe on a clip you already have, that is 1 credit per minute.",
      ]}
      stepsTitle="From long video to automatic clips"
      steps={[
        {
          title: "Start a job",
          body: "Paste a supported link or upload a file. Free plans cap source length at 30 minutes. Core goes to 2 hours. Growth and Scale take longer recordings.",
        },
        {
          title: "Review what AI cut",
          body: "Choppr returns a set of clips instead of one timeline dump. Open the ones that work. Skip the rest. Paid plans raise or remove the per-video clip cap.",
        },
        {
          title: "Export only what you will post",
          body: "Caption, reframe, and export clip by clip. You are not billed for a failed job, and unused top-up credits do not expire.",
        },
      ]}
      featuresTitle="Automatic, with the controls that matter"
      features={[
        {
          title: "No timer-based chopping",
          body: "Clips come from moments in the video, not equal slices. That is why a 40-minute talk can become a handful of usable shorts instead of 40 identical chunks.",
        },
        {
          title: "Prompt when you know the beat",
          body: "If you already know you want laughs or a product mention, say so. Automatic does not have to mean generic.",
        },
        {
          title: "Captions included in the finish",
          body: "Word-level captions are generated from the transcript. Style them, fix a word, or translate before you export - including Hinglish.",
        },
        {
          title: "Framing after the cut",
          body: "Automatic clips often start in 16:9. Reframe to 9:16 or 1:1, or use split when two people share the frame.",
        },
      ]}
      audienceTitle="When automatic clipping is the right move"
      audience={[
        {
          title: "You post every week from one long recording",
          body: "The bottleneck is not ideas. It is extracting clips before the next episode lands. Automatic first-pass clipping is for that cadence.",
        },
        {
          title: "You do not want a full NLE for shorts",
          body: "Premiere and CapCut still win for custom films. For repurposing a recording into several vertical files, an automatic clipper plus a light editor is faster.",
        },
        {
          title: "You need a free way to try the workflow",
          body: "150 monthly credits, no card, 720p export. Enough to run a real video and see whether the proposed clips are worth keeping.",
        },
      ]}
      faqs={faqs}
      related={[RELATED.clipMaker, RELATED.youtube, RELATED.podcast, RELATED.pricing]}
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebPage",
            name: "Automatic Video Clips | Choppr AI",
            url: "https://www.choppr.pro/tools/automatic-video-clips",
            description:
              "Generate automatic video clips from long recordings with Choppr. Review, caption, reframe, and export shorts.",
          },
          faqJsonLd(faqs),
        ],
      }}
    />
  );
}
