import type { ExtensionMessage, } from "../types/messages";
import type { AnalysisResult, WordLookupResult } from "../types/analysis";

interface ApiSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  sourceLang: string;
  targetLang: string;
}

async function loadSettings(): Promise<ApiSettings> {
  const stored = await browser.storage.local.get([
    "apiKey", "baseUrl", "model", "sourceLang", "targetLang",
  ]);
  return {
    apiKey:     (stored.apiKey as string)     || "",
    baseUrl:    (stored.baseUrl as string)    || "https://api.openai.com/v1",
    model:      (stored.model as string)      || "gpt-4o-mini",
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

async function callLLM(systemPrompt: string, userContent: string): Promise<string> {
  const settings = await loadSettings();
  if (!settings.apiKey) throw new Error("No API key configured — open settings to add one.");

  const response = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      ...providerHeaders(settings.baseUrl),
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status}::${body}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

function humanizeApiError(err: unknown): string {
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

function buildAnalysisPrompt(sourceLang: string, targetLang: string): string {
  return `You are a language learning assistant. The user is reading an article in ${sourceLang}.
Their native language is ${targetLang}.

Analyze the article and respond with ONLY valid JSON matching this exact schema:
{
  "summary": "string — 2-3 sentence summary in ${targetLang}",
  "translationParagraphs": [
    {
      "type": "heading|paragraph",
      "source": "original text",
      "target": "translated text"
    }
  ],
  "vocabulary": [
    {
      "word": "string",
      "pos": "noun|verb|adjective|adverb|phrase|other",
      "translation": "string",
      "difficulty": "A1|A2|B1|B2|C1|C2",
      "clue": "string — memorable mnemonic or etymology hint",
      "exampleFromText": "string — exact sentence from article containing this word"
    }
  ],
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
- translationParagraphs: first 5-8 segments from the article, in original reading order.
  If the article uses section headings/subheadings, include them as their own segment
  with type "heading" (do not merge a heading into the paragraph that follows it).
  Regular body paragraphs use type "paragraph". If the article has no headings, every
  segment is type "paragraph".
- vocabulary: 10-15 most important words for comprehension, prioritize domain-specific and non-cognates
- grammarNotes: 3-5 notable grammar patterns found in the text`;
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
        } catch { /* ignore */ }
        resolve();
      });
    })
  );
  // Also send via runtime so the sidebar's onMessage fires
  try {
    await browser.runtime.sendMessage(msg);
  } catch { /* no sidebar listener */ }
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
  } catch { /* ignore if already open */ }

  const settings = await loadSettings();
  const systemPrompt = buildLookupPrompt(word, settings.sourceLang, settings.targetLang);

  try {
    const raw = await callLLM(systemPrompt, `Look up: ${word}`);
    const result = JSON.parse(raw) as WordLookupResult;
    await broadcastToExtensionViews({ type: "LOOKUP_WORD", payload: { word, result } });
  } catch (err) {
    await broadcastToExtensionViews({ type: "LOOKUP_ERROR", payload: { message: humanizeApiError(err) } });
  }
});

// Handle messages from sidebar
browser.runtime.onMessage.addListener((rawMsg: unknown, _sender, sendResponse) => {
  const msg = rawMsg as ExtensionMessage;

  if (msg.type === "ANALYZE_ARTICLE") {
    const { text, sourceLang, targetLang } = msg.payload;
    const systemPrompt = buildAnalysisPrompt(
      sourceLang === "auto" ? "the article's language (auto-detect)" : sourceLang,
      targetLang,
    );

    callLLM(systemPrompt, `Analyze this article:\n\n${text}`)
      .then((raw) => {
        const result = JSON.parse(raw) as AnalysisResult;
        sendResponse({ type: "ANALYSIS_RESULT", payload: result });
      })
      .catch((err) => {
        sendResponse({ type: "ANALYSIS_ERROR", payload: { message: humanizeApiError(err) } });
      });

    // Return true to keep the message channel open for async response
    return true;
  }

  return false;
});
