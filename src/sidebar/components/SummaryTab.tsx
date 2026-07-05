import { analysis } from "../state";
import type { TranslationSegment } from "../../types/analysis";

interface TranslationGroup {
  heading: TranslationSegment | null;
  paragraphs: TranslationSegment[];
}

function groupByHeading(segments: TranslationSegment[]): TranslationGroup[] {
  const groups: TranslationGroup[] = [];
  let current: TranslationGroup = { heading: null, paragraphs: [] };

  for (const segment of segments) {
    if (segment.type === "heading") {
      if (current.heading || current.paragraphs.length > 0) groups.push(current);
      current = { heading: segment, paragraphs: [] };
    } else {
      current.paragraphs.push(segment);
    }
  }
  if (current.heading || current.paragraphs.length > 0) groups.push(current);

  return groups;
}

export function SummaryTab() {
  const data = analysis.value;
  if (!data) return null;

  const groups = groupByHeading(data.translationParagraphs);

  return (
    <>
      <section>
        <h2 class="section-heading">Summary</h2>
        <div class="island">
          <p>{data.summary}</p>
        </div>
      </section>

      {groups.length > 0 && (
        <section>
          <h2 class="section-heading">Translation</h2>
          {groups.map((group, gi) => (
            <div class="translation-group" key={gi}>
              {group.heading && (
                <div class="translation-heading">
                  <p class="translation-heading-source">{group.heading.source}</p>
                  <p class="translation-heading-target">{group.heading.target}</p>
                </div>
              )}
              {group.paragraphs.map((pair, i) => (
                <div class="translation-pair island" key={i}>
                  <p class="translation-source">{pair.source}</p>
                  <p class="translation-target">{pair.target}</p>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
