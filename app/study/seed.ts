import { getNormalizedDocument, getNormalizedSchedule, NORMALIZED_CATEGORY_LABELS, normalizedCourse } from "./normalized";
import type {
  Ability,
  AppState,
  GrammarPoint,
  Interest,
  Lesson,
  LessonRhythm,
  LessonType,
  PracticeTask,
  Profile,
  Question,
  SkillScores,
  StageId,
  StageRecord,
  VocabularyEntry,
} from "./types";

const q = (id: string, skill: Ability, prompt: string, options: string[], answer: number, explanation: string): Question => ({
  id, skill, prompt, options, answer, explanation,
});

export const INTERESTS: Interest[] = ["日常生活", "职场沟通", "教育成长", "社会文化", "健康生活", "科技常识"];

export const STAGE_TITLES: Record<StageId, string> = {
  "stage-1": "第1-3周 教材词汇与原句起步",
  "stage-2": "第4-5周 教材 Unit 1-4 精读",
  "stage-3": "第6-8周 教材 Unit 5-8 阅读",
  "stage-4": "第9-10周 教材 Unit 9-12 与自测",
  "stage-5": "第11周 教材回收与考前复盘",
};

export const STAGE_GOALS: Record<StageId, string> = {
  "stage-1": "从指定教材的词汇、对话和原句开始，建立教材内的词句理解。",
  "stage-2": "精读指定教材前四个 Unit，积累词汇与句型。",
  "stage-3": "继续阅读指定教材 Unit 5-8，训练原句理解和翻译。",
  "stage-4": "完成指定教材 Unit 9-12 与教材自测内容。",
  "stage-5": "回收指定教材中的错题、词汇、原句和自测内容。",
};

const stageOrder: StageId[] = ["stage-1", "stage-2", "stage-3", "stage-4", "stage-5"];

const stageFromWeek = (week: number): StageId => {
  if (week <= 3) return "stage-1";
  if (week <= 5) return "stage-2";
  if (week <= 8) return "stage-3";
  if (week <= 10) return "stage-4";
  return "stage-5";
};

const rhythmForDay = (day: number): LessonRhythm => {
  const slot = ((day - 1) % 7) + 1;
  if (slot <= 4) return "new";
  if (slot === 5) return "integrated";
  if (slot === 6) return "check";
  return "rest";
};

const lessonTypeForStage = (stageId: StageId): LessonType => stageId === "stage-1"
  ? "micro"
  : stageId === "stage-2"
    ? "foundation"
    : stageId === "stage-3"
      ? "transition-reading"
      : stageId === "stage-4"
        ? "exam-drill"
        : "sprint";

const topicForCategory = (): Interest => "教育成长";

function trimMaterial(value: string, limit = 700) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

function focusDocumentForSchedule(document: typeof normalizedCourse.documents[number], schedule: ReturnType<typeof getNormalizedSchedule>) {
  const selectedSections = schedule.focusPartIds?.length
    ? document.sections.filter((section) => schedule.focusPartIds?.includes(section.id))
    : document.sections;
  const sections = selectedSections.length ? selectedSections : document.sections;
  const focusText = sections.map((section) => section.content).join("\n");
  const focusSentences = [...new Set(focusText.match(/[A-Z][A-Za-z0-9,;:'’"()\- ]{18,260}[.!?]/g) ?? [])].slice(0, 12);
  return {
    ...document,
    sections,
    englishSentences: focusSentences.length ? focusSentences : document.englishSentences,
  };
}

function vocabularyForDay(day: number, stageId: StageId): VocabularyEntry[] {
  return normalizedCourse.vocabulary
    .filter((item) => item.firstExposureDay === day)
    .slice(0, 30)
    .map((item) => ({
      word: item.headword,
      level: stageId,
      phonetic: item.phonetic,
      partOfSpeech: item.partOfSpeech,
      meaning: item.meaning,
      example: item.example || normalizedCourse.documents.find((document) => document.category === "unit")?.englishSentences[0] || item.headword,
      status: "new",
    }));
}

function grammarFromMaterial(document: typeof normalizedCourse.documents[number], day: number, stageId: StageId): GrammarPoint {
  const section = document.sections[(day - 1) % document.sections.length];
  const examples = document.englishSentences.slice((day - 1) % Math.max(1, document.englishSentences.length), ((day - 1) % Math.max(1, document.englishSentences.length)) + 2);
  return {
    id: `textbook-language-${String(day).padStart(2, "0")}`,
    stageId,
    title: section?.title ? `教材语言点 · ${section.title}` : "教材语言点",
    explanation: trimMaterial(section?.content ?? document.englishSentences.join(" "), 900),
    structure: `选自《${document.title}》`,
    examples: (examples.length ? examples : document.englishSentences.slice(0, 2)).map((en) => ({ en, zh: "教材原句，请结合上下文理解。" })),
    pitfall: "本页只使用指定教材中的原句和词汇；遇到提取不清的字符，请回到纸质或 PDF 原页核对。",
  };
}

function makePractice(id: string, vocabulary: VocabularyEntry[]): PracticeTask[] {
  const words = vocabulary.length ? vocabulary : normalizedCourse.vocabulary.slice(0, 4).map((item) => ({ word: item.headword, meaning: item.meaning, example: item.example || item.headword, phonetic: item.phonetic, partOfSpeech: item.partOfSpeech, level: "stage-1" }));
  const kinds: PracticeTask["kind"][] = ["recognition", "listening", "choice", "ordering", "blank", "imitation", "translation"];
  return Array.from({ length: 20 }, (_, index) => {
    const word = words[index % words.length];
    const kind = kinds[index % kinds.length];
    const optionWords = words.slice(index % words.length).concat(words).slice(0, Math.min(4, words.length));
    return {
      id: `${id}-task-${index + 1}`,
      kind,
      ability: kind === "recognition" || kind === "listening" ? "vocabulary" : kind === "translation" ? "translationWriting" : kind === "ordering" || kind === "imitation" ? "sentence" : "grammar",
      prompt: kind === "recognition" ? `写出教材词汇 ${word.word} 的中文义。` : kind === "listening" ? `朗读教材词汇 ${word.word}，再朗读本课原句。` : kind === "ordering" ? `根据教材原句整理语序：${word.example}` : kind === "blank" ? `用教材词汇 ${word.word} 完成原句理解。` : kind === "imitation" ? `仿写教材原句中的一个结构：${word.example}` : kind === "translation" ? `翻译教材原句：${word.example}` : `选择教材词汇 ${word.word} 的正确释义。`,
      options: kind === "choice" ? optionWords.map((item) => item.meaning) : undefined,
      answer: kind === "recognition" || kind === "choice" ? word.meaning : undefined,
      reference: word.example,
    };
  });
}

/* Retired legacy source builder. The active curriculum below is textbook-only. */
function makeLesson(day: number): Lesson {
  const week = Math.ceil(day / 7);
  const stageId = stageFromWeek(week);
  const schedule = getNormalizedSchedule(day);
  const document = getNormalizedDocument(schedule.documentId) ?? normalizedCourse.documents[0];
  const rhythm = rhythmForDay(day);
  const vocabulary = vocabularyForDay(day, stageId);
  const grammar = grammarFromMaterial(document, day, stageId);
  const sentences = document.englishSentences.slice(0, 5);
  const paragraphs = (sentences.length ? sentences : document.sections.slice(0, 3).map((section) => trimMaterial(section.content, 850)))
    .map((en) => ({ en, zh: "本段来自用户提供的英语（二）normalized 学习资料；需要时可在资料正文中查看完整上下文。" }));
  const firstWord = vocabulary[0];
  const id = `textbook-day-${String(day).padStart(2, "0")}`;
  const categoryLabel = NORMALIZED_CATEGORY_LABELS[document.category] ?? "英语（二）资料";
  const sourceSections = document.sections.length;
  return {
    id,
    day,
    week,
    title: rhythm === "rest" ? `轻复习 · ${document.title}` : document.title,
    topic: topicForCategory(),
    stageId,
    rhythm,
    lessonType: lessonTypeForStage(stageId),
    level: STAGE_TITLES[stageId],
    summary: `使用 normalized 资料《${document.title}》学习。本文件包含 ${sourceSections} 个分页/段落单元，状态为 ${document.status}。`,
    stageGoal: STAGE_GOALS[stageId],
    prerequisites: stageId === "stage-1" ? [] : [STAGE_TITLES[stageOrder[Math.max(0, stageOrder.indexOf(stageId) - 1)]]],
    paragraphs,
    vocabulary,
    grammar,
    sentencePatterns: grammar.examples.map((example, index) => ({ pattern: example.en, meaning: `从《${document.title}》关联的语法材料中提取/补充的例句 ${index + 1}`, example: example.en })),
    expressions: normalizedCourse.phrases.slice(((day - 1) * 4) % normalizedCourse.phrases.length, ((day - 1) * 4) % normalizedCourse.phrases.length + 4).map((item) => ({ phrase: item.phrase, meaning: item.meaning, example: item.sourceLine })),
    questions: [
      q(`${id}-source`, "reading", "今天的主学习材料是哪一份？", [document.title, "旧版通用演示课", "随机网络文章", "空白占位课"], 0, `本课直接对应 normalized 文件：${document.filename}`),
      q(`${id}-category`, "reading", "这份资料属于哪一类？", [categoryLabel, "与英语二无关", "个人兴趣文章", "未导入资料"], 0, `转换层将它归入：${categoryLabel}。`),
      q(`${id}-vocab`, "vocabulary", firstWord ? `“${firstWord.word}”在本课词表中的核心义是？` : "本日没有新增词时应优先做什么？", firstWord ? [firstWord.meaning, "释义与资料无关", "只看拼写不理解", "跳过全部复习"] : ["完成到期复习和资料学习", "强行加入超过35个新词", "制造虚假完成记录", "跳过课程"], 0, firstWord ? firstWord.example : "新词为 0 不等于无任务，复习和资料学习仍然继续。"),
      q(`${id}-source-quality`, "grammar", "遇到 OCR 粘连或疑似错字时，正确做法是？", ["结合上下文和词典核对", "直接当作标准答案背诵", "删除整份资料", "随意改成另一个词"], 0, "normalized 来自 PDF 文本/OCR，必须保留来源并对疑似错误做核对。"),
      q(`${id}-limit`, "vocabulary", "每日新增单词的上限是多少？", ["35 个", "60 个", "不限", "只学 1 个"], 0, "重点词和扩展词合计不得超过 35；到期复习不计入新增上限。"),
      q(`${id}-use`, "translationWriting", "学习完资料后应留下什么证据？", ["练习答案、翻译或总结", "只打开页面", "虚构学习分钟", "删除旧记录"], 0, "系统只记录真实完成的练习和输出。"),
    ],
    practiceTasks: makePractice(id, vocabulary),
    translations: sentences.slice(0, 3).map((sentence) => ({ zh: sentence, reference: "完成后回到资料上下文和词典逐项核对主语、谓语、时态及关键词。", tip: "把这句材料英文译成中文：先找主语和谓语，再处理修饰成分。" })),
    outputPrompt: `用中文或英文总结《${document.title}》今天学习的内容；至少记录一个知识点、一个例子和一个仍需核对的问题。`,
    outputHint: `资料类别：${categoryLabel}。不要照抄整页，留下可复习的个人总结。`,
    sourceDocumentId: document.id,
    sourceTitle: document.title,
    sourceCategory: document.category,
    syllabusNodeIds: document.category === "self-assessment" ? ["exam-task"] : ["knowledge-grammar", "skill-reading"],
    prerequisiteNodeIds: stageId === "stage-1" ? ["prereq-word-recognition", "prereq-basic-sentence"] : [],
  };
}

void makeLesson;

function makeTextbookLesson(day: number): Lesson {
  const week = Math.ceil(day / 7);
  const stageId = stageFromWeek(week);
  const schedule = getNormalizedSchedule(day);
  const baseDocument = getNormalizedDocument(schedule.documentId) ?? normalizedCourse.documents[0];
  const document = focusDocumentForSchedule(baseDocument, schedule);
  const rhythm = rhythmForDay(day);
  const vocabulary = vocabularyForDay(day, stageId);
  const grammar = grammarFromMaterial(document, day, stageId);
  const sentences = document.englishSentences.slice(0, 5);
  const sourceSentences = sentences.length ? sentences : document.sections.flatMap((section) => section.content.split(/\n+/)).filter((line) => /[A-Za-z]/.test(line)).slice(0, 5);
  const firstWord = vocabulary[0];
  const otherDocuments = normalizedCourse.documents.filter((item) => item.id !== document.id);
  const titleOptions = [document.title, ...otherDocuments.slice(0, 3).map((item) => item.title)];
  const sentenceOptions = [sourceSentences[0] ?? document.title, ...otherDocuments.slice(0, 3).map((item) => item.englishSentences[0] ?? item.title)];
  const meaningOptions = firstWord ? [firstWord.meaning, ...normalizedCourse.vocabulary.filter((item) => item.headword !== firstWord.word).slice(0, 3).map((item) => item.meaning)] : ["完成教材复习", "完成教材复习", "完成教材复习", "完成教材复习"];
  const id = `textbook-day-${String(day).padStart(2, "0")}`;
  const categoryLabel = NORMALIZED_CATEGORY_LABELS[document.category];
  return {
    id,
    day,
    week,
    title: day === 74 ? "10.23 考前轻复盘" : rhythm === "rest" ? `教材复习 · ${schedule.title ?? document.title}` : schedule.title ?? document.title,
    topic: topicForCategory(),
    stageId,
    rhythm,
    lessonType: lessonTypeForStage(stageId),
    level: `第 ${week} 周教材学习`,
    summary: `本课内容选自完整 OCR JSON 派生资料《${baseDocument.title}》，重点是${schedule.contentFocus ?? categoryLabel}。`,
    stageGoal: day === 74 ? "考前只做轻复盘，不安排新词。" : `围绕指定教材的${categoryLabel}完成词汇、原句理解和练习。`,
    prerequisites: stageId === "stage-1" ? [] : ["完成前一阶段的教材复习"],
    paragraphs: sourceSentences.map((en) => ({ en, zh: "教材原句节选，请结合本单元上下文理解。" })),
    vocabulary,
    grammar,
    sentencePatterns: grammar.examples.map((example, index) => ({ pattern: example.en, meaning: `教材原句 ${index + 1}`, example: example.en })),
    expressions: [],
    questions: [
      q(`${id}-unit`, "reading", "今天学习的教材单元是？", titleOptions, 0, `本课选自《${baseDocument.title}》。`),
      q(`${id}-category`, "reading", "本课在教材中的内容类型是？", [categoryLabel, ...Object.values(NORMALIZED_CATEGORY_LABELS).filter((item) => item !== categoryLabel).slice(0, 3)], 0, `本课属于${categoryLabel}。`),
      q(`${id}-word`, "vocabulary", firstWord ? `教材词汇“${firstWord.word}”的释义是？` : "今天先完成教材复习。", meaningOptions, 0, firstWord?.example || "教材词汇复习。"),
      q(`${id}-sentence`, "sentence", "哪一句来自今天的教材节选？", sentenceOptions, 0, "请回到本单元教材节选核对原句。"),
    ],
    practiceTasks: makePractice(id, vocabulary),
    translations: sourceSentences.slice(0, 3).map((sentence) => ({ zh: sentence, reference: "教材原句，请完成后回到本单元核对。", tip: "把这句教材英文译成中文。" })),
    outputPrompt: day === 74 ? "考前轻复盘：写下最容易忘的 5 个词或短语，以及一个提醒自己的考场策略。" : `根据《${baseDocument.title}》的教材节选，写下一句原文和自己的中文理解。`,
    outputHint: "只围绕本教材单元作答。",
    sourceDocumentId: baseDocument.id,
    sourceTitle: schedule.title ?? baseDocument.title,
    sourceCategory: baseDocument.category,
    sourceSectionIds: schedule.focusPartIds ?? [],
    syllabusNodeIds: document.category === "self-assessment" ? ["exam-task"] : ["knowledge-grammar", "skill-reading"],
    prerequisiteNodeIds: stageId === "stage-1" ? ["prereq-word-recognition", "prereq-basic-sentence"] : [],
  };
}

export const lessons: Lesson[] = Array.from({ length: 74 }, (_, index) => makeTextbookLesson(index + 1));
export const migratedReadingLessons = lessons.filter((lesson) => lesson.stageId === "stage-3" && lesson.lessonType === "transition-reading");

const textbookAssessmentWords = normalizedCourse.vocabulary.slice(0, 6);
const textbookAssessmentDocuments = normalizedCourse.documents.slice(0, 4);

export const assessmentQuestions: Question[] = [
  q("a-v1", "vocabulary", `教材词汇“${textbookAssessmentWords[0]?.headword ?? "sufficient"}”的释义是？`, [textbookAssessmentWords[0]?.meaning ?? "", textbookAssessmentWords[1]?.meaning ?? "", textbookAssessmentWords[2]?.meaning ?? "", textbookAssessmentWords[3]?.meaning ?? ""], 0, "请回到指定教材的词汇提取内容核对。"),
  q("a-p1", "pronunciation", `请点击“${textbookAssessmentWords[1]?.headword ?? "authority"}”查询教材词汇的发音和释义。`, [textbookAssessmentWords[1]?.headword ?? "authority", textbookAssessmentWords[2]?.headword ?? "consistent", textbookAssessmentWords[3]?.headword ?? "directly", textbookAssessmentWords[4]?.headword ?? "identify"], 0, "本题使用教材词汇进行查询练习。"),
  q("a-g1", "grammar", "哪一句来自指定教材的 Unit 1？", [textbookAssessmentDocuments[0]?.englishSentences[0] ?? "", textbookAssessmentDocuments[1]?.englishSentences[0] ?? "", textbookAssessmentDocuments[2]?.englishSentences[0] ?? "", textbookAssessmentDocuments[3]?.englishSentences[0] ?? ""], 0, "请从教材 Unit 1 的原句中核对。"),
  q("a-s1", "sentence", "哪一句来自指定教材的 Unit 2？", [textbookAssessmentDocuments[1]?.englishSentences[0] ?? "", textbookAssessmentDocuments[0]?.englishSentences[0] ?? "", textbookAssessmentDocuments[2]?.englishSentences[0] ?? "", textbookAssessmentDocuments[3]?.englishSentences[0] ?? ""], 0, "请从教材 Unit 2 的原句中核对。"),
  q("a-r1", "reading", "教材 Unit 1 的标题是？", [textbookAssessmentDocuments[0]?.title ?? "", textbookAssessmentDocuments[1]?.title ?? "", textbookAssessmentDocuments[2]?.title ?? "", textbookAssessmentDocuments[3]?.title ?? ""], 0, "请根据指定教材目录判断。"),
  q("a-t1", "translationWriting", "请选择一条教材原句进行翻译练习。", [textbookAssessmentDocuments[0]?.englishSentences[1] ?? "", textbookAssessmentDocuments[1]?.englishSentences[1] ?? "", textbookAssessmentDocuments[2]?.englishSentences[1] ?? "", textbookAssessmentDocuments[3]?.englishSentences[1] ?? ""], 0, "这一步用于校准教材原句的理解与翻译起点。"),
];

export const defaultScores: SkillScores = {
  vocabulary: 20,
  pronunciation: 20,
  grammar: 20,
  sentence: 20,
  reading: 20,
  translationWriting: 20,
};

export const defaultProfile = (): Profile => ({
  examDate: "2026-10-23",
  weekdayMinutes: 90,
  weekendMinutes: 150,
  studyDays: 6,
  interests: [...INTERESTS],
  confidence: 2,
  onboardingComplete: false,
  planStartDate: "",
  startingStageId: "stage-1",
});

const emptyEvidence = (): AppState["mastery"]["abilities"] => ({
  vocabulary: { attempts: 0, correct: 0 },
  pronunciation: { attempts: 0, correct: 0 },
  grammar: { attempts: 0, correct: 0 },
  sentence: { attempts: 0, correct: 0 },
  reading: { attempts: 0, correct: 0 },
  translationWriting: { attempts: 0, correct: 0 },
});

const stageRecord = (stageId: StageId): StageRecord => ({
  stageId,
  startedAt: "",
  extendedWeeks: 0,
  remedialFocus: [],
  weeklyChecks: [],
});

export const createInitialState = (): AppState => ({
  schemaVersion: 5,
  profile: defaultProfile(),
  assessment: { ...defaultScores },
  mastery: {
    activeStageId: "stage-1",
    placementStageId: "stage-1",
    abilities: emptyEvidence(),
    vocabulary: {},
    grammar: {},
    stages: {
      "stage-1": stageRecord("stage-1"),
      "stage-2": stageRecord("stage-2"),
      "stage-3": stageRecord("stage-3"),
      "stage-4": stageRecord("stage-4"),
      "stage-5": stageRecord("stage-5"),
    },
    remedialQueue: [],
    syllabusNodeProgress: {},
    contentVersion: "textbook-00015-2012-v1",
  },
  attempts: [],
  reviewItems: [],
  mistakes: [],
  sessions: [],
  dailyPlans: {},
  savedExpressions: [],
});
