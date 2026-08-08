import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.resolve(projectRoot, "..", "normalized");
const outputRoot = path.join(projectRoot, "public", "data", "english2");
const outputFile = path.join(outputRoot, "normalized_course.json");
const dictionaryFile = path.join(projectRoot, "app", "study", "offline-dictionary.json");
const workbookFile = path.join(projectRoot, "public", "data", "exam", "vocabulary_candidates", "user_english2_1800.json");

const clean = (value = "") => value.replace(/\r/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
const scalar = (frontmatter, key) => {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m"));
  return clean(match?.[1] ?? "").replace(/^['"]|['"]$/g, "");
};

function classify(filename, declared) {
  if (declared) return declared;
  if (/真题|试题|202204/.test(filename)) return "past-paper";
  if (/教材/.test(filename)) return "textbook";
  if (/语法/.test(filename)) return "grammar";
  if (/单词/.test(filename)) return "vocabulary";
  if (/词组/.test(filename)) return "phrase";
  if (/写作|作文/.test(filename)) return "writing";
  if (/技巧/.test(filename)) return "strategy";
  if (/密训|急救|压轴|烤前/.test(filename)) return "exam-review";
  return "reference";
}

function splitSections(body) {
  const matches = [...body.matchAll(/^##\s+(.+)$/gm)];
  if (!matches.length) return [{ id: "section-1", title: "全文", content: clean(body) }];
  const prefix = clean(body.slice(0, matches[0].index));
  const sections = matches.map((match, index) => ({
    id: `section-${index + 1}`,
    title: clean(match[1]),
    content: clean(body.slice((match.index ?? 0) + match[0].length, matches[index + 1]?.index ?? body.length)),
  })).filter((item) => item.content);
  if (prefix) sections.unshift({ id: "section-0", title: "导读", content: prefix });
  return sections;
}

function extractEnglishSentences(text, limit = 12) {
  const normalized = text.replace(/\n+/g, " ").replace(/\s+/g, " ");
  const candidates = normalized.match(/[A-Z][A-Za-z0-9,'’()\-\s]{18,220}[.!?]/g) ?? [];
  return [...new Set(candidates.map(clean))].slice(0, limit);
}

function parseVocabulary(text, dictionary) {
  const entries = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^(?:DAY|Day)\s*\d+/i.test(line)) continue;
    const withPhonetic = line.match(/^\s*(?:\d+[.、]?\s*)?([A-Za-z][A-Za-z'’\- ]{0,38}?)\s*[［\[]([^］\]]+)[］\]]\s*(.+)$/);
    const numbered = line.match(/^\s*\d+[.、]\s*([A-Za-z][A-Za-z'’\-]*)\s*(.+)$/);
    if (!withPhonetic && !numbered) continue;
    const headword = (withPhonetic?.[1] ?? numbered?.[1] ?? "").trim().toLowerCase().replace(/’/g, "'");
    if (!/^[a-z][a-z'\-]*(?:\s+[a-z][a-z'\-]*)?$/.test(headword)) continue;
    const tail = clean(withPhonetic?.[3] ?? numbered?.[2] ?? "");
    const dictionaryEntry = dictionary[headword] ?? {};
    const posMatch = tail.match(/^(n\.|v\.|vt\.|vi\.|a\.|adj\.|adv\.|prep\.|pron\.|conj\.|num\.|art\.|modal|aux\.|interj\.)/i);
    const partOfSpeech = posMatch?.[1] ?? "待细分";
    const meaning = clean(tail.replace(posMatch?.[0] ?? "", "")) || clean(dictionaryEntry.translation?.split(/\r?\n/)[0]) || "释义待核对";
    entries.push({
      headword,
      phonetic: clean(dictionaryEntry.phonetic) || (withPhonetic ? `/${clean(withPhonetic[2])}/` : "发音待核对"),
      partOfSpeech,
      meaning,
      example: "",
      sourceLine: line,
      sourceKind: "explicit-list",
    });
  }
  const unique = [];
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.headword)) continue;
    seen.add(entry.headword);
    unique.push(entry);
  }
  return unique;
}

function extractCorpusVocabulary(documents, dictionary, workbookWords, existing) {
  const known = new Map(Object.entries(dictionary));
  for (const item of workbookWords) known.set(item.headword.toLowerCase(), item);
  const counts = new Map();
  const examples = new Map();
  for (const document of documents) {
    const text = document.sections.map((section) => section.content).join("\n");
    for (const match of text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)) {
      const word = match[0].toLowerCase().replace(/’/g, "'");
      if ((word.length < 2 && word !== "a" && word !== "i") || !known.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    for (const sentence of document.englishSentences) {
      for (const token of sentence.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? []) {
        const word = token.toLowerCase().replace(/’/g, "'");
        if (!examples.has(word)) examples.set(word, sentence);
      }
    }
  }
  return [...counts.entries()]
    .filter(([headword]) => !existing.has(headword))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([headword, frequency]) => {
      const workbookItem = workbookWords.find((item) => item.headword.toLowerCase() === headword);
      const dictionaryItem = dictionary[headword] ?? {};
      return {
        headword,
        phonetic: workbookItem?.phoneticUK || dictionaryItem.phonetic || "发音待核对",
        partOfSpeech: workbookItem?.partOfSpeech?.join("/") || "待细分",
        meaning: workbookItem?.chineseMeanings?.join("；") || clean(dictionaryItem.translation?.split(/\r?\n/)[0]) || "释义待核对",
        example: examples.get(headword) || workbookItem?.exampleSentences?.[0] || "",
        sourceLine: `normalized corpus frequency: ${frequency}`,
        sourceKind: "normalized-corpus",
        corpusFrequency: frequency,
      };
    });
}

function parsePhrases(text) {
  const phrases = [];
  const seen = new Set();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = clean(rawLine);
    if (!line || /^#|^>|^第\s*\d+\s*页|^\d*第.+部分/.test(line)) continue;
    const match = line.match(/^([A-Za-z][A-Za-z0-9'’().\-]*(?:\s+[A-Za-z.()'’\-]+){1,9})\s+(.{1,80})$/);
    if (!match) continue;
    const phrase = clean(match[1]).toLowerCase().replace(/’/g, "'");
    if (seen.has(phrase) || !/[\u3400-\u9fff]/.test(match[2])) continue;
    seen.add(phrase);
    phrases.push({ phrase, meaning: clean(match[2]), sourceLine: line });
  }
  return phrases;
}

const priority = {
  grammar: 0,
  vocabulary: 1,
  phrase: 2,
  textbook: 3,
  writing: 4,
  strategy: 5,
  "exam-review": 6,
  "past-paper": 7,
  reference: 8,
};

const files = (await readdir(sourceRoot)).filter((name) => name.endsWith(".md")).sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
const dictionary = JSON.parse(await readFile(dictionaryFile, "utf8"));
const workbook = JSON.parse(await readFile(workbookFile, "utf8"));
const documents = [];

for (const filename of files) {
  const raw = await readFile(path.join(sourceRoot, filename), "utf8");
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const frontmatter = frontmatterMatch?.[1] ?? "";
  const body = clean(raw.slice(frontmatterMatch?.[0].length ?? 0));
  const title = clean(body.match(/^#\s+(.+)$/m)?.[1] ?? filename.replace(/^\d+_/, "").replace(/_[a-f0-9]{8}\.md$/i, ""));
  const id = filename.match(/^(\d+)/)?.[1] ?? createHash("sha1").update(filename).digest("hex").slice(0, 8);
  const category = classify(filename, scalar(frontmatter, "category"));
  const sections = splitSections(body);
  documents.push({
    id: `normalized-${id}`,
    order: Number(id),
    filename,
    title,
    category,
    source: scalar(frontmatter, "relative_source") || scalar(frontmatter, "source") || filename,
    extractionMethod: scalar(frontmatter, "extraction_method") || "markdown",
    status: scalar(frontmatter, "status") || "unknown",
    pages: Number(scalar(frontmatter, "pages")) || sections.length,
    checksum: createHash("sha256").update(raw).digest("hex"),
    characterCount: body.length,
    sections,
    englishSentences: extractEnglishSentences(body),
  });
}

const orderedDocuments = [...documents].sort((a, b) => (priority[a.category] ?? 9) - (priority[b.category] ?? 9) || a.order - b.order);
const vocabularyDocument = documents.find((item) => item.category === "vocabulary" || /高频600单词/.test(item.title));
const phraseDocument = documents.find((item) => item.category === "phrase" || /核心300词组/.test(item.title));
const explicitVocabularyRaw = parseVocabulary(vocabularyDocument?.sections.map((item) => item.content).join("\n") ?? "", dictionary);
const supportedHeadwords = new Set([...Object.keys(dictionary), ...workbook.words.map((item) => item.headword.toLowerCase())]);
const explicitVocabulary = explicitVocabularyRaw.filter((item) => supportedHeadwords.has(item.headword));
const corpusVocabulary = extractCorpusVocabulary(documents, dictionary, workbook.words, new Set(explicitVocabulary.map((item) => item.headword)));
const vocabulary = [...explicitVocabulary, ...corpusVocabulary]
  .filter((entry, index, list) => list.findIndex((candidate) => candidate.headword.toLowerCase() === entry.headword.toLowerCase()) === index)
  .map((entry, index) => ({ ...entry, firstExposureDay: Math.floor(index / 30) + 1 }));
const phrases = parsePhrases(phraseDocument?.sections.map((item) => item.content).join("\n") ?? "");

const schedule = Array.from({ length: 84 }, (_, index) => {
  const day = index + 1;
  const document = orderedDocuments[index % orderedDocuments.length];
  return {
    day,
    week: Math.ceil(day / 7),
    documentId: document.id,
    title: document.title,
    category: document.category,
    isRevisit: index >= orderedDocuments.length,
  };
});

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceDirectory: "normalized",
  sourceRule: "用户提供的 normalized 文件夹是课程内容的唯一主体来源；离线词典仅用于补全查词信息。",
  documentCount: documents.length,
  totalCharacters: documents.reduce((sum, item) => sum + item.characterCount, 0),
  documents,
  vocabulary,
  phrases,
  schedule,
  audit: {
    expectedDocuments: files.length,
    includedDocuments: documents.length,
    vocabularyCount: vocabulary.length,
    explicitVocabularyRawCount: explicitVocabularyRaw.length,
    explicitVocabularyCount: explicitVocabulary.length,
    rejectedExplicitVocabularyCount: explicitVocabularyRaw.length - explicitVocabulary.length,
    corpusVocabularyCount: corpusVocabulary.length,
    phraseCount: phrases.length,
    maxNewWordsPerDay: Math.max(0, ...Array.from({ length: 84 }, (_, index) => vocabulary.filter((item) => item.firstExposureDay === index + 1).length)),
    missingDocuments: files.filter((filename) => !documents.some((item) => item.filename === filename)),
  },
};

await mkdir(outputRoot, { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputFile, ...payload.audit, totalCharacters: payload.totalCharacters }, null, 2));
