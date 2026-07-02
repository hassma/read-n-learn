import { analysis } from "../state";

export function GrammarTab() {
  const data = analysis.value;

  if (!data || data.grammarNotes.length === 0) {
    return (
      <div class="state-card">
        <p>No grammar notes found.</p>
      </div>
    );
  }

  return (
    <>
      <h2 class="section-heading">Grammar Patterns</h2>
      {data.grammarNotes.map((note, i) => (
        <div class="island grammar-note" key={i}>
          <p class="grammar-note-pattern">{note.pattern}</p>
          <p class="grammar-note-explanation">{note.explanation}</p>
          {note.exampleFromText && (
            <div class="vocab-example">
              <p>{note.exampleFromText}</p>
              {note.targetLanguageEquivalent && (
                <p class="translation-target" style={{ marginTop: "var(--space-1)" }}>
                  {note.targetLanguageEquivalent}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
