import { analysis, jumpToText } from "../state";
import type { TranslationSegment } from "../../types/analysis";

function JumpButton({ text }: { text: string }) {
  return (
    <button
      class="icon-btn-jump"
      onClick={() => jumpToText(text)}
      aria-label="Jump to this text in the page"
      title="Jump to this text in the page"
    >
      ↗
    </button>
  );
}

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
                  <div class="translation-heading-row">
                    <p class="translation-heading-source">{group.heading.source}</p>
                    <JumpButton text={group.heading.source} />
                  </div>
                  <p class="translation-heading-target">{group.heading.target}</p>
                </div>
              )}
              {group.paragraphs.map((pair, i) => (
                <div class="translation-pair island" key={i}>
                  <div class="translation-source-row">
                    <p class="translation-source">{pair.source}</p>
                    <JumpButton text={pair.source} />
                  </div>
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
