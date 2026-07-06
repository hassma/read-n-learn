# LinguaSide Roadmap

Feature ideas and planning notes, roughly ordered by how soon they'd land. Not
commitments — a working list to pick from and revise as priorities change.

## Shipped

### Flashcard / spaced-repetition review

New "Review" tab. Saved words carry SM-2-lite scheduling (`dueAt`, `intervalDays`,
`easeFactor`, `reviewCount` on `SavedVocabItem`); the tab shows one due card at a
time (word → reveal translation/clue/example → Again/Hard/Good/Easy), plus a
simple daily streak. All local, no backend.

### Richer grammar learning

The Grammar tab is now standalone (not gated behind analyzing an article) and
has two sections. "General {language} Grammar" is a per-language/CEFR-level
reference (6-8 core topics), fetched once and cached in `browser.storage.local`
for 7 days keyed by language+level — not regenerated per article. It needs a
specific source language set in Settings (a new "Your level" CEFR picker was
added alongside it); if the source language is still "auto", a hint points the
user at Settings instead of guessing. "From This Article" keeps the existing
article-grounded notes. Every grammar card (general or article) has a
"Practice this pattern" button that generates 3 exercises on demand (fill-blank,
multiple-choice, transformation) via a new `GET_GRAMMAR_EXERCISES` call —
exercises are never generated automatically, so browsing grammar costs nothing
extra; only practicing does.

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

## Bigger bet: companion PWA + sync

The idea: a Progressive Web App where saved vocabulary and analyzed articles
sync from the extension, so review/learning can happen on any device, not just
in the Firefox sidebar where the data currently lives. A PWA over a plain
website because:

- **Installable** — adds to the home screen/dock like a native app, no app
  store needed.
- **Offline-capable** — a service worker can cache the review UI and due
  flashcards, so reviewing on a commute/flight doesn't need connectivity.
- **Push notifications** — "you have 12 words due for review" is a natural fit
  and is the piece most likely to actually bring people back to review.
- **Shares the stack** — both the extension sidebar and a PWA can be Preact +
  signals, so the flashcard/vocab-card UI (`VocabCard.tsx` and friends) has a
  real shot at being shared code, not a rewrite.

This is still a real architecture shift, not just a new tab, because the
extension today is fully local — no accounts, no server, "bring your own API
key," and no user data ever leaves the browser except the article text sent
directly to whatever LLM endpoint the user configured. Adding sync means
introducing:

- **Accounts** — some auth (email/password or OAuth) to know whose data is whose.
- **A backend** — API + database to store synced vocabulary/article history per
  user. Options range from a small Cloudflare Workers + D1/KV service to a
  conventional Node/Postgres API to something like Supabase for less
  infrastructure to own.
- **A sync protocol** — extension pushes `savedVocabulary` (and maybe the
  existing analysis cache) to the backend on change; last-write-wins conflict
  resolution is probably fine for this data shape (append-mostly vocab lists).
- **The PWA itself** — a dashboard: browse synced articles, a roomier
  flashcard/review UI than the sidebar can offer, stats over time, and the
  install prompt + service worker plumbing that makes it a PWA rather than
  just a page.
- **A privacy/trust story** — today nothing is collected or stored outside the
  user's own browser + their own LLM provider. Syncing vocabulary and reading
  history to a first-party server is a meaningfully different privacy posture
  and should be opt-in, clearly explained, and probably worth a written privacy
  policy once it exists.

Suggested phasing, so this doesn't have to be one giant effort:

1. **Local-first, sync optional** — the extension keeps working fully offline/
   local exactly as it does now; an account + "sync my saved words" toggle is
   additive, not required.
2. **Read-only PWA shell** — a simple installable page that shows synced
   vocabulary and lets you review flashcards offline, no editing/analysis on
   the PWA side yet, service worker just caches the review UI + due cards.
3. **Full PWA** — article history, richer stats, review-due push notifications,
   maybe kicking off an analysis from the PWA itself (would need it to either
   hold an LLM key too, or defer analysis back to a browser with the extension
   installed).

Open questions to settle before starting this: hosting/infra choice, auth
provider, and how much (if any) of the "bring your own API key" model carries
over to the PWA side.

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
