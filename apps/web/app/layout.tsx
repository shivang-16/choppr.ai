import type { Metadata } from "next";
import { Geist, Geist_Mono, Work_Sans, Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
// import { Toaster } from "@/components/ui/sonner";
// import { Analytics } from "@vercel/analytics/next";
// import { SpeedInsights } from "@vercel/speed-insights/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
        className={`${workSans.variable} ${geistSans.variable} ${geistMono.variable} ${inter.variable} output-scrollbar min-h-screen antialiased`}
      >
        <Providers>{children}</Providers>
        {/* <Analytics />
        <SpeedInsights /> */}
        {/* <Toaster richColors closeButton position="top-center" /> */}
      </body>
    </html>
  );
}
