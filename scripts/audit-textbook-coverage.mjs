import { readFile } from "node:fs/promises";

const readJson = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8").then(JSON.parse);
const [course, offline, appendix, core, localReference, extra] = await Promise.all([
  readJson("public/data/english2/textbook_course.json"),
  readJson("app/study/offline-dictionary.json"),
  readJson("app/study/textbook-units/pdf-vocab-with-dict.json"),
  readJson("public/data/exam/vocabulary_candidates/textbook_english2_core.json"),
  readJson("public/data/exam/vocabulary_candidates/user_english2_1800.json"),
  readJson("app/study/local-extra-meanings.json"),
]);

const vocabulary = new Map(course.vocabulary.map((item) => [item.headword.toLowerCase(), item]));
const words = new Set();
const sentences = new Set();
for (const document of course.documents) {
  for (const sentence of document.englishSentences ?? []) {
    sentences.add(sentence);
    for (const word of sentence.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []) words.add(word);
  }
}

const appendixByWord = new Map(appendix.map((item) => [item.base.toLowerCase(), item]));
const coreByWord = new Map(core.words.map((item) => [item.headword.toLowerCase(), item]));
const referenceByWord = new Map(localReference.words.map((item) => [item.headword.toLowerCase(), item]));
const candidatesFor = (word) => {
  const candidates = [word];
  if (word.endsWith("'s")) candidates.push(word.slice(0, -2));
  if (word.endsWith("n't")) candidates.push(word.slice(0, -3));
  if (word.endsWith("'ll")) candidates.push(word.slice(0, -3));
  if (word.endsWith("'re")) candidates.push(word.slice(0, -3));
  if (word.endsWith("'d")) candidates.push(word.slice(0, -2));
  if (word.endsWith("ies")) candidates.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("ing")) candidates.push(word.slice(0, -3), `${word.slice(0, -3)}e`);
  if (word.endsWith("ed")) candidates.push(word.slice(0, -2), word.slice(0, -1));
  if (word.endsWith("s") && word.length > 3) candidates.push(word.slice(0, -1));
  return [...new Set(candidates)];
};
const missingLocalMeaning = [...words].filter((word) => {
  const courseItem = vocabulary.get(word);
  return !candidatesFor(word).some((candidate) => courseItem?.meaning || offline[candidate]?.translation || appendixByWord.get(candidate)?.translation || coreByWord.get(candidate)?.chineseMeanings?.length || referenceByWord.get(candidate)?.chineseMeanings?.length || extra[candidate]);
});
const suspicious = [...vocabulary.values()].filter((item) => /[户斤鍛ij訖蓹藞|]/.test(item.meaning));
const withoutExample = [...vocabulary.values()].filter((item) => !item.example);
const withoutFullTranslation = [...vocabulary.values()].filter((item) => item.example && !item.exampleTranslation);

const report = {
  documents: course.documents.length,
  englishSentences: sentences.size,
  uniqueTextWords: words.size,
  curriculumVocabulary: vocabulary.size,
  localOfflineDictionary: Object.keys(offline).length,
  textbookAppendixDictionary: appendix.length,
  textbookCoreDictionary: core.words.length,
  localReferenceDictionary: localReference.words.length,
  localExtraMeanings: Object.keys(extra).length,
  missingLocalMeaning: missingLocalMeaning.length,
  missingLocalMeaningSample: missingLocalMeaning.slice(0, 40),
  suspiciousCurriculumMeanings: suspicious.length,
  suspiciousMeaningSample: suspicious.slice(0, 40).map((item) => ({ word: item.headword, meaning: item.meaning })),
  vocabularyWithoutExample: withoutExample.length,
  vocabularyWithoutFullExampleTranslation: withoutFullTranslation.length,
  exampleTranslationSample: withoutFullTranslation.slice(0, 20).map((item) => ({ word: item.headword, example: item.example })),
};

console.log(JSON.stringify(report, null, 2));
if (suspicious.length || missingLocalMeaning.length) process.exitCode = 1;
