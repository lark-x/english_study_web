// ── Word detail (for sidebar) ─────────────────────────────────────
export interface WordEntry {
  phonetic: string;
  pos: string;
  meaning: string;
  example: string;
  exampleTranslation: string;
  relatedPhrases: { phrase: string; meaning: string }[];
}

export type WordDictionary = Record<string, WordEntry>;

// ── Unit module types ─────────────────────────────────────────────
export interface VocabItem {
  word: string;
  phonetic: string;
  pos: string;
  meaning: string;
  example: string;
  exampleTranslation: string;
}

export interface PhraseItem {
  phrase: string;
  meaning: string;
  englishDef?: string;
}

export interface BilingualItem {
  en: string;
  zh: string;
}

export interface GrammarPoint {
  en: string;
  zh: string;
}

export interface WritingPrompt {
  title: string;
  prompt: string;
  keywords: string[];
}

export interface UnitData {
  id: string;
  number: number;
  title: string;
  fullTitle: string;
  vocabulary: VocabItem[];
  phrases: PhraseItem[];
  grammar: { raw: string; points: GrammarPoint[] };
  sentences: BilingualItem[];
  practice: { raw: string; dialogue: string };
  writing: WritingPrompt;
}

export type ModuleType = "vocabulary" | "phrases" | "grammar" | "sentences" | "practice" | "writing";

export const MODULE_LABELS: Record<ModuleType, { zh: string; icon: string }> = {
  vocabulary: { zh: "单词", icon: "📖" },
  phrases: { zh: "词组", icon: "🔗" },
  grammar: { zh: "语法", icon: "📐" },
  sentences: { zh: "句子", icon: "💬" },
  practice: { zh: "练习", icon: "✏️" },
  writing: { zh: "作文", icon: "📝" },
};
