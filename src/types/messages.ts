import type { AnalysisResult, SourceBlock, WordLookupResult } from "./analysis";

export type ExtensionMessage =
  | { type: "GET_ARTICLE_TEXT" }
  | { type: "ARTICLE_TEXT"; payload: { blocks: SourceBlock[]; title: string; url: string; truncated: boolean } }
  | { type: "ANALYZE_ARTICLE"; payload: { blocks: SourceBlock[]; title: string; sourceLang: string; targetLang: string } }
  | { type: "ANALYSIS_RESULT"; payload: AnalysisResult }
  | { type: "ANALYSIS_ERROR"; payload: { message: string } }
  | { type: "LOOKUP_WORD"; payload: { word: string; result: WordLookupResult } }
  | { type: "LOOKUP_ERROR"; payload: { message: string } }
  | { type: "HIGHLIGHT_TEXT"; payload: { text: string } }
  | { type: "HIGHLIGHT_RESULT"; payload: { found: boolean } };
