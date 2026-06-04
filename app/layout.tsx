import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Refined display serif for the wordmark + large text.
// Variable font — omitting `weight` loads the full axis so CSS can use any value
// (the wordmark sits around 340). opsz is driven by font-optical-sizing in CSS.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

// Clean sans for UI + labels.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GoldenPixel",
  description: "A wall of art. Own your square. goldenpixel.co",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://goldenpixel.co"),
  openGraph: {
    title: "GoldenPixel",
    description: "A wall of art. Own your square.",
    url: "https://goldenpixel.co",
    siteName: "GoldenPixel",
  },
  icons: {
    // A single gold square — one literal pixel. Defined in app/icon.svg.
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
