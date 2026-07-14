// Shared types for the copy extractor.

/** The kind of a non-heading piece of copy. */
export type ItemType = "paragraph" | "link" | "button" | "list" | "quote" | "content" | "buybox";

/** A single leaf of visible copy that sits under a heading (or before the first heading). */
export interface ContentItem {
  type: ItemType;
  text: string;
  /** Present for links (and buttons that carry an href). */
  href?: string;
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5;

/** A heading and everything nested beneath it, grouped by level (h1 > h2 > h3 > h4 > h5). */
export interface HeadingNode {
  type: "heading";
  level: HeadingLevel;
  text: string;
  /** Copy that appears directly under this heading, before any deeper heading. */
  content: ContentItem[];
  /** Deeper headings nested under this one. */
  children: HeadingNode[];
}

/** The ungrouped root: copy before the first heading, plus the top-level heading tree. */
export interface RootNode {
  content: ContentItem[];
  children: HeadingNode[];
}

export interface ExtractResult {
  url: string;
  title: string;
  /** Where the core content was found (e.g. "main", "[role=main]", "body"). */
  container: string;
  /** Grouped tree of the extracted copy. */
  root: RootNode;
  /** The full document rendered as flat markdown, ready to copy/paste. */
  markdown: string;
  /** Counts by element type, for a quick summary in the UI. */
  stats: {
    headings: number;
    paragraphs: number;
    links: number;
    buttons: number;
    lists: number;
    buybox: number;
    other: number;
  };
}
