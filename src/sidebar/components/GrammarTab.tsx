import { useEffect, useState } from "preact/hooks";
import {
  analysis,
  grammarPending,
  generalGrammarTopics,
  generalGrammarStatus,
  generalGrammarError,
  loadGeneralGrammar,
} from "../state";
import { GrammarNoteCard } from "./GrammarNoteCard";

export function GrammarTab() {
  const data = analysis.value;
  const [sourceLang, setSourceLang] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState("English");
  const [level, setLevel] = useState("B1");

  useEffect(() => {
    browser.storage.local.get(["sourceLang", "targetLang", "learnerLevel"]).then((stored) => {
      setSourceLang((stored.sourceLang as string) || "auto");
      setTargetLang((stored.targetLang as string) || "English");
      setLevel((stored.learnerLevel as string) || "B1");
    });
  }, []);

  useEffect(() => {
    if (sourceLang && sourceLang !== "auto" && generalGrammarStatus.value === "idle") {
      loadGeneralGrammar(sourceLang, level);
    }
  }, [sourceLang, level]);

  const articleNotes = data?.grammarNotes ?? [];
  const showArticleSection = articleNotes.length > 0 || grammarPending.value;

  return (
    <>
      <section>
        <h2 class="section-heading">
          General {sourceLang && sourceLang !== "auto" ? sourceLang : ""} Grammar
        </h2>

        {sourceLang !== null && sourceLang === "auto" && (
          <div class="state-card">
            <p>
              Set a specific source language in Settings to see a general grammar reference for your
              level.
            </p>
            <button class="btn-ghost" onClick={() => browser.runtime.openOptionsPage()}>
              Open Settings
            </button>
          </div>
        )}

        {sourceLang && sourceLang !== "auto" && generalGrammarStatus.value === "loading" && (
          <div class="state-card" aria-busy="true">
            <p>Building your {level} grammar reference…</p>
          </div>
        )}

        {sourceLang && sourceLang !== "auto" && generalGrammarStatus.value === "error" && (
          <div class="state-card error">
            <p>{generalGrammarError.value}</p>
            <button class="btn-ghost" onClick={() => loadGeneralGrammar(sourceLang, level)}>
              Try Again
            </button>
          </div>
        )}

        {generalGrammarStatus.value === "done" &&
          generalGrammarTopics.value.map((topic, i) => (
            <GrammarNoteCard
              key={i}
              pattern={topic.pattern}
              explanation={topic.explanation}
              example={topic.example}
              exampleTranslation={topic.exampleTranslation}
              sourceLang={sourceLang ?? "auto"}
              targetLang={targetLang}
            />
          ))}
      </section>

      {showArticleSection && (
        <section>
          <h2 class="section-heading">From This Article</h2>

          {grammarPending.value && articleNotes.length === 0 && (
            <div class="state-card" aria-busy="true">
              <p>Finding grammar patterns…</p>
            </div>
          )}

          {articleNotes.map((note, i) => (
            <GrammarNoteCard
              key={i}
              pattern={note.pattern}
              explanation={note.explanation}
              example={note.exampleFromText}
              exampleTranslation={note.targetLanguageEquivalent}
              sourceLang={sourceLang ?? "auto"}
              targetLang={targetLang}
            />
          ))}
        </section>
      )}
    </>
  );
}
