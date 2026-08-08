import normalizedCourseJson from "../../public/data/english2/normalized_course.json";

export type NormalizedCategory =
  | "grammar"
  | "vocabulary"
  | "phrase"
  | "textbook"
  | "writing"
  | "strategy"
  | "exam-review"
  | "past-paper"
  | "reference";

export interface NormalizedSection {
  id: string;
  title: string;
  content: string;
}

export interface NormalizedDocument {
  id: string;
  order: number;
  filename: string;
  title: string;
  category: NormalizedCategory;
  source: string;
  extractionMethod: string;
  status: string;
  pages: number;
  checksum: string;
  characterCount: number;
  sections: NormalizedSection[];
  englishSentences: string[];
}

export interface NormalizedVocabularyItem {
  headword: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  example: string;
  sourceLine: string;
  sourceKind: "explicit-list" | "normalized-corpus";
  firstExposureDay: number;
}

export interface NormalizedPhraseItem {
  phrase: string;
  meaning: string;
  sourceLine: string;
}

export interface NormalizedScheduleItem {
  day: number;
  week: number;
  documentId: string;
  title: string;
  category: NormalizedCategory;
  isRevisit: boolean;
}

export interface NormalizedCourseBundle {
  schemaVersion: number;
  generatedAt: string;
  sourceDirectory: string;
  sourceRule: string;
  documentCount: number;
  totalCharacters: number;
  documents: NormalizedDocument[];
  vocabulary: NormalizedVocabularyItem[];
  phrases: NormalizedPhraseItem[];
  schedule: NormalizedScheduleItem[];
  audit: {
    expectedDocuments: number;
    includedDocuments: number;
    vocabularyCount: number;
    phraseCount: number;
    maxNewWordsPerDay: number;
    missingDocuments: string[];
  };
}

export const normalizedCourse = normalizedCourseJson as NormalizedCourseBundle;
export const normalizedDocuments = normalizedCourse.documents;
export const normalizedDocumentById = new Map(normalizedDocuments.map((document) => [document.id, document]));

export const NORMALIZED_CATEGORY_LABELS: Record<NormalizedCategory, string> = {
  grammar: "基础语法",
  vocabulary: "高频词汇",
  phrase: "核心词组",
  textbook: "教材精读",
  writing: "写作课程",
  strategy: "题型技巧",
  "exam-review": "考前训练",
  "past-paper": "历年真题",
  reference: "补充资料",
};

export function getNormalizedDocument(documentId?: string) {
  return documentId ? normalizedDocumentById.get(documentId) : undefined;
}

export function getNormalizedSchedule(day: number) {
  return normalizedCourse.schedule.find((item) => item.day === day) ?? normalizedCourse.schedule[0];
}
