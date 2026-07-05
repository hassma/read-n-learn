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
  items: TranslationSegment[];
}

function groupByHeading(segments: TranslationSegment[]): TranslationGroup[] {
  const groups: TranslationGroup[] = [];
  let current: TranslationGroup = { heading: null, items: [] };

  for (const segment of segments) {
    if (segment.type === "heading") {
      if (current.heading || current.items.length > 0) groups.push(current);
      current = { heading: segment, items: [] };
    } else {
      current.items.push(segment);
    }
  }
  if (current.heading || current.items.length > 0) groups.push(current);

  return groups;
}

// Within a group, consecutive list-items sharing a groupId (the same source <ol>/<ul>)
// or consecutive table-cells sharing a groupId (the same source <table>) are clustered
// together so they render as one real list/table instead of a string of look-alike
// paragraph cards.
type Cluster =
  | { kind: "single"; item: TranslationSegment }
  | { kind: "list"; listType: "ordered" | "unordered"; items: TranslationSegment[] }
  | { kind: "table"; items: TranslationSegment[] };

function clusterItems(items: TranslationSegment[]): Cluster[] {
  const clusters: Cluster[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];

    if (item.type === "list-item" && item.groupId != null) {
      const group: TranslationSegment[] = [];
      while (i < items.length && items[i].type === "list-item" && items[i].groupId === item.groupId) {
        group.push(items[i]);
        i++;
      }
      clusters.push({ kind: "list", listType: item.listType ?? "unordered", items: group });
      continue;
    }

    if (item.type === "table-cell" && item.groupId != null) {
      const group: TranslationSegment[] = [];
      while (i < items.length && items[i].type === "table-cell" && items[i].groupId === item.groupId) {
        group.push(items[i]);
        i++;
      }
      clusters.push({ kind: "table", items: group });
      continue;
    }

    clusters.push({ kind: "single", item });
    i++;
  }
  return clusters;
}

function SinglePair({ item }: { item: TranslationSegment }) {
  const quoteClass = item.type === "quote" ? " translation-quote" : "";
  return (
    <div class={`translation-pair island${quoteClass}`}>
      <div class="translation-source-row">
        <p class="translation-source">{item.source}</p>
        <JumpButton text={item.source} />
      </div>
      <p class="translation-target">{item.target}</p>
    </div>
  );
}

function ListCluster({ listType, items }: { listType: "ordered" | "unordered"; items: TranslationSegment[] }) {
  const ListTag = listType === "ordered" ? "ol" : "ul";
  return (
    <div class="translation-list island">
      <ListTag class="translation-list-items">
        {items.map((item, i) => (
          <li class="translation-list-item" key={i}>
            <div class="translation-list-item-grid">
              <div class="translation-source-row">
                <p class="translation-source">{item.source}</p>
                <JumpButton text={item.source} />
              </div>
              <p class="translation-target">{item.target}</p>
            </div>
          </li>
        ))}
      </ListTag>
    </div>
  );
}

function TableCluster({ items }: { items: TranslationSegment[] }) {
  return (
    <div class="translation-table island">
      {items.map((item, i) => (
        <div class="translation-table-cell" key={i}>
          <div class="translation-source-row">
            <p class="translation-source">{item.source}</p>
            <JumpButton text={item.source} />
          </div>
          <p class="translation-target">{item.target}</p>
        </div>
      ))}
    </div>
  );
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
                <div class="translation-heading" data-level={group.heading.level ?? 2}>
                  <div class="translation-heading-row">
                    <p class="translation-heading-source">{group.heading.source}</p>
                    <JumpButton text={group.heading.source} />
                  </div>
                  <p class="translation-heading-target">{group.heading.target}</p>
                </div>
              )}
              {clusterItems(group.items).map((cluster, ci) => {
                if (cluster.kind === "list") {
                  return <ListCluster key={ci} listType={cluster.listType} items={cluster.items} />;
                }
                if (cluster.kind === "table") {
                  return <TableCluster key={ci} items={cluster.items} />;
                }
                return <SinglePair key={ci} item={cluster.item} />;
              })}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
