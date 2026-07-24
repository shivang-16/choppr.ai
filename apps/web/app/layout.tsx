import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { Analytics } from "@vercel/analytics/next";

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
  title: "Choppr | AI Video Clipper for Viral Content Creation",
  description:
    "Choppr AI helps you analyze videos with AI. Gain instant insights, detect issues, and improve video quality with intelligent analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${overusedGrotesk.variable} ${geistMono.variable} ${overusedGrotesk.className} output-scrollbar min-h-screen antialiased`}
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
