import type { Metadata } from "next";
import MarketingPage, { RELATED, faqJsonLd } from "../../_components/marketing-page";

const faqs = [
  {
    q: "How do I turn a YouTube video into Shorts?",
    a: "Paste the YouTube URL into Choppr, run a clipping job, then open the clips you want. Reframe each one to 9:16, add captions, and export. Upload the files to YouTube Shorts, TikTok, or Reels yourself.",
  },
  {
    q: "Do I need to download the YouTube video first?",
    a: "No. If you have the right to use that video, paste the public YouTube or youtu.be link. Choppr pulls it for processing. You can also upload an MP4 if you already have the file.",
  },
  {
    q: "Can I clip someone else’s YouTube video?",
    a: "Only if you have the rights to use it. Choppr’s terms require that you own the content or have permission. Public URL access is not a license to clip other people’s channels.",
  },
  {
    q: "What YouTube URLs work?",
    a: "youtube.com and youtu.be links, including typical watch and share URLs. Live replay links on youtube.com are also accepted by the same checker.",
  },
  {
    q: "Will the Shorts have captions?",
    a: "Yes, if you add them in the editor. Choppr transcribes speech and lets you pick a caption style, edit words, and translate before export.",
  },
  {
    q: "What size should I export for YouTube Shorts?",
    a: "Use 9:16. Choppr’s reframe tools track the speaker or action so a 16:9 YouTube original can become a vertical Short without a static center crop.",
  },
];

export const metadata: Metadata = {
  title: {
    absolute: "YouTube to Shorts Converter | Choppr AI",
  },
  description:
    "Paste a YouTube link and turn long videos into vertical Shorts. Choppr clips highlights, adds captions, and reframes to 9:16. Start free, no credit card.",
  alternates: { canonical: "/tools/youtube-to-shorts" },
  openGraph: {
    title: "YouTube to Shorts | Choppr AI",
    description:
      "Convert a YouTube video into captioned vertical clips for Shorts, TikTok, and Reels.",
    url: "/tools/youtube-to-shorts",
    type: "website",
  },
};

export default function YoutubeToShortsPage() {
  return (
    <MarketingPage
      eyebrow="YouTube to Shorts"
      h1="Paste a YouTube link. Export vertical Shorts."
      sub="Choppr pulls the video, cuts highlight clips, captions the speech, and reframes to 9:16 so a long upload can feed Shorts without a second edit from scratch."
      ctaLabel="Paste a YouTube link"
      demo="clipping"
      intro={[
        "A YouTube video already did the hard part: the conversation, the tutorial, the story. Shorts need a different object - a 30 to 60 second vertical file with a hook in the first second and captions for mute playback. Doing that by hand means downloading, marking chapters, cropping faces, and typing subtitles.",
        "The Choppr YouTube workflow is the one on the homepage: paste the link, run clipping, then finish in the editor. YouTube is a first-class source alongside X, Drive, Loom, and Instagram. You do not need a separate downloader if you have the right to use the video.",
        "Choppr does not upload the Shorts to YouTube for you. You export the file and post it on the Shorts shelf, or to TikTok and Reels, the same way you would with any other MP4.",
      ]}
      stepsTitle="YouTube URL to a 9:16 file"
      steps={[
        {
          title: "Paste the link",
          body: "Drop a youtube.com or youtu.be URL into Choppr. If you prefer a file, upload the MP4 you already exported from YouTube Studio.",
        },
        {
          title: "Clip the useful minutes",
          body: "AI finds moments that can stand alone. A 20-minute tutorial should not become twenty identical Shorts - it should become the few cuts that still make sense off the main video.",
        },
        {
          title: "Reframe and caption",
          body: "Switch the clip to 9:16, keep the speaker in frame, add a caption style, and export. Free exports are 720p. Paid plans export 1080p.",
        },
      ]}
      featuresTitle="Built for people who already publish on YouTube"
      features={[
        {
          title: "Link in, no extra downloader",
          body: "The same paste field on choppr.pro accepts YouTube URLs. Processing uses your credits against the source duration.",
        },
        {
          title: "Vertical without a dead crop",
          body: "AI reframe tracks faces and action as you go from 16:9 to 9:16. You can still take over the crop, or use split when two people share the shot.",
        },
        {
          title: "Captions for mute scroll",
          body: "Shorts fail when the joke is only in the audio. Choppr burns word-level captions you can style and correct.",
        },
        {
          title: "Keep the long video as the source of truth",
          body: "You are repurposing, not replacing the original. Clip, post the Short, and point viewers back to the full upload if you want the click-through.",
        },
      ]}
      audienceTitle="Good fits for YouTube-to-Shorts"
      audience={[
        {
          title: "Talking-head channels",
          body: "Interviews, commentary, and education convert cleanly because the value is in a sentence, not a 12-minute arc.",
        },
        {
          title: "Podcasts that already live on YouTube",
          body: "Video podcasts are the most common Choppr source in our own demos. Paste the episode, cut quotes, split the frame if needed.",
        },
        {
          title: "Creators testing a Shorts shelf",
          body: "You do not need a new production. You need a reliable way to pull vertical clips from videos you already published.",
        },
      ]}
      faqs={faqs}
      related={[RELATED.clipMaker, RELATED.podcast, RELATED.reframe, RELATED.captions]}
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebPage",
            name: "YouTube to Shorts Converter | Choppr AI",
            url: "https://www.choppr.pro/tools/youtube-to-shorts",
            description:
              "Paste a YouTube link and convert long videos into captioned 9:16 Shorts with Choppr.",
          },
          faqJsonLd(faqs),
        ],
      }}
    />
  );
}
