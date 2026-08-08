import { readFile } from "node:fs/promises";

const readJson = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8").then(JSON.parse);
const [course, offline, appendix] = await Promise.all([
  readJson("public/data/english2/textbook_course.json"),
  readJson("app/study/offline-dictionary.json"),
  readJson("app/study/textbook-units/pdf-vocab-with-dict.json"),
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
const missingLocalMeaning = [...words].filter((word) => {
  const courseItem = vocabulary.get(word);
  return !courseItem?.meaning && !offline[word]?.translation && !appendixByWord.get(word)?.translation;
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
