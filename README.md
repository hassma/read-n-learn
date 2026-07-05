# LinguaSide

A Firefox sidebar extension for language learning while reading. Extracts article text and calls an OpenAI-compatible LLM to provide translation, vocabulary cards, grammar notes, and instant word lookups — all in a sidebar styled with Firefox's Nova design language.

## Installation

```sh
pnpm install
pnpm run build
```

Then in Firefox:

1. Navigate to `about:debugging`
2. Click **This Firefox** → **Load Temporary Add-on**
3. Select `manifest.json` in the repository root

The extension will remain loaded until Firefox restarts.

## Configuration

Click the **⚙** gear icon in the sidebar (or go to `about:addons` → LinguaSide → Preferences) and fill in:

| Field | Description |
|-------|-------------|
| API Base URL | Provider endpoint (see below) |
| API Key | Your provider's secret key |
| Model | Model ID (e.g. `gpt-4o-mini`) |
| Source language | Language of the articles you read (or leave blank to auto-detect) |
| Your native language | Language for translations and summaries (default: English) |

Click **Save Settings**, then **Test Connection** to verify.

## Compatible Providers

| Provider | Base URL |
|----------|----------|
| OpenAI | `https://api.openai.com/v1` |
| Groq | `https://api.groq.com/openai/v1` |
| Together AI | `https://api.together.xyz/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` — model IDs are prefixed, e.g. `anthropic/claude-3.5-sonnet`, `openai/gpt-4o-mini` |
| Ollama (local) | `http://localhost:11434/v1` — use `ollama` as API key |
| LM Studio (local) | `http://localhost:1234/v1` — use any string as API key |

## Usage

1. Navigate to any article in your target language
2. Open the LinguaSide sidebar: **View → Sidebar → LinguaSide**
3. Click **Analyze Article** to run the full analysis
4. Switch between tabs:
   - **Summary** — 2-3 sentence summary + side-by-side paragraph translation
   - **Vocab** — collapsible cards with CEFR level, POS, mnemonic clue, and highlighted example
   - **Grammar** — notable patterns found in the article with examples
   - **Lookup** — right-click any word → "Look up in LinguaSide" for instant lookup
   - **Saved** — star (☆) any word in the Vocab or Lookup tabs to add it to a persistent
     list you can reopen any time, across articles and browser restarts

## Development

```sh
pnpm run watch   # rebuilds on file changes
```

Output goes to `dist/` (gitignored). Reload the extension in `about:debugging` after each build.

## Packaging for Firefox

```sh
pnpm run package
```

This builds the extension, lints it with `web-ext lint`, and produces a signed-ready
`.zip` in `web-ext-artifacts/` containing only `manifest.json`, `dist/`, and `icons/` —
suitable for upload to [addons.mozilla.org](https://addons.mozilla.org/developers/) or
for permanent installation via `about:addons` → gear icon → **Install Add-on From File**.

## Notes

- Nova styling matches Firefox Nightly with `browser.nova.enabled = true`; the extension works in all Firefox versions ≥ 115
- Article extraction prefers common content containers (`<article>`, `[role="main"]`, `.entry-content`, etc.) before falling back to link-density-aware scoring, to skip nav/ads/comments/related-posts noise on real-world sites
- Extraction reads structure (heading depth, list membership, table membership, blockquotes) directly off the page DOM and carries it through end to end — the LLM only translates each block's text, it never has to re-guess structure from plain prose, which makes oddly-templated pages (recipe steps, ingredient lists, FAQ blocks) render as real lists/tables instead of generic paragraphs
- Article content is truncated to ~20,000 characters (≈2,500 words) of blocks before sending to the LLM, always cut on a block boundary
- Analysis is split into three parallel LLM calls (summary+translation, vocabulary, grammar) so full-article translation isn't capped to leave room for the other sections in a single response, and a failure in one section doesn't sink the whole analysis
- Click the ↗ icon next to any translated line to jump to and highlight that text on the live page
- No data is stored except your settings in `browser.storage.local`; article text is never persisted
