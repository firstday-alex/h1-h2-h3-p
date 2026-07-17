"use client";

import type { ContentItem, HeadingNode, RootNode } from "@/lib/types";

/** Collect the ids of every heading node (used by "Expand all"). */
export function collectHeadingIds(root: RootNode): string[] {
  const ids: string[] = [];
  const visit = (node: HeadingNode, id: string) => {
    ids.push(id);
    node.children.forEach((c, i) => visit(c, `${id}.${i}`));
  };
  root.children.forEach((c, i) => visit(c, `${i}`));
  return ids;
}

/** Which heading levels (1–5) actually appear on the page, sorted ascending. */
export function availableLevels(root: RootNode): number[] {
  const set = new Set<number>();
  const visit = (node: HeadingNode) => {
    set.add(node.level);
    node.children.forEach(visit);
  };
  root.children.forEach(visit);
  return [...set].sort((a, b) => a - b);
}

/**
 * Count the heading rows that will actually render directly beneath `node`
 * given the visible-level filter. A hidden level's children hoist upward, so
 * they still count toward the parent that renders them.
 */
function renderedChildCount(node: HeadingNode, levels: Set<number>): number {
  let n = 0;
  for (const c of node.children) {
    if (levels.has(c.level)) n += 1;
    else n += renderedChildCount(c, levels);
  }
  return n;
}

export function TreeView({
  root,
  expanded,
  onToggle,
  levels,
}: {
  root: RootNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  levels: Set<number>;
}) {
  const isEmpty = root.children.length === 0 && root.content.length === 0;
  if (isEmpty) {
    return <div className="empty">No core copy was extracted from this page.</div>;
  }

  const visibleHeadingRows = root.children.reduce(
    (n, c) => n + (levels.has(c.level) ? 1 : renderedChildCount(c, levels)),
    0,
  );

  return (
    <div className="tree">
      {root.content.length > 0 && (
        <div style={{ paddingBottom: 6 }}>
          {root.content.map((item, i) => (
            <Leaf key={`root-${i}`} item={item} />
          ))}
        </div>
      )}
      {root.children.map((node, i) => (
        <HeadingRow
          key={i}
          node={node}
          id={`${i}`}
          expanded={expanded}
          onToggle={onToggle}
          levels={levels}
        />
      ))}
      {visibleHeadingRows === 0 && root.children.length > 0 && (
        <div className="empty">No headings match the selected levels.</div>
      )}
    </div>
  );
}

function HeadingRow({
  node,
  id,
  expanded,
  onToggle,
  levels,
}: {
  node: HeadingNode;
  id: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  levels: Set<number>;
}) {
  const visible = levels.has(node.level);

  // Hidden heading: don't render its row or its own content, but hoist any
  // deeper selected headings up into this position so the outline stays intact.
  if (!visible) {
    return (
      <>
        {node.children.map((child, i) => (
          <HeadingRow
            key={i}
            node={child}
            id={`${id}.${i}`}
            expanded={expanded}
            onToggle={onToggle}
            levels={levels}
          />
        ))}
      </>
    );
  }

  const isOpen = expanded.has(id);
  const childCount = node.content.length + renderedChildCount(node, levels);
  const collapsible = childCount > 0;

  return (
    <div className="node">
      <button
        className="node-row"
        onClick={() => collapsible && onToggle(id)}
        aria-expanded={collapsible ? isOpen : undefined}
        style={collapsible ? undefined : { cursor: "default" }}
      >
        <span className={`chev${isOpen ? " open" : ""}`} style={{ visibility: collapsible ? "visible" : "hidden" }}>
          ▶
        </span>
        <span className="node-label">
          <span className="lvl">H{node.level}</span>
          <span className="node-title">{node.text}</span>
          {childCount > 0 && (
            <span className="count">
              {childCount} {childCount === 1 ? "item" : "items"}
            </span>
          )}
        </span>
      </button>

      {isOpen && collapsible && (
        <div className="children">
          {node.content.map((item, i) => (
            <Leaf key={`c-${i}`} item={item} />
          ))}
          {node.children.map((child, i) => (
            <HeadingRow
              key={i}
              node={child}
              id={`${id}.${i}`}
              expanded={expanded}
              onToggle={onToggle}
              levels={levels}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Leaf({ item }: { item: ContentItem }) {
  return (
    <div className={`leaf${item.type === "buybox" ? " is-buybox" : ""}`}>
      <span className={`badge ${item.type}`}>{badgeLabel(item.type)}</span>
      <span className="leaf-text">
        {item.type === "link" && item.href ? (
          <a href={item.href} target="_blank" rel="noreferrer noopener">
            {item.text}
          </a>
        ) : (
          item.text
        )}
      </span>
    </div>
  );
}

function badgeLabel(type: ContentItem["type"]): string {
  switch (type) {
    case "paragraph":
      return "P";
    case "link":
      return "A";
    case "button":
      return "BTN";
    case "list":
      return "LI";
    case "quote":
      return "QUOTE";
    case "buybox":
      return "BUY-BOX";
    default:
      return "CONTENT";
  }
}
