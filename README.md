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

| Field                | Description                                                       |
| -------------------- | ----------------------------------------------------------------- |
| API Base URL         | Provider endpoint (see below)                                     |
| API Key              | Your provider's secret key                                        |
| Model                | Model ID (e.g. `gpt-4o-mini`)                                     |
| Source language      | Language of the articles you read (or leave blank to auto-detect) |
| Your native language | Language for translations and summaries (default: English)        |

Click **Save Settings**, then **Test Connection** to verify.

## Compatible Providers

| Provider          | Base URL                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| OpenAI            | `https://api.openai.com/v1`                                                                                       |
| Groq              | `https://api.groq.com/openai/v1`                                                                                  |
| Together AI       | `https://api.together.xyz/v1`                                                                                     |
| OpenRouter        | `https://openrouter.ai/api/v1` — model IDs are prefixed, e.g. `anthropic/claude-3.5-sonnet`, `openai/gpt-4o-mini` |
| Ollama (local)    | `http://localhost:11434/v1` — use `ollama` as API key                                                             |
| LM Studio (local) | `http://localhost:1234/v1` — use any string as API key                                                            |

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

### Linting and formatting

This project uses [oxlint](https://oxc.rs/docs/guide/usage/linter) and [oxfmt](https://oxc.rs/docs/guide/usage/formatter) (config in `.oxlintrc.json` / `.oxfmtrc.json`):

```sh
pnpm run lint          # check for lint issues
pnpm run lint:fix      # auto-fix what oxlint can
pnpm run format        # format all files in place
pnpm run format:check  # check formatting without writing (used in CI)
```

## Packaging for Firefox

```sh
pnpm run package
```

This builds the extension, lints it with `web-ext lint`, and produces a signed-ready
`.zip` in `web-ext-artifacts/` containing only `manifest.json`, `dist/`, and `icons/` —
suitable for upload to [addons.mozilla.org](https://addons.mozilla.org/developers/) or
for permanent installation via `about:addons` → gear icon → **Install Add-on From File**.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned features and ideas (overlay mode,
spaced-repetition review, richer grammar practice, a synced companion PWA, and more).

## Notes

- Nova styling matches Firefox Nightly with `browser.nova.enabled = true`; the extension works in all Firefox versions ≥ 115
- Article extraction prefers common content containers (`<article>`, `[role="main"]`, `.entry-content`, etc.) before falling back to link-density-aware scoring, to skip nav/ads/comments/related-posts noise on real-world sites
- Extraction reads structure (heading depth, list membership, table membership, blockquotes) directly off the page DOM and carries it through end to end — the LLM only translates each block's text, it never has to re-guess structure from plain prose, which makes oddly-templated pages (recipe steps, ingredient lists, FAQ blocks) render as real lists/tables instead of generic paragraphs
- Article content is truncated to ~20,000 characters (≈2,500 words) of blocks before sending to the LLM, always cut on a block boundary
- Analysis is split into three LLM calls (summary+translation, vocabulary, grammar); the summary/translation result is delivered to the sidebar as soon as it's ready, with vocabulary and grammar filling in independently as those calls finish — a failure in one section doesn't sink the whole analysis
- Analysis results are cached in `browser.storage.local` per page URL + language pair (24h TTL, ~20 pages), so revisiting or reopening the sidebar on the same article skips the API entirely; "Re-analyze" always bypasses the cache and forces a fresh call
- LLM calls retry with backoff on rate-limit/server-busy responses (429/502/503/504), time out after 30s instead of hanging, and a new analysis cancels whatever the previous one still had in flight
- Click the ↗ icon next to any translated line to jump to and highlight that text on the live page
- No data is stored except your settings and the analysis cache described above, both in `browser.storage.local`; article text itself is never sent anywhere but the LLM provider
