# LinguaSide Roadmap

Feature ideas and planning notes, roughly ordered by how soon they'd land. Not
commitments — a working list to pick from and revise as priorities change.

## Next up

### On-page overlay mode

Highlight vocabulary words directly on the live article instead of only in the
sidebar, so reading and translating happen in the same view.

- Content script walks the same block elements used for extraction/highlighting
  (`content.ts` already has the text-matching machinery from the jump-to-text
  feature) and wraps occurrences of `analysis.vocabulary[].word` in a `<mark>`-like
  inline element.
- Hover (or tap, for touch) shows a small popover with translation + clue, styled
  with the same design tokens as the sidebar (`sidebar.css` custom properties).
- Needs a toggle (on by default after analysis completes? opt-in via a sidebar
  button?) and a way to turn it off per-page without disabling the extension.
- Watch out for: sites with contenteditable regions, sites that re-render their
  DOM (SPAs) and would need the overlay reapplied via a MutationObserver, and
  avoiding double-highlighting inside already-marked regions.

### Flashcard / spaced-repetition review

Turn the Saved tab from a static list into an actual review flow, so collected
words get learned instead of just archived.

- Extend `SavedVocabItem` (`types/analysis.ts`) with SRS scheduling fields:
  `intervalDays`, `easeFactor`, `dueAt`, `reviewCount`. A simple SM-2-lite or
  Leitner-box scheduler is enough — no need for a full SuperMemo implementation.
- New "Review" tab or mode: shows only cards where `dueAt <= now`, front = word,
  reveal → translation/clue/example, then Again / Hard / Good / Easy buttons
  adjust the schedule and move to the next due card.
- Track a simple daily streak (last reviewed date) for motivation.
- All state stays in `browser.storage.local` like the rest of the app — no
  backend needed for this piece on its own.

## Bigger bet: companion website + sync

The idea: a web app where saved vocabulary and analyzed articles sync from the
extension, so review/learning can happen on any device, not just in the
Firefox sidebar where the data currently lives.

This is a real architecture shift, not just a new tab, because the extension is
currently fully local — no accounts, no server, "bring your own API key," and no
user data ever leaves the browser except the article text sent directly to
whatever LLM endpoint the user configured. Adding sync means introducing:

- **Accounts** — some auth (email/password or OAuth) to know whose data is whose.
- **A backend** — API + database to store synced vocabulary/article history per
  user. Options range from a small Cloudflare Workers + D1/KV service to a
  conventional Node/Postgres API to something like Supabase for less
  infrastructure to own.
- **A sync protocol** — extension pushes `savedVocabulary` (and maybe the
  existing analysis cache) to the backend on change; last-write-wins conflict
  resolution is probably fine for this data shape (append-mostly vocab lists).
- **The web app itself** — a dashboard: browse synced articles, a roomier
  flashcard/review UI than the sidebar can offer, stats over time.
- **A privacy/trust story** — today nothing is collected or stored outside the
  user's own browser + their own LLM provider. Syncing vocabulary and reading
  history to a first-party server is a meaningfully different privacy posture
  and should be opt-in, clearly explained, and probably worth a written privacy
  policy once it exists.

Suggested phasing, so this doesn't have to be one giant effort:

1. **Local-first, sync optional** — the extension keeps working fully offline/
   local exactly as it does now; an account + "sync my saved words" toggle is
   additive, not required.
2. **Read-only web view** — a simple hosted page that shows synced vocabulary
   and lets you review flashcards from a browser, no editing/analysis on the
   web side yet.
3. **Full web app** — article history, richer stats, maybe kicking off an
   analysis from the website itself (would need the website to either hold an
   LLM key too, or defer analysis back to a browser with the extension installed).

Open questions to settle before starting this: hosting/infra choice, auth
provider, and how much (if any) of the "bring your own API key" model carries
over to the web side.

## Smaller ideas (backlog)

- **Text-to-speech** — `speechSynthesis` (built into the browser, no LLM cost)
  to pronounce a word or sentence on click.
- **CEFR-level filter** — set a target level (e.g. B1) so the vocabulary prompt
  skips words at/below it instead of mixing trivial and useful words together.
- **Export saved vocabulary** — CSV or Anki-compatible export, for people who'd
  rather review in a tool they already use than build review in-house.
- **Article history** — a browsable list of past analyses; cheap to add now
  that analysis results are already cached by URL (`background.ts`).
- **Keyboard shortcuts** — e.g. open sidebar, navigate vocab cards, without a
  mouse.
- **Per-task model selection** — cheaper/faster model for vocabulary/grammar,
  stronger model for translation (raised earlier, deferred in favor of caching/
  reliability work).
