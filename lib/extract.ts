import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type {
  ContentItem,
  ExtractResult,
  HeadingLevel,
  HeadingNode,
  ItemType,
  RootNode,
} from "./types";

/**
 * Extract the visible *core* copy from a page's HTML.
 *
 * Strategy:
 *  1. Anchor to the primary content container (<main> / [role=main] / #MainContent),
 *     which by itself excludes the site header, nav and footer on most themes.
 *  2. Strip chrome that can still live inside main: dialogs, drawers, carts, modals,
 *     pop-ups, cookie/consent banners, newsletter prompts, hidden nodes, scripts, etc.
 *  3. Walk what remains in document order, emitting one block per meaningful element
 *     (h1-h5, p, a, button, li, blockquote, or a leaf text container = "content").
 *  4. Collapse adjacent duplicates (responsive mobile/desktop variants render both).
 *  5. Group the flat blocks into a heading tree (h1 > h2 > h3 > h4 > h5).
 */
export function extract(html: string, url: string): ExtractResult {
  const $ = cheerio.load(html);

  const title =
    clean($("title").first().text()) ||
    clean($('meta[property="og:title"]').attr("content") || "") ||
    "Untitled page";

  // --- 1. Pick the core content container -------------------------------------
  const { container, label } = pickContainer($);

  // --- 2. Remove non-content chrome inside the container ----------------------
  stripChrome($, container);

  // --- 3. Walk to an ordered list of blocks -----------------------------------
  const blocks: Block[] = [];
  walk($, container, blocks);

  // --- 4. Collapse duplicate blocks from responsive (mobile/desktop) variants -
  const deduped = dedupeNearby(blocks);

  // --- 5. Build the heading tree ----------------------------------------------
  const root = buildTree(deduped);

  const markdown = renderMarkdown(root, title);
  const stats = countStats(deduped);

  return { url, title, container: label, root, markdown, stats };
}

// ---------------------------------------------------------------------------
// Internal block representation (flat, document-ordered)
// ---------------------------------------------------------------------------

type Block =
  | { kind: "heading"; level: HeadingLevel; text: string }
  | { kind: "item"; type: ItemType; text: string; href?: string };

// ---------------------------------------------------------------------------
// 1. Container selection
// ---------------------------------------------------------------------------

function pickContainer($: cheerio.CheerioAPI): {
  container: cheerio.Cheerio<Element>;
  label: string;
} {
  const candidates: Array<[string, string]> = [
    ["main", "main"],
    ["[role=main]", "[role=main]"],
    ["#MainContent", "#MainContent"],
    ["#main", "#main"],
    ["article", "article"],
    ["[role=article]", "[role=article]"],
  ];
  for (const [selector, label] of candidates) {
    const el = $(selector).first();
    if (el.length && clean(el.text()).length > 40) {
      return { container: el as cheerio.Cheerio<Element>, label };
    }
  }
  return { container: $("body") as cheerio.Cheerio<Element>, label: "body" };
}

// ---------------------------------------------------------------------------
// 2. Chrome removal
// ---------------------------------------------------------------------------

// Structural elements / roles that are never core copy.
const DROP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "template",
  "iframe",
  "nav",
  "header",
  "footer",
  "form input",
  "select",
  "[role=navigation]",
  "[role=banner]",
  "[role=contentinfo]",
  "[role=dialog]",
  "[role=alertdialog]",
  "[role=menu]",
  "[role=menubar]",
  "[role=tooltip]",
  "[aria-modal=true]",
  "[aria-hidden=true]",
  "[hidden]",
];

// class/id tokens that strongly signal chrome (nav, footer, pop-ups, cart, etc.).
// Kept deliberately high-confidence so we don't nuke real hero/section copy.
const DROP_KEYWORDS = [
  "nav",
  "navbar",
  "navigation",
  "mainmenu",
  "main-menu",
  "menu-drawer",
  "site-header",
  "site-footer",
  "page-footer",
  "footer",
  "breadcrumb",
  "cookie",
  "consent",
  "gdpr",
  "popup",
  "pop-up",
  "modal",
  "dialog",
  "overlay",
  "backdrop",
  "drawer",
  "offcanvas",
  "off-canvas",
  "flyout",
  "minicart",
  "mini-cart",
  "cart-drawer",
  "cart__",
  "cart-",
  "-cart",
  "shopping-cart",
  "newsletter",
  "announcement",
  "promo-bar",
  "toast",
  "notification-bar",
  "skip-link",
  "skip-to",
  "sr-only",
  "visually-hidden",
  "screen-reader",
  "back-to-top",
  "sticky-atc",
  "predictive-search",
  "search-modal",
  // sticky bars / mobile chrome that some themes render inside <main>
  "mobile-bottom-bar",
  "bottom-bar",
  "bottombar",
  "bottom-nav",
  "bottomnav",
  "mobile-nav",
  "mobilenav",
  "sticky-bar",
  "sticky-nav",
  "utility-bar",
  "header-utilit",
  "quick-add",
  "quickadd",
  "quick-view",
  "quickview",
];

// class/id tokens that mark a product purchase / "buy-box" region. These are NOT
// dropped — copy inside is kept but classified as "buybox" so it can be told apart
// from marketing copy. Kept specific enough to avoid matching the whole product
// wrapper (e.g. "product-info" / "liquid-pdp__wrapper" are intentionally excluded).
const BUYBOX_KEYWORDS = [
  "product-form",
  "product_form",
  "productform",
  "add-to-cart",
  "addtocart",
  "add_to_cart",
  "buy-box",
  "buybox",
  "variant-select",
  "variant-picker",
  "variant-radio",
  "variant-input",
  "variant-selects",
  "product-variant",
  "product-options",
  "product__option",
  "product-option",
  "quantity-selector",
  "quantity-input",
  "quantity__",
  "quantity-picker",
  "qty-selector",
  "qty-input",
  "swatch",
  "selling-plan",
  "sellingplan",
  "purchase-option",
  "subscription-option",
  "subscribe-save",
  "subscribe-and-save",
  "pack-selector",
  "style-selector",
  "size-selector",
  "size-picker",
  "length-toggle",
  "cut-selector",
  "product-pack-selector",
  "product-style",
  "best-deal",
  "product__submit",
  "product-cta",
  "product__cta",
  "sticky-atc",
  "atc-button",
];

// Short strings that are almost always UI chrome, not content copy.
const TEXT_STOPLIST = [
  "skip to content",
  "skip to main content",
  "add to cart",
  "your cart",
  "cart",
  "close",
  "menu",
  "search",
];

function stripChrome($: cheerio.CheerioAPI, container: cheerio.Cheerio<Element>): void {
  container.find(DROP_SELECTORS.join(",")).remove();

  // Drop by class/id keyword.
  container.find("[class],[id]").each((_, el) => {
    const cls = ($(el).attr("class") || "").toLowerCase();
    const id = ($(el).attr("id") || "").toLowerCase();
    const hay = `${cls} ${id}`;
    if (DROP_KEYWORDS.some((k) => hay.includes(k))) {
      $(el).remove();
    }
  });

  // Drop nodes hidden via inline styles.
  container.find("[style]").each((_, el) => {
    const style = ($(el).attr("style") || "").toLowerCase().replace(/\s+/g, "");
    if (style.includes("display:none") || style.includes("visibility:hidden")) {
      $(el).remove();
    }
  });
}

// ---------------------------------------------------------------------------
// 3. DOM walk -> ordered blocks
// ---------------------------------------------------------------------------

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5"]);
const PARAGRAPHISH = new Set(["p", "blockquote", "figcaption", "dd", "dt"]);

function walk($: cheerio.CheerioAPI, root: cheerio.Cheerio<Element>, out: Block[]): void {
  const rootEl = root.get(0);
  if (!rootEl) return;
  walkNode($, rootEl, out, false);
}

function walkNode($: cheerio.CheerioAPI, node: Element, out: Block[], inBuyBox: boolean): void {
  for (const child of node.children as AnyNode[]) {
    if (child.type === "text") {
      const t = clean(child.data);
      if (t && !isStopword(t)) {
        out.push({ kind: "item", type: inBuyBox ? "buybox" : "content", text: t });
      }
      continue;
    }
    if (child.type !== "tag") continue;
    handleElement($, child as Element, out, inBuyBox);
  }
}

function handleElement(
  $: cheerio.CheerioAPI,
  el: Element,
  out: Block[],
  inBuyBox: boolean,
): void {
  const tag = el.tagName.toLowerCase();
  // Once inside a buy-box region every descendant leaf is classified as "buybox".
  const bb = inBuyBox || isBuyBoxContainer($, el);
  const leafType = (normal: ItemType): ItemType => (bb ? "buybox" : normal);

  if (HEADINGS.has(tag)) {
    // Headings always stay headings so the grouping structure is preserved.
    const text = renderInline($, el);
    if (text) out.push({ kind: "heading", level: Number(tag[1]) as HeadingLevel, text });
    return;
  }

  if (PARAGRAPHISH.has(tag)) {
    const text = renderInline($, el);
    const type: ItemType = leafType(tag === "blockquote" ? "quote" : "paragraph");
    if (text && !isStopword(text)) out.push({ kind: "item", type, text });
    return;
  }

  if (tag === "li") {
    const text = renderInline($, el);
    if (text && !isStopword(text)) out.push({ kind: "item", type: leafType("list"), text });
    return;
  }

  if (tag === "button" || isRoleButton($, el)) {
    const text = clean($(el).text());
    if (text && !isStopword(text)) out.push({ kind: "item", type: leafType("button"), text });
    return;
  }

  if (tag === "a") {
    // A link wrapping real structure (cards, sections) should be descended into;
    // a plain text link becomes its own block.
    if ($(el).find("h1,h2,h3,h4,h5,p,li,ul,ol").length > 0) {
      walkNode($, el, out, bb);
      return;
    }
    const text = renderInline($, el);
    const href = normalizeHref($(el).attr("href"));
    if (text && !isStopword(text)) out.push({ kind: "item", type: leafType("link"), text, href });
    return;
  }

  // Leaf text container (div/span/etc. with copy but no block descendants).
  if (isLeafTextContainer($, el)) {
    const text = renderInline($, el);
    if (text && !isStopword(text)) out.push({ kind: "item", type: leafType("content"), text });
    return;
  }

  // Otherwise it's a structural container: keep walking in document order.
  walkNode($, el, out, bb);
}

function isBuyBoxContainer($: cheerio.CheerioAPI, el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  // Some themes use custom elements as the buy-box (e.g. <product-form>).
  if (tag === "product-form" || tag === "product-pack-selector" || tag === "product-style") {
    return true;
  }
  const hay = `${($(el).attr("class") || "").toLowerCase()} ${($(el).attr("id") || "").toLowerCase()}`;
  return BUYBOX_KEYWORDS.some((k) => hay.includes(k));
}

function isRoleButton($: cheerio.CheerioAPI, el: Element): boolean {
  const role = ($(el).attr("role") || "").toLowerCase();
  const type = ($(el).attr("type") || "").toLowerCase();
  return role === "button" || (el.tagName.toLowerCase() === "input" && (type === "button" || type === "submit"));
}

function isLeafTextContainer($: cheerio.CheerioAPI, el: Element): boolean {
  if ($(el).find("h1,h2,h3,h4,h5,p,li,ul,ol,a,button,blockquote,figcaption").length > 0) {
    return false;
  }
  return clean($(el).text()).length > 0;
}

// ---------------------------------------------------------------------------
// Inline markdown rendering (links/bold/italic/breaks inside a block)
// ---------------------------------------------------------------------------

function renderInline($: cheerio.CheerioAPI, el: Element): string {
  let out = "";
  for (const child of el.children as AnyNode[]) {
    if (child.type === "text") {
      out += child.data.replace(/\s+/g, " ");
      continue;
    }
    if (child.type !== "tag") continue;
    const c = child as Element;
    const tag = c.tagName.toLowerCase();
    const inner = renderInline($, c).trim();
    if (tag === "br") {
      out += "\n";
    } else if (tag === "a") {
      const href = normalizeHref($(c).attr("href"));
      out += inner ? (href ? `[${inner}](${href})` : inner) : "";
    } else if (tag === "strong" || tag === "b") {
      out += inner ? `**${inner}**` : "";
    } else if (tag === "em" || tag === "i") {
      out += inner ? `*${inner}*` : "";
    } else if (tag === "code") {
      out += inner ? `\`${inner}\`` : "";
    } else {
      out += renderInline($, c);
    }
  }
  return out.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

// ---------------------------------------------------------------------------
// 4. Dedupe duplicate blocks from responsive mobile/desktop copies
// ---------------------------------------------------------------------------

// Themes commonly render both a mobile and a desktop copy of a section, toggled
// by CSS media queries — so cheerio sees each block twice, a few blocks apart.
// We drop a block if an identical one appeared within the last WINDOW blocks,
// but only for *substantial* copy: short repeated CTAs/buttons (e.g. "Shop Now")
// are almost always intentional, so those are kept.
const DEDUPE_WINDOW = 14;
const DEDUPE_MIN_LEN = 20;

function dedupeNearby(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    const substantial = b.kind === "heading" || b.text.length >= DEDUPE_MIN_LEN;
    if (substantial) {
      const from = Math.max(0, out.length - DEDUPE_WINDOW);
      let dup = false;
      for (let i = out.length - 1; i >= from; i--) {
        if (sameBlock(out[i], b)) {
          dup = true;
          break;
        }
      }
      if (dup) continue;
    } else {
      // Still collapse immediate short repeats (adjacent identical buttons/links).
      const prev = out[out.length - 1];
      if (prev && sameBlock(prev, b)) continue;
    }
    out.push(b);
  }
  return out;
}

function sameBlock(a: Block, b: Block): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "heading" && b.kind === "heading") {
    return a.level === b.level && a.text === b.text;
  }
  if (a.kind === "item" && b.kind === "item") {
    return a.type === b.type && a.text === b.text && a.href === b.href;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 5. Build the heading tree
// ---------------------------------------------------------------------------

function buildTree(blocks: Block[]): RootNode {
  const root: RootNode = { content: [], children: [] };
  const stack: HeadingNode[] = [];

  for (const b of blocks) {
    if (b.kind === "heading") {
      const node: HeadingNode = {
        type: "heading",
        level: b.level,
        text: b.text,
        content: [],
        children: [],
      };
      while (stack.length && stack[stack.length - 1].level >= b.level) stack.pop();
      const parent = stack.length ? stack[stack.length - 1] : null;
      if (parent) parent.children.push(node);
      else root.children.push(node);
      stack.push(node);
    } else {
      const item: ContentItem = { type: b.type, text: b.text };
      if (b.href) item.href = b.href;
      const target = stack.length ? stack[stack.length - 1] : root;
      target.content.push(item);
    }
  }
  return root;
}

// ---------------------------------------------------------------------------
// Markdown rendering of the whole tree (flat, ready to paste)
// ---------------------------------------------------------------------------

function renderMarkdown(root: RootNode, title: string): string {
  const lines: string[] = [];
  for (const item of root.content) lines.push(renderItemMarkdown(item));
  for (const child of root.children) renderHeadingMarkdown(child, lines);
  const body = lines.filter((l) => l.length > 0).join("\n\n");
  return body ? `${body}\n` : "";
}

function renderHeadingMarkdown(node: HeadingNode, lines: string[]): void {
  lines.push(`${"#".repeat(node.level)} ${node.text}`);
  for (const item of node.content) lines.push(renderItemMarkdown(item));
  for (const child of node.children) renderHeadingMarkdown(child, lines);
}

function renderItemMarkdown(item: ContentItem): string {
  switch (item.type) {
    case "link":
      return item.href ? `[${item.text}](${item.href})` : item.text;
    case "button":
      return `**${item.text}**`;
    case "buybox":
      // Tagged so buy-box UI copy is distinguishable in the raw markdown.
      return item.href ? `\`[buy-box]\` [${item.text}](${item.href})` : `\`[buy-box]\` ${item.text}`;
    case "list":
      return `- ${item.text}`;
    case "quote":
      return item.text
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    case "paragraph":
    case "content":
    default:
      return item.text;
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function countStats(blocks: Block[]) {
  const stats = { headings: 0, paragraphs: 0, links: 0, buttons: 0, lists: 0, buybox: 0, other: 0 };
  for (const b of blocks) {
    if (b.kind === "heading") stats.headings++;
    else if (b.type === "paragraph") stats.paragraphs++;
    else if (b.type === "link") stats.links++;
    else if (b.type === "button") stats.buttons++;
    else if (b.type === "list") stats.lists++;
    else if (b.type === "buybox") stats.buybox++;
    else stats.other++;
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clean(s: string | undefined | null): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function isStopword(text: string): boolean {
  return TEXT_STOPLIST.includes(text.toLowerCase());
}

function normalizeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const h = href.trim();
  if (!h || h === "#" || h.startsWith("javascript:")) return undefined;
  return h;
}
