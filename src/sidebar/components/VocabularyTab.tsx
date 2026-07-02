import { useSignal, type Signal } from "@preact/signals";
import { analysis } from "../state";
import type { VocabularyItem } from "../../types/analysis";

function highlightWord(text: string, word: string): Array<string | { mark: string }> {
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

function VocabCard({ item, index, openSet }: {
  item: VocabularyItem;
  index: number;
  openSet: Signal<Set<number>>;
}) {
  const isOpen = openSet.value.has(index);

  function toggle() {
    const next = new Set(openSet.value);
    if (isOpen) next.delete(index);
    else next.add(index);
    openSet.value = next;
  }

  const highlighted = highlightWord(item.exampleFromText, item.word);

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
        <span class={`badge badge-pos`}>{item.pos}</span>
        <span class={`badge badge-${item.difficulty}`}>{item.difficulty}</span>
        <span aria-hidden="true" style={{ marginLeft: "auto", color: "var(--color-text-faint)" }}>
          {isOpen ? "▲" : "▼"}
        </span>
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

export function VocabularyTab() {
  const data = analysis.value;
  const openSet = useSignal<Set<number>>(new Set());

  if (!data || data.vocabulary.length === 0) {
    return (
      <div class="state-card">
        <p>No vocabulary items found.</p>
      </div>
    );
  }

  return (
    <>
      <h2 class="section-heading">{data.vocabulary.length} key words</h2>
      {data.vocabulary.map((item, i) => (
        <VocabCard key={i} item={item} index={i} openSet={openSet} />
      ))}
    </>
  );
}
