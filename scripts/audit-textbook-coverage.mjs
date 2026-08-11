import { readFile } from "node:fs/promises";

const readJson = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8").then(JSON.parse);
const [course, lookup, pages] = await Promise.all([
  readJson("public/data/english2/textbook_course.json"),
  readJson("public/data/english2/textbook_lookup.json"),
  readJson("app/study/textbook-units/ocr/ocr_full_pages.json"),
]);

const issues = [];
const unitDocuments = course.documents.filter((document) => document.category === "unit");
const requiredParts = ["sample_dialogue", "guided_practice", "new_words", "phrases"];

if (Object.keys(pages).length !== 418) issues.push("ocr_full_pages.json must contain 418 pages.");
if (course.schedule.length !== 74) issues.push("Course schedule must contain 74 days.");
if (course.schedule.at(-1)?.date !== "2026-10-23") issues.push("Final schedule date must be 2026-10-23.");
if ((course.schedule.at(-1)?.newWordHeadwords ?? []).length !== 0) issues.push("Exam day must not schedule new words.");
if ((course.audit?.maxNewWordsPerDay ?? 0) > 35) issues.push("Daily new word limit exceeds 35.");
if (unitDocuments.length !== 12) issues.push(`Expected 12 unit documents, found ${unitDocuments.length}.`);

for (const document of unitDocuments) {
  const partTypes = new Set(document.sections.map((section) => section.partType));
  for (const part of requiredParts) {
    if (!partTypes.has(part)) issues.push(`${document.title} missing ${part}.`);
  }
}

const lookupHeadwords = new Set(lookup.entries.map((entry) => entry.headword));
const missingLookup = course.vocabulary.filter((entry) => !lookupHeadwords.has(entry.headword)).map((entry) => entry.headword);
if (missingLookup.length) issues.push(`Scheduled words missing lookup entries: ${missingLookup.slice(0, 20).join(", ")}`);

const report = {
  ocrPages: Object.keys(pages).length,
  documents: course.documentCount,
  units: unitDocuments.length,
  scheduleDays: course.schedule.length,
  firstDate: course.schedule[0]?.date,
  examDate: course.schedule.at(-1)?.date,
  coreVocabulary: course.vocabulary.length,
  lookupEntries: lookup.entries.length,
  phrases: course.phrases.length,
  maxNewWordsPerDay: course.audit.maxNewWordsPerDay,
  issues,
};

console.log(JSON.stringify(report, null, 2));
if (issues.length) process.exitCode = 1;
