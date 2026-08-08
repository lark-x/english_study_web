import { lessons } from "./seed";

export interface DictionaryMeaning {
  partOfSpeech: string;
  definition: string;
}

export interface DictionaryResult {
  word: string;
  phonetic: string;
  audio: string;
  meanings: DictionaryMeaning[];
  examples: string[];
  source: "course" | "offline" | "online" | "basic" | "fallback";
}

interface OfflineEntry { phonetic: string; definition: string; translation: string; lemma: string }
interface TextbookAppendixEntry { headword: string; base: string; phonetic: string; translation: string; definition: string }
let bundledDictionaryPromise: Promise<Record<string, OfflineEntry>> | null = null;
const loadBundledDictionary = () => {
  bundledDictionaryPromise ??= import("./offline-dictionary.json").then((module) => module.default as Record<string, OfflineEntry>);
  return bundledDictionaryPromise;
};

const CACHE_KEY = "daily-english-dictionary-cache-v1";
const API_ROOT = "https://api.dictionaryapi.dev/api/v2/entries/en/";

const courseDictionary = new Map<string, DictionaryResult>();
for (const lesson of lessons) {
  for (const item of lesson.vocabulary) {
    const key = item.word.toLowerCase();
    if (!courseDictionary.has(key)) courseDictionary.set(key, {
      word: item.word, phonetic: item.phonetic, audio: "",
      meanings: [{ partOfSpeech: item.partOfSpeech, definition: item.meaning }],
      examples: [item.example], source: "course",
    });
  }
}

const basicMeanings: Record<string, string> = {
  a: "一个；一（用于单数可数名词前）", an: "一个；一（用于元音音素前）", the: "这；那；这些；那些（定冠词）",
  i: "我", you: "你；你们", he: "他", she: "她", it: "它；这件事", we: "我们", they: "他们；它们",
  me: "我（宾格）", him: "他（宾格）", her: "她；她的", us: "我们（宾格）", them: "他们（宾格）",
  my: "我的", your: "你的；你们的", his: "他的", its: "它的", our: "我们的", their: "他们的",
  this: "这；这个", that: "那；那个；引导从句", these: "这些", those: "那些", who: "谁；……的人", which: "哪一个；引导定语从句", what: "什么；……的事物",
  is: "是；处于", am: "是", are: "是；处于", was: "曾是；当时处于", were: "曾是；当时处于", be: "是；成为", been: "be 的过去分词", being: "be 的现在分词",
  have: "有；已经", has: "有；已经（第三人称单数）", had: "有过；已经（过去式）", do: "做；用于疑问或否定", does: "做；用于疑问或否定", did: "做了；用于过去时疑问或否定",
  can: "能够；可以", could: "能够；可能；较委婉地请求", may: "可能；可以", might: "可能", must: "必须；一定", should: "应该", would: "将会；愿意；用于假设", will: "将；愿意",
  and: "和；并且", or: "或者；否则", but: "但是", because: "因为", although: "尽管；虽然", if: "如果；是否", while: "当……时；然而", so: "所以；如此", however: "然而",
  in: "在……里面；在某段时间", on: "在……上面；在某日", at: "在某处；在某时刻", to: "到；向；用于不定式", from: "来自；从", for: "为了；持续", with: "和；带有；使用", by: "由；通过；在……之前", of: "……的", about: "关于；大约", as: "作为；像；当……时", before: "在……之前", after: "在……之后", between: "在……之间", without: "没有；不使用",
  not: "不；没有", no: "不；没有；无", yes: "是；对", more: "更多；更", less: "更少", most: "最多；大多数", very: "非常", also: "也", only: "只；仅", still: "仍然", often: "经常", usually: "通常", always: "总是", never: "从不",
  one: "一；一个", two: "二；两个", three: "三；三个", first: "第一；首先", second: "第二", another: "另一个", every: "每一个", each: "每个", some: "一些", many: "许多", much: "许多；非常", all: "全部", any: "任何；一些",
};

const normalizeWord = (word: string) => word.toLowerCase().replace(/[’']/g, "'").replace(/^'+|'+$/g, "").replace(/'s$/, "");

let textbookAppendixPromise: Promise<Map<string, TextbookAppendixEntry>> | null = null;
const loadTextbookAppendix = () => {
  textbookAppendixPromise ??= import("./textbook-units/pdf-vocab-with-dict.json").then((module) => {
    const dictionary = new Map<string, TextbookAppendixEntry>();
    for (const entry of module.default as TextbookAppendixEntry[]) {
      const key = entry.base.toLowerCase().trim();
      if (key && entry.translation) dictionary.set(key, entry);
    }
    return dictionary;
  });
  return textbookAppendixPromise;
};

const loadCache = (): Record<string, DictionaryResult> => {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}"); } catch { return {}; }
};

const saveCache = (word: string, result: DictionaryResult) => {
  if (typeof window === "undefined") return;
  try {
    const cache = loadCache();
    cache[word] = result;
    const entries = Object.entries(cache).slice(-300);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* Dictionary caching is optional. */ }
};

const addChineseHint = (example: string, word: string, meaning: string) => {
  if (!example || !meaning || /[\u4e00-\u9fff]/.test(example)) return example;
  return `${example}\n中文提示：“${word}”在本句中可理解为：${meaning}`;
};

const candidatesFor = (word: string) => {
  const values = [word];
  if (word.endsWith("ies") && word.length > 4) values.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("ing") && word.length > 5) values.push(word.slice(0, -3), `${word.slice(0, -3)}e`);
  if (word.endsWith("ed") && word.length > 4) values.push(word.slice(0, -2), `${word.slice(0, -1)}`);
  if (word.endsWith("es") && word.length > 4) values.push(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) values.push(word.slice(0, -1));
  return [...new Set(values)].slice(0, 4);
};

const fromOffline = async (word: string, context: string): Promise<DictionaryResult | null> => {
  const bundledDictionary = await loadBundledDictionary();
  for (const candidate of candidatesFor(word)) {
    const entry = bundledDictionary[candidate];
    if (!entry) continue;
    const meanings: DictionaryMeaning[] = [];
    if (entry.translation) meanings.push({ partOfSpeech: "中文释义", definition: entry.translation.replace(/\\n/g, "；") });
    if (entry.definition) meanings.push({ partOfSpeech: "英文释义", definition: entry.definition.replace(/\\n/g, "; ") });
    if (!meanings.length) continue;
    return { word, phonetic: entry.phonetic ? `/${entry.phonetic.replace(/^\/+|\/+$/g, "")}/` : "", audio: "", meanings, examples: context ? [addChineseHint(context, word, entry.translation)] : [], source: "offline" };
  }
  return null;
};

type ApiEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }>;
};

const fromApi = (entries: ApiEntry[], requestedWord: string): DictionaryResult | null => {
  const entry = entries[0];
  if (!entry) return null;
  const meanings = (entry.meanings ?? []).flatMap((meaning) => (meaning.definitions ?? []).slice(0, 2).map((definition) => ({ partOfSpeech: meaning.partOfSpeech ?? "", definition: definition.definition ?? "" }))).filter((item) => item.definition).slice(0, 5);
  const examples = (entry.meanings ?? []).flatMap((meaning) => (meaning.definitions ?? []).map((definition) => definition.example ?? "")).filter(Boolean).slice(0, 3);
  if (!meanings.length) return null;
  const phoneticItem = (entry.phonetics ?? []).find((item) => item.text) ?? (entry.phonetics ?? [])[0];
  const audioItem = (entry.phonetics ?? []).find((item) => item.audio);
  const audio = audioItem?.audio ? (audioItem.audio.startsWith("//") ? `https:${audioItem.audio}` : audioItem.audio) : "";
  return { word: entry.word ?? requestedWord, phonetic: entry.phonetic ?? phoneticItem?.text ?? "", audio, meanings, examples, source: "online" };
};

export async function lookupWord(rawWord: string, context = "", signal?: AbortSignal): Promise<DictionaryResult> {
  const word = normalizeWord(rawWord);
  const local = courseDictionary.get(word);
  if (local) return { ...local, examples: [...new Set([context, ...local.examples].filter(Boolean))].map((example) => addChineseHint(example, rawWord, local.meanings[0]?.definition ?? "")).slice(0, 3) };
  const textbookAppendixDictionary = await loadTextbookAppendix();
  const textbookEntry = candidatesFor(word).map((candidate) => textbookAppendixDictionary.get(candidate)).find(Boolean);
  if (textbookEntry) return {
    word: rawWord,
    phonetic: textbookEntry.phonetic || "",
    audio: "",
    meanings: [{ partOfSpeech: "教材词汇", definition: textbookEntry.translation }],
    examples: context ? [addChineseHint(context, rawWord, textbookEntry.translation)] : [],
    source: "course",
  };
  if (basicMeanings[word]) return { word, phonetic: "", audio: "", meanings: [{ partOfSpeech: "基础词", definition: basicMeanings[word] }], examples: context ? [context] : [], source: "basic" };
  const offline = await fromOffline(word, context);
  if (offline) return offline;
  const cache = loadCache()[word];
  if (cache) return { ...cache, examples: [...new Set([context, ...cache.examples].filter(Boolean))].slice(0, 3) };

  for (const candidate of candidatesFor(word)) {
    try {
      const response = await fetch(`${API_ROOT}${encodeURIComponent(candidate)}`, { signal });
      if (!response.ok) continue;
      const result = fromApi(await response.json() as ApiEntry[], word);
      if (result) {
        const withContext = { ...result, word: rawWord, examples: [...new Set([context, ...result.examples].filter(Boolean))].slice(0, 3) };
        saveCache(word, withContext);
        return withContext;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }
  return { word: rawWord, phonetic: "", audio: "", meanings: [{ partOfSpeech: "上下文词义", definition: "在线词典暂未返回释义。请结合下方原句理解，联网后可再次查询。" }], examples: context ? [context] : [], source: "fallback" };
}
