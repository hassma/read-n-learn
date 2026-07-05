import { render } from "preact";
import { useEffect } from "preact/hooks";
import { TabBar } from "./components/TabBar";
import { SummaryTab } from "./components/SummaryTab";
import { VocabularyTab } from "./components/VocabularyTab";
import { GrammarTab } from "./components/GrammarTab";
import { WordLookupTab } from "./components/WordLookupTab";
import { SavedTab } from "./components/SavedTab";
import {
  status,
  activeTab,
  analysis,
  errorMessage,
  wordLookup,
  wordLookupStatus,
  loadSavedVocabulary,
} from "./state";
import type { ExtensionMessage } from "../types/messages";

function SkeletonLoader() {
  return (
    <div class="tab-content" aria-label="Loading…" aria-busy="true">
      <div class="island" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div class="skeleton skeleton-heading" />
        <div class="skeleton skeleton-text" />
        <div class="skeleton skeleton-text" />
        <div class="skeleton skeleton-text" />
      </div>
      <div class="island" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <div class="skeleton skeleton-heading" />
        <div class="skeleton skeleton-text" />
        <div class="skeleton skeleton-text" style={{ width: "70%" }} />
      </div>
    </div>
  );
}

function LogoIcon() {
  return (
    <svg
      class="logo"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-label="LinguaSide"
      role="img"
    >
      {/* Speech bubble */}
      <path
        d="M3 3.5A1.5 1.5 0 0 1 4.5 2h11A1.5 1.5 0 0 1 17 3.5v9A1.5 1.5 0 0 1 15.5 14H7l-4 4V3.5Z"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Book mark lines */}
      <line x1="6.5" y1="6" x2="13.5" y2="6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="6.5" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function App() {
  useEffect(() => {
    loadSavedVocabulary();

    const listener = (msg: unknown) => {
      const m = msg as ExtensionMessage;
      if (m.type === "ANALYSIS_RESULT") {
        analysis.value = m.payload;
        status.value = "done";
      }
      if (m.type === "ANALYSIS_ERROR") {
        errorMessage.value = m.payload.message;
        status.value = "error";
      }
      if (m.type === "LOOKUP_WORD") {
        wordLookup.value = m.payload.result;
        wordLookupStatus.value = "done";
        activeTab.value = "lookup";
      }
      if (m.type === "LOOKUP_ERROR") {
        wordLookupStatus.value = "error";
        activeTab.value = "lookup";
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  async function handleAnalyze() {
    status.value = "loading";
    errorMessage.value = "";

    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) throw new Error("No active tab found.");

      const response = await browser.tabs.sendMessage(tab.id, { type: "GET_ARTICLE_TEXT" }) as {
        type: "ARTICLE_TEXT";
        payload: { text: string; title: string; url: string };
      };

      const stored = await browser.storage.local.get(["sourceLang", "targetLang"]);

      const result = await browser.runtime.sendMessage({
        type: "ANALYZE_ARTICLE",
        payload: {
          text: response.payload.text,
          sourceLang: (stored.sourceLang as string) || "auto",
          targetLang: (stored.targetLang as string) || "English",
        },
      }) as ExtensionMessage;

      if (result.type === "ANALYSIS_RESULT") {
        analysis.value = result.payload;
        status.value = "done";
        if (activeTab.value === "lookup" || activeTab.value === "saved") activeTab.value = "summary";
      } else if (result.type === "ANALYSIS_ERROR") {
        errorMessage.value = result.payload.message;
        status.value = "error";
      }
    } catch (err) {
      errorMessage.value =
        err instanceof Error ? err.message : "Could not extract article text from this page.";
      status.value = "error";
    }
  }

  const currentStatus = status.value;
  const currentTab = activeTab.value;
  const isStandaloneTab = currentTab === "lookup" || currentTab === "saved";

  return (
    <div class="app">
      <header class="app-header">
        <LogoIcon />
        <h1>LinguaSide</h1>
        {currentStatus === "done" && (
          <button class="btn-ghost" onClick={handleAnalyze}>
            Re-analyze
          </button>
        )}
        <button
          class="btn-ghost icon-only"
          onClick={() => browser.runtime.openOptionsPage()}
          aria-label="Open settings"
          title="Settings"
        >
          ⚙
        </button>
      </header>

      <TabBar />

      {isStandaloneTab && (
        <div class="tab-content">
          {currentTab === "lookup" && <WordLookupTab />}
          {currentTab === "saved" && <SavedTab />}
        </div>
      )}

      {!isStandaloneTab && currentStatus === "idle" && (
        <div class="tab-content">
          <div class="state-card">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
            <p>Navigate to any article and click Analyze to start learning.</p>
            <button class="btn-primary" onClick={handleAnalyze}>
              Analyze Article
            </button>
          </div>
        </div>
      )}

      {!isStandaloneTab && currentStatus === "loading" && <SkeletonLoader />}

      {!isStandaloneTab && currentStatus === "error" && (
        <div class="tab-content">
          <div class="state-card error">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>{errorMessage.value}</p>
            <button class="btn-ghost" onClick={() => { status.value = "idle"; }}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {!isStandaloneTab && currentStatus === "done" && (
        <div class="tab-content">
          {currentTab === "summary"    && <SummaryTab />}
          {currentTab === "vocabulary" && <VocabularyTab />}
          {currentTab === "grammar"    && <GrammarTab />}
        </div>
      )}
    </div>
  );
}

render(<App />, document.getElementById("app")!);
