import { signal, computed } from "@preact/signals";
import type { AnalysisResult, WordLookupResult } from "../types/analysis";

export type AppStatus = "idle" | "loading" | "error" | "done";
export type TabId = "summary" | "vocabulary" | "grammar" | "lookup";

export const status = signal<AppStatus>("idle");
export const activeTab = signal<TabId>("summary");
export const errorMessage = signal<string>("");
export const analysis = signal<AnalysisResult | null>(null);
export const wordLookup = signal<WordLookupResult | null>(null);
export const wordLookupStatus = signal<"idle" | "loading" | "error" | "done">("idle");

export const hasAnalysis = computed(() => analysis.value !== null);
