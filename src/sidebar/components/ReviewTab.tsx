import { useState } from "preact/hooks";
import { savedVocabulary, submitReview, reviewStreak, type ReviewRating } from "../state";
import { highlightWord } from "./VocabCard";
import type { SavedVocabItem } from "../../types/analysis";

function dueWords(items: SavedVocabItem[]): SavedVocabItem[] {
  const now = Date.now();
  return items.filter((item) => item.dueAt <= now);
}

function formatWait(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function StreakLine() {
  if (reviewStreak.value.count === 0) return null;
  return <p class="review-streak">🔥 {reviewStreak.value.count}-day streak</p>;
}

export function ReviewTab() {
  const items = savedVocabulary.value;
  // Captured once when the tab is opened so the session stays stable even as
  // ratings update `savedVocabulary` (e.g. an "Again" card becoming due again
  // ten minutes from now shouldn't loop back into the same session).
  const [queue] = useState(() => dueWords(items));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  if (items.length === 0) {
    return (
      <div class="state-card">
        <p>Save some words from the Vocab or Lookup tabs, then come back here to review them.</p>
      </div>
    );
  }

  if (queue.length === 0) {
    const nextDueAt = Math.min(...items.map((item) => item.dueAt));
    const wait = nextDueAt - Date.now();
    return (
      <div class="state-card">
        <p>All caught up — nothing is due for review right now.</p>
        {wait > 0 && <p class="review-next-hint">Next word due in {formatWait(wait)}.</p>}
        <StreakLine />
      </div>
    );
  }

  if (index >= queue.length) {
    return (
      <div class="state-card">
        <p>
          Nice work — you reviewed {queue.length} word{queue.length === 1 ? "" : "s"}.
        </p>
        <StreakLine />
      </div>
    );
  }

  const current = queue[index];
  const highlighted = current.exampleFromText
    ? highlightWord(current.exampleFromText, current.word)
    : [];

  function rate(rating: ReviewRating) {
    submitReview(current.word, rating);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  return (
    <>
      <p class="review-progress">
        Card {index + 1} of {queue.length}
      </p>
      <div class="island review-card">
        <div class="review-card-front">
          <span class="review-word">{current.word}</span>
          <span class="badge badge-pos">{current.pos}</span>
          {current.difficulty && (
            <span class={`badge badge-${current.difficulty}`}>{current.difficulty}</span>
          )}
        </div>

        {!revealed && (
          <button class="btn-primary" onClick={() => setRevealed(true)}>
            Show answer
          </button>
        )}

        {revealed && (
          <div class="review-card-back">
            <p class="review-translation">{current.translation}</p>
            {current.clue && <p class="vocab-clue">💡 {current.clue}</p>}
            {current.exampleFromText && (
              <div class="vocab-example">
                {highlighted.map((part, i) =>
                  typeof part === "string" ? (
                    <span key={i}>{part}</span>
                  ) : (
                    <mark key={i}>{part.mark}</mark>
                  ),
                )}
              </div>
            )}
            <div class="review-ratings">
              <button class="review-rating-btn again" onClick={() => rate("again")}>
                Again
              </button>
              <button class="review-rating-btn hard" onClick={() => rate("hard")}>
                Hard
              </button>
              <button class="review-rating-btn good" onClick={() => rate("good")}>
                Good
              </button>
              <button class="review-rating-btn easy" onClick={() => rate("easy")}>
                Easy
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
