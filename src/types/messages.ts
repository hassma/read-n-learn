import type { AnalysisResult, GrammarNote, SourceBlock, VocabularyItem, WordLookupResult } from "./analysis";

export type ExtensionMessage =
  | { type: "GET_ARTICLE_TEXT" }
  | { type: "ARTICLE_TEXT"; payload: { blocks: SourceBlock[]; title: string; url: string; truncated: boolean } }
  | {
      type: "ANALYZE_ARTICLE";
      payload: {
        blocks: SourceBlock[];
        title: string;
        url: string;
        sourceLang: string;
        targetLang: string;
        requestId: string;
        forceRefresh: boolean;
      };
    }
  | { type: "ANALYSIS_RESULT"; payload: AnalysisResult & { requestId: string; sectionsPending: boolean } }
  | {
      type: "ANALYSIS_SECTION_UPDATE";
      payload: { requestId: string; vocabulary?: VocabularyItem[]; grammarNotes?: GrammarNote[] };
    }
  | { type: "ANALYSIS_ERROR"; payload: { message: string; requestId?: string } }
  | { type: "LOOKUP_WORD"; payload: { word: string; result: WordLookupResult } }
  | { type: "LOOKUP_ERROR"; payload: { message: string } }
  | { type: "HIGHLIGHT_TEXT"; payload: { text: string } }
  | { type: "HIGHLIGHT_RESULT"; payload: { found: boolean } };
