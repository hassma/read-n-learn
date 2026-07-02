# LinguaSide

A Firefox sidebar extension for language learning while reading. Extracts article text and calls an OpenAI-compatible LLM to provide translation, vocabulary cards, grammar notes, and instant word lookups — all in a sidebar styled with Firefox's Nova design language.

## Installation

```sh
npm install
npm run build
```

Then in Firefox:

1. Navigate to `about:debugging`
2. Click **This Firefox** → **Load Temporary Add-on**
3. Select `manifest.json` in the `linguaside/` directory

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

## Development

```sh
npm run watch   # rebuilds on file changes
```

Output goes to `dist/` (gitignored). Reload the extension in `about:debugging` after each build.

## Notes

- Nova styling matches Firefox Nightly with `browser.nova.enabled = true`; the extension works in all Firefox versions ≥ 115
- Article text is truncated to ~12,000 characters (≈1,500 words) before sending to the LLM
- No data is stored except your settings in `browser.storage.local`; article text is never persisted
