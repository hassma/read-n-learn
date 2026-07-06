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

// A general (not article-specific) grammar topic for the learner's target
// language at their CEFR level — bundled/cached rather than regenerated per
// analysis, since it's stable reference content.
export interface GeneralGrammarTopic {
  pattern: string;
  explanation: string;
  example: string;
  exampleTranslation: string;
}

export type GrammarExerciseType = "fill-blank" | "multiple-choice" | "transformation";

export interface GrammarExercise {
  type: GrammarExerciseType;
  prompt: string;
  choices?: string[];
  answer: string;
  explanation: string;
}

export type SegmentType = "heading" | "paragraph" | "list-item" | "table-cell" | "quote";

// A block of source text as extracted directly from the page DOM, with structural
// metadata (heading depth, list membership, table membership) determined
// deterministically from the tag it came from — never inferred by the LLM.
export interface SourceBlock {
  type: SegmentType;
  source: string;
  level?: number; // heading depth, 1-6
  listType?: "ordered" | "unordered"; // for list-item
  ordinal?: number; // 1-based position within its list, for list-item
  groupId?: number; // ties list-items of the same list, or cells of the same table, together
}

export interface TranslationSegment extends SourceBlock {
  target: string;
}

export interface AnalysisResult {
  summary: string;
  translationParagraphs: TranslationSegment[];
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

export interface SavedVocabItem {
  word: string;
  pos: string;
  translation: string;
  difficulty: VocabularyItem["difficulty"] | null;
  clue: string;
  exampleFromText: string;
  savedAt: number;
  // Spaced-repetition scheduling (simplified SM-2). New words are due
  // immediately; `easeFactor` and `intervalDays` grow with successful reviews.
  dueAt: number;
  intervalDays: number;
  easeFactor: number;
  reviewCount: number;
}
