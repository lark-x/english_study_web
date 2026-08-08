"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { assessmentQuestions, createInitialState, INTERESTS, lessons, STAGE_GOALS, STAGE_TITLES } from "./seed";
import {
  ABILITY_LABELS,
  type Ability,
  type AppState,
  type Interest,
  type StudyMode,
} from "./types";
import {
  addDays,
  ensureTodayPlan,
  evaluatePromotion,
  getCurrentStage,
  getCurrentWeek,
  getDueReviews,
  getModeForToday,
  getPlanReason,
  getPromotionGapText,
  getRecommendation,
  getSkillScores,
  getTodayLesson,
  getTodaySteps,
  getWeakestSkill,
  getWeeklyStats,
  localDate,
  phaseDefinitions,
  recordWeeklyCheck,
  updateMasteryFromAttempt,
} from "./planner";
import { exportState, importState, loadState, remoteLogin, saveState } from "./storage";
import { InteractiveText, WordLookupProvider } from "./WordLookup";
import { getExamCoverage, loadExamData, type ExamDataBundle } from "./exam";
import { getVocabularyAudit, getVocabularyPlan, toVocabularyEntry, vocabularyMaster } from "./vocabulary";
import { getNormalizedDocument, NORMALIZED_CATEGORY_LABELS, normalizedCourse, normalizedDocuments, type NormalizedDocument } from "./normalized";

type Tab = "today" | "route" | "learn" | "review" | "materials" | "exam" | "progress" | "settings";
type SessionStep = ReturnType<typeof getTodaySteps>[number]["id"];
const MODES: StudyMode[] = [45, 90, 150];

function Logo() {
  return <div className="logo"><span className="logo-mark">D</span><span><strong>Daily English</strong><small>阶段驱动学习</small></span></div>;
}

function ProgressBar({ value, tone = "blue" }: { value: number; tone?: string }) {
  return <div className="progress-track"><span className={`progress-fill ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

function abilityScoreFromAnswers(answers: Record<string, number>) {
  const result = { vocabulary: 0, pronunciation: 0, grammar: 0, sentence: 0, reading: 0, translationWriting: 0 };
  (Object.keys(result) as Ability[]).forEach((ability) => {
    const items = assessmentQuestions.filter((item) => item.skill === ability);
    result[ability] = items.length ? Math.round((items.filter((item) => answers[item.id] === item.answer).length / items.length) * 100) : 20;
  });
  return result;
}

function placementStage(scores: Record<Ability, number>) {
  const min = Math.min(...Object.values(scores));
  if (min < 65) return "stage-1" as const;
  if (min < 72) return "stage-2" as const;
  if (min < 78) return "stage-3" as const;
  return "stage-4" as const;
}

function Onboarding({ state, onComplete }: { state: AppState; onComplete: (value: AppState) => void }) {
  const [stage, setStage] = useState<"profile" | "assessment" | "result">("profile");
  const [draft, setDraft] = useState(state.profile);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const scores = useMemo(() => abilityScoreFromAnswers(answers), [answers]);
  const suggestedStage = placementStage(scores);
  const weakest = (Object.keys(scores) as Ability[]).sort((a, b) => scores[a] - scores[b])[0];

  const toggleInterest = (interest: Interest) => {
    setDraft((current) => ({ ...current, interests: current.interests.includes(interest) ? current.interests.filter((item) => item !== interest) : [...current.interests, interest] }));
  };

  const finish = () => {
    const next = {
      ...state,
      profile: { ...draft, onboardingComplete: true, planStartDate: localDate(), startingStageId: suggestedStage },
      assessment: scores,
      mastery: { ...state.mastery, activeStageId: suggestedStage, placementStageId: suggestedStage },
    };
    onComplete(next);
  };

  if (stage === "profile") return <div className="onboarding-shell">
    <Logo />
    <div className="onboarding-grid">
      <section className="onboarding-intro">
        <span className="eyebrow">零基础默认从第 1 阶段开始</span>
        <h1>先按阶段学对内容，再按时长调深度。</h1>
        <p>系统会保留 45 / 90 / 150 分钟模式，但不再让时长决定课程类型。阶段先决定今天能出现什么任务，复习到期时会优先回收旧内容。</p>
        <div className="promise-list"><span>✓ 只记录真实完成</span><span>✓ IndexedDB 本地保存</span><span>✓ 所有英文词可点击查询</span></div>
      </section>
      <section className="form-card">
        <div className="step-label">第 1 步 / 2 · 学习安排</div>
        <label>预计考试日期<input type="date" value={draft.examDate} onChange={(event) => setDraft({ ...draft, examDate: event.target.value })} /></label>
        <div className="form-row">
          <label>工作日时长<select value={draft.weekdayMinutes} onChange={(event) => setDraft({ ...draft, weekdayMinutes: Number(event.target.value) as StudyMode })}>{MODES.map((mode) => <option key={mode} value={mode}>{mode} 分钟</option>)}</select></label>
          <label>周末时长<select value={draft.weekendMinutes} onChange={(event) => setDraft({ ...draft, weekendMinutes: Number(event.target.value) as StudyMode })}>{MODES.map((mode) => <option key={mode} value={mode}>{mode} 分钟</option>)}</select></label>
        </div>
        <label>每周计划学习 <strong>{draft.studyDays} 天</strong><input type="range" min="3" max="7" value={draft.studyDays} onChange={(event) => setDraft({ ...draft, studyDays: Number(event.target.value) })} /></label>
        <fieldset><legend>通用主题偏好</legend><div className="chip-row">{INTERESTS.map((item) => <button type="button" className={draft.interests.includes(item) ? "chip selected" : "chip"} onClick={() => toggleInterest(item)} key={item}>{item}</button>)}</div></fieldset>
        <button className="primary wide" disabled={!draft.examDate || !draft.interests.length} onClick={() => setStage("assessment")}>开始 6 题起点校准 <span>→</span></button>
      </section>
    </div>
  </div>;

  if (stage === "assessment") return <div className="assessment-shell">
    <header><Logo /><span className="step-label">第 2 步 / 2 · 起点校准</span></header>
    <main className="assessment-card">
      <span className="eyebrow">不会就凭直觉选</span>
      <h1>用关键基础决定起点</h1>
      <p className="muted">系统不会用平均分掩盖短板。词汇、发音、语法、简单句、阅读和翻译会分别记录。</p>
      <div className="assessment-list">{assessmentQuestions.map((question, index) => <section className="assessment-question" key={question.id}>
        <p><b>{index + 1}.</b> <InteractiveText text={question.prompt}/></p>
        <div className="option-grid">{question.options.map((option, optionIndex) => <button key={option} className={answers[question.id] === optionIndex ? "option chosen" : "option"} onClick={() => setAnswers({ ...answers, [question.id]: optionIndex })}><span>{String.fromCharCode(65 + optionIndex)}</span><InteractiveText text={option}/></button>)}</div>
      </section>)}</div>
      <button className="primary wide" disabled={Object.keys(answers).length < assessmentQuestions.length} onClick={() => setStage("result")}>生成路线</button>
    </main>
  </div>;

  return <div className="result-shell">
    <section className="result-card">
      <span className="success-mark">✓</span><span className="eyebrow">路线已准备好</span>
      <h1>建议从 {STAGE_TITLES[suggestedStage]} 开始。</h1>
      <p>当前最需要补的是 <strong>{ABILITY_LABELS[weakest]}</strong>。零基础用户默认从第 1 阶段开始；校准结果较高时，系统允许从更后阶段起步。</p>
      <div className="score-grid">{(Object.keys(scores) as Ability[]).map((ability) => <div key={ability}><span>{ABILITY_LABELS[ability]}</span><strong>{scores[ability]}</strong><ProgressBar value={scores[ability]} tone={ability} /></div>)}</div>
      <div className="route-preview"><span>12 周路线</span><strong>字词句 → 基础句型 → 短文阅读 → 自考题型 → 综合冲刺</strong><small>每天仍可切换 45 / 90 / 150 分钟</small></div>
      <button className="primary wide" onClick={finish}>进入今日任务 <span>→</span></button>
    </section>
  </div>;
}

function Sidebar({ tab, setTab, state }: { tab: Tab; setTab: (tab: Tab) => void; state: AppState }) {
  const week = getCurrentWeek(state);
  const currentStage = getCurrentStage(state);
  const nav: Array<[Tab, string, string]> = [["today", "◎", "今日"], ["route", "▣", "路线"], ["learn", "▶", "学习"], ["review", "↻", "复习"], ["materials", "≡", "英语二资料"], ["exam", "⌘", "考试大纲"], ["progress", "↗", "进度"], ["settings", "⚙", "设置"]];
  return <aside className="sidebar">
    <Logo />
    <nav>{nav.map(([id, icon, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><span>{icon}</span>{label}{id === "review" && getDueReviews(state).length > 0 && <b>{getDueReviews(state).length}</b>}</button>)}</nav>
    <div className="sidebar-status"><span>12 周路线</span><strong>第 {week} 周 · {STAGE_TITLES[currentStage]}</strong><ProgressBar value={(week / 12) * 100} /><small>{state.sessions.length} 次真实学习记录</small></div>
  </aside>;
}

function MaterialDocumentView({ document, compact = false }: { document: NormalizedDocument; compact?: boolean }) {
  const visibleSections = compact ? document.sections.slice(0, 4) : document.sections;
  return <div className="normalized-document">
    <div className="material-meta"><span>指定教材</span><span>{NORMALIZED_CATEGORY_LABELS[document.category]}</span><span>{document.pages} 页</span></div>
    {visibleSections.map((section, index) => <details className="material-section" key={`${document.id}-${section.id}`} open={index === 0}>
      <summary>{section.title}<small>{section.content.length.toLocaleString()} 字符</small></summary>
      <div>{section.content.split(/\n{2,}/).filter(Boolean).map((paragraph, paragraphIndex) => <p key={paragraphIndex}><InteractiveText text={paragraph} context={paragraph}/></p>)}</div>
    </details>)}
    {compact && document.sections.length > visibleSections.length && <p className="muted">本课先显示前 {visibleSections.length} 个单元；完整 {document.sections.length} 个单元可在“英语二资料”中查看。</p>}
  </div>;
}

function MaterialsLibrary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState(normalizedDocuments[0]?.id ?? "");
  const filtered = useMemo(() => normalizedDocuments.filter((document) => {
    const matchesCategory = category === "all" || document.category === category;
    const needle = query.trim().toLowerCase();
    return matchesCategory && (!needle || document.title.toLowerCase().includes(needle) || document.filename.toLowerCase().includes(needle) || document.sections.some((section) => section.content.toLowerCase().includes(needle)));
  }), [category, query]);
  const selected = getNormalizedDocument(selectedId) ?? filtered[0] ?? normalizedDocuments[0];
  return <div className="page-content">
    <section className="hero-card material-hero"><div className="hero-copy"><span className="eyebrow">TEXTBOOK · ENGLISH II</span><h1>英语（二）学习资料</h1><p>这里完整收录 《英语（二）自学教程》（2012年版）的 {normalizedCourse.documentCount} 份资料，共 {normalizedCourse.totalCharacters.toLocaleString()} 个正文字符。它们已经替换原来的通用演示课程，并进入每日路线。</p></div><div className="plan-card"><span>教材来源</span><div className="plan-step"><b>{normalizedCourse.documentCount}</b><div><strong>全部文件已登记</strong><small>缺失 {normalizedCourse.audit.missingDocuments.length} 份</small></div></div><div className="plan-step"><b>{normalizedCourse.audit.vocabularyCount}</b><div><strong>教材词汇</strong><small>每天新增最多 30 个</small></div></div><div className="plan-step"><b>{normalizedCourse.audit.phraseCount}</b><div><strong>教材原句</strong><small>独立于每日单词上限</small></div></div></div></section>
    <section className="material-layout"><aside className="panel material-index"><div className="material-filters"><input aria-label="搜索资料" placeholder="搜索标题或正文" value={query} onChange={(event) => setQuery(event.target.value)}/><select aria-label="资料类别" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">全部类别</option>{Object.entries(NORMALIZED_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><p className="muted">找到 {filtered.length} 份</p><div className="material-list">{filtered.map((document) => <button key={document.id} className={selected?.id === document.id ? "active" : ""} onClick={() => setSelectedId(document.id)}><span>{String(document.order).padStart(3, "0")}</span><div><strong>{document.title}</strong><small>{NORMALIZED_CATEGORY_LABELS[document.category]} · {document.status}</small></div></button>)}</div></aside>
      <article className="panel material-reader">{selected ? <><div className="panel-title"><div><span className="eyebrow">{selected.filename}</span><h2>{selected.title}</h2></div></div><MaterialDocumentView document={selected}/></> : <div className="empty-state"><h2>没有匹配资料</h2></div>}</article></section>
  </div>;
}

function ExamCenter({ state }: { state: AppState }) {
  const [data, setData] = useState<ExamDataBundle | null>(null);
  const [error, setError] = useState("");
  const [vocabularyQuery, setVocabularyQuery] = useState("");
  const [vocabularyPage, setVocabularyPage] = useState(0);
  useEffect(() => { loadExamData().then(setData).catch(() => setError("资料中心暂时无法读取，核心学习仍可继续。")); }, []);
  if (error) return <div className="page-content"><section className="empty-state"><h2>{error}</h2><p>请检查本地安装包是否包含 public/data/exam 数据。</p></section></div>;
  if (!data) return <div className="page-content"><section className="empty-state"><h2>正在读取考试范围...</h2></section></div>;
  const coverage = getExamCoverage(data.syllabus, state.mastery.syllabusNodeProgress);
  const vocabularyAudit = getVocabularyAudit();
  const filteredVocabulary = vocabularyMaster.filter((item) => !vocabularyQuery || item.headword.includes(vocabularyQuery.toLowerCase()) || item.chineseMeanings.some((meaning) => meaning.includes(vocabularyQuery)));
  const vocabularyPageItems = filteredVocabulary.slice(vocabularyPage * 30, vocabularyPage * 30 + 30);
  return <div className="page-content">
    <section className="hero-card"><span className="eyebrow">EXAM SCOPE CENTER · 13000</span><h1>考试大纲</h1><p>把已核验的课程事实、学习范围和待核验资料放在同一个可追溯入口。离线可浏览，来源链接联网后打开。</p><div className="metric-grid"><article><span>课程代码</span><strong>{data.course.currentCode}</strong><p>{data.course.currentName}</p></article><article><span>官方节点</span><strong>{coverage.officialCount}</strong><p>待核验 {coverage.pendingCount} 个</p></article><article><span>覆盖率</span><strong>{coverage.coverage}%</strong><p>基于真实学习证据</p></article><article><span>掌握率</span><strong>{coverage.mastery}%</strong><p>不把待核验内容计入</p></article></div></section>
    <section className="panel exam-facts"><h2>课程事实</h2><div className="fact-grid"><p><b>大纲</b>{data.course.syllabusName}</p><p><b>教材</b>{data.course.textbook.title} · {data.course.textbook.edition}</p><p><b>主编</b>{data.course.textbook.authors.join("、")}</p><p><b>出版社</b>{data.course.textbook.publisher}</p><p><b>旧代码</b>{data.course.legacyCode} {data.course.legacyName}</p><p><b>状态</b><span className="status-pill done">已由目录交叉确认</span></p></div></section>
    <section className="exam-grid"><article className="panel"><h2>大纲树</h2>{data.syllabus.map((node) => <div className={`exam-node ${node.verificationStatus === "pending" ? "pending" : ""}`} key={node.id}><div><strong>{node.title}</strong><p>{node.summary}</p></div><span>{node.verificationStatus === "pending" ? "待官方材料核验" : node.category}</span></div>)}</article><article className="panel"><h2>范围矩阵</h2>{data.scope.map((item) => <div className="scope-row" key={item.id}><div><strong>{item.title}</strong><p>{item.expectedStudyAmount}</p></div><span className={item.verificationStatus === "pending" ? "status-pill pending" : "status-pill done"}>{item.verificationStatus === "pending" ? "待核验" : item.status}</span></div>)}</article></section>
    <section className="exam-grid"><article className="panel"><h2>题型说明</h2>{data.questionTypes.map((item) => <div className="scope-row" key={item.id}><div><strong>{item.title}</strong><p>{item.notes}</p></div><span className="status-pill pending">题量/分值/时长待核验</span></div>)}</article><article className="panel"><h2>教材映射</h2>{data.textbookMap.map((item) => <div className="scope-row" key={item.unitId}><div><strong>{item.title}</strong><p>{item.learningObjectives.join("；")}</p></div><span className="status-pill pending">待资料</span></div>)}</article></section>
    <section className="panel vocabulary-scope"><div className="panel-title"><div><span className="eyebrow">VOCABULARY SCOPE</span><h2>词汇范围</h2></div><input aria-label="搜索词汇" placeholder="搜索英文或中文" value={vocabularyQuery} onChange={(event) => { setVocabularyQuery(event.target.value); setVocabularyPage(0); }}/></div><p className="muted">当前学习池 {vocabularyAudit.total} 个 headword；已核验 {vocabularyAudit.verified}，暂定 {vocabularyAudit.provisional}，待合法词表来源 {vocabularyAudit.pending}。当前全部进入 12 周排期，但不等于官方词表已完整覆盖。</p><div className="vocabulary-scope-list">{vocabularyPageItems.map((item) => <article key={item.id}><b>{item.priorityBand}</b><div><strong><InteractiveText text={item.headword}/></strong><span>{item.partOfSpeech.join("/")} · {item.chineseMeanings[0]}</span></div><small>第 {item.firstExposureDay} 天 · {item.verificationStatus}</small></article>)}</div><div className="pager"><button className="secondary small" disabled={vocabularyPage === 0} onClick={() => setVocabularyPage(Math.max(0, vocabularyPage - 1))}>上一页</button><span>{vocabularyPage + 1} / {Math.max(1, Math.ceil(filteredVocabulary.length / 30))}</span><button className="secondary small" disabled={(vocabularyPage + 1) * 30 >= filteredVocabulary.length} onClick={() => setVocabularyPage(vocabularyPage + 1)}>下一页</button></div></section>
    <section className="panel"><h2>来源登记</h2>{data.sources.map((source) => <div className="source-row" key={source.id}><div><strong>{source.title}</strong><p>{source.pageOrSection ?? "来源页面"} · {source.notes}</p></div><a href={source.url} target="_blank" rel="noreferrer">查看来源 ↗</a></div>)}</section>
  </div>;
}

function Topbar({ state }: { state: AppState }) {
  const todayDone = state.sessions.some((item) => item.date === localDate());
  return <header className="topbar"><div><strong>{todayDone ? "今天主线已完成，可以继续轻复习。" : "今天只做阶段允许的下一步。"}</strong><small>{new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date())}</small></div><span className={todayDone ? "status-pill done" : "status-pill"}>{todayDone ? "✓ 今日完成" : "● 等待开始"}</span></header>;
}

function Today({ state, updateState, start }: { state: AppState; updateState: (state: AppState) => void; start: () => void }) {
  const date = localDate();
  const lesson = getTodayLesson(state);
  const plan = state.dailyPlans[date];
  const mode = plan?.mode ?? getModeForToday(state);
  const steps = getTodaySteps(state, mode);
  const stats = getWeeklyStats(state);
  const scores = getSkillScores(state);
  const promotion = evaluatePromotion(state, lesson.stageId);
  const todayDone = state.sessions.some((item) => item.date === date);
  const vocabularyPlan = getVocabularyPlan(state, lesson.day, mode);
  const setMode = (nextMode: StudyMode) => updateState({ ...state, dailyPlans: { ...state.dailyPlans, [date]: { ...(plan ?? { date, lessonId: lesson.id, stageId: lesson.stageId, rhythm: lesson.rhythm, isRemedial: false }), mode: nextMode, reason: getPlanReason(state, lesson) } } });
  return <div className="page-content">
    <section className="hero-card">
      <div className="hero-copy"><span className="eyebrow">DAY {lesson.day.toString().padStart(2, "0")} · {lesson.level}</span><h1>{todayDone ? "今天的主线已完成" : lesson.title}</h1><p>{todayDone ? "记录已计入真实进度。继续学习会作为重复练习，不制造额外演示数据。" : lesson.summary}</p>
        <div className="stage-strip"><strong>{STAGE_TITLES[lesson.stageId]}</strong><span>{lesson.stageGoal}</span></div>
        <div className="mode-switch">{MODES.map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}<small>分钟</small></button>)}</div>
        <button className="primary large" onClick={start}>{todayDone ? "重新练习本课" : `开始 ${mode} 分钟`} <span>→</span></button>
      </div>
      <div className="plan-card"><span>今天怎么学</span>{steps.map((step, index) => <div className="plan-step" key={step.id}><b>{index + 1}</b><div><strong>{step.label}</strong><small>{step.minutes} 分钟 · {step.depth === "deep" ? "加深" : step.depth === "standard" ? "标准" : "最低闭环"}</small></div></div>)}<p>{plan?.reason ?? getRecommendation(state)}</p></div>
    </section>
    <section className="metric-grid">
      <article><span>今日重点新词</span><strong>{vocabularyPlan.focus.length}<small> 个</small></strong><p>A/B 优先；低表现时自适应减量</p></article>
      <article><span>扩展识别词</span><strong>{vocabularyPlan.extension.length}<small> 个</small></strong><p>先完成语境接触，不要求同日主动掌握</p></article>
      <article><span>到期复习词</span><strong>{vocabularyPlan.dueWords.length}<small> 个</small></strong><p>来自真实间隔复习队列</p></article>
      <article><span>晋级差距</span><strong className="text-value">{promotion.passed ? "可晋级" : `${promotion.gaps.length} 项`}</strong><p>{getPromotionGapText(state, lesson.stageId)}</p></article>
    </section>
    <section className="two-column">
      <article className="panel"><div className="panel-title"><div><span className="eyebrow">WHY THIS LESSON</span><h2>今日任务原因</h2></div></div><div className="reason-list"><div><b>01</b><p><strong>阶段先于时长</strong><span>{STAGE_TITLES[lesson.stageId]} 只允许 {lesson.lessonType} 类型任务。</span></p></div><div><b>02</b><p><strong>周节奏固定</strong><span>每周按 4 天新内容 + 综合 + 检测/补救 + 休息/轻复习推进，今天是 {lesson.rhythm}。</span></p></div><div><b>03</b><p><strong>关键短板不被平均分掩盖</strong><span>最低项是 {ABILITY_LABELS[getWeakestSkill(state)]}，晋级按分项证据判断。</span></p></div></div></article>
      <article className="panel"><div className="panel-title"><div><span className="eyebrow">THIS WEEK</span><h2>本周真实投入</h2></div><b>{stats.sessions}/{state.profile.studyDays}</b></div><ProgressBar value={(stats.sessions / state.profile.studyDays) * 100} tone="green" /><div className="week-days">{Array.from({ length: 7 }).map((_, index) => { const day = addDays(localDate(), index - 6); const done = state.sessions.some((item) => item.date === day); return <span className={done ? "done" : day === localDate() ? "today" : ""} key={day}><b>{"一二三四五六日"[(new Date(`${day}T12:00:00`).getDay() + 6) % 7]}</b><i>{done ? "✓" : "·"}</i></span>; })}</div><p className="muted">不要求连续打卡，只统计真实完成的学习记录。当前能力：{Object.entries(scores).map(([key, value]) => `${ABILITY_LABELS[key as Ability]} ${value}`).join(" / ")}</p></article>
    </section>
  </div>;
}

function Route({ state, updateState }: { state: AppState; updateState: (value: AppState) => void }) {
  const week = getCurrentWeek(state);
  const currentStage = getCurrentStage(state);
  const promotion = evaluatePromotion(state, currentStage);
  return <div className="page-content"><div className="page-heading"><span className="eyebrow">YOUR ROUTE</span><h1>阶段锁定的 12 周路线</h1><p>前 5 周是真正零基础内容；30 篇长阅读已迁入第 6 周以后，不再伪装成入门课。</p></div>
    <div className="route-layout"><section className="route-list">{phaseDefinitions.map((phase, index) => { const current = phase.id === currentStage; const finished = phase.weeks[1] < week && phase.id !== currentStage; return <article className={current ? "route-stage current" : finished ? "route-stage finished" : "route-stage"} key={phase.id}><span className="route-index">{finished ? "✓" : index + 1}</span><div><small>第 {phase.weeks[0]}-{phase.weeks[1]} 周</small><h2>{phase.title}</h2><p>{phase.goal}</p><p>晋级条件：{Object.entries(phase.required).map(([ability, score]) => `${ABILITY_LABELS[ability as Ability]} ${score}`).join(" / ")}</p>{current && <span className="current-tag">当前阶段 · {promotion.passed ? "已达标" : "补救中"}</span>}</div></article>; })}</section>
      <aside className="panel sticky-card"><span className="eyebrow">当前阶段</span><h2>{STAGE_TITLES[currentStage]}</h2><p>{STAGE_GOALS[currentStage]}</p><hr/><strong>晋级差距</strong><p>{getPromotionGapText(state, currentStage)}</p><button className="secondary wide" onClick={() => updateState(recordWeeklyCheck(state))}>记录一次周检测/补救判断</button><hr/><strong>课程迁移</strong><p>后期迁入长阅读：{lessons.filter((item) => item.id.startsWith("migrated-reading-")).length} / 30 篇。</p><ProgressBar value={(new Set(state.sessions.map((item) => item.lessonId)).size / lessons.length) * 100} /></aside>
    </div></div>;
}

function Review({ state, updateState }: { state: AppState; updateState: (value: AppState) => void }) {
  const due = getDueReviews(state);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const current = due[index];
  const grade = (remembered: boolean) => {
    if (!current) return;
    const repetitions = remembered ? current.repetitions + 1 : 0;
    const interval = remembered ? Math.min(30, current.intervalDays === 1 ? 3 : Math.round(current.intervalDays * 1.8)) : 1;
    const vocabulary = { ...state.mastery.vocabulary };
    if (current.kind === "word" && vocabulary[current.front.toLowerCase()]) {
      const word = vocabulary[current.front.toLowerCase()];
      vocabulary[current.front.toLowerCase()] = { ...word, reviewedAt: localDate(), status: remembered && repetitions >= 2 ? "mastered" : "learning", correct: word.correct + (remembered ? 1 : 0) };
    }
    updateState({ ...state, reviewItems: state.reviewItems.map((item) => item.id === current.id ? { ...item, repetitions, intervalDays: interval, dueAt: addDays(localDate(), interval) } : item), mastery: { ...state.mastery, vocabulary } });
    setFlipped(false);
    setIndex((value) => Math.max(0, Math.min(value, due.length - 2)));
  };
  return <div className="page-content"><div className="page-heading"><span className="eyebrow">SMART REVIEW</span><h1>到期复习优先</h1><p>积压时，系统会减少新内容而不是删除复习。</p></div>
    <section className="review-stats"><article><strong>{due.length}</strong><span>今天到期</span></article><article><strong>{state.reviewItems.length}</strong><span>记忆库总量</span></article><article><strong>{state.mistakes.length}</strong><span>历史错题</span></article></section>
    {current ? <section className="review-workspace"><div className="review-card" onClick={() => setFlipped(!flipped)} role="button" tabIndex={0}><small>{current.kind} · {index + 1}/{due.length}</small><h2><InteractiveText text={flipped ? current.back : current.front}/></h2>{flipped && current.example && <p><InteractiveText text={current.example}/></p>}<span>{flipped ? "根据记忆情况选择" : "点击查看答案"}</span></div>{flipped && <div className="review-actions"><button className="secondary" onClick={() => grade(false)}>还不熟 · 明天再来</button><button className="primary" onClick={() => grade(true)}>记得 · 延后复习</button></div>}</section> : <section className="empty-state"><span>✓</span><h2>今天没有到期卡片</h2><p>继续完成今日课程，新的错题和收藏表达会进入这里。</p></section>}
    <section className="panel"><div className="panel-title"><h2>最近错题</h2><span>{state.mistakes.length} 题</span></div>{state.mistakes.length ? <div className="mistake-list">{state.mistakes.slice(-5).reverse().map((item) => <div key={item.id}><p><strong><InteractiveText text={item.prompt}/></strong><span>你的答案：{item.chosen || "未作答"}</span><span className="correct-text">正确答案：{item.answer}</span></p><small>{item.explanation}</small></div>)}</div> : <p className="muted">完成练习后，答错的题会出现在这里。</p>}</section>
  </div>;
}

function Progress({ state }: { state: AppState }) {
  const scores = getSkillScores(state);
  const stats = getWeeklyStats(state);
  const last14 = Array.from({ length: 14 }).map((_, index) => { const date = addDays(localDate(), index - 13); return { date, minutes: state.sessions.filter((item) => item.date === date).reduce((sum, item) => sum + item.minutes, 0) }; });
  const maxMinutes = Math.max(75, ...last14.map((item) => item.minutes));
  const vocabularyAudit = getVocabularyAudit();
  const vocabularyStatuses = Object.values(state.mastery.vocabulary);
  return <div className="page-content"><div className="page-heading"><span className="eyebrow">REAL PROGRESS</span><h1>进度只来自你真正做过的事</h1><p>能力拆分为词汇、发音/听辨、基础语法、简单句、阅读、翻译/写作，不把简单句和段落作文混成一个分数。</p></div>
    <section className="metric-grid"><article><span>累计学习</span><strong>{state.sessions.reduce((sum, item) => sum + item.minutes, 0)}<small> 分钟</small></strong><p>{state.sessions.length} 次完成记录</p></article><article><span>本周正确率</span><strong>{stats.accuracy}<small>%</small></strong><p>{stats.accuracy ? "来自已回答题目" : "完成练习后显示"}</p></article><article><span>已掌握词汇</span><strong>{Object.values(state.mastery.vocabulary).filter((item) => item.status === "mastered").length}<small> 个</small></strong><p>与 1,286 词离线词典分开统计</p></article><article><span>补救队列</span><strong>{state.mastery.remedialQueue.filter((item) => !item.resolvedAt).length}<small> 项</small></strong><p>周检测未达标时生成</p></article></section>
    <section className="two-column progress-columns"><article className="panel"><div className="panel-title"><h2>能力分项</h2><span>不使用平均分晋级</span></div><div className="skill-list">{(Object.keys(scores) as Ability[]).map((ability) => <div key={ability}><span>{ABILITY_LABELS[ability]}</span><ProgressBar value={scores[ability]} tone={ability} /><strong>{scores[ability]}</strong></div>)}</div></article>
      <article className="panel"><div className="panel-title"><h2>14 天学习分钟</h2><span>真实记录</span></div><div className="bar-chart">{last14.map((item) => <div key={item.date}><span className={item.minutes ? "has-data" : ""} style={{ height: `${Math.max(4, (item.minutes / maxMinutes) * 100)}%` }} /><small>{item.date.slice(5)}</small></div>)}</div></article></section>
    <section className="panel vocabulary-dashboard"><div className="panel-title"><div><span className="eyebrow">VOCABULARY COVERAGE</span><h2>词汇排期与复习闭环</h2></div><span>当前词表并非已核验官方全表</span></div><div className="data-facts"><div><span><b>{vocabularyAudit.total}</b>当前 headword</span><span><b>{vocabularyAudit.verified}</b>verified</span><span><b>{vocabularyAudit.provisional}</b>provisional</span><span><b>{vocabularyAudit.pending}</b>pending-source</span><span><b>{vocabularyAudit.scheduled}</b>已排期</span><span><b>{vocabularyStatuses.filter((item) => item.firstExposedAt).length}</b>已首次接触</span><span><b>{vocabularyStatuses.filter((item) => item.reviewedAt).length}</b>已复习</span><span><b>{vocabularyStatuses.filter((item) => item.status === "mastered").length}</b>已掌握</span><span><b>{vocabularyAudit.orphan}</b>孤儿词</span></div></div><div className="week-allocation">{vocabularyAudit.byWeek.map((count, index) => <span key={index}><b>W{index + 1}</b>{count}</span>)}</div></section>
    <section className="panel"><div className="panel-title"><h2>最近学习记录</h2><span>{state.sessions.length} 条</span></div><div className="session-table">{state.sessions.slice(-8).reverse().map((session) => <div key={session.id}><span>{session.date}</span><strong>{lessons.find((item) => item.id === session.lessonId)?.title ?? session.lessonId}</strong><span>{session.minutes} 分钟</span><span>{session.correct}/{session.total}</span></div>)}</div></section>
  </div>;
}

function Settings({ state, updateState, reset }: { state: AppState; updateState: (value: AppState) => void; reset: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const updateProfile = (patch: Partial<AppState["profile"]>) => updateState({ ...state, profile: { ...state.profile, ...patch } });
  const handleImport = async (file?: File) => {
    if (!file) return;
    try { updateState(await importState(file)); setMessage("备份已导入。"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "导入失败。"); }
  };
  return <div className="page-content"><div className="page-heading"><span className="eyebrow">SETTINGS</span><h1>设置与本地数据</h1><p>数据保存在当前浏览器 IndexedDB 中，导入旧备份会安全迁移到新版结构。</p></div>
    <section className="settings-grid"><article className="panel settings-card"><h2>学习参数</h2><div className="form-row"><label>工作日<select value={state.profile.weekdayMinutes} onChange={(event) => updateProfile({ weekdayMinutes: Number(event.target.value) as StudyMode })}>{MODES.map((mode) => <option key={mode} value={mode}>{mode} 分钟</option>)}</select></label><label>周末<select value={state.profile.weekendMinutes} onChange={(event) => updateProfile({ weekendMinutes: Number(event.target.value) as StudyMode })}>{MODES.map((mode) => <option key={mode} value={mode}>{mode} 分钟</option>)}</select></label></div><label>考试日期<input type="date" value={state.profile.examDate} onChange={(event) => updateProfile({ examDate: event.target.value })}/></label><label>起点阶段<select value={state.mastery.activeStageId} onChange={(event) => updateState({ ...state, profile: { ...state.profile, startingStageId: event.target.value as AppState["mastery"]["activeStageId"] }, mastery: { ...state.mastery, activeStageId: event.target.value as AppState["mastery"]["activeStageId"], placementStageId: event.target.value as AppState["mastery"]["activeStageId"] } })}>{phaseDefinitions.map((phase) => <option key={phase.id} value={phase.id}>{phase.title}</option>)}</select></label><fieldset><legend>通用主题</legend><div className="chip-row">{INTERESTS.map((interest) => <button type="button" key={interest} className={state.profile.interests.includes(interest) ? "chip selected" : "chip"} onClick={() => updateProfile({ interests: state.profile.interests.includes(interest) ? state.profile.interests.filter((item) => item !== interest) : [...state.profile.interests, interest] })}>{interest}</button>)}</div></fieldset></article>
      <article className="panel settings-card"><h2>备份与恢复</h2><div className="privacy-note"><strong>浏览器本地记忆</strong><p>IndexedDB 为主，异常时回退到 localStorage。清理浏览器数据前请先导出 JSON。</p></div><button className="secondary wide" onClick={() => exportState(state)}>导出 JSON 备份</button><button className="secondary wide" onClick={() => inputRef.current?.click()}>从备份恢复</button><input ref={inputRef} hidden type="file" accept="application/json" onChange={(event) => handleImport(event.target.files?.[0])}/>{message && <p className="inline-message">{message}</p>}<hr/><button className="danger-link" onClick={reset}>重新开始（清空新版记录）</button></article>
    </section>
    <section className="panel data-facts"><h2>当前数据</h2><div><span><b>{state.sessions.length}</b> 学习记录</span><span><b>{state.reviewItems.length}</b> 复习卡</span><span><b>{state.mistakes.length}</b> 错题</span><span><b>v{state.schemaVersion}</b> 数据版本</span></div></section>
  </div>;
}

function StudySessionView({ state, updateState, exit }: { state: AppState; updateState: (value: AppState) => void; exit: () => void }) {
  const date = localDate();
  const lesson = getTodayLesson(state);
  const mode = state.dailyPlans[date]?.mode ?? getModeForToday(state);
  const steps = getTodaySteps(state, mode);
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex]?.id as SessionStep;
  const [showChinese, setShowChinese] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [output, setOutput] = useState("");
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sentenceDrafts, setSentenceDrafts] = useState<Record<number, string>>({});
  const [translationAnswers, setTranslationAnswers] = useState<Record<number, string>>({});
  const [showReferences, setShowReferences] = useState(false);
  const due = getDueReviews(state).slice(0, mode === 45 ? 40 : mode === 90 ? 60 : 80);
  const [reviewIndex, setReviewIndex] = useState(0);
  const card = due[reviewIndex];
  const correct = lesson.questions.filter((question) => answers[question.id] === question.answer).length;
  const targetWords = lesson.stageId === "stage-1" ? (mode === 45 ? 25 : mode === 90 ? 40 : 55) : mode === 45 ? 12 : mode === 90 ? 35 : 70;
  const englishOutputWords = output.match(/[A-Za-z]+(?:'[A-Za-z]+)*/g)?.length ?? 0;
  const chineseOutputUnits = Math.ceil((output.match(/[\u3400-\u9fff]/g)?.length ?? 0) / 2);
  const outputWords = Math.max(englishOutputWords, chineseOutputUnits);
  const vocabularyPlan = getVocabularyPlan(state, lesson.day, mode);
  const visibleVocabulary = [...vocabularyPlan.focus, ...vocabularyPlan.extension].map((item) => toVocabularyEntry(item, lesson.stageId));
  const sourceDocument = getNormalizedDocument(lesson.sourceDocumentId);
  const speakText = (text: string) => { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "en-US"; utterance.rate = 0.88; window.speechSynthesis.speak(utterance); };
  const speak = () => speakText(lesson.paragraphs.map((item) => item.en).join(" "));
  const answerQuestion = (questionIndex: number, chosen: number) => {
    const question = lesson.questions[questionIndex];
    if (answers[question.id] !== undefined) return;
    const attempt = { questionId: question.id, lessonId: lesson.id, skill: question.skill, correct: chosen === question.answer, answeredAt: new Date().toISOString() };
    let next = updateMasteryFromAttempt({ ...state, attempts: [...state.attempts, attempt] }, attempt, date);
    if (chosen !== question.answer) {
      const id = `${question.id}-${state.mistakes.length + 1}`;
      next = { ...next, mistakes: [...next.mistakes, { id, questionId: question.id, lessonId: lesson.id, prompt: question.prompt, chosen: question.options[chosen], answer: question.options[question.answer], explanation: question.explanation, createdAt: date }], reviewItems: [...next.reviewItems.filter((item) => item.id !== `review-${question.id}`), { id: `review-${question.id}`, kind: "mistake" as const, front: question.prompt, back: question.options[question.answer], example: question.explanation, sourceLessonId: lesson.id, dueAt: addDays(date, 1), intervalDays: 1, repetitions: 0 }] };
    }
    setAnswers({ ...answers, [question.id]: chosen });
    updateState(next);
  };
  const saveExpression = (phrase: string) => {
    if (state.savedExpressions.includes(phrase)) return;
    const word = visibleVocabulary.find((item) => item.word.toLowerCase() === phrase.toLowerCase()) ?? lesson.vocabulary.find((item) => item.word.toLowerCase() === phrase.toLowerCase());
    const expression = lesson.expressions.find((item) => item.phrase === phrase);
    if (!word && !expression) return;
    updateState({ ...state, savedExpressions: [...state.savedExpressions, phrase], reviewItems: [...state.reviewItems, { id: `expression-${lesson.id}-${phrase}`, kind: word ? "word" : "expression", front: phrase, back: word ? `${word.partOfSpeech} ${word.meaning}` : expression!.meaning, example: word?.example ?? expression!.example, sourceLessonId: lesson.id, dueAt: addDays(date, 1), intervalDays: 1, repetitions: 0 }] });
  };
  const complete = () => {
    if (saved) return;
    const session = { id: `${date}-${lesson.id}-${state.sessions.length + 1}`, date, lessonId: lesson.id, mode, minutes: mode, correct, total: lesson.questions.length, output, completedAt: new Date().toISOString() };
    const scheduledWords = [...vocabularyPlan.focus, ...vocabularyPlan.extension];
    const nextVocabulary = { ...state.mastery.vocabulary };
    const existingReviewIds = new Set(state.reviewItems.map((item) => item.id));
    const newReviews = scheduledWords.filter((item) => !existingReviewIds.has(`scheduled-word-${item.id}`)).map((item) => ({ id: `scheduled-word-${item.id}`, kind: "word" as const, front: item.headword, back: `${item.partOfSpeech.join("/")} ${item.chineseMeanings.join("；")}`, example: item.exampleSentences[0], sourceLessonId: lesson.id, dueAt: addDays(date, item.priorityBand === "C" ? 3 : 1), intervalDays: item.priorityBand === "C" ? 3 : 1, repetitions: 0 }));
    for (const item of scheduledWords) nextVocabulary[item.headword] = { ...(nextVocabulary[item.headword] ?? { word: item.headword, stageId: lesson.stageId, status: "new" as const, seen: 0, correct: 0 }), status: "learning", seen: (nextVocabulary[item.headword]?.seen ?? 0) + 1, firstExposureDay: item.firstExposureDay, firstExposedAt: nextVocabulary[item.headword]?.firstExposedAt ?? date, lastSeenAt: date };
    updateState({ ...state, sessions: [...state.sessions, session], reviewItems: [...state.reviewItems, ...newReviews], mastery: { ...state.mastery, vocabulary: nextVocabulary } });
    setSaved(true);
  };
  const next = () => {
    if (stepIndex === steps.length - 1) { if (!saved) complete(); exit(); return; }
    if (steps[stepIndex + 1]?.id === "summary") complete();
    setStepIndex(stepIndex + 1);
  };
  const canContinue = step === "practice" ? Object.keys(answers).length === lesson.questions.length : step === "translation" ? lesson.translations.every((_, index) => translationAnswers[index]?.trim()) : step === "output" ? outputWords >= targetWords : true;

  return <WordLookupProvider state={state}><div className="session-shell"><header className="session-header"><button className="icon-button" onClick={exit} aria-label="退出学习">×</button><div><span>{lesson.level} · {mode} 分钟</span><strong><InteractiveText text={lesson.title}/></strong></div><span>{stepIndex + 1} / {steps.length}</span></header><div className="session-progress">{steps.map((item, index) => <span key={item.id} className={index < stepIndex ? "done" : index === stepIndex ? "active" : ""}><i/>{item.label}</span>)}</div>
    <main className="session-main">
      {step === "review" && <section className="step-card"><span className="eyebrow">STEP · REVIEW</span><h1>{card ? "先回收一条旧记忆" : "今天没有复习积压"}</h1>{card ? <><div className="mini-review"><small>{reviewIndex + 1} / {due.length}</small><h2><InteractiveText text={reviewRevealed ? card.back : card.front}/></h2>{reviewRevealed && card.example && <p><InteractiveText text={card.example}/></p>}<button className="secondary small" onClick={() => setReviewRevealed(!reviewRevealed)}>{reviewRevealed ? "隐藏答案" : "查看答案"}</button></div>{reviewRevealed && reviewIndex < due.length - 1 && <button className="secondary" onClick={() => { setReviewIndex(reviewIndex + 1); setReviewRevealed(false); }}>下一张</button>}</> : <div className="empty-inline"><span>✓</span><p>直接进入今天的阶段任务。</p></div>}</section>}
      {step === "vocabulary" && <section className="step-card"><span className="eyebrow">VOCABULARY · {visibleVocabulary.length} WORDS</span><h1>{lesson.stageId === "stage-1" ? "先认词，再学课文" : "学习今天会用到的分级词汇"}</h1><p className="muted">今天的新词由《英语（二）自学教程》（2012 年版）统一排期；重点词和扩展词合计不超过 30 个。单击任意英文词可查看释义、发音和例句。</p><div className="vocabulary-list">{visibleVocabulary.map((word, index) => <article key={word.word}><span>{String(index + 1).padStart(2, "0")}</span><div><h3><InteractiveText text={word.word} context={word.example}/> <small>{word.phonetic}</small></h3><strong>{word.partOfSpeech} {word.meaning}</strong><p><InteractiveText text={word.example} context={word.example}/></p></div><button onClick={() => saveExpression(word.word)} disabled={state.savedExpressions.includes(word.word)}>{state.savedExpressions.includes(word.word) ? "✓ 已加入" : "+ 加入复习"}</button></article>)}</div></section>}
      {step === "pronunciation" && <section className="step-card"><span className="eyebrow">PRONUNCIATION</span><h1>听音、跟读、再辨认</h1><p className="muted">浏览器发音会朗读当天词和例句，适合零基础先建立声音印象。</p><div className="practice-list">{visibleVocabulary.slice(0, 6).map((word) => <article key={word.word}><span>{word.phonetic}</span><h3><InteractiveText text={word.word}/></h3><p><InteractiveText text={word.example}/></p><button className="secondary small" onClick={() => speakText(`${word.word}. ${word.example}`)}>播放发音</button></article>)}</div></section>}
      {step === "grammar" && <section className="step-card"><span className="eyebrow">GRAMMAR</span><h1>{lesson.grammar.title}</h1><div className="grammar-structure"><span>核心结构</span><strong><InteractiveText text={lesson.grammar.structure}/></strong></div><p className="grammar-explanation"><InteractiveText text={lesson.grammar.explanation}/></p><div className="grammar-examples">{lesson.grammar.examples.map((example, index) => <article key={example.en}><b>{index + 1}</b><div><p><InteractiveText text={example.en} context={example.en}/></p><span>{example.zh}</span></div></article>)}</div><div className="pitfall"><strong>容易出错</strong><p><InteractiveText text={lesson.grammar.pitfall}/></p></div></section>}
      {step === "sentences" && <section className="step-card"><span className="eyebrow">SENTENCE PATTERNS</span><h1>{lesson.stageId === "stage-1" ? "只写简单句，不写作文" : "把句型变成自己的短句"}</h1><div className="sentence-patterns">{lesson.sentencePatterns.map((pattern, index) => <article key={`${pattern.pattern}-${index}`}><span>句型 {index + 1}</span><h3><InteractiveText text={pattern.pattern}/></h3><p>{pattern.meaning}</p><small>例：<InteractiveText text={pattern.example} context={pattern.example}/></small><input value={sentenceDrafts[index] ?? ""} onChange={(event) => setSentenceDrafts({ ...sentenceDrafts, [index]: event.target.value })} placeholder="写一个自己的句子" /></article>)}</div></section>}
      {(step === "micro-read" || step === "read") && <section className="step-card reading-step"><span className="eyebrow">TEXTBOOK MATERIAL · {lesson.sourceCategory}</span><h1><InteractiveText text={lesson.sourceTitle}/></h1><div className="reading-tools"><button className="secondary small" onClick={speak}>播放教材英文句</button><button className="secondary small" onClick={() => setShowChinese(!showChinese)}>{showChinese ? "隐藏学习提示" : "显示学习提示"}</button><span>正文中的英文单词均可点击查词。</span></div>{sourceDocument ? <MaterialDocumentView document={sourceDocument} compact/> : <div className="article-body">{lesson.paragraphs.map((paragraph, index) => <div key={paragraph.en}><p><span className="paragraph-index">{index + 1}</span><InteractiveText text={paragraph.en} context={paragraph.en}/></p>{showChinese && <p className="translation">{paragraph.zh}</p>}</div>)}</div>}{showChinese && <p className="material-warning">先完成当前节选，再在“英语二资料”中查看对应教材单元。</p>}</section>}
      {step === "dictation" && <section className="step-card"><span className="eyebrow">DICTATION</span><h1>听写旧词旧句</h1><p className="muted">150 分钟模式主要加深复习、听写、改错和输出，不按比例增加新词。</p><div className="practice-list">{lesson.practiceTasks.filter((item) => item.kind === "listening" || item.kind === "blank").map((task) => <article key={task.id}><span>{ABILITY_LABELS[task.ability]}</span><h3><InteractiveText text={task.prompt}/></h3><input placeholder="听/读后写下答案" /></article>)}</div></section>}
      {step === "practice" && <section className="step-card"><span className="eyebrow">PRACTICE</span><h1>即时练习和分项记录</h1><div className="practice-list">{lesson.questions.map((question, questionIndex) => { const selected = answers[question.id]; const answered = selected !== undefined; return <article key={question.id}><span>{ABILITY_LABELS[question.skill]}</span><h3>{questionIndex + 1}. <InteractiveText text={question.prompt} context={question.prompt}/></h3><div>{question.options.map((option, optionIndex) => <div key={option} className={`practice-option ${answered && optionIndex === question.answer ? "correct" : answered && optionIndex === selected ? "wrong" : ""}`}><button type="button" aria-label={`选择 ${String.fromCharCode(65 + optionIndex)}`} disabled={answered} onClick={() => answerQuestion(questionIndex, optionIndex)}><b>{String.fromCharCode(65 + optionIndex)}</b></button><InteractiveText text={option} context={option}/></div>)}</div>{answered && <p className={selected === question.answer ? "feedback good" : "feedback bad"}><strong>{selected === question.answer ? "答对了" : "先记住原因"}</strong><InteractiveText text={question.explanation}/></p>}</article>; })}</div></section>}
      {step === "practice" && lesson.stageId === "stage-1" && <section className="step-card layered-practice"><span className="eyebrow">LAYERED PRACTICE · {lesson.practiceTasks.length} TASKS</span><h1>辨认、填空、排序、转换和仿写</h1><div className="practice-list">{lesson.practiceTasks.map((task, index) => <article key={task.id}><span>{index + 1}. {task.kind}</span><h3><InteractiveText text={task.prompt}/></h3>{task.options ? <div>{task.options.map((option) => <label key={option}><input type="radio" name={task.id}/><InteractiveText text={option}/></label>)}</div> : <input aria-label={`练习 ${index + 1}`} placeholder={task.kind === "ordering" ? "写出正确语序" : "写下答案"}/>}</article>)}</div></section>}
      {step === "correction" && <section className="step-card"><span className="eyebrow">CORRECTION</span><h1>错题归因，不急着加新课</h1><div className="mistake-list">{state.mistakes.slice(-4).reverse().map((item) => <div key={item.id}><p><strong><InteractiveText text={item.prompt}/></strong><span>你的答案：{item.chosen}</span><span className="correct-text">正确答案：{item.answer}</span></p><small>{item.explanation}</small></div>)}</div>{!state.mistakes.length && <p className="muted">当前没有错题，可以把今天的例句再仿写一遍。</p>}</section>}
      {step === "translation" && <section className="step-card"><span className="eyebrow">TRANSLATION</span><h1>材料句翻译与结构核对</h1><div className="translation-tasks">{lesson.translations.map((task, index) => <article key={task.zh}><span>第 {index + 1} 句</span><h3><InteractiveText text={task.zh} context={task.zh}/></h3><textarea value={translationAnswers[index] ?? ""} onChange={(event) => setTranslationAnswers({ ...translationAnswers, [index]: event.target.value })} placeholder="写下你的中文译文"/><small>提示：{task.tip}</small>{showReferences && <p><b>核对方法：</b><InteractiveText text={task.reference} context={task.reference}/></p>}</article>)}</div><button className="secondary" disabled={!lesson.translations.every((_, index) => translationAnswers[index]?.trim())} onClick={() => setShowReferences(!showReferences)}>{showReferences ? "隐藏核对方法" : "完成后查看核对方法"}</button></section>}
      {step === "output" && <section className="step-card output-step"><span className="eyebrow">OUTPUT · MATERIAL NOTES</span><h1>留下可复习的材料笔记</h1><div className="output-prompt"><strong><InteractiveText text={lesson.outputPrompt}/></strong><span>提示：<InteractiveText text={lesson.outputHint}/></span></div><textarea value={output} onChange={(event) => setOutput(event.target.value)} placeholder={`目标不少于 ${targetWords} 个英文词，或相当长度的中文笔记`}/><div className="self-check"><span className={outputWords >= targetWords ? "checked" : ""}>✓ 达到最低输出量</span><span className={lesson.vocabulary.some((item) => output.toLowerCase().includes(item.word.toLowerCase())) ? "checked" : ""}>✓ 使用核心词</span><span className={output.trim().length >= 20 ? "checked" : ""}>✓ 内容完整</span></div><p className="muted">当前折算 {outputWords} 个输出单位。</p></section>}
      {step === "summary" && <section className="step-card summary-step"><span className="success-mark">✓</span><span className="eyebrow">SESSION COMPLETE</span><h1>今天完成的是阶段闭环，不只是打开一篇文章。</h1><div className="summary-grid"><div><strong>{mode}</strong><span>计划分钟</span></div><div><strong>{correct}/{lesson.questions.length}</strong><span>练习正确</span></div><div><strong>{outputWords}</strong><span>输出词数</span></div><div><strong>{visibleVocabulary.length}</strong><span>今日新词上限</span></div></div><div className="tomorrow-note"><span>明天会怎么调</span><p>{getRecommendation(state)}</p></div></section>}
    </main><footer className="session-footer"><button className="text-button" onClick={exit}>退出，暂不计为完成</button><button className="primary" disabled={!canContinue} onClick={next}>{stepIndex === steps.length - 1 ? "完成并返回首页" : "完成这一步"} <span>→</span></button></footer>
  </div></WordLookupProvider>;
}

// Login screen is wired into the static deployment entry in the next sync step.
export function RemoteLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try { await remoteLogin(password); onLogin(); } catch (reason) { setError(reason instanceof Error ? reason.message : "登录失败"); }
  };
  return <main className="onboarding-shell"><div className="form-card" style={{ maxWidth: 440, margin: "12vh auto" }}><Logo/><h1>登录学习空间</h1><p className="muted">登录后可在不同设备间同步学习记录。</p><form onSubmit={submit}><label>访问密码<input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="feedback bad">{error}</p>}<button className="primary wide" type="submit">登录</button></form></div></main>;
}

export default function StudyApp() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [studying, setStudying] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { loadState().then((value) => { const planned = ensureTodayPlan(value); setState(planned); saveState(planned); }).catch(() => setError("本地学习数据暂时无法读取。你可以安全地重新载入页面。")); }, []);
  const updateState = (next: AppState) => { setState(next); saveState(next).catch(() => setError("记录暂时未能保存，请先导出备份。")); };
  const finishOnboarding = (next: AppState) => { const planned = ensureTodayPlan(next); updateState(planned); };
  const reset = () => { if (!window.confirm("确定清空新版学习记录并重新测评吗？建议先导出备份。")) return; updateState(createInitialState()); };
  if (error && !state) return <div className="fatal-state"><Logo/><h1>页面没有丢，只是数据没读出来。</h1><p>{error}</p><button className="primary" onClick={() => window.location.reload()}>重新载入</button></div>;
  if (!state) return <div className="loading-state"><Logo/><span/><p>正在恢复你的学习记录...</p></div>;
  if (!state.profile.onboardingComplete) return <WordLookupProvider state={state}><Onboarding state={state} onComplete={finishOnboarding}/></WordLookupProvider>;
  if (studying) return <StudySessionView state={state} updateState={updateState} exit={() => { setStudying(false); setTab("today"); }}/>;
  return <WordLookupProvider state={state}><div className="app-shell"><Sidebar tab={tab} setTab={setTab} state={state}/><div className="main-shell"><Topbar state={state}/>{error && <div className="save-warning">{error}</div>}{tab === "today" && <Today state={state} updateState={updateState} start={() => setStudying(true)}/>} {tab === "route" && <Route state={state} updateState={updateState}/>} {tab === "learn" && <Today state={state} updateState={updateState} start={() => setStudying(true)}/>} {tab === "review" && <Review state={state} updateState={updateState}/>} {tab === "materials" && <MaterialsLibrary/>} {tab === "exam" && <ExamCenter state={state}/>} {tab === "progress" && <Progress state={state}/>} {tab === "settings" && <Settings state={state} updateState={updateState} reset={reset}/>}</div><nav className="mobile-nav">{(["today", "route", "learn", "review", "materials", "exam", "progress"] as Tab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "today" ? "今日" : item === "route" ? "路线" : item === "learn" ? "学习" : item === "review" ? "复习" : item === "materials" ? "资料" : item === "exam" ? "大纲" : "进度"}</button>)}</nav></div></WordLookupProvider>;
}
