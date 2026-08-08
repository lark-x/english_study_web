export type StudyMode = 45 | 90 | 150;

export type Interest =
  | "日常生活"
  | "职场沟通"
  | "教育成长"
  | "社会文化"
  | "健康生活"
  | "科技常识";

export type StageId = "stage-1" | "stage-2" | "stage-3" | "stage-4" | "stage-5";

export type Ability =
  | "vocabulary"
  | "pronunciation"
  | "grammar"
  | "sentence"
  | "reading"
  | "translationWriting";

export type Skill = Ability;

export type LessonRhythm = "new" | "integrated" | "check" | "rest" | "remedial";

export type LessonType =
  | "micro"
  | "foundation"
  | "transition-reading"
  | "exam-drill"
  | "sprint";

export interface Profile {
  examDate: string;
  weekdayMinutes: StudyMode;
  weekendMinutes: StudyMode;
  studyDays: number;
  interests: Interest[];
  confidence: number;
  onboardingComplete: boolean;
  planStartDate: string;
  startingStageId: StageId;
}

export type SkillScores = Record<Ability, number>;

export interface Question {
  id: string;
  skill: Ability;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface PracticeTask {
  id: string;
  kind: "recognition" | "listening" | "choice" | "ordering" | "blank" | "imitation" | "translation";
  ability: Ability;
  prompt: string;
  options?: string[];
  answer?: string;
  reference?: string;
}

export interface Expression {
  phrase: string;
  meaning: string;
  example: string;
}

export interface VocabularyEntry {
  word: string;
  level: StageId;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  example: string;
  status?: "new" | "learning" | "recognised" | "mastered";
}

export interface GrammarPoint {
  id: string;
  stageId: StageId;
  title: string;
  explanation: string;
  structure: string;
  examples: Array<{ en: string; zh: string }>;
  pitfall: string;
}

export interface SentencePattern {
  pattern: string;
  meaning: string;
  example: string;
}

export interface TranslationTask {
  zh: string;
  reference: string;
  tip: string;
}

export interface Lesson {
  id: string;
  day: number;
  week: number;
  title: string;
  topic: Interest | "复盘";
  stageId: StageId;
  rhythm: LessonRhythm;
  lessonType: LessonType;
  level: string;
  summary: string;
  stageGoal: string;
  prerequisites: string[];
  paragraphs: Array<{ en: string; zh: string }>;
  vocabulary: VocabularyEntry[];
  grammar: GrammarPoint;
  sentencePatterns: SentencePattern[];
  expressions: Expression[];
  questions: Question[];
  practiceTasks: PracticeTask[];
  translations: TranslationTask[];
  outputPrompt: string;
  outputHint: string;
  sourceDocumentId: string;
  sourceTitle: string;
  sourceCategory: string;
  syllabusNodeIds?: string[];
  prerequisiteNodeIds?: string[];
}

export interface Attempt {
  questionId: string;
  lessonId: string;
  skill: Ability;
  correct: boolean;
  answeredAt: string;
}

export interface ReviewItem {
  id: string;
  kind: "expression" | "mistake" | "sentence" | "word" | "grammar";
  front: string;
  back: string;
  example?: string;
  sourceLessonId: string;
  dueAt: string;
  intervalDays: number;
  repetitions: number;
}

export interface Mistake {
  id: string;
  questionId: string;
  lessonId: string;
  prompt: string;
  chosen: string;
  answer: string;
  explanation: string;
  createdAt: string;
}

export interface StudySession {
  id: string;
  date: string;
  lessonId: string;
  mode: StudyMode;
  minutes: number;
  correct: number;
  total: number;
  output: string;
  completedAt: string;
}

export interface DailyPlan {
  date: string;
  lessonId: string;
  mode: StudyMode;
  stageId: StageId;
  rhythm: LessonRhythm;
  reason: string;
  isRemedial: boolean;
}

export interface VocabularyStatus {
  word: string;
  stageId: StageId;
  status: "new" | "learning" | "recognised" | "mastered";
  seen: number;
  correct: number;
  lastSeenAt?: string;
  firstExposureDay?: number;
  firstExposedAt?: string;
  reviewedAt?: string;
}

export interface GrammarStatus {
  grammarId: string;
  stageId: StageId;
  status: "new" | "learning" | "usable" | "mastered";
  attempts: number;
  correct: number;
  lastSeenAt?: string;
}

export type AbilityEvidence = Record<Ability, { attempts: number; correct: number; lastPracticedAt?: string }>;

export interface StageRecord {
  stageId: StageId;
  startedAt: string;
  promotedAt?: string;
  extendedWeeks: number;
  remedialFocus: Ability[];
  weeklyChecks: Array<{
    week: number;
    date: string;
    passed: boolean;
    gaps: Ability[];
    scores: Partial<SkillScores>;
  }>;
}

export interface MasteryState {
  activeStageId: StageId;
  placementStageId: StageId;
  abilities: AbilityEvidence;
  vocabulary: Record<string, VocabularyStatus>;
  grammar: Record<string, GrammarStatus>;
  stages: Record<StageId, StageRecord>;
  remedialQueue: Array<{ id: string; ability: Ability; reason: string; createdAt: string; resolvedAt?: string }>;
  syllabusNodeProgress: Record<string, SyllabusNodeProgress>;
  contentVersion: string;
}

export interface SyllabusNodeProgress {
  nodeId: string;
  coverageEvidence: number;
  masteryEvidence: number;
  firstLearnedAt?: string;
  lastReviewedAt?: string;
  evidenceCount: number;
}

export interface AppState {
  schemaVersion: 5;
  profile: Profile;
  assessment: SkillScores;
  mastery: MasteryState;
  attempts: Attempt[];
  reviewItems: ReviewItem[];
  mistakes: Mistake[];
  sessions: StudySession[];
  dailyPlans: Record<string, DailyPlan>;
  savedExpressions: string[];
}

export const ABILITY_LABELS: Record<Ability, string> = {
  vocabulary: "词汇辨认",
  pronunciation: "发音/听辨",
  grammar: "基础语法",
  sentence: "简单句",
  reading: "阅读理解",
  translationWriting: "翻译/写作",
};

export const SKILL_LABELS = ABILITY_LABELS;
