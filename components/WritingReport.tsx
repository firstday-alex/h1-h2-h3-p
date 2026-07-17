"use client";

export interface WritingReport {
  verdict: string;
  score: number;
  band: "easy" | "clear" | "moderate" | "choppy" | "hard";
  dimensions: Array<{ name: string; score: number; assessment: string; evidence: string }>;
  framework: { detected: string; adherence: number; assessment: string; evidence: string };
  strengths: string[];
  issues: string[];
}

const LABELS: Record<WritingReport["band"], string> = {
  easy: "Easy to follow",
  clear: "Mostly clear",
  moderate: "Moderate",
  choppy: "Choppy",
  hard: "Hard to follow",
};

export function WritingReportView({ report }: { report: WritingReport }) {
  return (
    <div className="narrative">
      <div className="grade-row">
        <div className={`grade-dial band-${report.band}`}>
          <span className="grade-score">{report.score}</span>
          <span className="grade-out">/100</span>
        </div>
        <div className="grade-meta">
          <div className={`grade-label band-${report.band}`}>{LABELS[report.band]}</div>
          <div className="grade-sub">
            AI reading of the actual copy (Claude). Grounded in the text — quotes are pulled
            verbatim from the page.
          </div>
          <div className="verdict">{report.verdict}</div>
        </div>
      </div>

      <div className={`framework-card${report.framework.detected.toLowerCase() === "none" ? " none" : ""}`}>
        <div className="framework-head">
          <span className="framework-tag">Narrative framework</span>
          <span className="framework-name">{report.framework.detected}</span>
          {report.framework.detected.toLowerCase() !== "none" && (
            <span className={`framework-adherence ${scoreClass(report.framework.adherence)}`}>
              {report.framework.adherence}
              <span className="fa-out">/100 fit</span>
            </span>
          )}
        </div>
        <div className="framework-assessment">{report.framework.assessment}</div>
        {report.framework.evidence && (
          <div className="dim-evidence">“{report.framework.evidence}”</div>
        )}
      </div>

      <div className="dims">
        {report.dimensions.map((d, i) => (
          <div className="dim" key={i}>
            <div className="dim-head">
              <span className="dim-name">{d.name}</span>
              <span className={`dim-score ${scoreClass(d.score)}`}>{d.score}</span>
            </div>
            <div className="dim-assessment">{d.assessment}</div>
            {d.evidence && <div className="dim-evidence">“{d.evidence}”</div>}
          </div>
        ))}
      </div>

      <div className="lists">
        {report.strengths.length > 0 && (
          <div className="list-col">
            <div className="list-title good">Strengths</div>
            <ul>
              {report.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {report.issues.length > 0 && (
          <div className="list-col">
            <div className="list-title warn">Issues</div>
            <ul>
              {report.issues.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function scoreClass(score: number): string {
  if (score >= 80) return "s-good";
  if (score >= 55) return "s-mid";
  return "s-low";
}
