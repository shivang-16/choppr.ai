import type { Metadata } from "next";
import MarketingPage, { RELATED, faqJsonLd } from "../../_components/marketing-page";

const faqs = [
  {
    q: "What is AI video reframe?",
    a: "AI reframe resizes a video to a new aspect ratio while keeping the subject in frame. Choppr tracks faces and action as you move between 16:9, 1:1, and 9:16, instead of a static center crop.",
  },
  {
    q: "Which aspect ratios can I export?",
    a: "9:16 for TikTok, Reels, and Shorts; 1:1 for square feeds; 16:9 for landscape. Crop presets also include 4:3 and 9:8, plus original and a custom crop.",
  },
  {
    q: "What are fill, fit, and split?",
    a: "Fill covers the frame (may crop the sides). Fit letterboxes so the whole picture stays visible. Split divides the canvas into two panes - useful for two speakers - each with its own crop.",
  },
  {
    q: "Can I override what the AI tracks?",
    a: "Yes. You can take over the crop and tell it what to follow. Split panes and the divider are adjustable too.",
  },
  {
    q: "Does reframe run without a full clipping job?",
    a: "Yes. Captions or reframe on their own cost 1 credit per minute. A clipping job is 2 credits per minute of source. Exports are 2 credits each.",
  },
  {
    q: "Will 9:16 stretch the video?",
    a: "No. Reframe crops and tracks. It does not stretch a 16:9 frame into a tall rectangle.",
  },
];

export const metadata: Metadata = {
  title: {
    absolute: "AI Video Reframe to 9:16 | Choppr",
  },
  description:
    "Reframe landscape video to 9:16, 1:1, or 16:9 with subject tracking. Fill, fit, or split layouts. Built into Choppr’s clip editor.",
  alternates: { canonical: "/features/ai-reframe" },
  openGraph: {
    title: "AI Reframe | Choppr",
    description:
      "Track faces and action while reframing to 9:16, 1:1, or 16:9. Split layouts for two speakers.",
    url: "/features/ai-reframe",
    type: "website",
  },
};

export default function AiReframePage() {
  return (
    <MarketingPage
      eyebrow="AI reframe"
      h1="Reframe to 9:16 without losing the person talking."
      sub="Choppr tracks faces and action as you move between 16:9, 1:1, and 9:16. Use fill, fit, or a split layout when two speakers share the shot."
      ctaLabel="Reframe a clip"
      demo="reframe"
      intro={[
        "A YouTube video is usually 16:9. TikTok, Reels, and Shorts are 9:16. A center crop cuts off the guest. A stretch looks cheap. Reframe is the job of keeping the subject in a new frame as the ratio changes.",
        "Choppr’s reframe is in the clip editor, not a separate app. After a clip is cut you choose the output ratio. Tracking keeps the speaker or the action in view. If the AI is wrong, you move the crop yourself.",
        "Interview and podcast clips often need more than one face. Split layout puts two crops on one vertical canvas, with a divider you can drag. That is a different problem from “make it tall,” and it is why reframe and layout live together here.",
      ]}
      stepsTitle="How reframe works on a clip"
      steps={[
        {
          title: "Open a clip in the editor",
          body: "Start from a clipping job or from a clip you already have. Layout controls sit next to captions, overlays, and speed.",
        },
        {
          title: "Pick the ratio and layout",
          body: "9:16, 1:1, or 16:9 for the output. Fill covers the frame, fit shows the whole picture, split gives two panes.",
        },
        {
          title: "Track, then override if needed",
          body: "AI tracking holds the subject. Custom crop and split-pane handles are there when you want a specific face or a tighter shot.",
        },
      ]}
      featuresTitle="Layout tools inside Choppr"
      features={[
        {
          title: "Subject tracking",
          body: "The crop follows faces and action instead of pinning the middle of a 16:9 frame forever. You can still take over.",
        },
        {
          title: "Fill, fit, split",
          body: "Three layout modes. Split is the one people look for on two-host podcasts: two independently cropped panes on one 9:16 output.",
        },
        {
          title: "Presets beyond vertical",
          body: "9:16 is the default short-form target. 1:1, 16:9, 4:3, 9:8, original, and custom crops are in the same crop panel.",
        },
        {
          title: "Same export as captions",
          body: "Reframe is part of the clip you download. You do not stitch a vertical version in another editor unless you want to.",
        },
      ]}
      audienceTitle="When reframe is the bottleneck"
      audience={[
        {
          title: "Landscape originals",
          body: "Cameras, Zoom recordings, and YouTube masters start wide. Shorts do not. Tracking is the difference between a usable vertical clip and a chopped forehead.",
        },
        {
          title: "Two people on camera",
          body: "Split layout exists for this. A single tracked crop will keep picking one speaker.",
        },
        {
          title: "You already like the cut",
          body: "If clipping is done and you only need a new ratio, reframe-only is 1 credit per minute.",
        },
      ]}
      faqs={faqs}
      related={[RELATED.captions, RELATED.podcast, RELATED.youtube, RELATED.clipMaker]}
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebPage",
            name: "AI Video Reframe to 9:16 | Choppr",
            url: "https://www.choppr.pro/features/ai-reframe",
            description:
              "Reframe video to 9:16, 1:1, or 16:9 with subject tracking, fill, fit, and split layouts.",
          },
          faqJsonLd(faqs),
        ],
      }}
    />
  );
}
