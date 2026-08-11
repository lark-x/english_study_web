import normalizedCourseJson from "../../public/data/english2/textbook_course.json";

export type NormalizedCategory = "unit" | "vocabulary" | "self-assessment";

export interface NormalizedSection {
  id: string;
  title: string;
  content: string;
  partType?: "sample_dialogue" | "guided_practice" | "new_words" | "phrases" | "self_assessment" | "syllabus_vocabulary";
  textPart?: "text_a" | "text_b";
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
  unitNumber?: number;
  pageRange?: string;
}

export interface NormalizedVocabularyItem {
  headword: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  example: string;
  exampleTranslation?: string;
  sourceLine: string;
  sourceKind: "unit-new-words" | "syllabus-vocabulary" | "textbook-vocabulary";
  sourcePage?: number;
  unitNumber?: number;
  priorityScore?: number;
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
  date?: string;
  focusPartIds?: string[];
  contentFocus?: string;
  newWordHeadwords?: string[];
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
    ocrPageCount?: number;
    unitCount?: number;
    vocabularyCount: number;
    lookupEntryCount?: number;
    syllabusVocabularyCount?: number;
    unitNewWordCount?: number;
    phraseCount: number;
    maxNewWordsPerDay: number;
    missingDocuments: string[];
  };
}

export const normalizedCourse = normalizedCourseJson as NormalizedCourseBundle;
export const normalizedDocuments = normalizedCourse.documents;
export const normalizedDocumentById = new Map(normalizedDocuments.map((document) => [document.id, document]));

export const NORMALIZED_CATEGORY_LABELS: Record<NormalizedCategory, string> = {
  unit: "教材单元",
  vocabulary: "教材附录词汇",
  "self-assessment": "教材自测",
};

export function getNormalizedDocument(documentId?: string) {
  return documentId ? normalizedDocumentById.get(documentId) : undefined;
}

export function getNormalizedSchedule(day: number) {
  return normalizedCourse.schedule.find((item) => item.day === day) ?? normalizedCourse.schedule[0];
}
