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

const MAX_TEXT_LENGTH = 20000;
const TRUNCATION_NOTICE = "\n\n[Article truncated for analysis]";

function stripNoise(el: Element): Element {
  const clone = el.cloneNode(true) as Element;
  for (const sel of NOISE_SELECTORS) {
    for (const node of Array.from(clone.querySelectorAll(sel))) {
      node.remove();
    }
  }
  return clone;
}

function extractText(el: Element): string {
  const stripped = stripNoise(el);
  // Collect paragraph-level text preserving whitespace
  const blocks: string[] = [];
  const walker = document.createTreeWalker(stripped, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

  const blockTags = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "TD", "TH"]);
  let currentBlock: string[] = [];

  function flushBlock() {
    const text = currentBlock.join(" ").replace(/\s+/g, " ").trim();
    if (text.length > 20) blocks.push(text);
    currentBlock = [];
  }

  let node: Node | null = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (blockTags.has(el.tagName)) {
        flushBlock();
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) currentBlock.push(text);
    }
    node = walker.nextNode();
  }
  flushBlock();

  return blocks.join("\n\n");
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
    // Skip containers that mostly wrap other candidates already considered
    // (e.g. <body> or top-level layout wrappers) to avoid re-including noise.
    const stripped = stripNoise(el);
    const score = scoreDiv(stripped);
    if (score > bestScore) {
      bestScore = score;
      bestEl = el;
    }
  }
  return bestEl;
}

function extractArticleContent(): { text: string; title: string; url: string } {
  let candidate = bestBySelector();

  if (!candidate || (candidate as HTMLElement).innerText.length < 200) {
    candidate = bestByDensity() ?? candidate;
  }

  // Fallback to body
  if (!candidate) candidate = document.body;

  let text = extractText(candidate);

  if (text.length > MAX_TEXT_LENGTH) {
    // Truncate at a paragraph boundary near the limit
    const cutoff = text.lastIndexOf("\n\n", MAX_TEXT_LENGTH);
    text = text.slice(0, cutoff > 0 ? cutoff : MAX_TEXT_LENGTH) + TRUNCATION_NOTICE;
  }

  return { text, title: document.title, url: location.href };
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
