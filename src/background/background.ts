import type { ExtensionMessage } from "../types/messages";
import type {
  AnalysisResult,
  GeneralGrammarTopic,
  GrammarExercise,
  GrammarNote,
  SourceBlock,
  TranslationSegment,
  VocabularyItem,
  WordLookupResult,
} from "../types/analysis";

interface ApiSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  sourceLang: string;
  targetLang: string;
}

async function loadSettings(): Promise<ApiSettings> {
  const stored = await browser.storage.local.get([
    "apiKey",
    "baseUrl",
    "model",
    "sourceLang",
    "targetLang",
  ]);
  return {
    apiKey: (stored.apiKey as string) || "",
    baseUrl: (stored.baseUrl as string) || "https://api.openai.com/v1",
    model: (stored.model as string) || "gpt-4o-mini",
    sourceLang: (stored.sourceLang as string) || "auto",
    targetLang: (stored.targetLang as string) || "English",
  };
}

function providerHeaders(baseUrl: string): Record<string, string> {
  // OpenRouter uses these optional headers for app attribution in its dashboard.
  if (baseUrl.includes("openrouter.ai")) {
    return {
      "HTTP-Referer": "https://github.com/hassma/read-n-learn",
      "X-Title": "LinguaSide",
    };
  }
  return {};
}

const REQUEST_TIMEOUT_MS = 30000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    // Each attempt depends on the previous one's outcome (retry only on a
    // retryable status), so this can't be parallelized with Promise.all.
    // oxlint-disable-next-line no-await-in-loop
    const response = await fetch(url, options);
    if (response.ok || attempt >= MAX_RETRIES || !RETRYABLE_STATUSES.has(response.status)) {
      return response;
    }
    // oxlint-disable-next-line no-await-in-loop
    await delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
  }
}

// Every call gets its own timeout so a hung provider can't leave the UI stuck
// loading forever, and can also be tied to an external AbortSignal so a caller
// (e.g. a superseded analysis request) can cancel in-flight work early.
async function callLLM(
  systemPrompt: string,
  userContent: string,
  maxTokens = 4000,
  externalSignal?: AbortSignal,
): Promise<string> {
  const settings = await loadSettings();
  if (!settings.apiKey) throw new Error("No API key configured — open settings to add one.");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetchWithRetry(`${settings.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
        ...providerHeaders(settings.baseUrl),
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${response.status}::${body}`);
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

function humanizeApiError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "Request timed out — try again.";
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("No API key")) return msg;
  if (msg.startsWith("401")) return "Invalid API key — check your settings.";
  if (msg.startsWith("403")) return "Access denied — verify your API key permissions.";
  if (msg.startsWith("429")) return "Rate limit exceeded — try again shortly.";
  if (msg.startsWith("500") || msg.startsWith("502") || msg.startsWith("503"))
    return "The AI provider is temporarily unavailable — try again in a moment.";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError"))
    return "Network error — check your internet connection and API base URL.";
  return `Unexpected error: ${msg.slice(0, 120)}`;
}

// The structure (heading/paragraph/list-item/table-cell/quote, heading depth, list
// membership) was already determined deterministically from the page DOM in
// content.ts. The model is only asked to translate each block's text in place — it
// is never asked to invent or re-derive structure, which is what made oddly-templated
// pages unreliable before.
function buildSummaryTranslationPrompt(sourceLang: string, targetLang: string): string {
  return `You are a language learning assistant. The user is reading an article in ${sourceLang}.
Their native language is ${targetLang}.

You will receive a JSON array of article blocks (in original reading order), each with
a "type" (heading/paragraph/list-item/table-cell/quote) and its "source" text.

Respond with ONLY valid JSON matching this exact schema:
{
  "summary": "string — 2-3 sentence summary of the whole article, in ${targetLang}",
  "translations": ["string", "string", ...]
}

Rules:
- "translations" must have EXACTLY one entry per input block, in the same order —
  do not merge, split, skip, or reorder blocks.
- Each entry is the ${targetLang} translation of the corresponding block's "source" text.
- Translate faithfully; keep the register appropriate to the block type (e.g. imperative
  tone for recipe/instruction steps, concise labels for table cells).`;
}

function buildVocabularyPrompt(sourceLang: string, targetLang: string): string {
  return `You are a language learning assistant. The user is reading an article in ${sourceLang}.
Their native language is ${targetLang}.

Respond with ONLY valid JSON matching this exact schema:
{
  "vocabulary": [
    {
      "word": "string",
      "pos": "noun|verb|adjective|adverb|phrase|other",
      "translation": "string",
      "difficulty": "A1|A2|B1|B2|C1|C2",
      "clue": "string — memorable mnemonic or etymology hint",
      "exampleFromText": "string — exact sentence from article containing this word"
    }
  ]
}

Rules:
- 10-15 most important words for comprehension, prioritize domain-specific words and non-cognates`;
}

function buildGrammarPrompt(sourceLang: string, targetLang: string): string {
  return `You are a language learning assistant. The user is reading an article in ${sourceLang}.
Their native language is ${targetLang}.

Respond with ONLY valid JSON matching this exact schema:
{
  "grammarNotes": [
    {
      "pattern": "string — pattern name e.g. 'Subjunctive after bien que'",
      "explanation": "string — brief rule explanation",
      "exampleFromText": "string — real sentence from article",
      "targetLanguageEquivalent": "string — translation of the example"
    }
  ]
}

Rules:
- 3-5 notable grammar patterns found in the text`;
}

// General grammar reference is stable, level-appropriate reference content —
// deliberately independent of any article — so it's cached long-term (see
// below) instead of regenerated on every analysis.
function buildGeneralGrammarPrompt(sourceLang: string, level: string): string {
  return `You are a language learning assistant creating a grammar reference for a ${level} (CEFR) learner of ${sourceLang}.

Respond with ONLY valid JSON matching this exact schema:
{
  "topics": [
    {
      "pattern": "string — grammar topic name, e.g. 'Present tense of -er verbs'",
      "explanation": "string — clear, concise rule explanation appropriate for a ${level} learner",
      "example": "string — one example sentence in ${sourceLang} demonstrating the pattern",
      "exampleTranslation": "string — translation of the example"
    }
  ]
}

Rules:
- 6-8 core grammar topics a ${level} learner of ${sourceLang} should know, ordered from
  foundational to more advanced within that level
- Topics are general language knowledge, not tied to any specific article or text`;
}

// Exercises are generated on demand (gated behind a "Practice" button in the UI)
// rather than alongside every grammar note, so browsing grammar notes never costs
// an extra LLM call — only actually practicing one does.
function buildGrammarExercisePrompt(
  pattern: string,
  explanation: string,
  example: string,
  sourceLang: string,
  targetLang: string,
): string {
  return `You are a language learning assistant. Create practice exercises for this ${sourceLang} grammar pattern:

Pattern: ${pattern}
Explanation: ${explanation}
${example ? `Example: ${example}` : ""}

The learner's native language is ${targetLang}.

Respond with ONLY valid JSON matching this exact schema:
{
  "exercises": [
    {
      "type": "fill-blank|multiple-choice|transformation",
      "prompt": "string — the exercise question, in ${sourceLang} with instructions in ${targetLang} if helpful",
      "choices": ["string", "..."] — ONLY present for type multiple-choice,
      "answer": "string — the exact correct answer",
      "explanation": "string — brief explanation of why this is correct, in ${targetLang}"
    }
  ]
}

Rules:
- Exactly 3 exercises, mixing types when it makes sense for this specific pattern
- fill-blank: a sentence in ${sourceLang} with a blank ("___") to fill in
- multiple-choice: "choices" has the correct answer plus 2-3 plausible distractors
- transformation: ask the learner to rewrite a given sentence applying the pattern
  (e.g. change tense, make it negative, change the subject)`;
}

function buildLookupPrompt(word: string, sourceLang: string, targetLang: string): string {
  return `You are a language learning assistant. Look up the word or phrase "${word}" in ${sourceLang}.
The learner's native language is ${targetLang}.

Respond with ONLY valid JSON:
{
  "word": "${word}",
  "pos": "part of speech",
  "translation": "string",
  "register": "formal|informal|slang|neutral|technical",
  "etymologyHint": "string — 1 sentence origin or memory hook",
  "examples": ["example sentence 1 in ${sourceLang}", "example sentence 2 in ${sourceLang}"]
}`;
}

async function broadcastToExtensionViews(msg: ExtensionMessage): Promise<void> {
  const views = browser.extension.getViews({ type: "sidebar" });
  if (views.length === 0) {
    // Sidebar may not be open yet; try runtime.sendMessage to sidebar context
    try {
      await browser.runtime.sendMessage(msg);
    } catch {
      // No listeners yet — sidebar will get state from signals when it opens
    }
    return;
  }
  // Send to all sidebar windows
  await Promise.allSettled(
    views.map((v) => {
      return new Promise<void>((resolve) => {
        try {
          (v as Window & { browser?: typeof browser }).browser?.runtime.sendMessage(msg);
        } catch {
          /* ignore */
        }
        resolve();
      });
    }),
  );
  // Also send via runtime so the sidebar's onMessage fires
  try {
    await browser.runtime.sendMessage(msg);
  } catch {
    /* no sidebar listener */
  }
}

// Register context menu on install
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "linguaside-lookup",
    title: 'Look up "%s" in LinguaSide',
    contexts: ["selection"],
  });
});

// Handle context menu clicks
browser.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "linguaside-lookup") return;
  const word = info.selectionText?.trim();
  if (!word) return;

  // Open sidebar
  try {
    await browser.sidebarAction.open();
  } catch {
    /* ignore if already open */
  }

  const settings = await loadSettings();
  const systemPrompt = buildLookupPrompt(word, settings.sourceLang, settings.targetLang);

  try {
    const raw = await callLLM(systemPrompt, `Look up: ${word}`);
    const result = JSON.parse(raw) as WordLookupResult;
    await broadcastToExtensionViews({ type: "LOOKUP_WORD", payload: { word, result } });
  } catch (err) {
    await broadcastToExtensionViews({
      type: "LOOKUP_ERROR",
      payload: { message: humanizeApiError(err) },
    });
  }
});

// ─── Analysis caching ──────────────────────────────────────────────────────
// Keyed by page URL + language pair so revisiting (or reopening the sidebar on)
// the same article skips the API entirely. A cheap content hash guards against
// serving a stale cache if the page's text actually changed since it was cached.

interface CacheEntry {
  result: AnalysisResult;
  hash: string;
  cachedAt: number;
}

const ANALYSIS_CACHE_KEY = "analysisCache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 20;

function hashBlocks(blocks: SourceBlock[]): string {
  let h = 5381;
  for (const block of blocks) {
    for (let i = 0; i < block.source.length; i++) {
      h = ((h << 5) + h + block.source.charCodeAt(i)) | 0;
    }
  }
  return `${h.toString(36)}:${blocks.length}`;
}

async function readAnalysisCache(): Promise<Record<string, CacheEntry>> {
  const stored = await browser.storage.local.get(ANALYSIS_CACHE_KEY);
  return (stored[ANALYSIS_CACHE_KEY] as Record<string, CacheEntry> | undefined) ?? {};
}

async function getCachedAnalysis(cacheKey: string, hash: string): Promise<AnalysisResult | null> {
  const cache = await readAnalysisCache();
  const entry = cache[cacheKey];
  if (!entry || entry.hash !== hash) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
  return entry.result;
}

async function setCachedAnalysis(
  cacheKey: string,
  hash: string,
  result: AnalysisResult,
): Promise<void> {
  const cache = await readAnalysisCache();
  cache[cacheKey] = { result, hash, cachedAt: Date.now() };
  const trimmed = Object.fromEntries(
    // `Object.entries()` returns a fresh array, so sorting it in place doesn't
    // risk mutating anything shared (toSorted() would just copy it again).
    Object.entries(cache)
      // oxlint-disable-next-line unicorn/no-array-sort
      .sort(([, a], [, b]) => b.cachedAt - a.cachedAt)
      .slice(0, CACHE_MAX_ENTRIES),
  );
  await browser.storage.local.set({ [ANALYSIS_CACHE_KEY]: trimmed });
}

// ─── General grammar reference caching ─────────────────────────────────────
// Keyed by language + CEFR level, not by article — this is stable reference
// content, so it's cached far longer than the per-article analysis cache and
// only regenerated when the learner's language or level actually changes.

interface GeneralGrammarCacheEntry {
  topics: GeneralGrammarTopic[];
  cachedAt: number;
}

const GENERAL_GRAMMAR_CACHE_KEY = "generalGrammarCache";
const GENERAL_GRAMMAR_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function getCachedGeneralGrammar(cacheKey: string): Promise<GeneralGrammarTopic[] | null> {
  const stored = await browser.storage.local.get(GENERAL_GRAMMAR_CACHE_KEY);
  const cache =
    (stored[GENERAL_GRAMMAR_CACHE_KEY] as Record<string, GeneralGrammarCacheEntry> | undefined) ??
    {};
  const entry = cache[cacheKey];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > GENERAL_GRAMMAR_TTL_MS) return null;
  return entry.topics;
}

async function setCachedGeneralGrammar(
  cacheKey: string,
  topics: GeneralGrammarTopic[],
): Promise<void> {
  const stored = await browser.storage.local.get(GENERAL_GRAMMAR_CACHE_KEY);
  const cache =
    (stored[GENERAL_GRAMMAR_CACHE_KEY] as Record<string, GeneralGrammarCacheEntry> | undefined) ??
    {};
  cache[cacheKey] = { topics, cachedAt: Date.now() };
  await browser.storage.local.set({ [GENERAL_GRAMMAR_CACHE_KEY]: cache });
}

// Only one analysis runs at a time; starting a new one cancels whatever the
// previous one still had in flight so a rapid re-analyze doesn't keep burning
// tokens on a response nobody will see.
let activeAnalysisController: AbortController | null = null;

async function runAnalysis(
  payload: Extract<ExtensionMessage, { type: "ANALYZE_ARTICLE" }>["payload"],
): Promise<void> {
  const { blocks, title, url, sourceLang, targetLang, requestId, forceRefresh } = payload;
  const lang = sourceLang === "auto" ? "the article's language (auto-detect)" : sourceLang;
  const cacheKey = `${url}::${sourceLang}::${targetLang}`;
  const hash = hashBlocks(blocks);

  // A new analysis always supersedes whatever the previous one still had in
  // flight, whether or not this new one turns out to be a cache hit.
  activeAnalysisController?.abort();
  activeAnalysisController = null;

  if (!forceRefresh) {
    const cached = await getCachedAnalysis(cacheKey, hash).catch(() => null);
    if (cached) {
      await broadcastToExtensionViews({
        type: "ANALYSIS_RESULT",
        payload: { ...cached, requestId, sectionsPending: false },
      });
      return;
    }
  }

  const controller = new AbortController();
  activeAnalysisController = controller;

  // Vocabulary/grammar don't need structure, just prose — build it once from the
  // blocks rather than sending a second copy of the article text from the content
  // script.
  const proseText = blocks.map((b) => b.source).join("\n\n");
  const proseInput = `Article title: ${title}\n\n${proseText}`;
  const translationInput = `Article title: ${title}\n\nBlocks:\n${JSON.stringify(
    blocks.map((b) => ({ type: b.type, source: b.source })),
  )}`;

  const translationPromise = callLLM(
    buildSummaryTranslationPrompt(lang, targetLang),
    translationInput,
    8000,
    controller.signal,
  );
  const vocabPromise = callLLM(
    buildVocabularyPrompt(lang, targetLang),
    proseInput,
    2500,
    controller.signal,
  );
  const grammarPromise = callLLM(
    buildGrammarPrompt(lang, targetLang),
    proseInput,
    2000,
    controller.signal,
  );

  let summary: string;
  let translationParagraphs: TranslationSegment[];
  try {
    const raw = await translationPromise;
    const parsed = JSON.parse(raw) as { summary: string; translations: string[] };
    summary = parsed.summary;
    // Runs once per analysis over at most a few hundred blocks — not a hot path —
    // and mutating `block` in place would corrupt the original `blocks` array,
    // which is also used above to build the prompts and the cache hash.
    // oxlint-disable-next-line oxc/no-map-spread
    translationParagraphs = blocks.map((block, i) => ({
      ...block,
      target: parsed.translations[i] ?? "",
    }));
  } catch (err) {
    if (controller.signal.aborted && activeAnalysisController !== controller) return; // superseded — stay silent
    await broadcastToExtensionViews({
      type: "ANALYSIS_ERROR",
      payload: { message: humanizeApiError(err), requestId },
    });
    return;
  }

  if (controller.signal.aborted) return; // superseded right as translation finished

  // Summary + translation are the core of the analysis — deliver them immediately
  // instead of waiting on vocabulary/grammar too. Those two arrive independently
  // as ANALYSIS_SECTION_UPDATE messages and fill in the Vocab/Grammar tabs when ready.
  await broadcastToExtensionViews({
    type: "ANALYSIS_RESULT",
    payload: {
      summary,
      translationParagraphs,
      vocabulary: [],
      grammarNotes: [],
      requestId,
      sectionsPending: true,
    },
  });

  let vocabulary: VocabularyItem[] = [];
  let grammarNotes: GrammarNote[] = [];

  const vocabDone = vocabPromise
    .then((raw) => {
      vocabulary = (JSON.parse(raw) as { vocabulary: VocabularyItem[] }).vocabulary;
      return broadcastToExtensionViews({
        type: "ANALYSIS_SECTION_UPDATE",
        payload: { requestId, vocabulary },
      });
    })
    .catch(() => {
      /* non-critical — leave empty */
    });

  const grammarDone = grammarPromise
    .then((raw) => {
      grammarNotes = (JSON.parse(raw) as { grammarNotes: GrammarNote[] }).grammarNotes;
      return broadcastToExtensionViews({
        type: "ANALYSIS_SECTION_UPDATE",
        payload: { requestId, grammarNotes },
      });
    })
    .catch(() => {
      /* non-critical — leave empty */
    });

  await Promise.allSettled([vocabDone, grammarDone]);

  if (activeAnalysisController === controller) activeAnalysisController = null;
  if (!controller.signal.aborted) {
    await setCachedAnalysis(cacheKey, hash, {
      summary,
      translationParagraphs,
      vocabulary,
      grammarNotes,
    }).catch(() => {});
  }
}

// Handle messages from sidebar
browser.runtime.onMessage.addListener((rawMsg: unknown, _sender, sendResponse) => {
  const msg = rawMsg as ExtensionMessage;

  if (msg.type === "ANALYZE_ARTICLE") {
    runAnalysis(msg.payload);
    // Results are delivered via broadcast messages (ANALYSIS_RESULT /
    // ANALYSIS_SECTION_UPDATE / ANALYSIS_ERROR) rather than a single response, so
    // progressive updates can be sent as each underlying call finishes.
    return false;
  }

  if (msg.type === "GET_GENERAL_GRAMMAR") {
    const { sourceLang, level } = msg.payload;
    const cacheKey = `${sourceLang}::${level}`;

    (async () => {
      const cached = await getCachedGeneralGrammar(cacheKey).catch(() => null);
      if (cached) {
        sendResponse({ type: "GENERAL_GRAMMAR_RESULT", payload: { topics: cached } });
        return;
      }
      try {
        const raw = await callLLM(
          buildGeneralGrammarPrompt(sourceLang, level),
          "Generate the grammar reference.",
          3000,
        );
        const { topics } = JSON.parse(raw) as { topics: GeneralGrammarTopic[] };
        await setCachedGeneralGrammar(cacheKey, topics).catch(() => {});
        sendResponse({ type: "GENERAL_GRAMMAR_RESULT", payload: { topics } });
      } catch (err) {
        sendResponse({
          type: "GENERAL_GRAMMAR_ERROR",
          payload: { message: humanizeApiError(err) },
        });
      }
    })();

    return true;
  }

  if (msg.type === "GET_GRAMMAR_EXERCISES") {
    const { pattern, explanation, exampleFromText, sourceLang, targetLang } = msg.payload;

    (async () => {
      try {
        const raw = await callLLM(
          buildGrammarExercisePrompt(pattern, explanation, exampleFromText, sourceLang, targetLang),
          `Generate exercises for: ${pattern}`,
          2000,
        );
        const { exercises } = JSON.parse(raw) as { exercises: GrammarExercise[] };
        sendResponse({ type: "GRAMMAR_EXERCISES_RESULT", payload: { exercises } });
      } catch (err) {
        sendResponse({
          type: "GRAMMAR_EXERCISES_ERROR",
          payload: { message: humanizeApiError(err) },
        });
      }
    })();

    return true;
  }

  return false;
});
