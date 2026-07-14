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

export function TreeView({
  root,
  expanded,
  onToggle,
}: {
  root: RootNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isEmpty = root.children.length === 0 && root.content.length === 0;
  if (isEmpty) {
    return <div className="empty">No core copy was extracted from this page.</div>;
  }

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
        />
      ))}
    </div>
  );
}

function HeadingRow({
  node,
  id,
  expanded,
  onToggle,
}: {
  node: HeadingNode;
  id: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isOpen = expanded.has(id);
  const childCount = node.content.length + node.children.length;

  return (
    <div className="node">
      <button
        className="node-row"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
      >
        <span className={`chev${isOpen ? " open" : ""}`}>▶</span>
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

      {isOpen && (
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
