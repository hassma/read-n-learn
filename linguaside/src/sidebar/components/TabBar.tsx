import { activeTab, wordLookup } from "../state";
import type { TabId } from "../state";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "summary",    label: "Summary",  icon: "📄" },
  { id: "vocabulary", label: "Vocab",    icon: "📚" },
  { id: "grammar",    label: "Grammar",  icon: "🔤" },
  { id: "lookup",     label: "Lookup",   icon: "🔍" },
];

export function TabBar() {
  return (
    <nav class="tab-bar" aria-label="Navigation tabs">
      {TABS.map((tab) => {
        const isLookup = tab.id === "lookup";
        const hasDot = isLookup && wordLookup.value !== null;
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
          </button>
        );
      })}
    </nav>
  );
}
