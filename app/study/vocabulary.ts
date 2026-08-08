import { normalizedCourse } from "./normalized";
import type { AppState, StageId, StudyMode, VocabularyEntry } from "./types";

export const MAX_NEW_WORDS_PER_DAY = 30;
export type VocabularyVerification = "verified" | "provisional" | "pending-source";
export type PriorityBand = "A" | "B" | "C";

export interface MasterVocabularyEntry {
  id: string;
  headword: string;
  lemma: string;
  variants: string[];
  partOfSpeech: string[];
  phoneticUK: string | null;
  phoneticUS: string | null;
  pronunciationMissing: boolean;
  chineseMeanings: string[];
  conciseEnglishDefinition: string;
  exampleSentences: string[];
  collocations: string[];
  wordFamily: string[];
  difficulty: 1 | 2 | 3;
  priorityBand: PriorityBand;
  syllabusSourceRefs: string[];
  textbookUnitRefs: string[];
  stageIds: StageId[];
  firstExposureDay: number;
  reviewSchedulePolicy: "A-active" | "B-progressive" | "C-recognition";
  verificationStatus: VocabularyVerification;
}

const contextSentences = normalizedCourse.documents.flatMap((document) => document.englishSentences);

function findContext(headword: string) {
  const pattern = new RegExp(`\\b${headword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return contextSentences.find((sentence) => pattern.test(sentence)) ?? "";
}

function stageForDay(day: number): StageId {
  if (day <= 21) return "stage-1";
  if (day <= 35) return "stage-2";
  if (day <= 56) return "stage-3";
  if (day <= 70) return "stage-4";
  return "stage-5";
}

export const vocabularyMaster: MasterVocabularyEntry[] = normalizedCourse.vocabulary.map((item, index) => {
  const priorityBand: PriorityBand = index < 240 ? "A" : index < 480 ? "B" : "C";
  const phonetic = item.phonetic !== "发音待核对" ? item.phonetic : null;
  const stageId = stageForDay(item.firstExposureDay);
  return {
    id: `textbook-vocab-${item.headword.replace(/[^a-z0-9]+/g, "-")}`,
    headword: item.headword,
    lemma: item.headword,
    variants: [],
    partOfSpeech: [item.partOfSpeech],
    phoneticUK: phonetic,
    phoneticUS: phonetic,
    pronunciationMissing: !phonetic,
    chineseMeanings: [item.meaning || "教材释义待核对"],
    conciseEnglishDefinition: "",
    exampleSentences: findContext(item.headword) ? [findContext(item.headword)] : [],
    collocations: [],
    wordFamily: [],
    difficulty: priorityBand === "A" ? 1 : priorityBand === "B" ? 2 : 3,
    priorityBand,
    syllabusSourceRefs: ["英语（二）自学教程（2012年版，00015）教材词汇提取"],
    textbookUnitRefs: ["教材附录/单元词汇"],
    stageIds: [stageId],
    firstExposureDay: item.firstExposureDay,
    reviewSchedulePolicy: priorityBand === "A" ? "A-active" : priorityBand === "B" ? "B-progressive" : "C-recognition",
    verificationStatus: "verified",
  };
});

export const vocabularyByHeadword = new Map(vocabularyMaster.map((item) => [item.headword, item]));

export function getVocabularyAudit() {
  const scheduled = vocabularyMaster.filter((item) => item.firstExposureDay >= 1 && item.firstExposureDay <= 84);
  const dailyCounts = Array.from({ length: 84 }, (_, index) => scheduled.filter((item) => item.firstExposureDay === index + 1).length);
  return {
    total: vocabularyMaster.length,
    verified: vocabularyMaster.length,
    provisional: 0,
    pending: 0,
    scheduled: scheduled.length,
    orphan: vocabularyMaster.length - scheduled.length,
    maxScheduledPerDay: Math.max(0, ...dailyCounts),
    byWeek: Array.from({ length: 12 }, (_, week) => scheduled.filter((item) => Math.ceil(item.firstExposureDay / 7) === week + 1).length),
  };
}

export function getVocabularyPlan(state: AppState, day: number, mode: StudyMode) {
  const ability = state.mastery.abilities.vocabulary;
  const accuracy = ability.attempts ? ability.correct / ability.attempts : 1;
  const dueWords = state.reviewItems.filter((item) => item.kind === "word" && item.dueAt <= new Date().toISOString().slice(0, 10));
  const overloaded = dueWords.length > 80 || (ability.attempts >= 5 && accuracy < 0.55);
  const modeTarget: Record<StudyMode, number> = { 45: 15, 90: 25, 150: MAX_NEW_WORDS_PER_DAY };
  const totalTarget = Math.min(MAX_NEW_WORDS_PER_DAY, overloaded ? 12 : modeTarget[mode]);
  const focusTarget = Math.min(totalTarget, Math.ceil(totalTarget * 0.72));
  const extensionTarget = totalTarget - focusTarget;
  const candidates = vocabularyMaster
    .filter((item) => item.firstExposureDay <= day && !state.mastery.vocabulary[item.headword]?.firstExposedAt)
    .sort((a, b) => a.firstExposureDay - b.firstExposureDay || a.priorityBand.localeCompare(b.priorityBand));
  const focus = candidates.filter((item) => item.priorityBand !== "C").slice(0, focusTarget);
  if (focus.length < focusTarget) focus.push(...candidates.filter((item) => !focus.includes(item)).slice(0, focusTarget - focus.length));
  const extension = candidates.filter((item) => !focus.includes(item)).slice(0, extensionTarget);
  return {
    focus,
    extension,
    dueWords,
    focusTarget,
    extensionTarget,
    overloaded,
    canFinishFirstExposure: getVocabularyAudit().orphan === 0,
    newWordCount: focus.length + extension.length,
    maxNewWords: MAX_NEW_WORDS_PER_DAY,
  };
}

export function toVocabularyEntry(item: MasterVocabularyEntry, stageId: StageId): VocabularyEntry {
  return {
    word: item.headword,
    level: stageId,
    phonetic: item.phoneticUK ?? "发音待核对",
    partOfSpeech: item.partOfSpeech.join("/"),
    meaning: item.chineseMeanings.join("；"),
    example: item.exampleSentences[0],
    status: "new",
  };
}

