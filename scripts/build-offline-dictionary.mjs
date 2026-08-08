import { writeFile } from "node:fs/promises";
import { lessons, assessmentQuestions } from "../app/study/seed.ts";

const SOURCE_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv";
const OUTPUT_URL = new URL("../app/study/offline-dictionary.json", import.meta.url);
const WORD_PATTERN = /[A-Za-z]+(?:[’'][A-Za-z]+)*/g;

function addWords(target, value) {
  if (typeof value !== "string") return;
  for (const match of value.match(WORD_PATTERN) ?? []) {
    const word = match.toLowerCase().replace(/[’']/g, "'").replace(/'s$/, "");
    if (word.length > 1 || ["a", "i"].includes(word)) target.add(word);
  }
}

function collectCourseWords() {
  const words = new Set();
  for (const lesson of lessons) {
    addWords(words, lesson.title);
    for (const paragraph of lesson.paragraphs) addWords(words, paragraph.en);
    for (const item of lesson.vocabulary) { addWords(words, item.word); addWords(words, item.example); }
    addWords(words, lesson.grammar.structure);
    for (const example of lesson.grammar.examples) addWords(words, example.en);
    for (const pattern of lesson.sentencePatterns) { addWords(words, pattern.pattern); addWords(words, pattern.example); }
    for (const expression of lesson.expressions) { addWords(words, expression.phrase); addWords(words, expression.example); }
    for (const question of lesson.questions) {
      addWords(words, question.prompt);
      question.options.forEach((option) => addWords(words, option));
      addWords(words, question.explanation);
    }
    for (const task of lesson.translations) addWords(words, task.reference);
    addWords(words, lesson.outputPrompt);
    addWords(words, lesson.outputHint);
  }
  for (const question of assessmentQuestions) {
    addWords(words, question.prompt);
    question.options.forEach((option) => addWords(words, option));
  }
  return words;
}

function candidatesFor(word) {
  const values = [word];
  if (word.endsWith("ies") && word.length > 4) values.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("ing") && word.length > 5) values.push(word.slice(0, -3), `${word.slice(0, -3)}e`);
  if (word.endsWith("ied") && word.length > 4) values.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("ed") && word.length > 4) values.push(word.slice(0, -2), word.slice(0, -1));
  if (word.endsWith("es") && word.length > 4) values.push(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) values.push(word.slice(0, -1));
  return [...new Set(values)];
}

function parseCsv(text, onRow) {
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"' && field.length === 0) { quoted = true; continue; }
    if (char === ",") { row.push(field); field = ""; continue; }
    if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      onRow(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  if (field || row.length) { row.push(field); onRow(row); }
}

function cleanDefinition(value) {
  return String(value ?? "").split(/\n+|\\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 5).join("；").slice(0, 700);
}

const courseWords = collectCourseWords();
const candidateOwners = new Map();
for (const word of courseWords) {
  for (const candidate of candidatesFor(word)) {
    const owners = candidateOwners.get(candidate) ?? [];
    owners.push(word);
    candidateOwners.set(candidate, owners);
  }
}

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`ECDICT download failed: ${response.status}`);
const csv = await response.text();
const dictionary = {};
let header = null;

parseCsv(csv, (row) => {
  if (!header) { header = row; return; }
  const sourceWord = String(row[0] ?? "").toLowerCase().trim();
  const owners = candidateOwners.get(sourceWord);
  if (!owners?.length) return;
  const entry = {
    phonetic: String(row[1] ?? "").trim(),
    definition: cleanDefinition(row[2]),
    translation: cleanDefinition(row[3]),
  };
  if (!entry.translation && !entry.definition) return;
  for (const owner of owners) {
    if (!dictionary[owner] || owner === sourceWord) dictionary[owner] = { ...entry, lemma: sourceWord === owner ? "" : sourceWord };
  }
});

const sorted = Object.fromEntries(Object.entries(dictionary).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(OUTPUT_URL, JSON.stringify(sorted), "utf8");
const missing = [...courseWords].filter((word) => !dictionary[word]);
console.log(JSON.stringify({ courseWords: courseWords.size, covered: Object.keys(dictionary).length, missing: missing.length, missingWords: missing.slice(0, 80) }, null, 2));
