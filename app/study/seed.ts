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
  "stage-1": "第1-3周 语法与高频词基础",
  "stage-2": "第4-5周 教材与核心词组",
  "stage-3": "第6-8周 阅读与写作专项",
  "stage-4": "第9-10周 题型与真题训练",
  "stage-5": "第11-12周 模拟与冲刺回收",
};

export const STAGE_GOALS: Record<StageId, string> = {
  "stage-1": "使用 normalized 中的基础语法、高频词和基础句型资料建立可用基础。",
  "stage-2": "进入教材、核心词组和句子结构，开始稳定理解较长材料。",
  "stage-3": "使用教材、写作课程和专项材料训练阅读与表达。",
  "stage-4": "使用题型技巧、2014 年后真题和专项练习熟悉现行常见题型。",
  "stage-5": "使用模拟卷、冲刺资料和历年真题完成限时训练与错题回收。",
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

const topicForCategory = (category: string): Interest | "复盘" => {
  if (category === "writing") return "教育成长";
  if (category === "textbook" || category === "grammar") return "日常生活";
  if (category === "past-paper" || category === "exam-review" || category === "strategy") return "复盘";
  return "社会文化";
};

function trimMaterial(value: string, limit = 700) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
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
      example: item.example || `Find ${item.headword} in the English II materials.`,
      status: "new",
    }));
}

function grammarFromMaterial(day: number, stageId: StageId): GrammarPoint {
  const grammarDocument = normalizedCourse.documents.find((item) => item.category === "grammar") ?? normalizedCourse.documents[0];
  const section = grammarDocument.sections[(day - 1) % grammarDocument.sections.length];
  const examples = grammarDocument.englishSentences.slice((day - 1) % Math.max(1, grammarDocument.englishSentences.length), ((day - 1) % Math.max(1, grammarDocument.englishSentences.length)) + 2);
  return {
    id: `normalized-grammar-${String(day).padStart(2, "0")}`,
    stageId,
    title: section?.title ? `基础语法 · ${section.title}` : "基础语法资料",
    explanation: trimMaterial(section?.content ?? "本课使用 normalized 文件夹中的基础语法资料。", 900),
    structure: `资料来源：${grammarDocument.title}`,
    examples: (examples.length ? examples : ["I study English every day.", "Practice makes learning clearer."]).map((en) => ({ en, zh: "请结合本课资料理解并尝试翻译。" })),
    pitfall: "资料来自 PDF/OCR 转换。遇到拼写、音标或公式粘连时，以词典发音和上下文为准，并把疑似错误作为待核对项。",
  };
}

function makePractice(id: string, vocabulary: VocabularyEntry[], materialTitle: string): PracticeTask[] {
  const words = vocabulary.length ? vocabulary : [{ word: "English", meaning: "英语", example: materialTitle } as VocabularyEntry];
  const kinds: PracticeTask["kind"][] = ["recognition", "listening", "choice", "ordering", "blank", "imitation", "translation"];
  return Array.from({ length: 20 }, (_, index) => {
    const word = words[index % words.length];
    const kind = kinds[index % kinds.length];
    return {
      id: `${id}-task-${index + 1}`,
      kind,
      ability: kind === "recognition" || kind === "listening" ? "vocabulary" : kind === "translation" ? "translationWriting" : kind === "ordering" || kind === "imitation" ? "sentence" : "grammar",
      prompt: kind === "recognition" ? `写出 ${word.word} 的核心中文义。` : kind === "listening" ? `朗读 ${word.word}，再朗读它在资料中的语境。` : `结合《${materialTitle}》完成一项 ${kind} 练习。`,
      options: kind === "choice" ? [word.meaning, "与本课无关", "仅供占位", "无法判断"] : undefined,
      answer: kind === "recognition" || kind === "choice" ? word.meaning : undefined,
      reference: word.example,
    };
  });
}

function makeLesson(day: number): Lesson {
  const week = Math.ceil(day / 7);
  const stageId = stageFromWeek(week);
  const schedule = getNormalizedSchedule(day);
  const document = getNormalizedDocument(schedule.documentId) ?? normalizedCourse.documents[0];
  const rhythm = rhythmForDay(day);
  const vocabulary = vocabularyForDay(day, stageId);
  const grammar = grammarFromMaterial(day, stageId);
  const sentences = document.englishSentences.slice(0, 5);
  const paragraphs = (sentences.length ? sentences : document.sections.slice(0, 3).map((section) => trimMaterial(section.content, 850)))
    .map((en) => ({ en, zh: "本段来自用户提供的英语（二）normalized 学习资料；需要时可在资料正文中查看完整上下文。" }));
  const firstWord = vocabulary[0];
  const id = `normalized-day-${String(day).padStart(2, "0")}`;
  const categoryLabel = NORMALIZED_CATEGORY_LABELS[document.category] ?? "英语（二）资料";
  const sourceSections = document.sections.length;
  return {
    id,
    day,
    week,
    title: rhythm === "rest" ? `轻复习 · ${document.title}` : document.title,
    topic: rhythm === "rest" ? "复盘" : topicForCategory(document.category),
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
      q(`${id}-vocab`, "vocabulary", firstWord ? `“${firstWord.word}”在本课词表中的核心义是？` : "本日没有新增词时应优先做什么？", firstWord ? [firstWord.meaning, "释义与资料无关", "只看拼写不理解", "跳过全部复习"] : ["完成到期复习和资料学习", "强行加入超过30个新词", "制造虚假完成记录", "跳过课程"], 0, firstWord ? firstWord.example : "新词为 0 不等于无任务，复习和资料学习仍然继续。"),
      q(`${id}-source-quality`, "grammar", "遇到 OCR 粘连或疑似错字时，正确做法是？", ["结合上下文和词典核对", "直接当作标准答案背诵", "删除整份资料", "随意改成另一个词"], 0, "normalized 来自 PDF 文本/OCR，必须保留来源并对疑似错误做核对。"),
      q(`${id}-limit`, "vocabulary", "每日新增单词的上限是多少？", ["30 个", "60 个", "不限", "只学 1 个"], 0, "重点词和扩展词合计不得超过 30；到期复习不计入新增上限。"),
      q(`${id}-use`, "translationWriting", "学习完资料后应留下什么证据？", ["练习答案、翻译或总结", "只打开页面", "虚构学习分钟", "删除旧记录"], 0, "系统只记录真实完成的练习和输出。"),
    ],
    practiceTasks: makePractice(id, vocabulary, document.title),
    translations: sentences.slice(0, 3).map((sentence) => ({ zh: sentence, reference: "完成后回到资料上下文和词典逐项核对主语、谓语、时态及关键词。", tip: "把这句材料英文译成中文：先找主语和谓语，再处理修饰成分。" })),
    outputPrompt: `用中文或英文总结《${document.title}》今天学习的内容；至少记录一个知识点、一个例子和一个仍需核对的问题。`,
    outputHint: `资料类别：${categoryLabel}。不要照抄整页，留下可复习的个人总结。`,
    sourceDocumentId: document.id,
    sourceTitle: document.title,
    sourceCategory: document.category,
    syllabusNodeIds: document.category === "writing" ? ["skill-writing"] : document.category === "past-paper" ? ["exam-task"] : ["knowledge-grammar", "skill-reading"],
    prerequisiteNodeIds: stageId === "stage-1" ? ["prereq-word-recognition", "prereq-basic-sentence"] : [],
  };
}

export const lessons: Lesson[] = Array.from({ length: 84 }, (_, index) => makeLesson(index + 1));
export const migratedReadingLessons = lessons.filter((lesson) => lesson.stageId === "stage-3" && lesson.lessonType === "transition-reading");

export const curatedAssessmentQuestions: Question[] = [
  q("a-v1", "vocabulary", "What does push mean?", ["推；推动", "天空", "文化", "湖"], 0, "push 来自 normalized 高频词资料。"),
  q("a-p1", "pronunciation", "Which word should be checked with the pronunciation tool?", ["culture", "的", "课程", "复习"], 0, "英文词可以点击查看词典信息并播放发音。"),
  q("a-g1", "grammar", "Choose the correct form: I ___ studying now.", ["am", "is", "are", "be"], 0, "现在进行时使用 be + doing，I 和 am 搭配。"),
  q("a-s1", "sentence", "Choose the complete sentence.", ["She studies English every day.", "Because useful.", "A useful book.", "Very carefully."], 0, "完整句需要清楚的主语和谓语。"),
  q("a-r1", "reading", "What should you do with an OCR error?", ["Check context and the dictionary", "Memorize it immediately", "Ignore every source", "Delete all materials"], 0, "OCR 资料要结合上下文和词典核对。"),
  q("a-t1", "translationWriting", "“每天最多学习30个新词。” is:", ["Learn no more than 30 new words a day.", "Learn 60 words without review.", "Words are no limit.", "Thirty day new word."], 0, "no more than 表示不超过。"),
];

export const assessmentQuestions: Question[] = [
  q("a-v1", "vocabulary", "What does push mean?", ["推动", "天空", "文化", "潮湿"], 0, "push 的核心义是“推动”。"),
  q("a-p1", "pronunciation", "Which word has the /ˈkʌltʃər/ pronunciation?", ["culture", "course", "future", "picture"], 0, "culture 的发音接近 /ˈkʌltʃər/。"),
  q("a-g1", "grammar", "Choose the correct form: I ___ studying now.", ["am", "is", "are", "be"], 0, "主语 I 与 be 动词 am 搭配，现在进行时为 am studying。"),
  q("a-s1", "sentence", "Choose the complete sentence.", ["She studies English every day.", "Because useful.", "A useful book.", "Very carefully."], 0, "完整句通常需要明确的主语和谓语。"),
  q("a-r1", "reading", "Mina studies ten words, reviews yesterday's words, and writes one sentence. What is she doing?", ["She is following a balanced study routine.", "She is avoiding review.", "She is only memorizing spelling.", "She is taking a day off."], 0, "短文同时提到新词、复习和造句，说明她在进行完整的学习闭环。"),
  q("a-t1", "translationWriting", "“每天最多学习30个新词。” is:", ["Learn no more than 30 new words a day.", "Learn 60 words without review.", "Words are no limit.", "Thirty day new word."], 0, "no more than 表示“不超过”。"),
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
  examDate: "2026-10-31",
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
    contentVersion: "normalized-english2-v1",
  },
  attempts: [],
  reviewItems: [],
  mistakes: [],
  sessions: [],
  dailyPlans: {},
  savedExpressions: [],
});
