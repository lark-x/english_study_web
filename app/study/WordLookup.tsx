"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { lookupWord, type DictionaryResult } from "./dictionary";
import { vocabularyByHeadword } from "./vocabulary";
import type { AppState } from "./types";

type OpenWord = (word: string, context?: string) => void;
const WordContext = createContext<OpenWord>(() => {});
const TOKEN_PATTERN = /([A-Za-z]+(?:[’'][A-Za-z]+)*)/g;
const WORD_PATTERN = /^[A-Za-z]+(?:[’'][A-Za-z]+)*$/;

const contextSentence = (context: string, word: string) => {
  const sentences = context.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  const normalized = word.toLowerCase().replace(/[’']/g, "'");
  return sentences.find((sentence) => sentence.toLowerCase().replace(/[’']/g, "'").includes(normalized)) ?? context;
};

export function InteractiveText({ text, context, className }: { text: string; context?: string; className?: string }) {
  const openWord = useContext(WordContext);
  const parts = useMemo(() => text.split(TOKEN_PATTERN), [text]);
  return <span className={className}>{parts.map((part, index) => WORD_PATTERN.test(part) ? <button type="button" className="lookup-word" aria-label={`查询单词 ${part}`} onClick={(event) => { event.stopPropagation(); openWord(part, contextSentence(context ?? text, part)); }} key={`${part}-${index}`}>{part}</button> : <span key={`${part}-${index}`}>{part}</span>)}</span>;
}

function speak(word: string, audio: string) {
  if (audio) {
    const player = new Audio(audio);
    player.play().catch(() => speak(word, ""));
    return;
  }
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

export function WordLookupProvider({ children, state }: { children: ReactNode; state?: AppState }) {
  const [selected, setSelected] = useState<{ word: string; context: string } | null>(null);
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const openWord: OpenWord = (word, context = "") => {
    setLoading(true); setResult(null); setError(""); setSelected({ word, context });
  };
  const metadata = selected ? vocabularyByHeadword.get(selected.word.toLowerCase()) : undefined;
  const nextReview = selected ? state?.reviewItems.filter((item) => item.kind === "word" && item.front.toLowerCase() === selected.word.toLowerCase()).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0] : undefined;

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    let active = true;
    lookupWord(selected.word, selected.context, controller.signal).then((value) => { if (active) setResult(value); }).catch((reason) => {
      if (active && !(reason instanceof DOMException && reason.name === "AbortError")) setError("词典查询暂时失败，请稍后重试。");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [selected]);

  return <WordContext.Provider value={openWord}>
    {children}
    {selected && <div className="word-drawer-backdrop" onClick={() => setSelected(null)}>
      <aside className="word-drawer" role="dialog" aria-modal="true" aria-label={`${selected.word} 词典信息`} onClick={(event) => event.stopPropagation()}>
        <header><div><span>WORD LOOKUP</span><h2>{selected.word}</h2></div><button type="button" aria-label="关闭词典" onClick={() => setSelected(null)}>×</button></header>
        {loading && <div className="dictionary-loading"><i/><p>正在查询词义和发音…</p></div>}
        {error && <div className="dictionary-error"><p>{error}</p><button className="secondary small" onClick={() => openWord(selected.word, selected.context)}>重新查询</button></div>}
        {result && <div className="dictionary-content">
          <div className="pronunciation"><div><strong>{result.word}</strong><span>{result.phonetic || "可使用浏览器朗读"}</span></div><button type="button" onClick={() => speak(result.word, result.audio)}>▶ 播放发音</button></div>
          {metadata && <section><h3>学习计划</h3><article><span>{metadata.priorityBand} 级</span><p>首次安排：第 {metadata.firstExposureDay} 天 · {metadata.verificationStatus === "verified" ? "已核验范围" : metadata.verificationStatus === "provisional" ? "暂定课程词" : "等待合法词表来源"}</p></article><article><span>阶段</span><p>{metadata.stageIds.join(" / ")} · 复习策略 {metadata.reviewSchedulePolicy}</p></article><article><span>下次复习</span><p>{nextReview?.dueAt ?? "首次学习完成后生成"}</p></article><article><span>范围</span><p>{metadata.syllabusSourceRefs.length ? metadata.syllabusSourceRefs.join("、") : "完整官方词表尚未取得，不声称正式大纲覆盖"}</p></article></section>}
          <section><h3>词义</h3>{result.meanings.map((meaning, index) => <article key={`${meaning.partOfSpeech}-${index}`}><span>{meaning.partOfSpeech || "释义"}</span><p>{meaning.definition}</p></article>)}</section>
          <section><h3>短句与上下文</h3>{result.examples.length ? result.examples.map((example, index) => <p className="dictionary-example" key={`${example}-${index}`}><b>{index + 1}</b><InteractiveText text={example} context={example}/></p>) : <p className="muted">当前词典没有提供例句。</p>}</section>
          <footer>{result.source === "course" ? "课程核心词典 · 离线可用" : result.source === "offline" ? "ECDICT 课程离线词典 · 无需联网" : result.source === "online" ? "在线补充词典 · 已在本机缓存" : result.source === "basic" ? "课程基础词典 · 离线可用" : "已显示当前课程上下文"}</footer>
        </div>}
      </aside>
    </div>}
  </WordContext.Provider>;
}
