# Copy Extractor

A small Next.js app (deployable to Vercel) that scrapes a web page — typically a
Shopify page — and pulls out only the **core visible copy**: no navigation, no
pop-ups/modals/cart drawers, no footer. The copy is grouped into a heading tree
(`h1 → h2 → h3 → h4 → h5`) that you can expand/collapse, plus a raw-markdown panel
you can copy or download.

## What it extracts

- **Headings** `h1`–`h5` — used to build the nested, collapsible groups.
- **Paragraphs** `p`, **links** `a` (with `href`), **buttons** `button` / `[role=button]`,
  **list items** `li`, **quotes** `blockquote`.
- **Everything else** with visible text falls under **`content`** (leaf text in
  `div`/`span` containers, common on page-builder landing pages).
- **Buy-box** — copy inside a product purchase region (variant/size/quantity
  selectors, add-to-cart, subscription/pack options) is kept but tagged as
  **`buybox`** so it's easy to tell apart from marketing copy. It shows an amber
  `BUY-BOX` badge in the tree and a `` `[buy-box]` `` prefix in the raw markdown.

Inline formatting inside a block is preserved as markdown: `**bold**`, `*italic*`,
`[text](href)`, `` `code` ``.

## How the filtering works

1. **Anchor** to the primary content container — `main` / `[role=main]` /
   `#MainContent` / `article` — which already excludes the site header, nav and footer.
2. **Strip chrome** that can still live inside `main`: `nav`/`header`/`footer`,
   dialogs, drawers, carts, modals, pop-ups, cookie/consent banners, newsletter
   prompts, `[aria-hidden]`/`[hidden]` nodes, `script`/`style`/`svg`, and elements
   whose `class`/`id` match high-confidence chrome keywords.
3. **Walk** the remaining DOM in document order, emitting one block per meaningful
   element.
4. **Dedupe** duplicate blocks that come from responsive mobile/desktop variants
   (themes render both copies into the DOM).
5. **Group** the flat blocks into the heading tree.

The extraction logic lives in [`lib/extract.ts`](lib/extract.ts) and is framework-agnostic.

## UI features

- Heading groups **default to collapsed**; click any heading to expand it.
- **Expand all** / **Collapse all**.
- Per-item type badges (`P`, `A`, `BTN`, `LI`, `QUOTE`, `CONTENT`, `BUY-BOX`) and level tags (`H1`…`H5`).
- **Copy markdown** to clipboard and **Download .md**.
- A **Raw markdown** textarea for pasting into other tools.
- **Grade narrative flow** (optional) — see below.

## Narrative flow grade

An optional button that scores how easy the page's **heading outline (H1–H4)** is to
follow, and draws a visual of the reading path with arrows between headers.

The grade is a **deterministic, explainable heuristic** — not an AI/semantic judgment
— computed in [`lib/narrative.ts`](lib/narrative.ts) from the heading structure:

- **Skipped levels** (e.g. H1 → H3) — the biggest readability hit; each one is
  highlighted with an amber arrow in the flow so you can *see* where the story jumps.
- **Number of H1s** — one clear top-level topic scores best.
- **Section count** — too many top-level sections is hard to hold in mind.
- **Heading length** — long headings are harder to scan.
- **Starting level** — outlines that open below H1 start mid-hierarchy.

It produces a 0–100 score, a band (*Easy to follow → Hard to follow*), a plain-English
list of what helped or hurt, and the arrow flow diagram (color-coded by level). Because
it only reads structure, it's labelled as a *structure grade* in the UI — it does not
claim to judge the writing itself.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Then paste a URL (or click the built-in example) and hit **Extract copy**.

## Deploy to Vercel

The app is a standard Next.js App Router project — no extra config needed.

```bash
# Option A: Vercel CLI
npm i -g vercel
vercel            # first run links/creates the project
vercel --prod

# Option B: push to a Git repo and "Import Project" at vercel.com
```

The scrape runs in a Node.js serverless function (`app/api/scrape/route.ts`,
`runtime = "nodejs"`, `maxDuration = 30`).

## Notes & limitations

- Extraction uses server-side `fetch` + [cheerio](https://cheerio.js.org/) on the
  page's **initial HTML**. Content rendered purely client-side (after JS execution)
  won't be captured — most notably **third-party review widgets** (Okendo, Yotpo,
  Rivo, etc.), which hydrate after load. Most Shopify pages server-render their core
  copy, so this is rarely an issue for marketing/landing/funnel pages. To capture
  JS-injected content you'd swap the `fetch` for a headless browser (e.g. Playwright
  + `@sparticuz/chromium` on Vercel).
- Tested against three different Shopify setups: a landing page (firstday.com), a
  funnel page (try.javvycoffee.com), and a product page (trueclassictees.com).
- Requests to internal/local addresses are blocked, and fetches time out after 20s.
- Product-form copy that lives inside `main` (e.g. "Quantity", "Delivery Frequency")
  is treated as real content and kept, since it is genuinely visible on the page.
