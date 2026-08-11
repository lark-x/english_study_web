import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ocrFile = path.join(projectRoot, "app", "study", "textbook-units", "ocr", "ocr_full_pages.json");
const outputRoot = path.join(projectRoot, "public", "data", "english2");
const courseOutputFile = path.join(outputRoot, "textbook_course.json");
const lookupOutputFile = path.join(outputRoot, "textbook_lookup.json");

const PLAN_START = "2026-08-11";
const EXAM_DATE = "2026-10-23";
const NEW_WORD_LIMIT = 35;
const CORE_WORD_TARGET = 2380;
const sourceTitle = "英语（二）自学教程（2012年版，00015，张敬源、张虹主编）";
const coreStopwords = new Set([
  "a", "an", "the", "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their", "this", "that", "these", "those", "who", "which", "what",
  "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "can", "could", "may", "might", "must", "should", "would", "will", "shall", "and", "or", "but", "if",
  "because", "although", "while", "so", "however", "in", "on", "at", "to", "from", "for", "with", "by",
  "of", "about", "as", "before", "after", "between", "without", "not", "no", "yes", "one", "two", "three",
  "first", "second", "another", "every", "each", "some", "any", "all", "many", "much", "more", "most",
  "less", "very", "also", "only", "still", "often", "usually", "always", "never",
]);

const unitSpecs = [
  { number: 1, title: "The Power of Language", start: 115, end: 132, textA: "Critical Reading", textB: "The Language of Confidence" },
  { number: 2, title: "Mistakes to Success", start: 133, end: 151, textA: "Spilt Milk", textB: "The Cake" },
  { number: 3, title: "Friendship and Loyalty", start: 153, end: 171, textA: "Reflections: Friendship and Loyalty", textB: "A Tribute to the Dog" },
  { number: 4, title: "The Joy of Work", start: 173, end: 193, textA: "Work Is a Blessing", textB: "How to Start Your Own Business" },
  { number: 5, title: "Keeping Your Dreams Alive", start: 205, end: 222, textA: "Life Is Difficult", textB: "Begin Again" },
  { number: 6, title: "The Value of Money", start: 223, end: 240, textA: "Teaching Children to Spend Pocket Money Wisely", textB: "The Importance of Money in Life" },
  { number: 7, title: "Inner Voice", start: 241, end: 258, textA: "Your Inner Voice", textB: "Make a Good First Impression" },
  { number: 8, title: "The Great Minds", start: 259, end: 279, textA: "Life Without Limits", textB: "An Unwanted Baby, Steve Jobs" },
  { number: 9, title: "Facing Life's Challenges", start: 291, end: 308, textA: "300 Hurdles", textB: "A Violin with Three Strings" },
  { number: 10, title: "Ode to Public Transport", start: 309, end: 328, textA: "The Importance of Public Transportation", textB: "Personal Advantages of Taking Public Transportation" },
  { number: 11, title: "Cyber World", start: 329, end: 348, textA: "Cyberlove", textB: "The Impact of the Internet on Society" },
  { number: 12, title: "A Break from Life", start: 349, end: 369, textA: "Feeling Free", textB: "Self-Esteem and Body Image" },
];

const assessmentSpecs = [
  { id: "self-assessment-1", title: "Self-Assessment 1", start: 194, end: 203 },
  { id: "self-assessment-2", title: "Self-Assessment 2", start: 280, end: 290 },
  { id: "self-assessment-3", title: "Self-Assessment 3", start: 370, end: 382 },
];

const clean = (value = "") => String(value)
  .replace(/\r/g, "")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replace(/[ \t]+/g, " ")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const compact = (value = "") => clean(value).replace(/\s+/g, " ").trim();
const normalizeWord = (value = "") => value.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z'-]/g, "").replace(/^'+|'+$/g, "").replace(/'s$/, "");
const dateForDay = (day) => {
  const [year, month, dateOfMonth] = PLAN_START.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, dateOfMonth + day - 1));
  return date.toISOString().slice(0, 10);
};

const englishSentencePattern = /[A-Z][A-Za-z0-9,;:'’"()\- ]{18,260}[.!?]/g;
function extractEnglishSentences(text, limit = 36) {
  return [...new Set((text.match(englishSentencePattern) ?? []).map(compact).filter((sentence) => sentence.split(/\s+/).length >= 4))].slice(0, limit);
}

function linesForPages(pages, start, end) {
  const result = [];
  for (let page = start; page <= end; page += 1) {
    const record = pages[String(page)];
    for (const line of record?.lines ?? []) {
      const text = clean(line.text);
      if (text) result.push({ page, text });
    }
  }
  return result;
}

function textForPages(pages, start, end) {
  return linesForPages(pages, start, end).map((line) => line.text).join("\n");
}

function findMarker(lines, patterns, from = 0) {
  return lines.findIndex((line, index) => index >= from && patterns.some((pattern) => pattern.test(line.text)));
}

function sliceByMarkers(lines, startPatterns, endPatterns, fallbackStart = 0, fallbackEnd = lines.length) {
  const startIndex = findMarker(lines, startPatterns, fallbackStart);
  const actualStart = startIndex >= 0 ? startIndex : fallbackStart;
  let endIndex = fallbackEnd;
  if (endPatterns.length) {
    const foundEnd = findMarker(lines, endPatterns, actualStart + 1);
    if (foundEnd >= 0) endIndex = Math.min(foundEnd, fallbackEnd);
  }
  return lines.slice(actualStart, endIndex);
}

function contentFromLines(lines, maxChars = 2200) {
  return clean(lines.map((line) => line.text).join("\n")).slice(0, maxChars);
}

const textBMarkers = [/^Text B$/i, /\bText B\b/i];
const textAMarkers = [/^Text A$/i, /\bText A\b/i, /Pre[-^]?reading/i];
const phraseMarkers = [/^Phrases?\b/i, /Phrases?\b.*Expressions?/i, /Phrases?\s+a[nm]/i, /Piirases/i, /Expressions?/i, /iMpress/i, /lMpress/i, /WMrms/i, /Ewwmmsimm/i, /Exp(?:r|e)ss/i];
const phraseEndMarkers = [/Key Sentences/i, /Checking Your Comprehension/i, /Building Your Vocabulary/i, /Exercises/i, /Notes/i, /Mmtms/i, /S[®e].*n.*s/i];
const sampleMarkers = [/Sample Dialogue/i, /Sample\s+\S{2,30}/i];
const guidedMarkers = [/Guided Practice/i, /^Practice$/i, /^Practice\b/i, /^Directions:/i];

function extractSpeaking(lines) {
  const sample = sliceByMarkers(lines, sampleMarkers, guidedMarkers, 0, Math.min(lines.length, 90));
  const guided = sliceByMarkers(lines, guidedMarkers, textAMarkers, sample.length ? lines.indexOf(sample.at(-1)) + 1 : 0, Math.min(lines.length, 140));
  return {
    sampleDialogue: contentFromLines(sample, 2600),
    guidedPractice: contentFromLines(guided, 1800),
  };
}

function splitTextParts(lines) {
  const textBIndex = findMarker(lines, textBMarkers, 0);
  if (textBIndex >= 0) {
    return {
      textALines: lines.slice(0, textBIndex),
      textBLines: lines.slice(textBIndex),
    };
  }
  const midpoint = Math.floor(lines.length / 2);
  return { textALines: lines.slice(0, midpoint), textBLines: lines.slice(midpoint) };
}

function isLikelyHeadword(value) {
  return /^[a-z][a-z'-]{1,32}$/i.test(value) && !/^(unit|text|section|directions|page|english|chinese)$/i.test(value);
}

function parseWordEntries(lines, unitNumber, textPart) {
  const entries = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].text;
    const current = line.match(/^([A-Za-z][A-Za-z'’\-\s]{1,38})\s+\/([^/]{2,80})\/\s*([A-Za-z.()]+)?\s*(.*)$/);
    const split = !current && index + 1 < lines.length
      ? `${line} ${lines[index + 1].text}`.match(/^([A-Za-z][A-Za-z'’\-\s]{1,38})\s+\/([^/]{2,80})\/\s*([A-Za-z.()]+)?\s*(.*)$/)
      : null;
    const match = current || split;
    if (!match) continue;
    const headword = normalizeWord(match[1]);
    if (!isLikelyHeadword(headword)) continue;
    const definitionLines = [match[4] || ""];
    let cursor = index + (split ? 2 : 1);
    while (cursor < lines.length && definitionLines.join(" ").length < 420) {
      const next = lines[cursor].text;
      if (/^([A-Za-z][A-Za-z'’\-\s]{1,38})\s+\/([^/]{2,80})\//.test(next)) break;
      if (phraseMarkers.some((pattern) => pattern.test(next)) || phraseEndMarkers.some((pattern) => pattern.test(next))) break;
      definitionLines.push(next);
      cursor += 1;
    }
    const rawDefinition = compact(definitionLines.join(" "));
    const chinese = (rawDefinition.match(/[\u3400-\u9fff][\u3400-\u9fff，、；;（）() ]{0,120}/g) ?? []).join("；").replace(/[；;，,、\s]+$/, "");
    entries.push({
      headword,
      phonetic: `/${match[2].trim().replace(/^\/+|\/+$/g, "")}/`,
      partOfSpeech: (match[3] || "词性待核对").replace(/[()]/g, ""),
      meaning: chinese || "释义待核对",
      englishDefinition: rawDefinition.replace(/[\u3400-\u9fff].*$/, "").trim(),
      unitNumber,
      textPart,
      sourcePage: lines[index].page,
      sourceKind: "unit-new-words",
    });
  }
  return entries.filter((entry, index, list) => list.findIndex((item) => item.headword === entry.headword && item.unitNumber === entry.unitNumber && item.textPart === entry.textPart) === index);
}

function parsePhraseChunk(lines, unitNumber, textPart) {
  const start = findMarker(lines, phraseMarkers, 0);
  if (start < 0) return { content: "", phrases: [] };
  let end = lines.length;
  const foundEnd = findMarker(lines, phraseEndMarkers, start + 1);
  if (foundEnd >= 0) end = foundEnd;
  const chunk = lines.slice(start, end);
  const phrases = [];
  for (let index = 1; index < chunk.length; index += 1) {
    const text = compact(chunk[index].text).replace(/[•.。]+$/, "");
    if (!/^[a-z][a-z'’().\-]*(?:\s+[a-z'’().\-]+){1,7}$/i.test(text)) continue;
    const explanation = compact(chunk.slice(index + 1, index + 4).map((line) => line.text).join(" "));
    phrases.push({
      phrase: text.toLowerCase().replace(/[’]/g, "'"),
      meaning: explanation.slice(0, 240) || "释义待核对",
      example: "",
      unitNumber,
      textPart,
      sourcePage: chunk[index].page,
      sourceKind: "unit-phrase",
    });
  }
  return { content: contentFromLines(chunk, 2200), phrases: phrases.slice(0, 18) };
}

function parseSyllabusVocabulary(lines) {
  const words = [];
  for (const line of lines) {
    const text = compact(line.text);
    if (!/^[A-Za-z][A-Za-z'’\-]*(?:\/-[A-Za-z]+)?$/.test(text)) continue;
    const base = normalizeWord(text.split("/")[0]);
    if (isLikelyHeadword(base)) words.push({
      headword: base,
      phonetic: "",
      partOfSpeech: "词性待核对",
      meaning: "大纲词汇，释义待核对",
      englishDefinition: "",
      sourcePage: line.page,
      sourceKind: "syllabus-vocabulary",
    });
  }
  return words.filter((entry, index, list) => list.findIndex((item) => item.headword === entry.headword) === index);
}

function scoreCoreWords(candidates, corpusText, phraseItems) {
  const corpus = corpusText.toLowerCase();
  const phraseSet = new Set(phraseItems.flatMap((item) => item.phrase.split(/\s+/).map(normalizeWord)).filter(Boolean));
  return candidates.map((entry) => {
    const frequency = (corpus.match(new RegExp(`\\b${entry.headword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")) ?? []).length;
    const unitBoost = entry.sourceKind === "unit-new-words" ? 120 : 0;
    const phraseBoost = phraseSet.has(entry.headword) ? 40 : 0;
    const definitionBoost = entry.meaning && !/待核对/.test(entry.meaning) ? 15 : 0;
    return { ...entry, priorityScore: unitBoost + phraseBoost + definitionBoost + frequency * 5, corpusFrequency: frequency };
  }).sort((a, b) => b.priorityScore - a.priorityScore || a.headword.localeCompare(b.headword));
}

function buildUnitDocument(pages, spec) {
  const lines = linesForPages(pages, spec.start, spec.end);
  const text = lines.map((line) => line.text).join("\n");
  const { sampleDialogue, guidedPractice } = extractSpeaking(lines);
  const { textALines, textBLines } = splitTextParts(lines);
  const textAWords = parseWordEntries(textALines, spec.number, "text_a");
  const textBWords = parseWordEntries(textBLines, spec.number, "text_b");
  const textAPhrases = parsePhraseChunk(textALines, spec.number, "text_a");
  const textBPhrases = parsePhraseChunk(textBLines, spec.number, "text_b");
  const sections = [
    { id: `unit-${spec.number}-sample-dialogue`, partType: "sample_dialogue", title: "Sample Dialogue", content: sampleDialogue },
    { id: `unit-${spec.number}-guided-practice`, partType: "guided_practice", title: "Guided Practice", content: guidedPractice },
    { id: `unit-${spec.number}-text-a-new-words`, partType: "new_words", textPart: "text_a", title: `Text A New Words - ${spec.textA}`, content: formatWordEntries(textAWords) },
    { id: `unit-${spec.number}-text-a-phrases`, partType: "phrases", textPart: "text_a", title: `Text A Phrases and Expressions - ${spec.textA}`, content: textAPhrases.content },
    { id: `unit-${spec.number}-text-b-new-words`, partType: "new_words", textPart: "text_b", title: `Text B New Words - ${spec.textB}`, content: formatWordEntries(textBWords) },
    { id: `unit-${spec.number}-text-b-phrases`, partType: "phrases", textPart: "text_b", title: `Text B Phrases and Expressions - ${spec.textB}`, content: textBPhrases.content },
  ];
  return {
    document: {
      id: `textbook-unit-${String(spec.number).padStart(2, "0")}`,
      order: spec.number,
      filename: "ocr_full_pages.json",
      title: `Unit ${spec.number} ${spec.title}`,
      category: "unit",
      source: sourceTitle,
      extractionMethod: "ocr-json-hybrid-extraction",
      status: "ocr-derived",
      pages: spec.end - spec.start + 1,
      checksum: createHash("sha256").update(text).digest("hex"),
      characterCount: text.length,
      sections,
      englishSentences: extractEnglishSentences(text, 48),
      unitNumber: spec.number,
      pageRange: `${spec.start}-${spec.end}`,
    },
    wordEntries: [...textAWords, ...textBWords],
    phraseEntries: [...textAPhrases.phrases, ...textBPhrases.phrases],
    requiredSections: sections,
  };
}

function formatWordEntries(entries) {
  return entries.map((entry) => [
    `${entry.headword} ${entry.phonetic} ${entry.partOfSpeech}`,
    entry.englishDefinition,
    entry.meaning,
  ].filter(Boolean).join("\n")).join("\n\n");
}

function buildSchedule(documents, vocabulary) {
  const byUnit = new Map(documents.filter((document) => document.category === "unit").map((document) => [document.unitNumber, document]));
  const focusSequence = [];
  for (const spec of unitSpecs) {
    const document = byUnit.get(spec.number);
    focusSequence.push(
      { document, focusPartIds: [`unit-${spec.number}-sample-dialogue`, `unit-${spec.number}-guided-practice`], contentFocus: "对话与口语练习" },
      { document, focusPartIds: [`unit-${spec.number}-text-a-new-words`, `unit-${spec.number}-text-a-phrases`], contentFocus: `Text A: ${spec.textA}` },
      { document, focusPartIds: [`unit-${spec.number}-text-b-new-words`, `unit-${spec.number}-text-b-phrases`], contentFocus: `Text B: ${spec.textB}` },
      { document, focusPartIds: document.sections.map((section) => section.id), contentFocus: "Unit 复盘与输出" },
    );
    if ([4, 8, 12].includes(spec.number)) {
      const assessment = documents.find((item) => item.category === "self-assessment" && item.title.endsWith(String([4, 8, 12].indexOf(spec.number) + 1)));
      if (assessment) focusSequence.push({ document: assessment, focusPartIds: assessment.sections.map((section) => section.id), contentFocus: "教材自测与错题回收" });
    }
  }
  const vocabDocument = documents.find((document) => document.category === "vocabulary");
  while (focusSequence.length < 68 && vocabDocument) {
    focusSequence.push({ document: vocabDocument, focusPartIds: vocabDocument.sections.map((section) => section.id), contentFocus: "大纲核心词补强" });
  }
  while (focusSequence.length < 73) {
    const reviewDoc = documents[(focusSequence.length - 68) % documents.length];
    focusSequence.push({ document: reviewDoc, focusPartIds: reviewDoc.sections.map((section) => section.id), contentFocus: "综合复盘与考前回收" });
  }
  focusSequence.push({ document: vocabDocument ?? documents[0], focusPartIds: [], contentFocus: "10.23 考前轻复盘，不安排新词" });

  return Array.from({ length: 74 }, (_, index) => {
    const day = index + 1;
    const focus = focusSequence[index] ?? focusSequence.at(-1);
    const words = vocabulary.filter((item) => item.firstExposureDay === day).map((item) => item.headword);
    return {
      day,
      date: dateForDay(day),
      week: Math.ceil(day / 7),
      documentId: focus.document.id,
      title: `${focus.document.title} · ${focus.contentFocus}`,
      category: focus.document.category,
      isRevisit: day > 68,
      focusPartIds: focus.focusPartIds,
      contentFocus: focus.contentFocus,
      newWordHeadwords: day === 74 ? [] : words,
    };
  });
}

function buildAssessmentDocument(pages, spec, order) {
  const text = textForPages(pages, spec.start, spec.end);
  const sections = text.split(/\n(?=第[一二三四五六七]部分|Section\s+[A-Z]|Self-Assessment)/).map((content, index) => ({
    id: `${spec.id}-section-${index + 1}`,
    partType: "self_assessment",
    title: index === 0 ? spec.title : `自测部分 ${index}`,
    content: clean(content).slice(0, 2800),
  })).filter((section) => section.content);
  return {
    id: `textbook-${spec.id}`,
    order,
    filename: "ocr_full_pages.json",
    title: spec.title,
    category: "self-assessment",
    source: sourceTitle,
    extractionMethod: "ocr-json-hybrid-extraction",
    status: "ocr-derived",
    pages: spec.end - spec.start + 1,
    checksum: createHash("sha256").update(text).digest("hex"),
    characterCount: text.length,
    sections,
    englishSentences: extractEnglishSentences(text, 36),
    pageRange: `${spec.start}-${spec.end}`,
  };
}

function buildLookupEntries(allEntries, phraseEntries, documents) {
  const byWord = new Map();
  const allSentences = documents.flatMap((document) => document.englishSentences ?? []);
  for (const entry of allEntries) {
    const current = byWord.get(entry.headword) ?? {
      headword: entry.headword,
      phonetic: entry.phonetic || "",
      partOfSpeech: entry.partOfSpeech || "词性待核对",
      meanings: [],
      englishDefinitions: [],
      examples: [],
      collocations: [],
      sourceKinds: [],
      sourcePages: [],
      unitRefs: [],
    };
    if (entry.meaning && !current.meanings.includes(entry.meaning)) current.meanings.push(entry.meaning);
    if (entry.englishDefinition && !current.englishDefinitions.includes(entry.englishDefinition)) current.englishDefinitions.push(entry.englishDefinition);
    if (entry.sourceKind && !current.sourceKinds.includes(entry.sourceKind)) current.sourceKinds.push(entry.sourceKind);
    if (entry.sourcePage && !current.sourcePages.includes(entry.sourcePage)) current.sourcePages.push(entry.sourcePage);
    if (entry.unitNumber && !current.unitRefs.includes(`Unit ${entry.unitNumber}`)) current.unitRefs.push(`Unit ${entry.unitNumber}`);
    byWord.set(entry.headword, current);
  }
  for (const phrase of phraseEntries) {
    for (const token of phrase.phrase.split(/\s+/).map(normalizeWord).filter(Boolean)) {
      const current = byWord.get(token);
      if (current && !current.collocations.includes(phrase.phrase)) current.collocations.push(phrase.phrase);
    }
  }
  for (const entry of byWord.values()) {
    const pattern = new RegExp(`\\b${entry.headword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    entry.examples = allSentences.filter((sentence) => pattern.test(sentence)).slice(0, 3);
  }
  return [...byWord.values()].sort((a, b) => a.headword.localeCompare(b.headword));
}

function validate(pages, unitResults, schedule) {
  const failures = [];
  const pageKeys = Object.keys(pages).map(Number);
  if (Math.min(...pageKeys) !== 1 || Math.max(...pageKeys) !== 418 || pageKeys.length !== 418) {
    failures.push(`ocr_full_pages.json must cover pages 1-418; found ${pageKeys.length} pages ${Math.min(...pageKeys)}-${Math.max(...pageKeys)}`);
  }
  for (const result of unitResults) {
    for (const section of result.requiredSections) {
      if (!section.content || section.content.length < 20) failures.push(`${result.document.title} missing ${section.title}`);
    }
  }
  for (const item of schedule) {
    if ((item.newWordHeadwords?.length ?? 0) > NEW_WORD_LIMIT) failures.push(`Day ${item.day} schedules ${item.newWordHeadwords.length} words`);
    if (item.date > EXAM_DATE) failures.push(`Day ${item.day} is after exam date: ${item.date}`);
  }
  if (failures.length) {
    throw new Error(`OCR course build failed:\n${failures.slice(0, 80).join("\n")}`);
  }
}

const pages = JSON.parse(await readFile(ocrFile, "utf8"));
const syllabusLines = linesForPages(pages, 51, 109);
const syllabusVocabulary = parseSyllabusVocabulary(syllabusLines);
const unitResults = unitSpecs.map((spec) => buildUnitDocument(pages, spec));
const unitDocuments = unitResults.map((result) => result.document);
const unitWordEntries = unitResults.flatMap((result) => result.wordEntries);
const phraseEntries = unitResults.flatMap((result) => result.phraseEntries);
const assessmentDocuments = assessmentSpecs.map((spec, index) => buildAssessmentDocument(pages, spec, 13 + index));
const vocabText = syllabusLines.map((line) => line.text).join("\n");
const vocabDocument = {
  id: "textbook-vocab-appendix",
  order: 16,
  filename: "ocr_full_pages.json",
  title: "附录：大纲词汇表",
  category: "vocabulary",
  source: sourceTitle,
  extractionMethod: "ocr-json-hybrid-extraction",
  status: "ocr-derived",
  pages: 59,
  checksum: createHash("sha256").update(vocabText).digest("hex"),
  characterCount: vocabText.length,
  sections: Array.from({ length: Math.ceil(syllabusVocabulary.length / 120) }, (_, index) => ({
    id: `syllabus-vocabulary-${index + 1}`,
    partType: "syllabus_vocabulary",
    title: `大纲词汇表 ${index + 1}`,
    content: syllabusVocabulary.slice(index * 120, index * 120 + 120).map((entry) => entry.headword).join("\n"),
  })),
  englishSentences: extractEnglishSentences(vocabText, 24),
  pageRange: "51-109",
};

const documents = [...unitDocuments, ...assessmentDocuments, vocabDocument];
const corpusText = documents.flatMap((document) => [document.title, ...document.sections.map((section) => section.content)]).join("\n");
const allVocabularyCandidates = [...unitWordEntries, ...syllabusVocabulary]
  .filter((entry, index, list) => list.findIndex((item) => item.headword === entry.headword) === index)
  .filter((entry) => !coreStopwords.has(entry.headword));
const rankedCore = scoreCoreWords(allVocabularyCandidates, corpusText, phraseEntries).slice(0, Math.min(CORE_WORD_TARGET, allVocabularyCandidates.length));
const vocabulary = rankedCore.map((entry, index) => ({
  headword: entry.headword,
  phonetic: entry.phonetic || "发音待核对",
  partOfSpeech: entry.partOfSpeech || "词性待核对",
  meaning: entry.meaning || "释义待核对",
  englishDefinition: entry.englishDefinition || "",
  example: documents.flatMap((document) => document.englishSentences).find((sentence) => new RegExp(`\\b${entry.headword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(sentence)) || entry.headword,
  exampleTranslation: "",
  sourceLine: `OCR ${entry.sourceKind}: ${entry.headword}`,
  sourceKind: entry.sourceKind,
  sourcePage: entry.sourcePage,
  unitNumber: entry.unitNumber,
  priorityScore: entry.priorityScore,
  firstExposureDay: Math.min(68, Math.floor(index / NEW_WORD_LIMIT) + 1),
}));
const lookupEntries = buildLookupEntries([...unitWordEntries, ...syllabusVocabulary], phraseEntries, documents);
const schedule = buildSchedule(documents, vocabulary);
validate(pages, unitResults, schedule);

const payload = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  sourceDirectory: "app/study/textbook-units/ocr",
  sourceFile: "ocr_full_pages.json",
  sourceRule: `课程内容仅来自《${sourceTitle}》的完整 OCR JSON。旧 txt/json 不作为内容来源。`,
  planStartDate: PLAN_START,
  examDate: EXAM_DATE,
  documentCount: documents.length,
  totalCharacters: documents.reduce((sum, item) => sum + item.characterCount, 0),
  documents,
  vocabulary,
  phrases: phraseEntries.map((entry) => ({ phrase: entry.phrase, meaning: entry.meaning, sourceLine: `Unit ${entry.unitNumber} ${entry.textPart}`, unitNumber: entry.unitNumber, textPart: entry.textPart })),
  schedule,
  audit: {
    expectedDocuments: 16,
    includedDocuments: documents.length,
    ocrPageCount: Object.keys(pages).length,
    unitCount: unitDocuments.length,
    vocabularyCount: vocabulary.length,
    lookupEntryCount: lookupEntries.length,
    syllabusVocabularyCount: syllabusVocabulary.length,
    unitNewWordCount: unitWordEntries.length,
    phraseCount: phraseEntries.length,
    maxNewWordsPerDay: Math.max(0, ...schedule.map((item) => item.newWordHeadwords.length)),
    missingDocuments: [],
  },
};

const lookupPayload = {
  schemaVersion: 1,
  generatedAt: payload.generatedAt,
  sourceFile: "ocr_full_pages.json",
  entries: lookupEntries,
};

await mkdir(outputRoot, { recursive: true });
await writeFile(courseOutputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(lookupOutputFile, `${JSON.stringify(lookupPayload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  courseOutputFile,
  lookupOutputFile,
  documents: documents.length,
  vocabulary: vocabulary.length,
  lookupEntries: lookupEntries.length,
  maxNewWordsPerDay: payload.audit.maxNewWordsPerDay,
}, null, 2));
