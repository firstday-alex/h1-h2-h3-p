"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExtractResult } from "@/lib/types";
import { analyzeNarrative, type NarrativeReport } from "@/lib/narrative";
import {
  DEFAULT_FRAMEWORKS,
  loadFrameworks,
  saveFrameworks,
  type Framework,
} from "@/lib/frameworks";
import { SettingsMenu } from "@/components/SettingsMenu";
import {
  TreeView,
  collectHeadingIds,
  headingIdsForLevels,
  availableLevels,
  hasContent,
} from "@/components/TreeView";
import { NarrativeReportView } from "@/components/NarrativeReport";
import { WritingReportView, type WritingReport } from "@/components/WritingReport";

const DEFAULT_LEVELS = [1, 2];

const EXAMPLE = "https://firstday.com/pages/tdk-behind-the-science-lp";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [report, setReport] = useState<NarrativeReport | null>(null);
  const [levels, setLevels] = useState<Set<number>>(new Set(DEFAULT_LEVELS));
  const [showContent, setShowContent] = useState(false);
  const [writing, setWriting] = useState<WritingReport | null>(null);
  const [writingLoading, setWritingLoading] = useState(false);
  const [writingError, setWritingError] = useState<string | null>(null);
  const [frameworks, setFrameworks] = useState<Framework[]>(DEFAULT_FRAMEWORKS);

  // Load the user's saved frameworks (localStorage) on mount.
  useEffect(() => {
    setFrameworks(loadFrameworks());
  }, []);

  function updateFrameworks(next: Framework[]) {
    setFrameworks(next);
    saveFrameworks(next);
  }

  const allHeadingIds = useMemo(
    () => (result ? collectHeadingIds(result.root) : []),
    [result],
  );
  const pageLevels = useMemo(
    () => (result ? availableLevels(result.root) : []),
    [result],
  );
  const pageHasContent = useMemo(
    () => (result ? hasContent(result.root) : false),
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
    setReport(null);
    setLevels(new Set(DEFAULT_LEVELS));
    setShowContent(false);
    setWriting(null);
    setWritingError(null);
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        const r = data as ExtractResult;
        setResult(r);
        // Start with H1 + H2 expanded so the outline is visible immediately.
        setExpanded(new Set(headingIdsForLevels(r.root, new Set(DEFAULT_LEVELS))));
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

  function toggleLevel(level: number) {
    setLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  function toggleGrade() {
    if (report) {
      setReport(null);
    } else if (result) {
      setReport(analyzeNarrative(result.root));
    }
  }

  async function gradeWriting() {
    if (!result) return;
    if (writing) {
      setWriting(null);
      return;
    }
    setWritingLoading(true);
    setWritingError(null);
    try {
      const res = await fetch("/api/grade-writing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          markdown: result.markdown,
          title: result.title,
          frameworks,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWritingError(data.error || "The writing grade failed.");
      } else {
        setWriting(data.report as WritingReport);
      }
    } catch {
      setWritingError("Network error — could not reach the grader.");
    } finally {
      setWritingLoading(false);
    }
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
        <div className="masthead-text">
          <h1>Copy Extractor</h1>
          <p>
            Pull the core visible copy off a page — no nav, pop-ups, or footer — grouped by
            heading and ready to expand, collapse, and copy as markdown.
          </p>
        </div>
        <SettingsMenu frameworks={frameworks} onSave={updateFrameworks} />
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
            <button
              className={`btn small grade-btn${report ? " active" : ""}`}
              onClick={toggleGrade}
            >
              {report ? "Hide flow grade" : "◇ Grade narrative flow"}
            </button>
            <button
              className={`btn small writing-btn${writing ? " active" : ""}`}
              onClick={gradeWriting}
              disabled={writingLoading}
            >
              {writingLoading ? <span className="spinner" /> : null}
              {writingLoading
                ? "Reading the copy…"
                : writing
                  ? "Hide writing grade"
                  : "✦ Grade the writing (AI)"}
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

          {report && (
            <div className="panel grade-panel">
              <NarrativeReportView report={report} />
            </div>
          )}

          {writingError && <div className="error">{writingError}</div>}

          {writing && (
            <div className="panel grade-panel writing-panel">
              <WritingReportView report={writing} />
            </div>
          )}

          {pageLevels.length > 0 && (
            <div className="levels">
              <span className="levels-label">Show levels</span>
              {pageLevels.map((lvl) => {
                const on = levels.has(lvl);
                return (
                  <button
                    key={lvl}
                    className={`level-toggle${on ? " on" : ""}`}
                    onClick={() => toggleLevel(lvl)}
                    aria-pressed={on}
                  >
                    H{lvl}
                  </button>
                );
              })}
              {pageHasContent && (
                <button
                  className={`level-toggle content-toggle${showContent ? " on" : ""}`}
                  onClick={() => setShowContent((v) => !v)}
                  aria-pressed={showContent}
                >
                  Content
                </button>
              )}
            </div>
          )}

          <div className="panel">
            <TreeView
              root={result.root}
              expanded={expanded}
              onToggle={toggle}
              levels={levels}
              showContent={showContent}
            />
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
