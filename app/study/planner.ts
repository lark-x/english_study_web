import { lessons, STAGE_GOALS, STAGE_TITLES } from "./seed";
import { ABILITY_LABELS, type Ability, type AppState, type Lesson, type SkillScores, type StageId, type StudyMode } from "./types";

export const localDate = (value = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localDate(value);
};

export const stageOrder: StageId[] = ["stage-1", "stage-2", "stage-3", "stage-4", "stage-5"];

export const phaseDefinitions: Array<{
  id: StageId;
  weeks: [number, number];
  title: string;
  goal: string;
  required: Partial<SkillScores>;
  allowedLessonTypes: Lesson["lessonType"][];
}> = [
  {
    id: "stage-1",
    weeks: [1, 3],
    title: STAGE_TITLES["stage-1"],
    goal: STAGE_GOALS["stage-1"],
    required: { vocabulary: 70, pronunciation: 60, grammar: 70, sentence: 65, reading: 60 },
    allowedLessonTypes: ["micro"],
  },
  {
    id: "stage-2",
    weeks: [4, 5],
    title: STAGE_TITLES["stage-2"],
    goal: STAGE_GOALS["stage-2"],
    required: { vocabulary: 72, grammar: 70, sentence: 70, reading: 65, translationWriting: 60 },
    allowedLessonTypes: ["foundation"],
  },
  {
    id: "stage-3",
    weeks: [6, 8],
    title: STAGE_TITLES["stage-3"],
    goal: STAGE_GOALS["stage-3"],
    required: { vocabulary: 75, grammar: 72, sentence: 72, reading: 70, translationWriting: 65 },
    allowedLessonTypes: ["transition-reading"],
  },
  {
    id: "stage-4",
    weeks: [9, 10],
    title: STAGE_TITLES["stage-4"],
    goal: STAGE_GOALS["stage-4"],
    required: { vocabulary: 78, grammar: 75, reading: 74, translationWriting: 68 },
    allowedLessonTypes: ["exam-drill", "transition-reading"],
  },
  {
    id: "stage-5",
    weeks: [11, 12],
    title: STAGE_TITLES["stage-5"],
    goal: STAGE_GOALS["stage-5"],
    required: { vocabulary: 80, grammar: 78, sentence: 76, reading: 78, translationWriting: 72 },
    allowedLessonTypes: ["sprint"],
  },
];

export type StepId =
  | "review"
  | "vocabulary"
  | "pronunciation"
  | "grammar"
  | "sentences"
  | "micro-read"
  | "read"
  | "practice"
  | "dictation"
  | "correction"
  | "translation"
  | "output"
  | "summary";

export interface PlanStep {
  id: StepId;
  label: string;
  minutes: number;
  depth: "minimum" | "standard" | "deep";
}

export const stageModeTemplates: Record<StageId, Record<StudyMode, PlanStep[]>> = {
  "stage-1": {
    45: [
      { id: "review", label: "到期复习", minutes: 8, depth: "minimum" },
      { id: "vocabulary", label: "高频词辨认", minutes: 9, depth: "minimum" },
      { id: "pronunciation", label: "听音跟读", minutes: 6, depth: "minimum" },
      { id: "grammar", label: "be/have 选择", minutes: 8, depth: "minimum" },
      { id: "micro-read", label: "3-8句微阅读", minutes: 8, depth: "minimum" },
      { id: "output", label: "1句汉译英", minutes: 6, depth: "minimum" },
    ],
    90: [
      { id: "review", label: "到期复习", minutes: 14, depth: "standard" },
      { id: "vocabulary", label: "高频词+词性", minutes: 15, depth: "standard" },
      { id: "pronunciation", label: "听辨与跟读", minutes: 10, depth: "standard" },
      { id: "grammar", label: "基础语法选择", minutes: 14, depth: "standard" },
      { id: "sentences", label: "排序/填空/仿写", minutes: 14, depth: "standard" },
      { id: "micro-read", label: "微阅读", minutes: 12, depth: "standard" },
      { id: "output", label: "简单句输出", minutes: 9, depth: "standard" },
      { id: "summary", label: "学习复盘", minutes: 2, depth: "standard" },
    ],
    150: [
      { id: "review", label: "到期复习", minutes: 22, depth: "deep" },
      { id: "vocabulary", label: "高频词辨认", minutes: 18, depth: "deep" },
      { id: "pronunciation", label: "听写与跟读", minutes: 18, depth: "deep" },
      { id: "grammar", label: "基础语法改错", minutes: 22, depth: "deep" },
      { id: "sentences", label: "排序/填空/仿写", minutes: 24, depth: "deep" },
      { id: "micro-read", label: "微阅读回读", minutes: 18, depth: "deep" },
      { id: "correction", label: "错因修正", minutes: 14, depth: "deep" },
      { id: "output", label: "3个简单句", minutes: 10, depth: "deep" },
      { id: "summary", label: "学习复盘", minutes: 4, depth: "deep" },
    ],
  },
  "stage-2": {
    45: [
      { id: "review", label: "到期复习", minutes: 8, depth: "minimum" },
      { id: "vocabulary", label: "分级词汇", minutes: 8, depth: "minimum" },
      { id: "grammar", label: "句型语法", minutes: 9, depth: "minimum" },
      { id: "read", label: "50-100词短文", minutes: 10, depth: "minimum" },
      { id: "practice", label: "短句练习", minutes: 6, depth: "minimum" },
      { id: "output", label: "一句汉译英", minutes: 4, depth: "minimum" },
    ],
    90: [
      { id: "review", label: "到期复习", minutes: 14, depth: "standard" },
      { id: "vocabulary", label: "词汇与词性", minutes: 13, depth: "standard" },
      { id: "grammar", label: "时态/介词/连接词", minutes: 16, depth: "standard" },
      { id: "sentences", label: "短句翻译", minutes: 14, depth: "standard" },
      { id: "read", label: "50-100词短文", minutes: 17, depth: "standard" },
      { id: "practice", label: "即时练习", minutes: 10, depth: "standard" },
      { id: "output", label: "3-5个短句", minutes: 6, depth: "standard" },
    ],
    150: [
      { id: "review", label: "到期复习", minutes: 22, depth: "deep" },
      { id: "dictation", label: "听写旧词旧句", minutes: 16, depth: "deep" },
      { id: "vocabulary", label: "分级词汇", minutes: 16, depth: "deep" },
      { id: "grammar", label: "句型扩展", minutes: 24, depth: "deep" },
      { id: "sentences", label: "翻译与改写", minutes: 22, depth: "deep" },
      { id: "read", label: "短文精读", minutes: 22, depth: "deep" },
      { id: "correction", label: "错句改错", minutes: 14, depth: "deep" },
      { id: "output", label: "短句输出", minutes: 10, depth: "deep" },
      { id: "summary", label: "学习复盘", minutes: 4, depth: "deep" },
    ],
  },
  "stage-3": {
    45: [
      { id: "review", label: "到期复习", minutes: 8, depth: "minimum" },
      { id: "vocabulary", label: "阅读词汇", minutes: 7, depth: "minimum" },
      { id: "grammar", label: "句子主干", minutes: 8, depth: "minimum" },
      { id: "read", label: "120-200词阅读", minutes: 14, depth: "minimum" },
      { id: "practice", label: "理解练习", minutes: 6, depth: "minimum" },
      { id: "output", label: "主旨句", minutes: 2, depth: "minimum" },
    ],
    90: [
      { id: "review", label: "到期复习", minutes: 14, depth: "standard" },
      { id: "vocabulary", label: "阅读词汇", minutes: 12, depth: "standard" },
      { id: "grammar", label: "句子主干/从句", minutes: 16, depth: "standard" },
      { id: "read", label: "120-200词阅读", minutes: 24, depth: "standard" },
      { id: "practice", label: "阅读与语法练习", minutes: 14, depth: "standard" },
      { id: "translation", label: "句子翻译", minutes: 8, depth: "standard" },
      { id: "summary", label: "复盘", minutes: 2, depth: "standard" },
    ],
    150: [
      { id: "review", label: "到期复习", minutes: 22, depth: "deep" },
      { id: "dictation", label: "听写回收", minutes: 14, depth: "deep" },
      { id: "vocabulary", label: "阅读词汇", minutes: 14, depth: "deep" },
      { id: "grammar", label: "长句拆解", minutes: 24, depth: "deep" },
      { id: "read", label: "阅读精读", minutes: 34, depth: "deep" },
      { id: "practice", label: "综合练习", minutes: 18, depth: "deep" },
      { id: "correction", label: "错因修正", minutes: 10, depth: "deep" },
      { id: "translation", label: "翻译回收", minutes: 10, depth: "deep" },
      { id: "summary", label: "复盘", minutes: 4, depth: "deep" },
    ],
  },
  "stage-4": {
    45: [
      { id: "review", label: "到期复习", minutes: 8, depth: "minimum" },
      { id: "read", label: "题型材料", minutes: 16, depth: "minimum" },
      { id: "practice", label: "题型练习", minutes: 14, depth: "minimum" },
      { id: "correction", label: "错题归因", minutes: 5, depth: "minimum" },
      { id: "summary", label: "复盘", minutes: 2, depth: "minimum" },
    ],
    90: [
      { id: "review", label: "到期复习", minutes: 14, depth: "standard" },
      { id: "grammar", label: "题型语法", minutes: 12, depth: "standard" },
      { id: "read", label: "题型阅读", minutes: 24, depth: "standard" },
      { id: "practice", label: "判断/选句/填词", minutes: 24, depth: "standard" },
      { id: "translation", label: "短文写作句库", minutes: 10, depth: "standard" },
      { id: "summary", label: "复盘", minutes: 6, depth: "standard" },
    ],
    150: [
      { id: "review", label: "到期复习", minutes: 22, depth: "deep" },
      { id: "grammar", label: "题型语法", minutes: 18, depth: "deep" },
      { id: "read", label: "限时阅读", minutes: 34, depth: "deep" },
      { id: "practice", label: "多题型训练", minutes: 36, depth: "deep" },
      { id: "correction", label: "错题归因", minutes: 18, depth: "deep" },
      { id: "output", label: "短文写作", minutes: 18, depth: "deep" },
      { id: "summary", label: "复盘", minutes: 4, depth: "deep" },
    ],
  },
  "stage-5": {
    45: [
      { id: "review", label: "到期复习", minutes: 10, depth: "minimum" },
      { id: "practice", label: "限时小练", minutes: 18, depth: "minimum" },
      { id: "correction", label: "错因回收", minutes: 10, depth: "minimum" },
      { id: "output", label: "翻译/写作回收", minutes: 7, depth: "minimum" },
    ],
    90: [
      { id: "review", label: "到期复习", minutes: 16, depth: "standard" },
      { id: "practice", label: "限时训练", minutes: 32, depth: "standard" },
      { id: "read", label: "模拟阅读", minutes: 18, depth: "standard" },
      { id: "correction", label: "错题归因", minutes: 14, depth: "standard" },
      { id: "output", label: "写作与翻译回收", minutes: 10, depth: "standard" },
    ],
    150: [
      { id: "review", label: "到期复习", minutes: 24, depth: "deep" },
      { id: "practice", label: "整组限时训练", minutes: 46, depth: "deep" },
      { id: "read", label: "模拟阅读", minutes: 26, depth: "deep" },
      { id: "correction", label: "错题归因", minutes: 24, depth: "deep" },
      { id: "translation", label: "翻译回收", minutes: 14, depth: "deep" },
      { id: "output", label: "写作修改", minutes: 12, depth: "deep" },
      { id: "summary", label: "复盘", minutes: 4, depth: "deep" },
    ],
  },
};

export const modeSteps = stageModeTemplates["stage-1"];

export const getModeForToday = (state: AppState): StudyMode => {
  const day = new Date().getDay();
  return day === 0 || day === 6 ? state.profile.weekendMinutes : state.profile.weekdayMinutes;
};

export const getCurrentWeek = (state: AppState) => {
  if (!state.profile.planStartDate) return 1;
  const start = new Date(`${state.profile.planStartDate}T12:00:00`).getTime();
  const elapsed = Math.max(0, Date.now() - start);
  return Math.min(12, Math.floor(elapsed / 604_800_000) + 1);
};

export const getPhase = (week: number) => phaseDefinitions.find((item) => week >= item.weeks[0] && week <= item.weeks[1])?.title ?? STAGE_TITLES["stage-5"];

export const getDueReviews = (state: AppState) => state.reviewItems.filter((item) => item.dueAt <= localDate());

export const getSkillScores = (state: AppState): SkillScores => {
  const scores = { ...state.assessment };
  (Object.keys(scores) as Ability[]).forEach((ability) => {
    const attempts = state.attempts.filter((item) => item.skill === ability);
    const evidence = state.mastery.abilities[ability];
    const recent = attempts.slice(-24);
    const fromAttempts = recent.length ? Math.round((recent.filter((item) => item.correct).length / recent.length) * 100) : scores[ability];
    const fromMastery = evidence.attempts ? Math.round((evidence.correct / evidence.attempts) * 100) : fromAttempts;
    scores[ability] = Math.round(scores[ability] * 0.25 + fromAttempts * 0.45 + fromMastery * 0.3);
  });
  return scores;
};

export const getWeakestSkill = (state: AppState): Ability => {
  const scores = getSkillScores(state);
  return (Object.keys(scores) as Ability[]).sort((a, b) => scores[a] - scores[b])[0];
};

export const getCurrentStage = (state: AppState): StageId => {
  const active = state.mastery.activeStageId;
  return stageOrder.includes(active) ? active : "stage-1";
};

export const evaluatePromotion = (state: AppState, stageId = getCurrentStage(state)) => {
  const definition = phaseDefinitions.find((item) => item.id === stageId)!;
  const scores = getSkillScores(state);
  const gaps = (Object.keys(definition.required) as Ability[]).filter((ability) => scores[ability] < (definition.required[ability] ?? 0));
  const passed = gaps.length === 0;
  return { stageId, passed, gaps, scores, required: definition.required };
};

export const getPromotionGapText = (state: AppState, stageId = getCurrentStage(state)) => {
  const result = evaluatePromotion(state, stageId);
  if (result.passed) return "本阶段关键能力均达到晋级线。";
  return result.gaps.map((ability) => `${ABILITY_LABELS[ability]}差 ${Math.max(0, (result.required[ability] ?? 0) - result.scores[ability])} 分`).join("；");
};

export const recordWeeklyCheck = (state: AppState, date = localDate()): AppState => {
  const stageId = getCurrentStage(state);
  const check = evaluatePromotion(state, stageId);
  const week = getCurrentWeek(state);
  const record = state.mastery.stages[stageId];
  const withoutSameWeek = record.weeklyChecks.filter((item) => item.week !== week);
  const remedialItems = check.gaps.map((ability) => ({
    id: `${date}-${stageId}-${ability}`,
    ability,
    reason: `${ABILITY_LABELS[ability]}未达到${stageId}晋级线`,
    createdAt: date,
  }));
  const nextStage = check.passed ? stageOrder[Math.min(stageOrder.length - 1, stageOrder.indexOf(stageId) + 1)] : stageId;
  return {
    ...state,
    mastery: {
      ...state.mastery,
      activeStageId: nextStage,
      stages: {
        ...state.mastery.stages,
        [stageId]: {
          ...record,
          promotedAt: check.passed ? date : record.promotedAt,
          extendedWeeks: check.passed ? record.extendedWeeks : record.extendedWeeks + 1,
          remedialFocus: check.gaps,
          weeklyChecks: [...withoutSameWeek, { week, date, passed: check.passed, gaps: check.gaps, scores: check.scores }],
        },
      },
      remedialQueue: check.passed ? state.mastery.remedialQueue : [...state.mastery.remedialQueue, ...remedialItems],
    },
  };
};

const getCompletedLessonIds = (state: AppState) => new Set(state.sessions.map((item) => item.lessonId));

export const getNextLesson = (state: AppState): Lesson => {
  const completed = getCompletedLessonIds(state);
  const stageId = getCurrentStage(state);
  const definition = phaseDefinitions.find((item) => item.id === stageId)!;
  const dueCount = getDueReviews(state).length;
  const remedial = dueCount > 8 || state.mastery.remedialQueue.some((item) => !item.resolvedAt);
  const pool = lessons.filter((lesson) => lesson.stageId === stageId && definition.allowedLessonTypes.includes(lesson.lessonType));
  const rhythmPool = remedial ? pool.filter((lesson) => lesson.rhythm === "integrated" || lesson.rhythm === "check" || lesson.rhythm === "rest") : pool;
  const remaining = (rhythmPool.length ? rhythmPool : pool).filter((lesson) => !completed.has(lesson.id));
  if (remaining.length) return remaining[0];
  return pool.find((lesson) => !completed.has(lesson.id)) ?? pool[completed.size % Math.max(1, pool.length)] ?? lessons[0];
};

export const getPlanReason = (state: AppState, lesson: Lesson) => {
  const due = getDueReviews(state).length;
  if (due > 8) return `到期复习有 ${due} 项，今天减少新内容，优先保住记忆闭环。`;
  const check = evaluatePromotion(state, lesson.stageId);
  if (!check.passed) return `当前阶段由 ${check.gaps.map((item) => ABILITY_LABELS[item]).join("、")} 决定补强顺序。`;
  return `阶段允许 ${lesson.lessonType} 任务；时长只决定练习深度。`;
};

export const ensureTodayPlan = (state: AppState, preferredMode?: StudyMode) => {
  const date = localDate();
  if (state.dailyPlans[date]) return state;
  const lesson = getNextLesson(state);
  const due = getDueReviews(state).length;
  return {
    ...state,
    dailyPlans: {
      ...state.dailyPlans,
      [date]: {
        date,
        lessonId: lesson.id,
        mode: preferredMode ?? getModeForToday(state),
        stageId: lesson.stageId,
        rhythm: lesson.rhythm,
        reason: getPlanReason(state, lesson),
        isRemedial: due > 8 || state.mastery.remedialQueue.some((item) => !item.resolvedAt),
      },
    },
  };
};

export const getTodayLesson = (state: AppState) => {
  const plan = state.dailyPlans[localDate()];
  return lessons.find((item) => item.id === plan?.lessonId) ?? getNextLesson(state);
};

export const getTodaySteps = (state: AppState, mode: StudyMode): PlanStep[] => {
  const lesson = getTodayLesson(state);
  const template = stageModeTemplates[lesson.stageId][mode];
  const due = getDueReviews(state).length;
  if (due <= 8) return template;
  return template.map((step) => step.id === "vocabulary" ? { ...step, label: `${step.label}（减量）`, minutes: Math.max(5, step.minutes - 4) } : step.id === "review" ? { ...step, minutes: step.minutes + 4 } : step);
};

export const getNewWordTarget = (state: AppState, mode: StudyMode) => {
  const stageId = getTodayLesson(state).stageId;
  const base: Record<StageId, Record<StudyMode, number>> = {
    "stage-1": { 45: 4, 90: 6, 150: 6 },
    "stage-2": { 45: 5, 90: 7, 150: 8 },
    "stage-3": { 45: 5, 90: 8, 150: 8 },
    "stage-4": { 45: 3, 90: 5, 150: 5 },
    "stage-5": { 45: 2, 90: 3, 150: 3 },
  };
  const due = getDueReviews(state).length;
  return due > 8 ? Math.max(2, base[stageId][mode] - 2) : base[stageId][mode];
};

export const updateMasteryFromAttempt = (state: AppState, attempt: { skill: Ability; correct: boolean; lessonId: string }, date = localDate()): AppState => {
  const lesson = lessons.find((item) => item.id === attempt.lessonId);
  const ability = state.mastery.abilities[attempt.skill];
  const nextVocabulary = { ...state.mastery.vocabulary };
  const nextGrammar = { ...state.mastery.grammar };
  if (lesson) {
    for (const word of lesson.vocabulary) {
      const current = nextVocabulary[word.word] ?? { word: word.word, stageId: word.level, status: "new" as const, seen: 0, correct: 0 };
      const seen = current.seen + (attempt.skill === "vocabulary" ? 1 : 0);
      const correct = current.correct + (attempt.skill === "vocabulary" && attempt.correct ? 1 : 0);
      nextVocabulary[word.word] = { ...current, seen, correct, lastSeenAt: date, status: correct >= 3 ? "mastered" : seen >= 1 ? "learning" : current.status };
    }
    const currentGrammar = nextGrammar[lesson.grammar.id] ?? { grammarId: lesson.grammar.id, stageId: lesson.grammar.stageId, status: "new" as const, attempts: 0, correct: 0 };
    const attempts = currentGrammar.attempts + (attempt.skill === "grammar" ? 1 : 0);
    const correct = currentGrammar.correct + (attempt.skill === "grammar" && attempt.correct ? 1 : 0);
    nextGrammar[lesson.grammar.id] = { ...currentGrammar, attempts, correct, lastSeenAt: date, status: correct >= 3 ? "mastered" : attempts >= 1 ? "learning" : currentGrammar.status };
  }
  const nodeId = attempt.skill === "vocabulary" ? "prereq-word-recognition" : attempt.skill === "sentence" ? "prereq-basic-sentence" : attempt.skill === "reading" ? "skill-reading" : attempt.skill === "translationWriting" ? "skill-translation" : attempt.skill === "grammar" ? "knowledge-grammar" : "prereq-word-recognition";
  const currentNode = state.mastery.syllabusNodeProgress[nodeId] ?? { nodeId, coverageEvidence: 0, masteryEvidence: 0, evidenceCount: 0 };
  const nextNode = { ...currentNode, coverageEvidence: Math.min(1, currentNode.coverageEvidence + 0.08), masteryEvidence: Math.min(1, currentNode.masteryEvidence + (attempt.correct ? 0.1 : 0.02)), evidenceCount: currentNode.evidenceCount + 1, lastReviewedAt: date, firstLearnedAt: currentNode.firstLearnedAt ?? date };
  return {
    ...state,
    mastery: {
      ...state.mastery,
      abilities: {
        ...state.mastery.abilities,
        [attempt.skill]: {
          attempts: ability.attempts + 1,
          correct: ability.correct + (attempt.correct ? 1 : 0),
          lastPracticedAt: date,
        },
      },
      vocabulary: nextVocabulary,
      grammar: nextGrammar,
      syllabusNodeProgress: { ...state.mastery.syllabusNodeProgress, [nodeId]: nextNode },
    },
  };
};

export const getRecommendation = (state: AppState) => {
  const lesson = getTodayLesson(state);
  const due = getDueReviews(state).length;
  if (due > 0) return `先处理 ${due} 项到期复习，再进入 ${STAGE_TITLES[lesson.stageId]}。`;
  const weakest = getWeakestSkill(state);
  return `今天处在 ${STAGE_TITLES[lesson.stageId]}，重点补强 ${ABILITY_LABELS[weakest]}。`;
};

export const getWeeklyStats = (state: AppState) => {
  const cutoff = addDays(localDate(), -6);
  const sessions = state.sessions.filter((item) => item.date >= cutoff);
  const total = sessions.reduce((sum, item) => sum + item.minutes, 0);
  const correct = sessions.reduce((sum, item) => sum + item.correct, 0);
  const questions = sessions.reduce((sum, item) => sum + item.total, 0);
  return { sessions: sessions.length, minutes: total, accuracy: questions ? Math.round((correct / questions) * 100) : 0 };
};
