import { signal, computed } from "@preact/signals";
import type {
  AnalysisResult,
  GeneralGrammarTopic,
  WordLookupResult,
  SavedVocabItem,
} from "../types/analysis";
import type { ExtensionMessage } from "../types/messages";

export type AppStatus = "idle" | "loading" | "error" | "done";
export type TabId = "summary" | "vocabulary" | "grammar" | "lookup" | "saved" | "review";

export const status = signal<AppStatus>("idle");
export const activeTab = signal<TabId>("summary");
export const errorMessage = signal<string>("");
export const analysis = signal<AnalysisResult | null>(null);
export const wordLookup = signal<WordLookupResult | null>(null);
export const wordLookupStatus = signal<"idle" | "loading" | "error" | "done">("idle");
export const analyzedTabId = signal<number | null>(null);

// The current in-flight (or most recently started) analysis request. Incoming
// ANALYSIS_RESULT / ANALYSIS_SECTION_UPDATE / ANALYSIS_ERROR messages carry the
// requestId they belong to; anything that doesn't match is from a request that was
// superseded by a newer one and must be ignored so it can't clobber fresher state.
export const currentAnalysisRequestId = signal<string | null>(null);

// Vocabulary/grammar are delivered independently after the summary/translation, so
// the Vocab/Grammar tabs can show a "still working on it" state instead of an
// empty-results state while they're pending.
export const vocabularyPending = signal(false);
export const grammarPending = signal(false);

export const hasAnalysis = computed(() => analysis.value !== null);

// General grammar reference is independent of any analyzed article (it's keyed
// on the learner's language + level in Settings), so it's loaded lazily by
// GrammarTab rather than as part of the analysis flow.
export const generalGrammarTopics = signal<GeneralGrammarTopic[]>([]);
export const generalGrammarStatus = signal<"idle" | "loading" | "error" | "done">("idle");
export const generalGrammarError = signal<string>("");

export async function loadGeneralGrammar(sourceLang: string, level: string): Promise<void> {
  generalGrammarStatus.value = "loading";
  generalGrammarError.value = "";
  try {
    const result = (await browser.runtime.sendMessage({
      type: "GET_GENERAL_GRAMMAR",
      payload: { sourceLang, level },
    })) as ExtensionMessage;
    if (result.type === "GENERAL_GRAMMAR_RESULT") {
      generalGrammarTopics.value = result.payload.topics;
      generalGrammarStatus.value = "done";
    } else if (result.type === "GENERAL_GRAMMAR_ERROR") {
      generalGrammarError.value = result.payload.message;
      generalGrammarStatus.value = "error";
    }
  } catch (err) {
    generalGrammarError.value =
      err instanceof Error ? err.message : "Could not load the grammar reference.";
    generalGrammarStatus.value = "error";
  }
}

export async function jumpToText(text: string): Promise<void> {
  const tabId = analyzedTabId.value;
  if (tabId == null) return;
  try {
    await browser.tabs.sendMessage(tabId, { type: "HIGHLIGHT_TEXT", payload: { text } });
  } catch {
    // Tab may have navigated away or closed — nothing to jump to.
  }
}

const SAVED_VOCAB_KEY = "savedVocab";

export const savedVocabulary = signal<SavedVocabItem[]>([]);

// Legacy entries saved before spaced-repetition scheduling existed won't have
// these fields — treat them as due immediately rather than requiring a
// separate migration step.
function withScheduleDefaults(item: SavedVocabItem): SavedVocabItem {
  if (item.dueAt != null) return item;
  return {
    ...item,
    dueAt: item.savedAt ?? Date.now(),
    intervalDays: 0,
    easeFactor: 2.5,
    reviewCount: 0,
  };
}

export async function loadSavedVocabulary(): Promise<void> {
  const stored = await browser.storage.local.get(SAVED_VOCAB_KEY);
  const raw = (stored[SAVED_VOCAB_KEY] as SavedVocabItem[] | undefined) ?? [];
  const normalized = raw.map(withScheduleDefaults);
  savedVocabulary.value = normalized;
  if (normalized.some((item, i) => item !== raw[i])) {
    await browser.storage.local.set({ [SAVED_VOCAB_KEY]: normalized });
  }
}

export function isWordSaved(word: string): boolean {
  const key = word.trim().toLowerCase();
  return savedVocabulary.value.some((item) => item.word.trim().toLowerCase() === key);
}

export async function saveVocabularyItem(
  item: Omit<SavedVocabItem, "savedAt" | "dueAt" | "intervalDays" | "easeFactor" | "reviewCount">,
): Promise<void> {
  if (isWordSaved(item.word)) return;
  const now = Date.now();
  const next = [
    { ...item, savedAt: now, dueAt: now, intervalDays: 0, easeFactor: 2.5, reviewCount: 0 },
    ...savedVocabulary.value,
  ];
  savedVocabulary.value = next;
  await browser.storage.local.set({ [SAVED_VOCAB_KEY]: next });
}

export async function removeVocabularyItem(word: string): Promise<void> {
  const key = word.trim().toLowerCase();
  const next = savedVocabulary.value.filter((item) => item.word.trim().toLowerCase() !== key);
  savedVocabulary.value = next;
  await browser.storage.local.set({ [SAVED_VOCAB_KEY]: next });
}

// ─── Spaced-repetition review ──────────────────────────────────────────────
// Simplified SM-2: each rating adjusts `easeFactor` and `intervalDays`, which
// together determine how far out `dueAt` is pushed. "Again" doesn't fail the
// word out of the deck — it just comes back for a short-term re-try.

export type ReviewRating = "again" | "hard" | "good" | "easy";

const MIN_EASE_FACTOR = 1.3;
const AGAIN_DELAY_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function scheduleNextReview(item: SavedVocabItem, rating: ReviewRating): SavedVocabItem {
  if (rating === "again") {
    return {
      ...item,
      intervalDays: 0,
      easeFactor: Math.max(MIN_EASE_FACTOR, item.easeFactor - 0.2),
      reviewCount: 0,
      dueAt: Date.now() + AGAIN_DELAY_MS,
    };
  }

  let { intervalDays, easeFactor } = item;
  if (rating === "hard") {
    easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
    intervalDays = Math.max(1, intervalDays * 1.2);
  } else if (rating === "good") {
    intervalDays = item.reviewCount === 0 ? 1 : intervalDays * easeFactor;
  } else {
    easeFactor = easeFactor + 0.15;
    intervalDays = (item.reviewCount === 0 ? 2 : intervalDays * easeFactor) * 1.3;
  }

  return {
    ...item,
    intervalDays,
    easeFactor,
    reviewCount: item.reviewCount + 1,
    dueAt: Date.now() + intervalDays * DAY_MS,
  };
}

export async function submitReview(word: string, rating: ReviewRating): Promise<void> {
  const key = word.trim().toLowerCase();
  const next = savedVocabulary.value.map((item) =>
    item.word.trim().toLowerCase() === key ? scheduleNextReview(item, rating) : item,
  );
  savedVocabulary.value = next;
  await browser.storage.local.set({ [SAVED_VOCAB_KEY]: next });
  await bumpReviewStreak();
}

interface ReviewStreak {
  count: number;
  lastReviewDate: string; // YYYY-MM-DD, local date
}

const REVIEW_STREAK_KEY = "reviewStreak";

export const reviewStreak = signal<ReviewStreak>({ count: 0, lastReviewDate: "" });

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function loadReviewStreak(): Promise<void> {
  const stored = await browser.storage.local.get(REVIEW_STREAK_KEY);
  reviewStreak.value = (stored[REVIEW_STREAK_KEY] as ReviewStreak | undefined) ?? {
    count: 0,
    lastReviewDate: "",
  };
}

async function bumpReviewStreak(): Promise<void> {
  const today = dateString(new Date());
  const { count, lastReviewDate } = reviewStreak.value;
  if (lastReviewDate === today) return; // already reviewed today
  const yesterday = dateString(new Date(Date.now() - DAY_MS));
  const next: ReviewStreak = {
    count: lastReviewDate === yesterday ? count + 1 : 1,
    lastReviewDate: today,
  };
  reviewStreak.value = next;
  await browser.storage.local.set({ [REVIEW_STREAK_KEY]: next });
}
