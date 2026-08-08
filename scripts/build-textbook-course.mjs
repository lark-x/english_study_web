import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "app", "study", "textbook-units");
const outputFile = path.join(projectRoot, "public", "data", "english2", "textbook_course.json");
const manifest = JSON.parse(await readFile(path.join(sourceRoot, "main-textbook-manifest.json"), "utf8"));
const extractedVocabulary = JSON.parse(await readFile(path.join(sourceRoot, "textbook-vocab-extracted.json"), "utf8"));
const appendixDictionary = JSON.parse(await readFile(path.join(sourceRoot, "pdf-vocab-with-dict.json"), "utf8"));
const appendixByBase = new Map(appendixDictionary.map((entry) => [String(entry.base || entry.headword).toLowerCase(), entry]));

const sourceTitle = "英语（二）自学教程（2012年版，00015，张敬源、张虹主编）";
const clean = (value = "") => value.replace(/\r/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/\s+/g, " ").trim();
const cleanMeaning = (value = "") => value
  .split(/\\n|\n/)
  .map((line) => line.replace(/\[[^\]]+\]\s*/g, "").trim())
  .filter(Boolean)
  .join("；")
  .replace(/[；;，,、\s]+$/, "");
const curatedMeanings = {
  content: "满足的；满意的；内容；所含之物",
  identify: "识别；鉴定；确认；认出",
  please: "请；使高兴；使满意",
  remove: "移开；去除；搬走；开除；删除",
  survive: "生存；幸存；比……活得久",
  anguish: "极度痛苦；苦恼",
  imagine: "想象；设想；认为",
  favorite: "最喜欢的；特别喜爱的",
  contain: "包含；容纳；控制；抑制",
  goodwill: "善意；友好；亲善",
  pensive: "沉思的；忧思的",
  stable: "稳定的；牢固的；马厩",
  push: "推；推动；促进；努力争取",
  consume: "消耗；消费；吃；喝",
  subside: "减弱；平息；消退；下沉",
  ethnic: "种族的；民族的；具有民族特色的",
};
const curatedExampleTranslations = {
  content: "他想让它们感到满足。",
  baggage: "我只带着自己和一点点行李。",
  goodwill: "你的微笑是你善意的使者。",
};

function extractEnglishSentences(text, limit = 36) {
  const candidates = text.replace(/--- Page \d+ ---/g, " ").match(/[A-Z][A-Za-z0-9,;:'’"()\- ]{18,320}[.!?]/g) ?? [];
  return [...new Set(candidates.map(clean).filter((sentence) => sentence.split(/\s+/).length >= 4))].slice(0, limit);
}

function sectionChunks(sentences) {
  const sections = [];
  for (let index = 0; index < sentences.length; index += 5) {
    const content = sentences.slice(index, index + 5).join("\n\n");
    if (content) sections.push({ id: `extract-${sections.length + 1}`, title: `教材节选 ${sections.length + 1}`, content });
  }
  return sections;
}

const includedUnits = manifest.units.filter((unit) => /^\d{2}-unit\d{2}$/.test(unit.id) || unit.id === "13-self-assessment" || unit.id === "14-vocab-appendix");
const documents = [];
for (const [index, unit] of includedUnits.entries()) {
  const raw = await readFile(path.join(sourceRoot, unit.file), "utf8");
  const englishSentences = extractEnglishSentences(raw);
  const category = unit.id === "14-vocab-appendix" ? "vocabulary" : unit.id === "13-self-assessment" ? "self-assessment" : "unit";
  documents.push({
    id: `textbook-${unit.id}`,
    order: index + 1,
    filename: unit.file,
    title: unit.title,
    category,
    source: sourceTitle,
    extractionMethod: "source-pdf-text-extraction",
    status: "source-verified",
    pages: unit.pages.length,
    checksum: createHash("sha256").update(raw).digest("hex"),
    characterCount: raw.length,
    sections: sectionChunks(englishSentences),
    englishSentences,
  });
}

const allSentences = documents.flatMap((document) => document.englishSentences);
const vocabulary = extractedVocabulary
  .filter((entry) => /^[a-z][a-z'-]*$/i.test(entry.headword ?? "") && /[\u4e00-\u9fff]/.test(entry.meaning ?? ""))
  .filter((entry, index, list) => list.findIndex((candidate) => candidate.headword.toLowerCase() === entry.headword.toLowerCase()) === index)
  .map((entry, index) => {
    const headword = entry.headword.toLowerCase();
    const appendixEntry = appendixByBase.get(headword);
    const pattern = new RegExp(`\\b${headword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return {
      headword,
      phonetic: entry.phonetic || "发音待核对",
      partOfSpeech: entry.partOfSpeech || "词性待核对",
      meaning: curatedMeanings[headword] || cleanMeaning(appendixEntry?.translation || entry.meaning),
      example: allSentences.find((sentence) => pattern.test(sentence)) || "",
      exampleTranslation: curatedExampleTranslations[headword] || "",
      sourceLine: `教材词汇提取：${headword}`,
      sourceKind: "textbook-vocabulary",
      firstExposureDay: Math.floor(index / 30) + 1,
    };
  });

const scheduleOrder = [documents.find((item) => item.category === "vocabulary"), ...documents.filter((item) => item.category === "unit"), documents.find((item) => item.category === "self-assessment")].filter(Boolean);
const schedule = Array.from({ length: 84 }, (_, index) => {
  const document = scheduleOrder[index % scheduleOrder.length];
  return { day: index + 1, week: Math.ceil((index + 1) / 7), documentId: document.id, title: document.title, category: document.category, isRevisit: index >= scheduleOrder.length };
});

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceDirectory: "app/study/textbook-units",
  sourceRule: `课程内容仅来自《${sourceTitle}》的本地提取文件。`,
  documentCount: documents.length,
  totalCharacters: documents.reduce((sum, item) => sum + item.characterCount, 0),
  documents,
  vocabulary,
  phrases: [],
  schedule,
  audit: {
    expectedDocuments: includedUnits.length,
    includedDocuments: documents.length,
    vocabularyCount: vocabulary.length,
    phraseCount: 0,
    maxNewWordsPerDay: Math.max(...Array.from({ length: 84 }, (_, index) => vocabulary.filter((item) => item.firstExposureDay === index + 1).length)),
    missingDocuments: includedUnits.filter((unit) => !documents.some((document) => document.filename === unit.file)).map((unit) => unit.file),
  },
};

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputFile, source: sourceTitle, documents: documents.length, vocabulary: vocabulary.length, maxNewWordsPerDay: payload.audit.maxNewWordsPerDay }, null, 2));
