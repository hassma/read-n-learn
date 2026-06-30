import type { AnalysisResult, WordLookupResult } from "./analysis";

export type ExtensionMessage =
  | { type: "GET_ARTICLE_TEXT" }
  | { type: "ARTICLE_TEXT"; payload: { text: string; title: string; url: string } }
  | { type: "ANALYZE_ARTICLE"; payload: { text: string; sourceLang: string; targetLang: string } }
  | { type: "ANALYSIS_RESULT"; payload: AnalysisResult }
  | { type: "ANALYSIS_ERROR"; payload: { message: string } }
  | { type: "LOOKUP_WORD"; payload: { word: string; result: WordLookupResult } }
  | { type: "LOOKUP_ERROR"; payload: { message: string } };
