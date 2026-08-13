import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = "/Volumes/Lark/Study/english-study/模块提取";
const OUT_DIR = "/Volumes/Lark/Study/english-study/public/data/modules";
mkdirSync(OUT_DIR, { recursive: true });

// ── 1. Parse vocabulary handbook ──────────────────────────────────
function parseVocabHandbook() {
  const raw = readFileSync(join(ROOT, "英语二_学习单词手册.md"), "utf-8");
  const words = [];
  const phrases = [];
  const [part1, part2] = raw.split("# 第二部分：短语/词组");

  if (part1) {
    for (const block of part1.split(/^### /m).slice(1)) {
      const lines = block.split("\n");
      const word = lines[0].trim();
      const get = (label) => {
        const m = block.match(new RegExp(`-\\s*\\*\\*${label}\\*\\*:\\s*(.+)`));
        return m ? m[1].trim() : "";
      };
      words.push({
        word: word.toLowerCase(), phonetic: get("音标"), pos: get("词性"),
        meaning: get("释义"), example: get("例句"), translation: get("翻译"),
      });
    }
  }
  if (part2) {
    for (const block of part2.split(/^### /m).slice(1)) {
      const phrase = block.split("\n")[0].trim();
      const get = (label) => {
        const m = block.match(new RegExp(`-\\s*\\*\\*${label}\\*\\*:\\s*(.+)`));
        return m ? m[1].trim() : "";
      };
      phrases.push({ phrase, meaning: get("释义"), example: get("例句"), translation: get("翻译") });
    }
  }
  return { words, phrases };
}

// ── 2. Parse unit phrases ─────────────────────────────────────────
function parseUnitPhrases(content) {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const phrases = [];
  
  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("**")) continue;
    // Match: "phrase english_def chinese_meaning"
    // Pattern: starts with English, has Chinese somewhere
    const cnMatch = line.match(/([\u4e00-\u9fff][\u4e00-\u9fff\uff0c\u3001\uff1b\uff08\uff09·、；，（）]+)/);
    if (cnMatch && /^[a-zA-Z]/.test(line)) {
      const cn = cnMatch[1];
      const enPart = line.substring(0, line.indexOf(cn)).trim();
      // Split enPart into phrase and English definition
      // The phrase is typically the first few words before the definition
      const words = enPart.split(/\s+/);
      // Try to find where the definition starts (after the phrase)
      // Common pattern: "phrase_word1 word2 english definition text"
      let phraseEnd = Math.min(4, words.length);
      // Look for common definition starters
      for (let i = 1; i < words.length; i++) {
        if (/^(to|a|an|the|that|in|of|on|at|for|with|and|or|not|is|are|was|were|be|been|when|where|how|what|who|which)$/i.test(words[i])) {
          phraseEnd = i;
          break;
        }
      }
      const phrase = words.slice(0, phraseEnd).join(" ");
      const enDef = words.slice(phraseEnd).join(" ");
      phrases.push({ phrase, meaning: cn, englishDef: enDef });
    } else if (/^[a-zA-Z]/.test(line) && line.length > 2 && line.length < 80) {
      // Bare phrase without Chinese (will get definition from next lines)
      phrases.push({ phrase: line, meaning: "", englishDef: "" });
    }
  }
  return phrases;
}

// ── 3. Parse numbered bilingual items ─────────────────────────────
function parseNumberedBilingual(content) {
  const items = [];
  // Split by numbered pattern
  const parts = content.split(/(?=\n?\d+\.\s)/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!/^\d+\./.test(trimmed)) continue;
    const text = trimmed.replace(/^\d+\.\s*/, "").trim();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    let en = "";
    let zh = "";
    for (const line of lines) {
      if (/[\u4e00-\u9fff]/.test(line)) {
        zh = (zh ? zh + " " : "") + line;
      } else {
        en = (en ? en + " " : "") + line;
      }
    }
    if (en || zh) items.push({ en: en.trim(), zh: zh.trim() });
  }
  return items;
}

// ── 4. Parse grammar from notes ───────────────────────────────────
function parseGrammar(content) {
  const points = [];
  const lines = content.split("\n").filter((l) => l.trim());
  let buffer = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    
    // If it's a short English phrase/word pattern, it might be a grammar point
    if (/^[a-zA-Z]/.test(trimmed) && trimmed.length < 120) {
      if (buffer.length > 0) {
        const text = buffer.join(" ").trim();
        const cnMatch = text.match(/([\u4e00-\u9fff].+)$/);
        const enText = cnMatch ? text.substring(0, text.indexOf(cnMatch[1])).trim() : text;
        const cnText = cnMatch ? cnMatch[1] : "";
        if (enText.length > 3) {
          points.push({ en: enText, zh: cnText });
        }
        buffer = [];
      }
      buffer.push(trimmed);
    } else {
      buffer.push(trimmed);
    }
  }
  if (buffer.length > 0) {
    const text = buffer.join(" ").trim();
    const cnMatch = text.match(/([\u4e00-\u9fff].+)$/);
    const enText = cnMatch ? text.substring(0, text.indexOf(cnMatch[1])).trim() : text;
    const cnText = cnMatch ? cnMatch[1] : "";
    if (enText.length > 3) {
      points.push({ en: enText, zh: cnText });
    }
  }
  return points;
}

// ── Unit data ─────────────────────────────────────────────────────
const UNIT_TITLES = {
  "Unit_01": "The Power of Language", "Unit_02": "Mistakes to Success",
  "Unit_03": "Friendship and Loyalty", "Unit_04": "The Joy of Work",
  "Unit_05": "Keeping Your Dreams Alive", "Unit_06": "The Value of Money",
  "Unit_07": "Inner Voice", "Unit_08": "The Great Minds",
  "Unit_09": "Facing Life's Challenges", "Unit_10": "Ode to Public Transport",
  "Unit_11": "Cyber World", "Unit_12": "A Break from Life",
};

const WRITING_PROMPTS = {
  "Unit_01": { title: "Language and Reading", prompt: "Write a short paragraph (80-120 words) about your reading habits. What kind of books do you like? How do you read critically?", keywords: ["read", "critical", "author", "opinion", "evaluate"] },
  "Unit_02": { title: "Learning from Mistakes", prompt: "Write a short paragraph (80-120 words) about a mistake you made and what you learned from it.", keywords: ["mistake", "learn", "experience", "improve", "overcome"] },
  "Unit_03": { title: "Friendship", prompt: "Write a short paragraph (80-120 words) about what friendship means to you. What qualities do you value in a friend?", keywords: ["friend", "loyalty", "trust", "support", "share"] },
  "Unit_04": { title: "Work and Career", prompt: "Write a short paragraph (80-120 words) about your dream job. What kind of work do you want to do and why?", keywords: ["work", "career", "goal", "passion", "achieve"] },
  "Unit_05": { title: "Dreams and Goals", prompt: "Write a short paragraph (80-120 words) about your biggest dream. What steps are you taking to achieve it?", keywords: ["dream", "goal", "plan", "effort", "success"] },
  "Unit_06": { title: "Money and Value", prompt: "Write a short paragraph (80-120 words) about how you manage your money. Do you think money can buy happiness?", keywords: ["money", "save", "spend", "value", "important"] },
  "Unit_07": { title: "Inner Voice", prompt: "Write a short paragraph (80-120 words) about listening to your inner voice. How do you make important decisions?", keywords: ["think", "decide", "inner", "voice", "choice"] },
  "Unit_08": { title: "Great Minds", prompt: "Write a short paragraph (80-120 words) about a person you admire. What makes them a great mind?", keywords: ["admire", "great", "contribution", "inspire", "achievement"] },
  "Unit_09": { title: "Facing Challenges", prompt: "Write a short paragraph (80-120 words) about a challenge you have faced. How did you deal with it?", keywords: ["challenge", "face", "overcome", "strength", "grow"] },
  "Unit_10": { title: "Public Transport", prompt: "Write a short paragraph (80-120 words) about transportation in your city. What are the advantages and disadvantages?", keywords: ["transport", "bus", "convenient", "traffic", "environment"] },
  "Unit_11": { title: "Cyber World", prompt: "Write a short paragraph (80-120 words) about how the internet has changed your life. What are the benefits and risks?", keywords: ["internet", "online", "technology", "connect", "risk"] },
  "Unit_12": { title: "A Break from Life", prompt: "Write a short paragraph (80-120 words) about how you relax and take a break from your busy life.", keywords: ["rest", "relax", "hobby", "balance", "health"] },
};

const { words: allWords, phrases: allPhrases } = parseVocabHandbook();

const units = [];
const unitDirs = readdirSync(ROOT).filter((d) => d.startsWith("Unit_")).sort();

for (const dir of unitDirs) {
  const unitNum = parseInt(dir.replace("Unit_", ""));
  const unitTitle = UNIT_TITLES[dir] || dir;
  const dirPath = join(ROOT, dir);
  const files = readdirSync(dirPath);

  const readModule = (keyword) => {
    const f = files.find((f) => f.includes(keyword));
    if (!f) return "";
    const raw = readFileSync(join(dirPath, f), "utf-8");
    const parts = raw.split("---");
    return parts.length >= 3 ? parts.slice(2).join("---").trim() : raw;
  };

  const phrasesRaw = readModule("phrases");
  const sentencesRaw = readModule("key_sentences");
  const grammarRaw = readModule("notes");
  const practiceRaw = readModule("guided_practice");
  const dialogueRaw = readModule("simple_dialogue");

  const allUnitText = [phrasesRaw, sentencesRaw, grammarRaw, practiceRaw, dialogueRaw].join(" ").toLowerCase();
  const unitWords = allWords.filter((w) => allUnitText.includes(w.word) && w.meaning).slice(0, 30);
  const unitPhrases = parseUnitPhrases(phrasesRaw);
  const sentences = parseNumberedBilingual(sentencesRaw);
  const grammarPoints = parseGrammar(grammarRaw);

  units.push({
    id: dir, number: unitNum, title: unitTitle, fullTitle: `Unit ${unitNum} ${unitTitle}`,
    vocabulary: unitWords.map((w) => ({ word: w.word, phonetic: w.phonetic, pos: w.pos, meaning: w.meaning, example: w.example, exampleTranslation: w.translation })),
    phrases: unitPhrases.length > 0 ? unitPhrases : allPhrases.slice((unitNum - 1) * 12, unitNum * 12).map((p) => ({ phrase: p.phrase, meaning: p.meaning })),
    grammar: { raw: grammarRaw, points: grammarPoints },
    sentences: sentences.length > 0 ? sentences : [{ en: "Read the text carefully.", zh: "仔细阅读课文。" }],
    practice: { raw: practiceRaw, dialogue: dialogueRaw },
    writing: WRITING_PROMPTS[dir] || { title: unitTitle, prompt: `Write about ${unitTitle}.`, keywords: [] },
  });
}

// ── Word dictionary ───────────────────────────────────────────────
const wordDictionary = {};
for (const w of allWords) {
  if (!w.meaning) continue;
  wordDictionary[w.word] = { phonetic: w.phonetic, pos: w.pos, meaning: w.meaning, example: w.example, exampleTranslation: w.translation, relatedPhrases: [] };
}
for (const p of allPhrases) {
  const key = p.phrase.toLowerCase().split(/\s+/)[0];
  if (wordDictionary[key] && wordDictionary[key].relatedPhrases.length < 5) {
    wordDictionary[key].relatedPhrases.push({ phrase: p.phrase, meaning: p.meaning });
  }
}

// ── Write ─────────────────────────────────────────────────────────
writeFileSync(join(OUT_DIR, "units.json"), JSON.stringify(units, null, 2));
writeFileSync(join(OUT_DIR, "word-dictionary.json"), JSON.stringify(wordDictionary, null, 2));
writeFileSync(join(OUT_DIR, "all-phrases.json"), JSON.stringify(allPhrases, null, 2));

console.log(`✅ ${units.length} units, ${Object.keys(wordDictionary).length} words, ${allPhrases.length} phrases`);
for (const u of units) console.log(`  ${u.id}: ${u.vocabulary.length}w ${u.phrases.length}p ${u.sentences.length}s ${u.grammar.points.length}g`);
