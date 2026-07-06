import { useState } from "preact/hooks";
import type { GrammarExercise } from "../../types/analysis";
import type { ExtensionMessage } from "../../types/messages";

interface GrammarNoteCardProps {
  pattern: string;
  explanation: string;
  example: string;
  exampleTranslation: string;
  sourceLang: string;
  targetLang: string;
}

type PracticeStatus = "idle" | "loading" | "error" | "practicing" | "done";

function isCorrect(exercise: GrammarExercise, answer: string): boolean {
  return answer.trim().toLowerCase() === exercise.answer.trim().toLowerCase();
}

export function GrammarNoteCard({
  pattern,
  explanation,
  example,
  exampleTranslation,
  sourceLang,
  targetLang,
}: GrammarNoteCardProps) {
  const [status, setStatus] = useState<PracticeStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [exercises, setExercises] = useState<GrammarExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);

  async function startPractice() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const result = (await browser.runtime.sendMessage({
        type: "GET_GRAMMAR_EXERCISES",
        payload: { pattern, explanation, exampleFromText: example, sourceLang, targetLang },
      })) as ExtensionMessage;
      if (result.type === "GRAMMAR_EXERCISES_RESULT") {
        setExercises(result.payload.exercises);
        setIndex(0);
        setAnswer("");
        setChecked(false);
        setStatus("practicing");
      } else if (result.type === "GRAMMAR_EXERCISES_ERROR") {
        setErrorMsg(result.payload.message);
        setStatus("error");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not load exercises.");
      setStatus("error");
    }
  }

  function next() {
    if (index + 1 >= exercises.length) {
      setStatus("done");
      return;
    }
    setIndex(index + 1);
    setAnswer("");
    setChecked(false);
  }

  const current = exercises[index];

  return (
    <div class="island grammar-note">
      <p class="grammar-note-pattern">{pattern}</p>
      <p class="grammar-note-explanation">{explanation}</p>
      {example && (
        <div class="vocab-example">
          <p>{example}</p>
          {exampleTranslation && (
            <p class="translation-target" style={{ marginTop: "var(--space-1)" }}>
              {exampleTranslation}
            </p>
          )}
        </div>
      )}

      {status === "idle" && (
        <button class="btn-ghost grammar-practice-btn" onClick={startPractice}>
          Practice this pattern
        </button>
      )}

      {status === "loading" && <p class="grammar-practice-status">Preparing exercises…</p>}

      {status === "error" && (
        <div class="grammar-practice-status error">
          <p>{errorMsg}</p>
          <button class="btn-ghost" onClick={startPractice}>
            Try Again
          </button>
        </div>
      )}

      {status === "practicing" && current && (
        <div class="grammar-exercise">
          <p class="grammar-exercise-progress">
            Exercise {index + 1} of {exercises.length}
          </p>
          <p class="grammar-exercise-prompt">{current.prompt}</p>

          {current.type === "multiple-choice" && current.choices ? (
            <div class="grammar-exercise-choices">
              {current.choices.map((choice, i) => {
                const isSelected = answer === choice;
                const isRight = checked && choice === current.answer;
                const isWrongPick = checked && isSelected && choice !== current.answer;
                const cls = [
                  "grammar-choice-btn",
                  isSelected && "selected",
                  isRight && "correct",
                  isWrongPick && "incorrect",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button key={i} class={cls} disabled={checked} onClick={() => setAnswer(choice)}>
                    {choice}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              class="grammar-exercise-input"
              type="text"
              value={answer}
              disabled={checked}
              onInput={(e) => setAnswer((e.target as HTMLInputElement).value)}
              placeholder="Type your answer…"
            />
          )}

          {!checked ? (
            <button class="btn-primary" disabled={!answer} onClick={() => setChecked(true)}>
              Check
            </button>
          ) : (
            <>
              <p
                class={`grammar-exercise-feedback ${isCorrect(current, answer) ? "correct" : "incorrect"}`}
              >
                {isCorrect(current, answer)
                  ? "✓ Correct"
                  : `✗ Not quite — correct answer: ${current.answer}`}
              </p>
              {current.explanation && (
                <p class="grammar-exercise-explanation">{current.explanation}</p>
              )}
              <button class="btn-primary" onClick={next}>
                {index + 1 >= exercises.length ? "Finish" : "Next"}
              </button>
            </>
          )}
        </div>
      )}

      {status === "done" && (
        <div class="grammar-practice-status">
          <p>Nice work — practice complete.</p>
          <button class="btn-ghost" onClick={startPractice}>
            Practice again
          </button>
        </div>
      )}
    </div>
  );
}
