import type { Metadata } from "next";
import MarketingPage, { RELATED, faqJsonLd } from "../../_components/marketing-page";

const faqs = [
  {
    q: "Does Choppr generate captions automatically?",
    a: "Yes. When a clip is processed, Choppr transcribes the speech into word-level captions. You then pick a style, fix words on the transcript, or translate before you export.",
  },
  {
    q: "Can I edit a caption if the transcript is wrong?",
    a: "Yes. Captions are tied to the transcript. Change a word there and the on-screen caption updates. You are not stuck with a baked-in misspelling.",
  },
  {
    q: "What caption styles are available?",
    a: "Choppr includes animated word styles (karaoke, word pop, MrBeast-style, bounce, glitch, and more), cleaner subtitle looks, and a set of pro motion styles such as spring, liquid fill, chroma split, and glass. You can also adjust size and vertical position.",
  },
  {
    q: "Can I translate captions?",
    a: "Yes. The translator includes English, Hinglish, Hindi, Tamil, Telugu, Kannada, Malayalam, Spanish, French, German, Chinese, Japanese, Korean, Arabic, and Portuguese.",
  },
  {
    q: "Do captions cost extra credits?",
    a: "If you already clipped the video, finishing captions in the editor is part of preparing that clip for export. Running captions or reframe on their own is 1 credit per minute. Each export is 2 credits.",
  },
  {
    q: "Are captions burned into the export?",
    a: "Yes. The style you pick is rendered into the file so the clip still has captions when you post it to TikTok, Reels, or Shorts.",
  },
];

export const metadata: Metadata = {
  title: {
    absolute: "AI Captions for Shorts | Choppr",
  },
  description:
    "Add AI captions to clips with word-level timing, animated styles, transcript edits, and translation including Hinglish. Built into the Choppr editor.",
  alternates: { canonical: "/features/ai-captions" },
  openGraph: {
    title: "AI Captions | Choppr",
    description:
      "Word-level AI captions with styles, transcript edits, and translation - including Hinglish.",
    url: "/features/ai-captions",
    type: "website",
  },
};

export default function AiCaptionsPage() {
  return (
    <MarketingPage
      eyebrow="AI captions"
      h1="Captions that follow the words, not a guess."
      sub="Choppr transcribes the clip, times every word, and lets you pick a style, fix the transcript, or translate - then burns it into the export."
      ctaLabel="Caption a clip"
      demo="captions"
      intro={[
        "Short-form without captions loses the line. People scroll with the sound off. Choppr treats captions as part of the clip, not a separate subtitle file you hope the platform will display.",
        "Speech becomes a transcript with start and end times per word. That is what drives karaoke-style animation, word pop, and the quieter subtitle looks. If the model hears “there” instead of “their”, you change it on the transcript instead of re-exporting from a new tool.",
        "Translation sits next to styles. Hinglish is included because a lot of talking-head clips mix Hindi and English in the same sentence. Tamil, Telugu, and other languages are in the same panel.",
      ]}
      stepsTitle="How captions work in Choppr"
      steps={[
        {
          title: "Transcribe the clip",
          body: "After clipping, Choppr extracts speech so captions can sit on the timeline with word-level timing.",
        },
        {
          title: "Pick a style, then correct",
          body: "Choose an animated or clean look. Open the transcript if a word is wrong. Size and vertical position are adjustable.",
        },
        {
          title: "Translate if you need to",
          body: "Keep the original language or switch. Hinglish sits alongside Hindi, English, and the rest of the language list. Export with captions burned in.",
        },
      ]}
      featuresTitle="Caption tools that are actually in the editor"
      features={[
        {
          title: "Word-level timing",
          body: "Styles like karaoke and word pop only work if each word has a timestamp. That is the caption model Choppr uses, not a single block of text for the whole sentence.",
        },
        {
          title: "Animated and clean presets",
          body: "High-energy looks for Shorts, plus calmer subtitle, outline, and shadow styles when you do not want the clip to shout.",
        },
        {
          title: "Pro motion styles",
          body: "Spring pop, liquid fill, focus blur, chroma split, shimmer, glass, and the rest of the pro set animate each word from its own start time.",
        },
        {
          title: "Translation, including Hinglish",
          body: "Same captions, different reading language. Useful when the audience hears English on the mic but reads Hindi in Latin script - or the other way around.",
        },
      ]}
      audienceTitle="When captioning is the whole job"
      audience={[
        {
          title: "You already have the cut",
          body: "If the clip exists and you only need captions or a reframe, that path is priced at 1 credit per minute instead of a full clipping job.",
        },
        {
          title: "You post talking-head shorts",
          body: "The joke is in the sentence. Captions have to be readable and timed. That is this feature.",
        },
        {
          title: "You mix languages on camera",
          body: "Hinglish and Indian-language translation exist because the product is used on bilingual speech, not only US English podcasts.",
        },
      ]}
      faqs={faqs}
      related={[RELATED.reframe, RELATED.clipMaker, RELATED.podcast, RELATED.youtube]}
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebPage",
            name: "AI Captions for Shorts | Choppr",
            url: "https://www.choppr.pro/features/ai-captions",
            description:
              "Word-level AI captions with animated styles, transcript edits, and translation including Hinglish.",
          },
          faqJsonLd(faqs),
        ],
      }}
    />
  );
}
