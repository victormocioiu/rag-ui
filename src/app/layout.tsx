import type { Metadata } from "next";
import { Archivo_Black, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "hRAG — WELTSCHAU.DER.DOKUMENTE",
  description:
    "Hybrid retrieval over 512,000 documents — Postgres, BM25, vectors, a reranker, and receipts for every number.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport = {
  themeColor: "#fcfbf7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable} antialiased`}>
        {children}
        <script
          defer
          src={`${process.env.NEXT_PUBLIC_UMAMI_URL ?? "/u"}/script.js`}
          data-website-id={process.env.NEXT_PUBLIC_UMAMI_ID
            ?? "be227628-8f36-4f79-adcd-f922b8333a34"}
        />
      </body>
    </html>
  );
}
