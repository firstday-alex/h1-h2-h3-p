"use client";

import type { NarrativeReport } from "@/lib/narrative";

export function NarrativeReportView({ report }: { report: NarrativeReport }) {
  return (
    <div className="narrative">
      <div className="grade-row">
        <div className={`grade-dial band-${report.band}`}>
          <span className="grade-score">{report.score}</span>
          <span className="grade-out">/100</span>
        </div>
        <div className="grade-meta">
          <div className={`grade-label band-${report.band}`}>{report.label}</div>
          <div className="grade-sub">
            Structure grade — based only on the H1–H4 outline. Not a judgment of the
            writing itself.
          </div>
          <div className="grade-stats">
            <span>{report.metrics.headings} headings</span>
            <span>·</span>
            <span>{report.metrics.h1Count} H1</span>
            <span>·</span>
            <span>{report.metrics.jumps} level jumps</span>
            <span>·</span>
            <span>depth H{report.metrics.maxDepth || 0}</span>
          </div>
        </div>
      </div>

      <ul className="findings">
        {report.findings.map((f, i) => (
          <li key={i} className={`finding ${f.kind}`}>
            <span className="finding-icon">{f.kind === "good" ? "✓" : "!"}</span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>

      <div className="flow-head">Narrative flow</div>
      {report.flow.length === 0 ? (
        <div className="empty">No H1–H4 headings to map.</div>
      ) : (
        <div className="flow">
          {report.flow.map((n, i) => (
            <div className="flow-step" key={i}>
              {i > 0 && (
                <div
                  className={`flow-arrow${n.jump ? " jump" : ""}`}
                  style={{ marginLeft: indent(n.level) }}
                >
                  <span className="arrow-glyph">↓</span>
                  {n.jump && <span className="arrow-note">skips H{(n.jumpFrom ?? 0) + 1}</span>}
                </div>
              )}
              <div
                className={`flow-node lvl-${n.level}${n.jump ? " is-jump" : ""}`}
                style={{ marginLeft: indent(n.level) }}
              >
                <span className="flow-tag">H{n.level}</span>
                <span className="flow-text">{n.text}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function indent(level: number): number {
  return (level - 1) * 30;
}
