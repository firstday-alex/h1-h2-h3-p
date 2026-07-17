import type { HeadingNode, RootNode } from "./types";

// A deterministic, explainable read of how easy a page's *heading outline* is to
// follow. Deliberately NOT an AI/semantic judgment — every point is derived from
// the H1–H4 structure and each deduction is spelled out, so the grade is
// transparent and reproducible.

export interface FlowItem {
  level: 1 | 2 | 3 | 4;
  text: string;
  /** True when this heading skips a level vs. the previous one (e.g. H1 → H3). */
  jump: boolean;
  /** The level we jumped from, when `jump` is true (for the "skips H2" note). */
  jumpFrom?: number;
}

export interface Finding {
  kind: "good" | "warn";
  text: string;
}

export type Band = "easy" | "clear" | "moderate" | "choppy" | "hard";

export interface NarrativeReport {
  score: number; // 0–100
  band: Band;
  label: string;
  flow: FlowItem[];
  findings: Finding[];
  metrics: {
    headings: number;
    h1Count: number;
    topLevelSections: number;
    jumps: number;
    longHeadings: number;
    maxDepth: number;
    firstLevel: number;
  };
}

const MAX_LEVEL = 4;
const LONG_HEADING_WORDS = 12;

/** Flatten the heading tree into reading order (pre-order), keeping only H1–H4. */
function flatten(root: RootNode): Array<{ level: 1 | 2 | 3 | 4; text: string }> {
  const out: Array<{ level: 1 | 2 | 3 | 4; text: string }> = [];
  const visit = (node: HeadingNode) => {
    if (node.level <= MAX_LEVEL) {
      out.push({ level: node.level as 1 | 2 | 3 | 4, text: stripInline(node.text) });
    }
    node.children.forEach(visit);
  };
  root.children.forEach(visit);
  return out;
}

/** Remove markdown emphasis so the flow reads cleanly. */
function stripInline(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

export function analyzeNarrative(root: RootNode): NarrativeReport {
  const headings = flatten(root);

  // --- Build the flow with jump detection -----------------------------------
  const flow: FlowItem[] = headings.map((h, i) => {
    const prev = headings[i - 1];
    const jump = !!prev && h.level > prev.level + 1;
    return { level: h.level, text: h.text, jump, jumpFrom: jump ? prev.level : undefined };
  });

  // --- Metrics ----------------------------------------------------------------
  const h1Count = headings.filter((h) => h.level === 1).length;
  const topLevelSections = root.children.filter((c) => c.level <= MAX_LEVEL).length;
  const jumps = flow.filter((f) => f.jump).length;
  const longHeadings = headings.filter((h) => wordCount(h.text) > LONG_HEADING_WORDS).length;
  const maxDepth = headings.reduce((m, h) => Math.max(m, h.level), 0);
  const firstLevel = headings.length ? headings[0].level : 0;

  // --- Score (start at 100, deduct with explanations) -------------------------
  let score = 100;
  const findings: Finding[] = [];

  if (headings.length === 0) {
    return {
      score: 0,
      band: "hard",
      label: "No headings",
      flow,
      findings: [{ kind: "warn", text: "This page has no H1–H4 headings, so there's no outline to follow." }],
      metrics: { headings: 0, h1Count, topLevelSections, jumps, longHeadings, maxDepth, firstLevel },
    };
  }

  if (jumps > 0) {
    const d = Math.min(jumps * 10, 30);
    score -= d;
    findings.push({
      kind: "warn",
      text: `${jumps} abrupt jump${jumps > 1 ? "s" : ""} in heading levels (e.g. an H1 straight to an H3). Readers lose the thread when a level is skipped.`,
    });
  } else {
    findings.push({ kind: "good", text: "Heading levels step down one at a time — nothing is skipped." });
  }

  if (h1Count === 0) {
    score -= 15;
    findings.push({ kind: "warn", text: "No H1 — there's no single title to anchor the story." });
  } else if (h1Count === 1) {
    findings.push({ kind: "good", text: "One clear H1 sets the main topic." });
  } else {
    const d = Math.min((h1Count - 1) * 6, 18);
    score -= d;
    findings.push({
      kind: "warn",
      text: `${h1Count} H1s — multiple top-level topics can split the narrative into competing stories.`,
    });
  }

  if (topLevelSections > 8) {
    const d = Math.min((topLevelSections - 8) * 3, 15);
    score -= d;
    findings.push({
      kind: "warn",
      text: `${topLevelSections} top-level sections — that's a lot to hold in mind at once.`,
    });
  } else if (topLevelSections >= 2 && topLevelSections <= 6) {
    findings.push({ kind: "good", text: `${topLevelSections} top-level sections — an easy number to scan.` });
  }

  if (longHeadings > 0) {
    const d = Math.min(longHeadings * 3, 12);
    score -= d;
    findings.push({
      kind: "warn",
      text: `${longHeadings} long heading${longHeadings > 1 ? "s" : ""} (over ${LONG_HEADING_WORDS} words) — harder to skim at a glance.`,
    });
  } else {
    findings.push({ kind: "good", text: "Headings are concise and scannable." });
  }

  if (firstLevel > 1) {
    score -= 6;
    findings.push({
      kind: "warn",
      text: `The outline opens on an H${firstLevel} rather than an H1, so it starts mid-hierarchy.`,
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const { band, label } = grade(score);

  return {
    score,
    band,
    label,
    flow,
    findings,
    metrics: { headings: headings.length, h1Count, topLevelSections, jumps, longHeadings, maxDepth, firstLevel },
  };
}

function grade(score: number): { band: Band; label: string } {
  if (score >= 85) return { band: "easy", label: "Easy to follow" };
  if (score >= 70) return { band: "clear", label: "Mostly clear" };
  if (score >= 55) return { band: "moderate", label: "Moderate" };
  if (score >= 40) return { band: "choppy", label: "Choppy" };
  return { band: "hard", label: "Hard to follow" };
}
