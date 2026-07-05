import { activeTab, wordLookup, savedVocabulary } from "../state";
import type { TabId } from "../state";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "summary",    label: "Summary",  icon: "📄" },
  { id: "vocabulary", label: "Vocab",    icon: "📚" },
  { id: "grammar",    label: "Grammar",  icon: "🔤" },
  { id: "lookup",     label: "Lookup",   icon: "🔍" },
  { id: "saved",      label: "Saved",    icon: "🔖" },
];

export function TabBar() {
  const savedCount = savedVocabulary.value.length;

  return (
    <nav class="tab-bar" aria-label="Navigation tabs">
      {TABS.map((tab) => {
        const hasDot = tab.id === "lookup" && wordLookup.value !== null;
        const count = tab.id === "saved" && savedCount > 0 ? savedCount : null;
        return (
          <button
            key={tab.id}
            class={activeTab.value === tab.id ? "active" : ""}
            onClick={() => { activeTab.value = tab.id; }}
            aria-pressed={activeTab.value === tab.id}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
            {hasDot && <span class="lookup-dot" aria-label="has result" />}
            {count !== null && <span class="tab-count-badge">{count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
