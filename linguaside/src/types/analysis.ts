export interface VocabularyItem {
  word: string;
  pos: "noun" | "verb" | "adjective" | "adverb" | "phrase" | "other";
  translation: string;
  difficulty: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  clue: string;
  exampleFromText: string;
}

export interface GrammarNote {
  pattern: string;
  explanation: string;
  exampleFromText: string;
  targetLanguageEquivalent: string;
}

export interface AnalysisResult {
  summary: string;
  translationParagraphs: Array<{ source: string; target: string }>;
  vocabulary: VocabularyItem[];
  grammarNotes: GrammarNote[];
}

export interface WordLookupResult {
  word: string;
  pos: string;
  translation: string;
  register: "formal" | "informal" | "slang" | "neutral" | "technical";
  etymologyHint: string;
  examples: [string, string];
}
