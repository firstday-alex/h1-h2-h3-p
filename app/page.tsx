"use client";

import { useMemo, useState } from "react";
import type { ExtractResult } from "@/lib/types";
import { TreeView, collectHeadingIds } from "@/components/TreeView";

const EXAMPLE = "https://firstday.com/pages/tdk-behind-the-science-lp";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const allHeadingIds = useMemo(
    () => (result ? collectHeadingIds(result.root) : []),
    [result],
  );

  async function scrape(target: string) {
    const trimmed = target.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setExpanded(new Set());
    setCopied(false);
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setResult(data as ExtractResult);
      }
    } catch {
      setError("Network error — could not reach the scraper.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(allHeadingIds));
  }
  function collapseAll() {
    setExpanded(new Set());
  }

  async function copyMarkdown() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access was blocked by the browser.");
    }
  }

  function downloadMarkdown() {
    if (!result) return;
    const blob = new Blob([result.markdown], { type: "text/markdown" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${slug(result.title)}.md`;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <main className="wrap">
      <div className="masthead">
        <h1>Copy Extractor</h1>
        <p>
          Pull the core visible copy off a page — no nav, pop-ups, or footer — grouped by
          heading and ready to expand, collapse, and copy as markdown.
        </p>
      </div>

      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          scrape(url);
        }}
      >
        <input
          type="url"
          placeholder="https://example.com/page"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          spellCheck={false}
        />
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? "Scraping…" : "Extract copy"}
        </button>
      </form>
      <div className="hint">
        Try the example:{" "}
        <button
          type="button"
          onClick={() => {
            setUrl(EXAMPLE);
            scrape(EXAMPLE);
          }}
        >
          {EXAMPLE}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="results">
          <div className="summary">
            <span className="chip title-chip">
              <b>{result.title}</b>
            </span>
            <span className="chip">
              source: <b>{result.container}</b>
            </span>
            <span className="chip">
              <b>{result.stats.headings}</b> headings
            </span>
            <span className="chip">
              <b>{result.stats.paragraphs}</b> paragraphs
            </span>
            <span className="chip">
              <b>{result.stats.links}</b> links
            </span>
            <span className="chip">
              <b>{result.stats.buttons}</b> buttons
            </span>
            {result.stats.lists > 0 && (
              <span className="chip">
                <b>{result.stats.lists}</b> list items
              </span>
            )}
            {result.stats.buybox > 0 && (
              <span className="chip">
                <b>{result.stats.buybox}</b> buy-box
              </span>
            )}
            {result.stats.other > 0 && (
              <span className="chip">
                <b>{result.stats.other}</b> other
              </span>
            )}
          </div>

          <div className="toolbar">
            <button className="btn small" onClick={expandAll}>
              Expand all
            </button>
            <button className="btn small" onClick={collapseAll}>
              Collapse all
            </button>
            <span className="spacer" />
            <button className="btn small" onClick={copyMarkdown}>
              Copy markdown
            </button>
            <button className="btn small" onClick={downloadMarkdown}>
              Download .md
            </button>
            {copied && <span className="copied">✓ Copied</span>}
          </div>

          <div className="panel">
            <TreeView root={result.root} expanded={expanded} onToggle={toggle} />
          </div>

          <div className="md-head">
            <h2>Raw markdown</h2>
            <span className="hint">Copy/paste into any tool.</span>
          </div>
          <textarea className="raw" readOnly value={result.markdown} />
        </div>
      )}
    </main>
  );
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "extracted-copy"
  );
}
