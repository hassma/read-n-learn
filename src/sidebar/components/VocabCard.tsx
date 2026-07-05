import { useSignal, type Signal } from "@preact/signals";

export function highlightWord(text: string, word: string): Array<string | { mark: string }> {
  const parts: Array<string | { mark: string }> = [];
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ mark: m[1] });
    last = m.index + m[1].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export interface VocabCardData {
  word: string;
  pos: string;
  translation: string;
  difficulty: string | null;
  clue: string;
  exampleFromText: string;
}

export function VocabCard({ item, index, openSet, isSaved, onToggleSave, onRemove }: {
  item: VocabCardData;
  index: number;
  openSet: Signal<Set<number>>;
  isSaved: boolean;
  onToggleSave: () => void;
  onRemove?: () => void;
}) {
  const isOpen = openSet.value.has(index);

  function toggle() {
    const next = new Set(openSet.value);
    if (isOpen) next.delete(index);
    else next.add(index);
    openSet.value = next;
  }

  const highlighted = item.exampleFromText ? highlightWord(item.exampleFromText, item.word) : [];

  return (
    <div class="vocab-card">
      <div
        class="vocab-card-header"
        onClick={toggle}
        role="button"
        aria-expanded={isOpen}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
      >
        <span class="vocab-word">{item.word}</span>
        <span class="vocab-translation">{item.translation}</span>
        <span class="badge badge-pos">{item.pos}</span>
        {item.difficulty && <span class={`badge badge-${item.difficulty}`}>{item.difficulty}</span>}
        <button
          class={`icon-btn-save${isSaved ? " saved" : ""}`}
          aria-label={isSaved ? "Remove from saved list" : "Save to list"}
          title={isSaved ? "Remove from saved list" : "Save to list"}
          onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
        >
          {isSaved ? "★" : "☆"}
        </button>
        {onRemove && (
          <button
            class="icon-btn-remove"
            aria-label="Remove from list"
            title="Remove from list"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            ✕
          </button>
        )}
        <span class="chevron" aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
      </div>

      {isOpen && (
        <div class="vocab-card-body">
          {item.clue && <p class="vocab-clue">💡 {item.clue}</p>}
          {item.exampleFromText && (
            <div class="vocab-example">
              {highlighted.map((part, i) =>
                typeof part === "string"
                  ? <span key={i}>{part}</span>
                  : <mark key={i}>{part.mark}</mark>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function useOpenSet() {
  return useSignal<Set<number>>(new Set());
}
