import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { Analytics } from "@vercel/analytics/next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.choppr.pro";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const overusedGrotesk = localFont({
  src: [
    {
      path: "./fonts/OverusedGrotesk-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/OverusedGrotesk-Roman.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-overused-grotesk",
  display: "swap",
  fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Choppr AI - Turn Long Videos into Viral Short Clips",
    template: "%s | Choppr AI",
  },
  description:
    "Choppr AI automatically finds the best moments in any video, cuts clips, adds captions, and reframes for TikTok, Reels, and YouTube Shorts. Start free - no credit card required.",
  keywords: [
    "choppr ai",
    "choppr",
    "AI video clipper",
    "AI clip maker",
    "viral clips",
    "short form video",
    "auto captions",
    "TikTok clips",
    "YouTube Shorts",
    "Instagram Reels",
    "video editing AI",
  ],
  authors: [{ name: "Choppr AI", url: BASE_URL }],
  creator: "Choppr AI",
  publisher: "Choppr, Inc.",
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "Choppr AI",
    title: "Choppr AI - Turn Long Videos into Viral Short Clips",
    description:
      "Drop a video. Choppr AI finds the hooks, cuts clips, adds captions, and hands you content that stops the scroll.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 3182,
        height: 1900,
        alt: "Choppr AI - AI Video Clipper",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@choppr_pro",
    creator: "@choppr_pro",
    title: "Choppr AI - Turn Long Videos into Viral Short Clips",
    description:
      "Drop a video. Choppr AI finds the hooks, cuts clips, adds captions, and hands you content that stops the scroll.",
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Choppr AI",
  url: BASE_URL,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description:
    "Choppr AI automatically finds the best moments in any video, cuts clips, adds captions, and reframes for TikTok, Reels, and YouTube Shorts.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free plan available",
  },
  publisher: {
    "@type": "Organization",
    name: "Choppr AI",
    url: BASE_URL,
    logo: `${BASE_URL}/choppr_logo.png`,
    sameAs: [
      "https://x.com/choppr_pro",
      "https://www.instagram.com/choppr.pro",
      "https://www.youtube.com/@choppr-pro",
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${overusedGrotesk.variable} ${geistMono.variable} ${overusedGrotesk.className} output-scrollbar min-h-screen antialiased`}
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
