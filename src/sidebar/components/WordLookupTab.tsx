import {
  wordLookup,
  wordLookupStatus,
  isWordSaved,
  saveVocabularyItem,
  removeVocabularyItem,
  savedVocabulary,
} from "../state";

function SkeletonLookup() {
  return (
    <div class="island" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div class="skeleton skeleton-heading" />
      <div class="skeleton skeleton-text" />
      <div class="skeleton skeleton-text" />
      <div class="skeleton skeleton-text" style={{ width: "80%" }} />
    </div>
  );
}

export function WordLookupTab() {
  const status = wordLookupStatus.value;
  const result = wordLookup.value;
  // Re-read for reactivity when saved list changes
  void savedVocabulary.value;

  if (status === "loading") return <SkeletonLookup />;

  if (status === "error") {
    return (
      <div class="state-card error">
        <p>Word lookup failed. Try right-clicking a word again.</p>
      </div>
    );
  }

  if (!result) {
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
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <p>
          Right-click any word on the page and choose <strong>"Look up in LinguaSide"</strong>.
        </p>
      </div>
    );
  }

  const lookup = result;
  const saved = isWordSaved(lookup.word);

  function toggleSave() {
    if (saved) {
      removeVocabularyItem(lookup.word);
    } else {
      saveVocabularyItem({
        word: lookup.word,
        pos: lookup.pos,
        translation: lookup.translation,
        difficulty: null,
        clue: lookup.etymologyHint,
        exampleFromText: lookup.examples[0] ?? "",
      });
    }
  }

  return (
    <div class="island" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div
        style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap" }}
      >
        <span
          style={{
            fontSize: "var(--font-size-large)",
            fontWeight: "var(--font-weight-bold)",
            minWidth: 0,
          }}
        >
          {result.word}
        </span>
        <span class="badge badge-pos">{result.pos}</span>
        <span
          class="badge"
          style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent)" }}
        >
          {result.register}
        </span>
        <button
          class={`icon-btn-save${saved ? " saved" : ""}`}
          style={{ marginLeft: "auto" }}
          aria-label={saved ? "Remove from saved list" : "Save to list"}
          title={saved ? "Remove from saved list" : "Save to list"}
          onClick={toggleSave}
        >
          {saved ? "★" : "☆"}
        </button>
      </div>

      <p style={{ color: "var(--color-text)", fontSize: "var(--font-size-large)" }}>
        {result.translation}
      </p>

      {result.etymologyHint && (
        <p class="vocab-clue" style={{ fontSize: "var(--font-size-small)" }}>
          💡 {result.etymologyHint}
        </p>
      )}

      {result.examples.map((ex, i) => (
        <div class="vocab-example" key={i}>
          {ex}
        </div>
      ))}
    </div>
  );
}
