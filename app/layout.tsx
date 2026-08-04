import type { Metadata } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://pmsc-ai-calendar-2026-27.apfivos.chatgpt.site";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const socialImage = new URL(`${basePath}/og.png`, siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "PMSc AI for Digital Transformation | Academic Calendar 2026–27",
  description:
    "Το διαδραστικό ακαδημαϊκό ημερολόγιο του PMSc Artificial Intelligence for Digital Transformation για το 2026–27.",
  openGraph: {
    title: "PMSc AI for Digital Transformation",
    description: "Academic Calendar 2026–27 — μαθήματα, εξετάσεις και αργίες σε μία προβολή.",
    images: [{ url: socialImage, width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PMSc AI for Digital Transformation",
    description: "Academic Calendar 2026–27",
    images: [socialImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el">
      <body>{children}</body>
    </html>
  );
}
