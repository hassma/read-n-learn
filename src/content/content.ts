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
  '[aria-hidden="true"]',
];

const MAX_TEXT_LENGTH = 12000;
const TRUNCATION_NOTICE = "\n\n[Article truncated to ~1,500 words for analysis]";

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

function scoreDiv(el: Element): number {
  const text = (el as HTMLElement).innerText || "";
  const childCount = el.children.length + 1;
  return text.length / childCount;
}

function extractArticleContent(): { text: string; title: string; url: string } {
  let candidate: Element | null = null;

  // 1. <article> with most text
  const articles = Array.from(document.querySelectorAll("article"));
  if (articles.length > 0) {
    candidate = articles.reduce((best, el) =>
      (el as HTMLElement).innerText.length > (best as HTMLElement).innerText.length ? el : best
    );
  }

  // 2. [role="main"]
  if (!candidate || (candidate as HTMLElement).innerText.length < 200) {
    candidate = document.querySelector('[role="main"]') ?? candidate;
  }

  // 3. <main>
  if (!candidate || (candidate as HTMLElement).innerText.length < 200) {
    candidate = document.querySelector("main") ?? candidate;
  }

  // 4. Largest div by text density
  if (!candidate || (candidate as HTMLElement).innerText.length < 200) {
    const divs = Array.from(document.querySelectorAll("div"));
    let bestScore = 0;
    let bestDiv: Element | null = null;
    for (const div of divs) {
      const score = scoreDiv(div);
      if (score > bestScore) {
        bestScore = score;
        bestDiv = div;
      }
    }
    if (bestDiv) candidate = bestDiv;
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

browser.runtime.onMessage.addListener((msg: unknown) => {
  if ((msg as { type: string }).type === "GET_ARTICLE_TEXT") {
    const payload = extractArticleContent();
    return Promise.resolve({ type: "ARTICLE_TEXT", payload });
  }
  return undefined;
});
