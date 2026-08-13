import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = "/Volumes/Lark/Study/english-study/模块提取";
const OUT_DIR = "/Volumes/Lark/Study/english-study/public/data/modules";
mkdirSync(OUT_DIR, { recursive: true });

// ══════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════
function cleanCRLF(s) { return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n"); }
function hasCN(s) { return /[\u4e00-\u9fff]/.test(s); }

// Strip markdown metadata header (everything up to and including the first --- line)
function stripHeader(raw) {
  const s = cleanCRLF(raw);
  const idx = s.indexOf("\n---\n");
  if (idx !== -1) return s.substring(idx + 5).trim();
  // fallback: try just ---
  const idx2 = s.indexOf("---");
  if (idx2 !== -1) return s.substring(idx2 + 3).trim();
  return s.trim();
}

function getField(block, label) {
  const re = new RegExp(`-\\s*\\*\\*${label}\\*\\*:\\s*(.+)`);
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

// ══════════════════════════════════════════════════════════════════
// 1. Parse vocabulary handbook (structured source)
// ══════════════════════════════════════════════════════════════════
function parseVocabHandbook() {
  const raw = cleanCRLF(readFileSync(join(ROOT, "英语二_学习单词手册.md"), "utf-8"));
  const words = [];
  const phrases = [];
  const [part1, part2] = raw.split("# 第二部分：短语/词组");

  if (part1) {
    for (const block of part1.split(/^### /m).slice(1)) {
      const word = block.split("\n")[0].trim();
      const meaning = getField(block, "释义");
      if (word && meaning) {
        words.push({
          word: word.toLowerCase(),
          phonetic: getField(block, "音标"),
          pos: getField(block, "词性"),
          meaning,
          example: getField(block, "例句"),
          translation: getField(block, "翻译"),
        });
      }
    }
  }

  if (part2) {
    for (const block of part2.split(/^### /m).slice(1)) {
      const phrase = block.split("\n")[0].trim();
      const meaning = getField(block, "释义");
      if (phrase && meaning && !phrase.startsWith("#")) {
        phrases.push({ phrase, meaning, example: getField(block, "例句"), translation: getField(block, "翻译") });
      }
    }
  }
  return { words, phrases };
}

// ══════════════════════════════════════════════════════════════════
// 2. Parse unit phrases
// ══════════════════════════════════════════════════════════════════
function parseUnitPhrases(raw) {
  const content = stripHeader(raw);
  if (!content) return [];
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const results = [];
  let buf = "";

  function flush() {
    if (!buf) return;
    const s = buf.trim();
    buf = "";
    if (s.length < 3) return;
    // Split: English part + Chinese part
    const cnMatch = s.match(/([\u4e00-\u9fff][\u4e00-\u9fff\uff0c\u3001\uff1b\uff08\uff09·、；，（）\s]*[^\s]*)\s*$/);
    if (cnMatch) {
      const cn = cnMatch[1].trim();
      const en = s.substring(0, s.lastIndexOf(cn)).trim();
      if (en.length > 1) results.push({ phrase: en, meaning: cn });
    } else if (s.length < 120) {
      results.push({ phrase: s, meaning: "" });
    }
  }

  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("**")) continue;
    if (hasCN(line)) {
      buf += (buf ? " " : "") + line;
      flush();
    } else {
      flush();
      buf = line;
    }
  }
  flush();
  return results;
}

// ══════════════════════════════════════════════════════════════════
// 3. Parse sentences
// ══════════════════════════════════════════════════════════════════
function parseSentences(raw) {
  const content = stripHeader(raw);
  if (!content) return [];
  const items = [];
  const parts = content.split(/\n(?=\d+\.\s)/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!/^\d+\./.test(trimmed)) continue;
    const text = trimmed.replace(/^\d+\.\s*/, "").trim();
    const textLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const enLines = [];
    const zhLines = [];
    for (const tl of textLines) {
      (hasCN(tl) ? zhLines : enLines).push(tl);
    }
    const en = enLines.join(" ").trim();
    const zh = zhLines.join(" ").trim();
    if (en.length > 10) items.push({ en, zh });
  }
  return items;
}

// ══════════════════════════════════════════════════════════════════
// 4. Parse grammar from notes
// ══════════════════════════════════════════════════════════════════
function parseGrammar(raw) {
  const content = stripHeader(raw);
  if (!content) return [];
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const points = [];
  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("**")) continue;
    if (/^[a-zA-Z]/.test(line) && hasCN(line) && line.length < 200) {
      const cnMatch = line.match(/([\u4e00-\u9fff].+)$/);
      if (cnMatch) {
        const en = line.substring(0, line.indexOf(cnMatch[1])).trim();
        const zh = cnMatch[1].trim();
        if (en.length > 3 && en.length < 120) points.push({ en, zh });
      }
    }
  }
  return points;
}

// ══════════════════════════════════════════════════════════════════
// 5. Extract ALL English words from unit content for word enrichment
// ══════════════════════════════════════════════════════════════════
function extractEnglishWords(text) {
  const words = new Set();
  const matches = text.toLowerCase().match(/[a-z][a-z''-]*/g) || [];
  for (const w of matches) {
    const clean = w.replace(/[''-]+$/, "").replace(/^[''-]+/, "");
    if (clean.length >= 3) words.add(clean);
  }
  return words;
}

// ══════════════════════════════════════════════════════════════════
// Unit metadata
// ══════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════════
const { words: allWords, phrases: allPhrases } = parseVocabHandbook();

// Collect ALL English words from every unit for word enrichment
const allContentWords = new Set();
const unitDirs = readdirSync(ROOT).filter((d) => d.startsWith("Unit_")).sort();

for (const dir of unitDirs) {
  const dirPath = join(ROOT, dir);
  const files = readdirSync(dirPath);
  for (const f of files) {
    const raw = cleanCRLF(readFileSync(join(dirPath, f), "utf-8"));
    for (const w of extractEnglishWords(raw)) allContentWords.add(w);
  }
}

// Build enriched word dictionary: handbook entries + basic entries for content words
const wordDictionary = {};
for (const w of allWords) {
  if (!w.meaning) continue;
  wordDictionary[w.word] = {
    phonetic: w.phonetic, pos: w.pos, meaning: w.meaning,
    example: w.example, exampleTranslation: w.translation,
    relatedPhrases: [],
  };
}

// Add basic entries for words found in content but not in handbook
for (const w of allContentWords) {
  if (!wordDictionary[w] && w.length >= 3) {
    wordDictionary[w] = {
      phonetic: "", pos: "", meaning: "",
      example: "", exampleTranslation: "",
      relatedPhrases: [], _needsTranslation: true,
    };
  }
}

// Associate phrases with words
for (const p of allPhrases) {
  const phraseWords = p.phrase.toLowerCase().split(/[\s\/.]+/).filter((w) => w.length > 2);
  for (const pw of phraseWords) {
    if (wordDictionary[pw] && wordDictionary[pw].relatedPhrases.length < 5) {
      wordDictionary[pw].relatedPhrases.push({ phrase: p.phrase, meaning: p.meaning });
    }
  }
}

// Build units
const units = [];
for (const dir of unitDirs) {
  const unitNum = parseInt(dir.replace("Unit_", ""));
  const unitTitle = UNIT_TITLES[dir] || dir;
  const dirPath = join(ROOT, dir);
  const files = readdirSync(dirPath);

  const readRaw = (keyword) => {
    const f = files.find((f) => f.includes(keyword));
    return f ? readFileSync(join(dirPath, f), "utf-8") : "";
  };

  const phrasesRaw = readRaw("phrases");
  const sentencesRaw = readRaw("key_sentences");
  const grammarRaw = readRaw("notes");
  const practiceRaw = readRaw("guided_practice");
  const dialogueRaw = readRaw("simple_dialogue");

  const unitPhrases = parseUnitPhrases(phrasesRaw);
  const sentences = parseSentences(sentencesRaw);
  const grammarPoints = parseGrammar(grammarRaw);

  // Match vocabulary: handbook words that appear in this unit
  const allUnitText = [phrasesRaw, sentencesRaw, grammarRaw, practiceRaw, dialogueRaw]
    .join(" ").toLowerCase();
  const unitWords = allWords
    .filter((w) => allUnitText.includes(w.word) && w.meaning)
    .slice(0, 35);

  const finalPhrases = unitPhrases.length > 0
    ? unitPhrases
    : allPhrases.slice((unitNum - 1) * 12, unitNum * 12).map((p) => ({ phrase: p.phrase, meaning: p.meaning }));

  units.push({
    id: dir, number: unitNum, title: unitTitle, fullTitle: `Unit ${unitNum} ${unitTitle}`,
    vocabulary: unitWords.map((w) => ({
      word: w.word, phonetic: w.phonetic, pos: w.pos,
      meaning: w.meaning, example: w.example, exampleTranslation: w.translation,
    })),
    phrases: finalPhrases,
    grammar: { points: grammarPoints, raw: stripHeader(grammarRaw) },
    sentences: sentences.length > 0 ? sentences : [{ en: "Read the text carefully.", zh: "仔细阅读课文。" }],
    practice: { raw: stripHeader(practiceRaw), dialogue: stripHeader(dialogueRaw) },
    writing: WRITING_PROMPTS[dir] || { title: unitTitle, prompt: `Write about ${unitTitle}.`, keywords: [] },
  });
}

// Write
writeFileSync(join(OUT_DIR, "units.json"), JSON.stringify(units, null, 2));
writeFileSync(join(OUT_DIR, "word-dictionary.json"), JSON.stringify(wordDictionary, null, 2));
writeFileSync(join(OUT_DIR, "all-phrases.json"), JSON.stringify(allPhrases, null, 2));

const withMeaning = Object.values(wordDictionary).filter((w) => w.meaning).length;
const total = Object.keys(wordDictionary).length;
console.log(`✅ ${units.length} units, ${total} words (${withMeaning} with meaning, ${total - withMeaning} placeholder), ${allPhrases.length} phrases`);
for (const u of units) console.log(`  ${u.id}: ${u.vocabulary.length}w ${u.phrases.length}p ${u.sentences.length}s ${u.grammar.points.length}g`);
