import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", base);

  return {
    metadataBase: base,
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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el">
      <body className={`${geistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
