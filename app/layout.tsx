import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Copy Extractor",
  description: "Scrape a page and extract its core visible copy as collapsible, heading-grouped markdown.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="aurora" aria-hidden="true">
          <span className="blob blob-1" />
          <span className="blob blob-2" />
          <span className="blob blob-3" />
          <span className="grain" />
        </div>
        {children}
      </body>
    </html>
  );
}
