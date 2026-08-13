"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadUnits, loadWordDictionary, lookupWord } from "./data-loader";
import { InteractiveText, WordDetailSidebar } from "./WordDetail";
import type { ModuleType, UnitData, WordDictionary, WordEntry } from "./types";
import { MODULE_LABELS } from "./types";

const MODULES: ModuleType[] = ["vocabulary", "phrases", "grammar", "sentences", "practice", "writing"];

export default function UnitStudyApp() {
  const [units, setUnits] = useState<UnitData[]>([]);
  const [dict, setDict] = useState<WordDictionary>({});
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<UnitData | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleType>("vocabulary");
  const [wordTarget, setWordTarget] = useState<{ word: string; entry: WordEntry | null } | null>(null);

  // Load data
  useEffect(() => {
    Promise.all([loadUnits(), loadWordDictionary()]).then(([u, d]) => {
      setUnits(u);
      setDict(d);
      setLoading(false);
    });
  }, []);

  const handleWordClick = useCallback((word: string) => {
    const entry = lookupWord(word, dict);
    setWordTarget({ word, entry });
  }, [dict]);

  if (loading) {
    return <div className="unit-loading">加载课程数据中…</div>;
  }

  // ── Unit selection view ───────────────────────────────────────
  if (!selectedUnit) {
    return (
      <div className="unit-shell">
        <header className="unit-header">
          <h1>英语(二) 自学教程</h1>
          <p className="unit-subtitle">选择一个单元开始学习</p>
        </header>
        <div className="unit-grid">
          {units.map((u) => (
            <button key={u.id} className="unit-card" onClick={() => setSelectedUnit(u)}>
              <span className="unit-card-num">Unit {u.number}</span>
              <span className="unit-card-title">{u.title}</span>
              <span className="unit-card-stats">
                {u.vocabulary.length}词 · {u.phrases.length}短语 · {u.sentences.length}句
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Study view ───────────────────────────────────────────────
  return (
    <div className="unit-shell">
      <header className="unit-header-study">
        <button className="unit-back" onClick={() => setSelectedUnit(null)}>← 返回</button>
        <h2>{selectedUnit.fullTitle}</h2>
      </header>

      {/* Module tabs */}
      <nav className="module-tabs">
        {MODULES.map((m) => (
          <button
            key={m}
            className={`module-tab ${activeModule === m ? "active" : ""}`}
            onClick={() => setActiveModule(m)}
          >
            <span className="module-tab-icon">{MODULE_LABELS[m].icon}</span>
            <span className="module-tab-label">{MODULE_LABELS[m].zh}</span>
          </button>
        ))}
      </nav>

      {/* Module content */}
      <main className="module-content">
        {activeModule === "vocabulary" && (
          <VocabularyModule items={selectedUnit.vocabulary} onWordClick={handleWordClick} />
        )}
        {activeModule === "phrases" && (
          <PhrasesModule items={selectedUnit.phrases} onWordClick={handleWordClick} />
        )}
        {activeModule === "grammar" && (
          <GrammarModule data={selectedUnit.grammar} onWordClick={handleWordClick} />
        )}
        {activeModule === "sentences" && (
          <SentencesModule items={selectedUnit.sentences} onWordClick={handleWordClick} />
        )}
        {activeModule === "practice" && (
          <PracticeModule data={selectedUnit.practice} onWordClick={handleWordClick} />
        )}
        {activeModule === "writing" && (
          <WritingModule data={selectedUnit.writing} onWordClick={handleWordClick} />
        )}
      </main>

      {/* Word detail sidebar */}
      {wordTarget && (
        <WordDetailSidebar
          word={wordTarget.word}
          entry={wordTarget.entry}
          onClose={() => setWordTarget(null)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Module components
// ════════════════════════════════════════════════════════════════════

function speak(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function VocabularyModule({ items, onWordClick }: { items: UnitData["vocabulary"]; onWordClick: (w: string) => void }) {
  return (
    <div className="mod-vocab">
      <p className="mod-hint">点击任意英文单词查看详细释义</p>
      <div className="vocab-list">
        {items.map((item, i) => (
          <div key={i} className="vocab-card">
            <div className="vocab-top">
              <span className="vocab-word" onClick={() => onWordClick(item.word)}>{item.word}</span>
              {item.pos && <span className="vocab-pos">{item.pos}</span>}
              <button className="vocab-speak" onClick={() => speak(item.word)} title="播放发音">🔊</button>
            </div>
            {item.phonetic && <div className="vocab-phonetic">{item.phonetic}</div>}
            <div className="vocab-meaning">{item.meaning}</div>
            {item.example && (
              <div className="vocab-example">
                <InteractiveText text={item.example} onWordClick={onWordClick} />
                {item.exampleTranslation && <div className="vocab-example-zh">{item.exampleTranslation}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PhrasesModule({ items, onWordClick }: { items: UnitData["phrases"]; onWordClick: (w: string) => void }) {
  return (
    <div className="mod-phrases">
      <p className="mod-hint">点击短语中的单词查看释义</p>
      <div className="phrases-list">
        {items.map((item, i) => (
          <div key={i} className="phrase-card">
            <div className="phrase-en">
              <InteractiveText text={item.phrase} onWordClick={onWordClick} />
            </div>
            {item.englishDef && <div className="phrase-def">{item.englishDef}</div>}
            <div className="phrase-zh">{item.meaning}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GrammarModule({ data, onWordClick }: { data: UnitData["grammar"]; onWordClick: (w: string) => void }) {
  return (
    <div className="mod-grammar">
      <p className="mod-hint">语法要点与知识点笔记</p>
      {data.points.length > 0 ? (
        <div className="grammar-list">
          {data.points.map((pt, i) => (
            <div key={i} className="grammar-card">
              <div className="grammar-en">
                <InteractiveText text={pt.en} onWordClick={onWordClick} />
              </div>
              {pt.zh && <div className="grammar-zh">{pt.zh}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="grammar-raw">
          <InteractiveText text={data.raw} onWordClick={onWordClick} />
        </div>
      )}
    </div>
  );
}

function SentencesModule({ items, onWordClick }: { items: UnitData["sentences"]; onWordClick: (w: string) => void }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="mod-sentences">
      <p className="mod-hint">点击句子显示/隐藏中文翻译</p>
      <div className="sentences-list">
        {items.map((item, i) => (
          <div key={i} className="sentence-card" onClick={() => toggle(i)}>
            <div className="sentence-en">
              <button className="sentence-speak" onClick={(e) => { e.stopPropagation(); speak(item.en); }} title="播放发音">🔊</button>
              <InteractiveText text={item.en} onWordClick={onWordClick} />
            </div>
            {revealed.has(i) && item.zh && (
              <div className="sentence-zh">{item.zh}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PracticeModule({ data, onWordClick }: { data: UnitData["practice"]; onWordClick: (w: string) => void }) {
  return (
    <div className="mod-practice">
      <p className="mod-hint">口语练习与指导对话</p>
      {data.dialogue && (
        <div className="practice-section">
          <h3>🗣️ 对话练习</h3>
          <div className="practice-dialogue">
            <InteractiveText text={data.dialogue} onWordClick={onWordClick} />
          </div>
        </div>
      )}
      {data.raw && (
        <div className="practice-section">
          <h3>✏️ 指导练习</h3>
          <div className="practice-text">
            <InteractiveText text={data.raw} onWordClick={onWordClick} />
          </div>
        </div>
      )}
    </div>
  );
}

function WritingModule({ data, onWordClick }: { data: UnitData["writing"]; onWordClick: (w: string) => void }) {
  return (
    <div className="mod-writing">
      <h3>📝 写作练习：{data.title}</h3>
      <div className="writing-prompt">
        <InteractiveText text={data.prompt} onWordClick={onWordClick} />
      </div>
      {data.keywords.length > 0 && (
        <div className="writing-keywords">
          <span className="writing-kw-label">参考词汇：</span>
          {data.keywords.map((kw, i) => (
            <span key={i} className="writing-kw" onClick={() => onWordClick(kw)}>{kw}</span>
          ))}
        </div>
      )}
      <div className="writing-area">
        <textarea className="writing-textarea" placeholder="在此输入你的作文…" rows={8} />
      </div>
    </div>
  );
}
