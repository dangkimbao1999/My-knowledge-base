import type { Metadata } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Mono } from "next/font/google";
import { env } from "@/config/env";
import { MathJaxScript } from "@/components/markdown/mathjax-script";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"]
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-mono",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "Second Brain Journal",
  description: "Bao's Journaling, sharing, inspiring, and learning",
  metadataBase: new URL(env.APP_URL),
  openGraph: {
    title: "Second Brain Journal",
    description: "Bao's Journaling, sharing, inspiring, and learning",
    siteName: "Second Brain Journal",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Second Brain Journal",
    description: "Bao's Journaling, sharing, inspiring, and learning"
  },
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${beVietnamPro.variable} ${ibmPlexMono.variable}`}>
        <MathJaxScript />
        {children}
      </body>
    </html>
  );
}
