import {
  analysis,
  savedVocabulary,
  isWordSaved,
  saveVocabularyItem,
  removeVocabularyItem,
  vocabularyPending,
} from "../state";
import { VocabCard, useOpenSet } from "./VocabCard";
import type { VocabularyItem } from "../../types/analysis";

export function VocabularyTab() {
  const data = analysis.value;
  const openSet = useOpenSet();
  // Re-read for reactivity when saved list changes
  void savedVocabulary.value;

  if (!data || data.vocabulary.length === 0) {
    if (vocabularyPending.value) {
      return (
        <div class="state-card" aria-busy="true">
          <p>Finding key vocabulary…</p>
        </div>
      );
    }
    return (
      <div class="state-card">
        <p>No vocabulary items found.</p>
      </div>
    );
  }

  function toggleSave(item: VocabularyItem) {
    if (isWordSaved(item.word)) {
      removeVocabularyItem(item.word);
    } else {
      saveVocabularyItem({
        word: item.word,
        pos: item.pos,
        translation: item.translation,
        difficulty: item.difficulty,
        clue: item.clue,
        exampleFromText: item.exampleFromText,
      });
    }
  }

  return (
    <>
      <h2 class="section-heading">{data.vocabulary.length} key words</h2>
      {data.vocabulary.map((item, i) => (
        <VocabCard
          key={i}
          item={item}
          index={i}
          openSet={openSet}
          isSaved={isWordSaved(item.word)}
          onToggleSave={() => toggleSave(item)}
        />
      ))}
    </>
  );
}
