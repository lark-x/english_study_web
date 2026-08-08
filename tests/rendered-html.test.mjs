import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

async function loadStudyModules() {
  const transpile = async (relativePath, replacements = []) => {
    let source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    for (const [from, to] of replacements) source = source.replaceAll(from, to);
    const js = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        verbatimModuleSyntax: false,
      },
    }).outputText;
    return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  };
  const typesUrl = await transpile("../app/study/types.ts");
  const normalizedJson = await readFile(new URL("../public/data/english2/textbook_course.json", import.meta.url), "utf8");
  const normalizedJsonUrl = `data:text/javascript;base64,${Buffer.from(`export default ${normalizedJson}`).toString("base64")}`;
  const normalizedUrl = await transpile("../app/study/normalized.ts", [[
    'import normalizedCourseJson from "../../public/data/english2/textbook_course.json";',
    `import normalizedCourseJson from "${normalizedJsonUrl}";`,
  ]]);
  const seedUrl = await transpile("../app/study/seed.ts", [
    ['from "./types"', `from "${typesUrl}"`],
    ['from "./normalized"', `from "${normalizedUrl}"`],
  ]);
  const plannerUrl = await transpile("../app/study/planner.ts", [
    ['from "./seed"', `from "${seedUrl}"`],
    ['from "./types"', `from "${typesUrl}"`],
  ]);
  const storageUrl = await transpile("../app/study/storage.ts", [
    ['from "./seed"', `from "${seedUrl}"`],
    ['from "./planner"', `from "${plannerUrl}"`],
    ['from "./types"', `from "${typesUrl}"`],
  ]);
  const vocabularyUrl = await transpile("../app/study/vocabulary.ts", [
    ['from "./normalized"', `from "${normalizedUrl}"`],
    ['from "./types"', `from "${typesUrl}"`],
  ]);
  const [seed, planner, storage, vocabulary] = await Promise.all([import(seedUrl), import(plannerUrl), import(storageUrl), import(vocabularyUrl)]);
  return { seed, planner, storage, vocabulary };
}

test("server renders the Web-only stage-driven English learning system", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Daily English · 阶段驱动英语学习<\/title>/i);
  assert.match(html, /正在恢复你的学习记录/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site|Electron/i);
});

test("the app keeps Web-only persistence, import/export, launch, and clickable word lookup", async () => {
  const [app, storage, wordLookup, dictionary, launcher, windowsLauncher, packageJson] = await Promise.all([
    readFile(new URL("../app/study/StudyApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/study/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/study/WordLookup.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/study/dictionary.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/launch.mjs", import.meta.url), "utf8"),
    readFile(new URL("../START_ENGLISH.cmd", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(app, /45 \/ 90 \/ 150/);
  assert.match(app, /阶段先于时长/);
  assert.match(app, /InteractiveText/);
  assert.match(app, /visibleVocabulary\.find/);
  assert.match(app, /savedExpressions\.includes/);
  assert.match(storage, /indexedDB\.open/);
  assert.match(storage, /schemaVersion === 5/);
  assert.match(storage, /upgradeV4/);
  assert.match(storage, /upgradeV3/);
  assert.match(storage, /jiangxi-english-study-state-v1/);
  assert.match(storage, /exportState/);
  assert.match(wordLookup, /lookup-word/);
  assert.match(wordLookup, /播放发音|鎾斁鍙戦煶/);
  assert.doesNotMatch(dictionary, /api\.dictionaryapi\.dev|https:\/\//);
  assert.match(dictionary, /courseDictionary/);
  assert.match(dictionary, /daily-english-dictionary-cache-v1/);
  assert.match(launcher, /npmCommand/);
  assert.match(launcher, /openBrowser/);
  assert.match(launcher, /--port", "4173"/);
  assert.match(windowsLauncher, /scripts\\start-background\.ps1/);
  assert.match(windowsLauncher, /WindowStyle Hidden/);
  assert.match(windowsLauncher, /where node\.exe/);
  assert.match(packageJson, /"dev": "vinext dev"/);
  assert.doesNotMatch(packageJson, /electron-builder|"desktop:/);
});

test("curriculum uses only the specified English II textbook across the 12-week route", async () => {
  const { seed } = await loadStudyModules();
  const { lessons, migratedReadingLessons } = seed;
  const textbook = JSON.parse(await readFile(new URL("../public/data/english2/textbook_course.json", import.meta.url), "utf8"));
  assert.equal(lessons.length, 84);
  assert.ok(migratedReadingLessons.length > 0);
  assert.ok(lessons.slice(0, 21).every((lesson) => lesson.stageId === "stage-1" && lesson.lessonType === "micro"));
  assert.ok(lessons.every((lesson) => lesson.sourceDocumentId && lesson.sourceTitle && lesson.sourceCategory));
  assert.ok(lessons.every((lesson) => lesson.vocabulary.length <= 30));
  assert.equal(textbook.documentCount, 14);
  assert.equal(textbook.audit.includedDocuments, 14);
  assert.equal(textbook.audit.missingDocuments.length, 0);
  assert.match(textbook.sourceRule, /00015/);
  assert.ok(textbook.documents.every((document) => ["unit", "vocabulary", "self-assessment"].includes(document.category)));
  assert.ok(textbook.documents.every((document) => /英语（二）自学教程|英语\(二\)自学教程/.test(document.source)));
  assert.ok(textbook.documents.every((document) => !/历年真题|基础语法|english-file/i.test(`${document.title} ${document.source} ${document.filename}`)));
  assert.equal(new Set(lessons.map((lesson) => lesson.sourceDocumentId)).size, textbook.documentCount);
  assert.ok(lessons.slice(21, 35).every((lesson) => lesson.stageId === "stage-2" && lesson.lessonType === "foundation"));
  assert.deepEqual(lessons.slice(0, 7).map((lesson) => lesson.rhythm), ["new", "new", "new", "new", "integrated", "check", "rest"]);
  for (const lesson of lessons.slice(0, 35)) {
    assert.ok(lesson.vocabulary.every((item) => item.level === lesson.stageId), `${lesson.id} vocabulary should be staged`);
    assert.ok(lesson.vocabulary.every((item) => item.phonetic && item.partOfSpeech && item.meaning && item.example), `${lesson.id} vocabulary should be complete`);
    assert.ok(lesson.practiceTasks.some((item) => item.kind === "recognition"), `${lesson.id} should train word recognition`);
    assert.ok(lesson.practiceTasks.some((item) => item.kind === "listening"), `${lesson.id} should train listening`);
    assert.ok(lesson.practiceTasks.some((item) => item.kind === "ordering"), `${lesson.id} should train ordering`);
    assert.ok(lesson.practiceTasks.some((item) => item.kind === "blank"), `${lesson.id} should train blanks`);
    assert.ok(lesson.practiceTasks.some((item) => item.kind === "imitation"), `${lesson.id} should train imitation`);
    assert.ok(lesson.practiceTasks.some((item) => item.kind === "translation"), `${lesson.id} should train one-sentence translation`);
    assert.doesNotMatch(JSON.stringify(lesson), /历年真题|基础语法|随机网络文章|旧版通用演示|OCR/i);
  }
});

test("stage-specific 45/90/150 templates keep phase before duration", async () => {
  const { planner } = await loadStudyModules();
  const { stageModeTemplates } = planner;
  for (const stageId of ["stage-1", "stage-2", "stage-3", "stage-4", "stage-5"]) {
    assert.deepEqual(Object.keys(stageModeTemplates[stageId]).sort(), ["150", "45", "90"]);
    const labels45 = stageModeTemplates[stageId][45].map((item) => item.id);
    const labels90 = stageModeTemplates[stageId][90].map((item) => item.id);
    const labels150 = stageModeTemplates[stageId][150].map((item) => item.id);
    assert.equal(labels45[0], "review");
    assert.equal(labels90[0], "review");
    assert.equal(labels150[0], "review");
  }
  assert.ok(stageModeTemplates["stage-1"][45].some((item) => item.id === "micro-read"));
  assert.ok(!stageModeTemplates["stage-1"][45].some((item) => item.id === "read"));
  assert.ok(stageModeTemplates["stage-1"][150].some((item) => item.id === "dictation" || item.id === "correction"));
  assert.ok(stageModeTemplates["stage-4"][90].some((item) => item.label.includes("判断") || item.label.includes("题型")));
});

test("due review backlog reduces new words instead of dropping review", async () => {
  const { seed, planner } = await loadStudyModules();
  const state = seed.createInitialState();
  state.profile.onboardingComplete = true;
  state.profile.planStartDate = planner.localDate();
  state.reviewItems = Array.from({ length: 10 }, (_, index) => ({
    id: `r-${index}`,
    kind: "word",
    front: "book",
    back: "书",
    sourceLessonId: "day-01",
    dueAt: planner.localDate(),
    intervalDays: 1,
    repetitions: 0,
  }));
  const planned = planner.ensureTodayPlan(state, 90);
  const steps = planner.getTodaySteps(planned, 90);
  assert.equal(steps[0].id, "review");
  assert.ok(steps[0].minutes > planner.stageModeTemplates["stage-1"][90][0].minutes);
  assert.ok(planner.getNewWordTarget(planned, 90) < 6);
  assert.equal(planned.dailyPlans[planner.localDate()].isRemedial, true);
});

test("promotion and remedial checks require every key ability, not an average", async () => {
  const { seed, planner } = await loadStudyModules();
  const state = seed.createInitialState();
  state.profile.onboardingComplete = true;
  state.profile.planStartDate = planner.localDate();
  state.assessment = { vocabulary: 95, pronunciation: 95, grammar: 95, sentence: 95, reading: 20, translationWriting: 95 };
  const failed = planner.evaluatePromotion(state, "stage-1");
  assert.equal(failed.passed, false);
  assert.deepEqual(failed.gaps, ["reading"]);
  const checked = planner.recordWeeklyCheck(state, planner.localDate());
  assert.equal(checked.mastery.activeStageId, "stage-1");
  assert.equal(checked.mastery.remedialQueue.at(-1).ability, "reading");
  state.assessment = { vocabulary: 90, pronunciation: 90, grammar: 90, sentence: 90, reading: 90, translationWriting: 90 };
  const passed = planner.recordWeeklyCheck(state, planner.localDate());
  assert.equal(passed.mastery.activeStageId, "stage-2");
});

test("lesson prerequisites keep long readings out of the beginner stages", async () => {
  const { seed, planner } = await loadStudyModules();
  const state = seed.createInitialState();
  state.profile.onboardingComplete = true;
  state.profile.planStartDate = planner.localDate();
  let lesson = planner.getNextLesson(state);
  assert.equal(lesson.stageId, "stage-1");
  assert.equal(lesson.lessonType, "micro");
  state.mastery.activeStageId = "stage-3";
  state.sessions = seed.lessons.filter((item) => item.stageId === "stage-1" || item.stageId === "stage-2").map((item) => ({
    id: `s-${item.id}`,
    date: "2026-08-01",
    lessonId: item.id,
    mode: 90,
    minutes: 90,
    correct: 6,
    total: 6,
    output: "",
    completedAt: "2026-08-01T12:00:00.000Z",
  }));
  lesson = planner.getNextLesson(state);
  assert.equal(lesson.stageId, "stage-3");
  assert.ok(["transition-reading"].includes(lesson.lessonType));
});

test("schema v3 migration preserves historical minutes and completion records", async () => {
  const { storage } = await loadStudyModules();
  const old = {
    schemaVersion: 3,
    profile: {
      examDate: "2026-10-31",
      weekdayMinutes: 88,
      weekendMinutes: 151,
      studyDays: 5,
      interests: ["日常生活"],
      confidence: 3,
      onboardingComplete: true,
      planStartDate: "2026-08-01",
    },
    assessment: { reading: 80, grammar: 70, translation: 60, writing: 40 },
    attempts: [{ questionId: "q1", lessonId: "day-01", skill: "writing", correct: true, answeredAt: "2026-08-01T00:00:00.000Z" }],
    reviewItems: [],
    mistakes: [],
    sessions: [{ id: "old-session", date: "2026-08-01", lessonId: "day-01", mode: 88, minutes: 73, correct: 3, total: 4, output: "I am ready.", completedAt: "2026-08-01T00:00:00.000Z" }],
    dailyPlans: { "2026-08-01": { date: "2026-08-01", lessonId: "day-01", mode: 88 } },
    savedExpressions: ["ready"],
  };
  const upgraded = storage.upgradeV3(old);
  assert.equal(upgraded.schemaVersion, 5);
  assert.equal(upgraded.sessions[0].id, "old-session");
  assert.equal(upgraded.sessions[0].minutes, 73);
  assert.equal(upgraded.sessions[0].mode, 90);
  assert.equal(upgraded.attempts[0].skill, "translationWriting");
  assert.equal(upgraded.dailyPlans["2026-08-01"].stageId, "stage-1");
});

test("schema v4 migration preserves history and clears obsolete daily plans", async () => {
  const { seed, storage } = await loadStudyModules();
  const old = seed.createInitialState();
  old.schemaVersion = 4;
  old.sessions = [{ id: "kept", date: "2026-08-01", lessonId: "day-01", mode: 90, minutes: 73, correct: 1, total: 2, output: "kept", completedAt: "2026-08-01T00:00:00.000Z" }];
  old.dailyPlans = { "2026-08-08": { date: "2026-08-08", lessonId: "day-01", mode: 90, stageId: "stage-1", rhythm: "new", reason: "old", isRemedial: false } };
  const upgraded = storage.upgradeV4(old);
  assert.equal(upgraded.schemaVersion, 5);
  assert.equal(upgraded.sessions[0].id, "kept");
  assert.equal(upgraded.sessions[0].minutes, 73);
  assert.deepEqual(upgraded.dailyPlans, {});
  assert.equal(upgraded.mastery.contentVersion, "textbook-00015-2012-v1");
});

test("textbook course builder keeps vocabulary within its source and schedule", async () => {
  const [builder, textbook] = await Promise.all([
    readFile(new URL("../scripts/build-textbook-course.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/data/english2/textbook_course.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assert.match(builder, /main-textbook-manifest\.json/);
  assert.match(builder, /textbook-vocab-extracted\.json/);
  assert.doesNotMatch(builder, /normalized_course\.json|CET4|english-file/);
  assert.ok(textbook.vocabulary.length > 0);
  assert.ok(textbook.vocabulary.every((item) => item.sourceKind === "textbook-vocabulary"));
  assert.ok(textbook.vocabulary.every((item) => item.firstExposureDay >= 1 && item.firstExposureDay <= 84));
  assert.ok(textbook.vocabulary.every((item) => item.meaning && item.partOfSpeech));
  const content = textbook.vocabulary.find((item) => item.headword === "content");
  assert.equal(content.meaning, "满足的；满意的；内容；所含之物");
  assert.equal(content.exampleTranslation, "他想让它们感到满足。");
  assert.doesNotMatch(JSON.stringify(textbook), /户斤容纳之物|居ij痛|口 liked more/);
  assert.ok(textbook.audit.maxNewWordsPerDay <= 30);
  assert.equal(textbook.phrases.length, 0);
});

test("empty review advances safely to a renderable textbook vocabulary step", async () => {
  const { seed, vocabulary } = await loadStudyModules();
  const state = seed.createInitialState();
  const plan = vocabulary.getVocabularyPlan(state, 1, 90);
  const cards = [...plan.focus, ...plan.extension].map((item) => vocabulary.toVocabularyEntry(item, "stage-1"));
  assert.ok(cards.length > 0);
  assert.ok(cards.every((card) => typeof card.example === "string" && card.example.length > 0));
});

test("offline dictionary remains bundled at 1,286 entries", async () => {
  const offline = JSON.parse(await readFile(new URL("../app/study/offline-dictionary.json", import.meta.url), "utf8"));
  assert.equal(Object.keys(offline).length, 1286);
  for (const word of ["routine", "paragraph", "evidence"]) {
    assert.ok(offline[word], `${word} should be available offline`);
  }
});

test("textbook PDF vocabulary supplies Chinese meanings to offline word lookup", async () => {
  const [dictionarySource, appendix] = await Promise.all([
    readFile(new URL("../app/study/dictionary.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/study/textbook-units/pdf-vocab-with-dict.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assert.match(dictionarySource, /pdf-vocab-with-dict\.json/);
  assert.match(dictionarySource, /textbookAppendixDictionary/);
  assert.equal(appendix.length, 652);
  assert.ok(appendix.every((item) => item.translation && /[\u4e00-\u9fff]/.test(item.translation)));
});

test("13000 exam center uses traceable facts and never invents exam numbers", async () => {
  const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
  const course = await readJson("../public/data/exam/course_profile.json");
  const sources = await readJson("../public/data/exam/source_registry.json");
  const questionTypes = await readJson("../public/data/exam/question_types.json");
  const syllabus = await readJson("../public/data/exam/syllabus_outline.json");
  assert.equal(course.currentCode, "13000");
  assert.equal(course.currentName, "英语（专升本）");
  assert.equal(course.textbook.edition, "2012年版");
  assert.ok(sources.length >= 3);
  assert.ok(sources.filter((item) => item.status === "active").length >= 3);
  assert.ok(questionTypes.every((item) => item.verificationStatus === "pending" && item.questionCount === null && item.score === null && item.durationMinutes === null));
  assert.ok(syllabus.every((item) => item.verificationStatus === "pending" || item.sourceRefs.length > 0));
});

test("textbook corpus is complete and every scheduled day stays within 30 new words", async () => {
  const course = JSON.parse(await readFile(new URL("../public/data/english2/textbook_course.json", import.meta.url), "utf8"));
  const files = new Set(course.documents.map((item) => item.filename));
  const headwords = course.vocabulary.map((item) => item.headword.toLowerCase());
  assert.equal(course.documentCount, 14);
  assert.equal(course.audit.expectedDocuments, 14);
  assert.equal(course.audit.includedDocuments, 14);
  assert.equal(course.audit.missingDocuments.length, 0);
  assert.equal(files.size, 14);
  assert.equal(new Set(headwords).size, headwords.length, "vocabulary headwords should be unique after normalization");
  assert.ok(course.vocabulary.every((item) => item.firstExposureDay >= 1 && item.firstExposureDay <= 84));
  const dailyCounts = Array.from({ length: 84 }, (_, index) => course.vocabulary.filter((item) => item.firstExposureDay === index + 1).length);
  assert.ok(dailyCounts.every((count) => count <= 30), `daily vocabulary counts: ${dailyCounts.join(",")}`);
  assert.equal(course.audit.maxNewWordsPerDay, Math.max(...dailyCounts));
  assert.ok(course.totalCharacters > 100_000);
  assert.equal(course.phrases.length, 0);
  console.log(`textbook documents=${course.documentCount} vocabulary=${course.vocabulary.length} maxNewWords=${course.audit.maxNewWordsPerDay}`);
});

test("the previous workbook no longer drives the active course", async () => {
  const [vocabularySource, seedSource, appSource] = await Promise.all([
    readFile(new URL("../app/study/vocabulary.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/study/seed.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/study/StudyApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(vocabularySource, /user_english2_1800/);
  assert.match(vocabularySource, /MAX_NEW_WORDS_PER_DAY = 30/);
  assert.match(seedSource, /normalizedCourse/);
  assert.match(appSource, /MaterialsLibrary|英语二资料/);
});
