import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Copy Extractor",
  description: "Scrape a page and extract its core visible copy as collapsible, heading-grouped markdown.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
