import { signal, computed } from "@preact/signals";
import type { AnalysisResult, WordLookupResult, SavedVocabItem } from "../types/analysis";

export type AppStatus = "idle" | "loading" | "error" | "done";
export type TabId = "summary" | "vocabulary" | "grammar" | "lookup" | "saved";

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

export async function loadSavedVocabulary(): Promise<void> {
  const stored = await browser.storage.local.get(SAVED_VOCAB_KEY);
  savedVocabulary.value = (stored[SAVED_VOCAB_KEY] as SavedVocabItem[] | undefined) ?? [];
}

export function isWordSaved(word: string): boolean {
  const key = word.trim().toLowerCase();
  return savedVocabulary.value.some((item) => item.word.trim().toLowerCase() === key);
}

export async function saveVocabularyItem(item: Omit<SavedVocabItem, "savedAt">): Promise<void> {
  if (isWordSaved(item.word)) return;
  const next = [{ ...item, savedAt: Date.now() }, ...savedVocabulary.value];
  savedVocabulary.value = next;
  await browser.storage.local.set({ [SAVED_VOCAB_KEY]: next });
}

export async function removeVocabularyItem(word: string): Promise<void> {
  const key = word.trim().toLowerCase();
  const next = savedVocabulary.value.filter((item) => item.word.trim().toLowerCase() !== key);
  savedVocabulary.value = next;
  await browser.storage.local.set({ [SAVED_VOCAB_KEY]: next });
}
