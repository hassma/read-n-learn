import { analysis } from "../state";

export function SummaryTab() {
  const data = analysis.value;
  if (!data) return null;

  return (
    <>
      <section>
        <h2 class="section-heading">Summary</h2>
        <div class="island">
          <p>{data.summary}</p>
        </div>
      </section>

      {data.translationParagraphs.length > 0 && (
        <section>
          <h2 class="section-heading">Translation</h2>
          {data.translationParagraphs.map((pair, i) => (
            <div class="translation-pair island" key={i}>
              <p class="translation-source">{pair.source}</p>
              <p class="translation-target">{pair.target}</p>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
