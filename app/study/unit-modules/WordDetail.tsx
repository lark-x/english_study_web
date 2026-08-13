"use client";
import { useCallback, useEffect, useState } from "react";
import type { WordEntry } from "./types";

interface Props {
  word: string;
  entry: WordEntry | null;
  onClose: () => void;
}

function speak(text: string, lang = "en-US") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

export function WordDetailSidebar({ word, entry, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 250);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  if (!entry) {
    return (
      <>
        <div className={`wd-overlay ${visible ? "wd-show" : ""}`} onClick={handleClose} />
        <div className={`wd-sidebar ${visible ? "wd-show" : ""}`}>
          <div className="wd-header">
            <span className="wd-word-title">{word}</span>
            <button className="wd-close" onClick={handleClose}>✕</button>
          </div>
          <div className="wd-empty">暂无该词的详细信息。</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={`wd-overlay ${visible ? "wd-show" : ""}`} onClick={handleClose} />
      <div className={`wd-sidebar ${visible ? "wd-show" : ""}`}>
        {/* Header */}
        <div className="wd-header">
          <div>
            <span className="wd-word-title">{word}</span>
            {entry.pos && <span className="wd-pos">{entry.pos}</span>}
          </div>
          <button className="wd-close" onClick={handleClose}>✕</button>
        </div>

        {/* Pronunciation & phonetic */}
        <div className="wd-section">
          <button className="wd-speak-btn" onClick={() => speak(word)} title="点击播放发音">
            🔊 <span>播放发音</span>
          </button>
          {entry.phonetic && <div className="wd-phonetic">{entry.phonetic}</div>}
        </div>

        {/* Translation */}
        <div className="wd-section">
          <div className="wd-label">📖 释义</div>
          <div className="wd-meaning">{entry.meaning}</div>
        </div>

        {/* Example sentence */}
        {entry.example && (
          <div className="wd-section">
            <div className="wd-label">💬 例句</div>
            <div className="wd-example-en">
              <button className="wd-mini-speak" onClick={() => speak(entry.example)} title="播放例句发音">🔊</button>
              {entry.example}
            </div>
            {entry.exampleTranslation && (
              <div className="wd-example-zh">{entry.exampleTranslation}</div>
            )}
          </div>
        )}

        {/* Related phrases */}
        {entry.relatedPhrases && entry.relatedPhrases.length > 0 && (
          <div className="wd-section">
            <div className="wd-label">🔗 相关短语</div>
            <div className="wd-phrases">
              {entry.relatedPhrases.map((p, i) => (
                <div key={i} className="wd-phrase-item">
                  <span className="wd-phrase-en" onClick={() => speak(p.phrase)}>{p.phrase}</span>
                  <span className="wd-phrase-zh">{p.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grammar hint */}
        <div className="wd-section">
          <div className="wd-label">📐 用法提示</div>
          <div className="wd-grammar-hint">
            {entry.pos ? (
              <span>该词为 <strong>{entry.pos}</strong>，{posToGrammarHint(entry.pos)}</span>
            ) : (
              <span>请结合上下文理解该词的用法。</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function posToGrammarHint(pos: string): string {
  const map: Record<string, string> = {
    n: "可作主语或宾语使用。",
    v: "注意时态和语态的变化。",
    adj: "通常放在名词前面作定语，或放在系动词后作表语。",
    adv: "常用来修饰动词、形容词或其他副词。",
    prep: "后面通常接名词或代词作宾语。",
    conj: "用来连接词、短语或句子。",
    pron: "用来代替名词。",
    int: "用于表达感情或语气。",
  };
  const key = pos.toLowerCase().replace(/\./g, "").trim();
  return map[key] || "请结合上下文理解该词的用法。";
}

// ── Clickable word component ──────────────────────────────────────
interface ClickableWordProps {
  word: string;
  onWordClick: (word: string) => void;
}

export function ClickableWord({ word, onWordClick }: ClickableWordProps) {
  return (
    <span className="clickable-word" onClick={() => onWordClick(word)}>
      {word}
    </span>
  );
}

// ── Interactive text (renders text with clickable English words) ──
interface InteractiveTextProps {
  text: string;
  onWordClick: (word: string) => void;
}

export function InteractiveText({ text, onWordClick }: InteractiveTextProps) {
  // Split text into segments: English words, Chinese text, and punctuation/spaces
  const parts = text.split(/([a-zA-Z][a-zA-Z''-]*)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (/^[a-zA-Z][a-zA-Z''-]*$/.test(part)) {
          return (
            <span key={i} className="clickable-word" onClick={() => onWordClick(part)}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
