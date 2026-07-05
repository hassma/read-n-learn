import type { SourceBlock } from "../types/analysis";

const NOISE_SELECTORS = [
  "nav", "footer", "header", "aside", "script", "style", "figure", "iframe",
  "noscript", "template", "dialog",
  '[class*="ad"]', '[id*="ad"]',
  '[class*="banner"]', '[id*="banner"]',
  '[class*="sidebar"]', '[id*="sidebar"]',
  '[class*="related"]', '[id*="related"]',
  '[class*="comment"]', '[id*="comment"]',
  '[class*="share"]', '[id*="share"]',
  '[class*="social"]', '[id*="social"]',
  '[class*="newsletter"]', '[id*="newsletter"]',
  '[class*="promo"]', '[id*="promo"]',
  '[class*="widget"]', '[id*="widget"]',
  '[class*="cookie"]', '[id*="cookie"]',
  '[class*="popup"]', '[id*="popup"]',
  '[class*="subscribe"]', '[id*="subscribe"]',
  '[class*="recipe-card"]', // many recipe plugins duplicate the whole recipe as a separate structured block
  '[aria-hidden="true"]',
];

// Common CMS/blog content-container selectors, checked before falling back to
// generic density scoring — real articles are usually marked up this way.
const CONTENT_SELECTORS = [
  "article",
  '[role="main"]',
  "main",
  '[itemprop="articleBody"]',
  ".entry-content",
  ".post-content",
  ".article-content",
  ".article-body",
  ".post-body",
  ".content-area",
];

const MAX_BLOCK_CHARS = 20000;

function stripNoise(el: Element): Element {
  const clone = el.cloneNode(true) as Element;
  for (const sel of NOISE_SELECTORS) {
    for (const node of Array.from(clone.querySelectorAll(sel))) {
      node.remove();
    }
  }
  return clone;
}

interface PendingBlock {
  type: SourceBlock["type"];
  level?: number;
  listType?: "ordered" | "unordered";
  ordinal?: number;
  groupId?: number;
}

// Walks the DOM (already noise-stripped) and turns block-level elements into a
// structured array of {type, source, ...metadata}. Structure (heading depth, list
// membership/ordinal, table membership) is read directly off the real tags here —
// it is never left for the LLM to re-infer from plain prose later.
function extractBlocks(root: Element): SourceBlock[] {
  const blockTagNames = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "TD", "TH"]);
  const listGroupIds = new WeakMap<Element, number>();
  const listOrdinals = new WeakMap<Element, number>();
  const tableGroupIds = new WeakMap<Element, number>();
  let nextGroupId = 1;

  function classify(el: Element): PendingBlock {
    const tag = el.tagName;

    if (/^H[1-6]$/.test(tag)) {
      return { type: "heading", level: Number(tag[1]) };
    }

    if (tag === "LI") {
      const list = el.closest("ol, ul");
      if (!list) return { type: "list-item", listType: "unordered" };
      if (!listGroupIds.has(list)) {
        listGroupIds.set(list, nextGroupId++);
        listOrdinals.set(list, 0);
      }
      const ordinal = (listOrdinals.get(list) ?? 0) + 1;
      listOrdinals.set(list, ordinal);
      return {
        type: "list-item",
        listType: list.tagName === "OL" ? "ordered" : "unordered",
        ordinal,
        groupId: listGroupIds.get(list),
      };
    }

    if (tag === "TD" || tag === "TH") {
      const table = el.closest("table");
      if (table && !tableGroupIds.has(table)) tableGroupIds.set(table, nextGroupId++);
      return { type: "table-cell", groupId: table ? tableGroupIds.get(table) : undefined };
    }

    if (tag === "BLOCKQUOTE") return { type: "quote" };

    return { type: "paragraph" };
  }

  const blocks: SourceBlock[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

  let pending: PendingBlock | null = null;
  let currentText: string[] = [];

  function flush() {
    const text = currentText.join(" ").replace(/\s+/g, " ").trim();
    currentText = [];
    if (pending && text.length > 1) {
      blocks.push({ ...pending, source: text });
    }
    pending = null;
  }

  let node: Node | null = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (blockTagNames.has(el.tagName)) {
        flush();
        pending = classify(el);
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) currentText.push(text);
    }
    node = walker.nextNode();
  }
  flush();

  return blocks;
}

function linkDensity(el: Element): number {
  const totalLength = (el.textContent || "").length;
  if (totalLength === 0) return 1;
  let linkLength = 0;
  for (const a of Array.from(el.querySelectorAll("a"))) {
    linkLength += (a.textContent || "").length;
  }
  return linkLength / totalLength;
}

function scoreDiv(strippedClone: Element): number {
  const text = strippedClone.textContent || "";
  const paragraphCount = strippedClone.querySelectorAll("p").length + 1;
  const density = linkDensity(strippedClone);
  // Favor text-dense blocks with many paragraphs; heavily penalize link-heavy
  // blocks (nav lists, "related articles", tag clouds, etc.)
  return (text.length * (1 - density)) / paragraphCount;
}

function bestBySelector(): Element | null {
  for (const sel of CONTENT_SELECTORS) {
    const matches = Array.from(document.querySelectorAll(sel));
    if (matches.length === 0) continue;
    const best = matches.reduce((a, b) =>
      (a as HTMLElement).innerText.length >= (b as HTMLElement).innerText.length ? a : b
    );
    if ((best as HTMLElement).innerText.length >= 200) return best;
  }
  return null;
}

function bestByDensity(): Element | null {
  const divs = Array.from(document.querySelectorAll("div, section"));
  let bestScore = 0;
  let bestEl: Element | null = null;
  for (const el of divs) {
    const stripped = stripNoise(el);
    const score = scoreDiv(stripped);
    if (score > bestScore) {
      bestScore = score;
      bestEl = el;
    }
  }
  return bestEl;
}

function extractArticleContent(): { blocks: SourceBlock[]; title: string; url: string; truncated: boolean } {
  let candidate = bestBySelector();

  if (!candidate || (candidate as HTMLElement).innerText.length < 200) {
    candidate = bestByDensity() ?? candidate;
  }

  if (!candidate) candidate = document.body;

  const stripped = stripNoise(candidate);
  const allBlocks = extractBlocks(stripped);

  // Truncate by whole blocks (never mid-sentence) once the running character
  // budget is exceeded, so large pages still produce clean, complete segments.
  const blocks: SourceBlock[] = [];
  let total = 0;
  let truncated = false;
  for (const block of allBlocks) {
    if (total + block.source.length > MAX_BLOCK_CHARS) {
      truncated = true;
      break;
    }
    blocks.push(block);
    total += block.source.length;
  }

  return { blocks, title: document.title, url: location.href, truncated };
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

const HIGHLIGHT_CLASS = "linguaside-highlight";

function injectHighlightStyle(): void {
  if (document.getElementById("linguaside-highlight-style")) return;
  const style = document.createElement("style");
  style.id = "linguaside-highlight-style";
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      outline: 3px solid #ffb703 !important;
      outline-offset: 2px !important;
      background-color: rgba(255, 183, 3, 0.25) !important;
      border-radius: 4px !important;
      transition: background-color 0.3s ease, outline-color 0.3s ease;
    }
  `;
  document.head?.appendChild(style);
}

let highlightTimer: ReturnType<typeof setTimeout> | null = null;

function findAndHighlight(target: string): boolean {
  const targetNorm = normalize(target);
  if (!targetNorm) return false;

  const blockTags = "p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th";
  const candidates = Array.from(document.querySelectorAll(blockTags));

  let match =
    candidates.find((el) => normalize(el.textContent || "") === targetNorm) ?? null;

  if (!match) {
    const snippet = targetNorm.slice(0, 40);
    match = candidates.find((el) => normalize(el.textContent || "").includes(snippet)) ?? null;
  }

  if (!match) return false;

  injectHighlightStyle();

  if (highlightTimer) clearTimeout(highlightTimer);
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));

  match.scrollIntoView({ behavior: "smooth", block: "center" });
  match.classList.add(HIGHLIGHT_CLASS);
  highlightTimer = setTimeout(() => match?.classList.remove(HIGHLIGHT_CLASS), 2500);

  return true;
}

browser.runtime.onMessage.addListener((msg: unknown) => {
  const m = msg as { type: string; payload?: { text: string } };

  if (m.type === "GET_ARTICLE_TEXT") {
    const payload = extractArticleContent();
    return Promise.resolve({ type: "ARTICLE_TEXT", payload });
  }

  if (m.type === "HIGHLIGHT_TEXT" && m.payload) {
    const found = findAndHighlight(m.payload.text);
    return Promise.resolve({ type: "HIGHLIGHT_RESULT", payload: { found } });
  }

  return undefined;
});
