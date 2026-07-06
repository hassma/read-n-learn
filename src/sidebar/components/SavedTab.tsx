import { savedVocabulary, removeVocabularyItem } from "../state";
import { VocabCard, useOpenSet } from "./VocabCard";

export function SavedTab() {
  const openSet = useOpenSet();
  const items = savedVocabulary.value;

  if (items.length === 0) {
    return (
      <div class="state-card">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M6 3h12a1 1 0 0 1 1 1v16l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
        </svg>
        <p>Words you save from the Vocab or Lookup tabs will appear here for later review.</p>
      </div>
    );
  }

  return (
    <>
      <h2 class="section-heading">
        {items.length} saved word{items.length === 1 ? "" : "s"}
      </h2>
      {items.map((item, i) => (
        <VocabCard
          key={item.word}
          item={item}
          index={i}
          openSet={openSet}
          isSaved={true}
          onToggleSave={() => removeVocabularyItem(item.word)}
          onRemove={() => removeVocabularyItem(item.word)}
        />
      ))}
    </>
  );
}
