import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const inputFlag = args.indexOf("--input");
const outputFlag = args.indexOf("--output");
const sourceFlag = args.indexOf("--source");
const inputPath = inputFlag >= 0 ? args[inputFlag + 1] : "";
const outputPath = outputFlag >= 0 ? args[outputFlag + 1] : "";
const sourceId = sourceFlag >= 0 ? args[sourceFlag + 1] : "local-user-material-pending";

if (!inputPath) {
  console.error("用法：node scripts/audit-vocabulary-source.mjs --input <本地JSON或CSV> [--output <报告JSON>] [--source <来源ID>]");
  process.exit(2);
}

const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/’/g, "'");
const wordPattern = /^[a-z]+(?:['-][a-z]+)*$/i;
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseWordList(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => {
    if (!line || /^[A-Z]$/.test(line) || /^\(/.test(line)) return false;
    return /^[A-Za-z][A-Za-z'-]*(?:\s|$)/.test(line);
  }).map((line) => {
    const match = line.match(/^([A-Za-z][A-Za-z'-]*)(?:\s+(\[[^\]]+\]))?\s*(.*)$/);
    return { headword: match?.[1] ?? line.split(/\s+/)[0], phonetic: match?.[2] ?? "", chineseMeanings: match?.[3] ?? "" };
  });
}

const inputBuffer = await readFile(resolve(inputPath));
const raw = inputPath.toLowerCase().endsWith(".csv")
  ? parseCsv(inputBuffer.toString("utf8"))
  : inputPath.toLowerCase().endsWith(".txt")
    ? parseWordList(inputBuffer.toString("utf8"))
    : JSON.parse(inputBuffer.toString("utf8"));
const rows = Array.isArray(raw)
  ? raw
  : Array.isArray(raw.entries)
    ? raw.entries
    : raw && typeof raw === "object"
      ? Object.entries(raw).map(([headword, value]) => ({ headword, ...(value && typeof value === "object" ? value : {}) }))
      : [];
const sourceWords = new Set(rows.map((row) => normalize(row.headword ?? row.word ?? row.lemma)).filter(Boolean));
const canonicalByForm = (word) => {
  const candidates = [
    word.endsWith("ies") ? `${word.slice(0, -3)}y` : "",
    word.endsWith("ied") ? `${word.slice(0, -3)}y` : "",
    word.endsWith("ing") ? word.slice(0, -3) : "",
    word.endsWith("ing") ? `${word.slice(0, -3)}e` : "",
    word.endsWith("ed") ? word.slice(0, -2) : "",
    word.endsWith("ed") ? `${word.slice(0, -2)}e` : "",
    word.endsWith("es") ? word.slice(0, -2) : "",
    word.endsWith("s") ? word.slice(0, -1) : "",
  ];
  return candidates.find((candidate) => candidate.length > 2 && sourceWords.has(candidate)) ?? word;
};
const entries = new Map();
const issues = [];

for (const [index, row] of rows.entries()) {
  const rawHeadword = normalize(row.headword ?? row.word ?? row.lemma);
  const suppliedLemma = normalize(row.lemma);
  const headword = suppliedLemma || canonicalByForm(rawHeadword);
  if (!wordPattern.test(rawHeadword)) {
    issues.push({ row: index + 1, type: "invalid-headword", value: rawHeadword });
    continue;
  }
  const lemma = suppliedLemma || headword;
  const key = `${headword}::${lemma}`;
  const existing = entries.get(key);
  const next = {
    id: `source-vocab-${headword.replace(/[^a-z0-9]+/g, "-")}`,
    headword,
    lemma,
    variants: [...(rawHeadword !== headword ? [rawHeadword] : []), ...(Array.isArray(row.variants) ? row.variants.map(normalize).filter(Boolean) : [])],
    partOfSpeech: Array.isArray(row.partOfSpeech) ? row.partOfSpeech : String(row.partOfSpeech ?? "").split(/[;/|]/).map((item) => item.trim()).filter(Boolean),
    phoneticUK: row.phoneticUK || row.phonetic || null,
    phoneticUS: row.phoneticUS || row.phonetic || null,
    chineseMeanings: Array.isArray(row.chineseMeanings) ? row.chineseMeanings : String(row.chineseMeanings ?? row.meaning ?? "").split(/[;；|]/).map((item) => item.trim()).filter(Boolean),
    conciseEnglishDefinition: String(row.conciseEnglishDefinition ?? row.definition ?? "").trim(),
    exampleSentences: Array.isArray(row.exampleSentences) ? row.exampleSentences : String(row.exampleSentences ?? row.example ?? "").split(/[|\n]/).map((item) => item.trim()).filter(Boolean),
    priorityBand: ["A", "B", "C"].includes(row.priorityBand) ? row.priorityBand : "C",
    syllabusSourceRefs: Array.isArray(row.syllabusSourceRefs) ? row.syllabusSourceRefs : [sourceId],
    textbookUnitRefs: Array.isArray(row.textbookUnitRefs) ? row.textbookUnitRefs : [],
    verificationStatus: "pending-source",
  };
  if (existing) {
    existing.variants = [...new Set([...existing.variants, ...next.variants])];
    existing.partOfSpeech = [...new Set([...existing.partOfSpeech, ...next.partOfSpeech])];
    existing.chineseMeanings = [...new Set([...existing.chineseMeanings, ...next.chineseMeanings])];
    existing.exampleSentences = [...new Set([...existing.exampleSentences, ...next.exampleSentences])];
  } else entries.set(key, next);
}

const list = [...entries.values()].map((entry, index) => ({ ...entry, firstExposureDay: Math.min(84, Math.floor(index / 55) + 1), reviewSchedulePolicy: entry.priorityBand === "A" ? "A-active" : entry.priorityBand === "B" ? "B-progressive" : "C-recognition" }));
const report = {
  sourceId,
  input: resolve(inputPath),
  inputSha256: hash(inputBuffer),
  rawRows: rows.length,
  headwordTotal: list.length,
  scheduled: list.filter((entry) => entry.firstExposureDay >= 1 && entry.firstExposureDay <= 84).length,
  orphan: list.filter((entry) => !entry.firstExposureDay).length,
  verified: 0,
  provisional: 0,
  pendingSource: list.length,
  issues,
  entries: list,
  policy: "本地材料尚未由人工核对页码和版本；脚本不会自动将词条标记为verified。",
};
if (outputPath) await writeFile(resolve(outputPath), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ sourceId, rawRows: report.rawRows, headwordTotal: report.headwordTotal, scheduled: report.scheduled, orphan: report.orphan, verified: report.verified, provisional: report.provisional, pendingSource: report.pendingSource, issues: report.issues.length, output: outputPath ? resolve(outputPath) : null }, null, 2));
