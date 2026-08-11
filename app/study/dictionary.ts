import { lessons } from "./seed";
import localExtraMeaningData from "./local-extra-meanings.json";
import textbookLookupData from "../../public/data/english2/textbook_lookup.json";

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
  exampleTranslations?: string[];
  collocations?: string[];
  source: "course" | "offline" | "online" | "basic" | "fallback";
}

interface OfflineEntry { phonetic: string; definition: string; translation: string; lemma: string }
interface TextbookLookupEntry { headword: string; phonetic?: string; partOfSpeech?: string; meanings?: string[]; englishDefinitions?: string[]; examples?: string[]; exampleTranslations?: string[]; collocations?: string[] }
let bundledDictionaryPromise: Promise<Record<string, OfflineEntry>> | null = null;
const loadBundledDictionary = () => {
  bundledDictionaryPromise ??= import("./offline-dictionary.json").then((module) => module.default as Record<string, OfflineEntry>);
  return bundledDictionaryPromise;
};

const CACHE_KEY = "daily-english-dictionary-cache-v1";
const localExtraMeanings = localExtraMeaningData as Record<string, string>;
const textbookLookup = new Map((textbookLookupData as { entries: TextbookLookupEntry[] }).entries.map((entry) => [entry.headword.toLowerCase(), entry]));
const localExampleTranslations: Record<string, string> = {
  "i just carry myself and my tiny baggage.": "我只带着自己和一点点行李。",
  "please put your baggage in the trunk.": "请把你的行李放进后备箱。",
  "this person has got a lot of emotional baggage.": "这个人背负着很多情感负担。",
};
const API_ROOT = "";

const courseDictionary = new Map<string, DictionaryResult>();
for (const lesson of lessons) {
  for (const item of lesson.vocabulary) {
    const key = item.word.toLowerCase();
    if (!courseDictionary.has(key)) courseDictionary.set(key, {
      word: item.word, phonetic: item.phonetic, audio: "",
      meanings: [{ partOfSpeech: item.partOfSpeech, definition: item.meaning }],
      examples: item.example ? [item.example] : [],
      exampleTranslations: item.exampleTranslation ? [item.exampleTranslation] : [],
      source: "course",
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

const cleanExampleText = (example: string) => example
  .split(/\n(?:中文译文|中文提示|词义提示)：/)
  .at(0)
  ?.trim() ?? example.trim();

const chineseHintForExample = (example: string, word: string, meaning: string) => {
  if (!example || /[\u4e00-\u9fff]/.test(example)) return "";
  const translation = localExampleTranslations[example.trim().toLowerCase()];
  if (translation) return translation;
  if (!meaning) return "";
  return `教材原句理解：本句包含 “${word}”，核心义为“${meaning}”。`;
};

const mergeExamplePairs = (
  items: Array<{ example?: string; translation?: string }>,
  word: string,
  meaning: string,
  limit = 3,
) => {
  const examples: string[] = [];
  const translations: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const example = cleanExampleText(item.example ?? "");
    if (!example) continue;
    const key = example.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    examples.push(example);
    translations.push(item.translation?.trim() || chineseHintForExample(example, word, meaning));
    if (examples.length >= limit) break;
  }
  return { examples, exampleTranslations: translations };
};

const contextualExample = (context: string, word: string) => {
  const normalizedContext = context.toLowerCase().replace(/[’']/g, "'");
  return candidatesFor(normalizeWord(word)).some((candidate) => {
    if (!candidate) return false;
    return new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(normalizedContext);
  }) ? context : "";
};

const candidatesFor = (word: string) => {
  const values = [word];
  if (word.includes("-")) values.push(word.replace(/-/g, ""));
  if (word.endsWith("n't")) values.push(word.slice(0, -3));
  if (word.endsWith("'ll")) values.push(word.slice(0, -3));
  if (word.endsWith("'re")) values.push(word.slice(0, -3));
  if (word.endsWith("'d")) values.push(word.slice(0, -2));
  if (word.endsWith("'ve")) values.push(word.slice(0, -3));
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
    const merged = mergeExamplePairs([{ example: context }], word, entry.translation);
    return { word, phonetic: entry.phonetic ? `/${entry.phonetic.replace(/^\/+|\/+$/g, "")}/` : "", audio: "", meanings, ...merged, source: "offline" };
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
  void signal;
  const local = courseDictionary.get(word);
  const ocrLookup = candidatesFor(word).map((candidate) => textbookLookup.get(candidate)).find(Boolean);
  if (local) {
    const merged = mergeExamplePairs([
      { example: contextualExample(context, rawWord) },
      ...local.examples.map((example, index) => ({ example, translation: local.exampleTranslations?.[index] })),
      ...(ocrLookup?.examples ?? []).map((example, index) => ({ example, translation: ocrLookup.exampleTranslations?.[index] })),
    ], rawWord, local.meanings[0]?.definition ?? "");
    return {
      ...local,
      collocations: ocrLookup?.collocations?.slice(0, 8) ?? [],
      ...merged,
    };
  }
  if (ocrLookup) return {
    word: rawWord,
    phonetic: ocrLookup.phonetic || "",
    audio: "",
    meanings: [
      ...(ocrLookup.meanings ?? []).filter(Boolean).slice(0, 3).map((definition) => ({ partOfSpeech: ocrLookup.partOfSpeech || "OCR 教材词汇", definition })),
      ...(ocrLookup.englishDefinitions ?? []).filter(Boolean).slice(0, 2).map((definition) => ({ partOfSpeech: "英文释义", definition })),
    ].slice(0, 5),
    ...mergeExamplePairs([
      { example: contextualExample(context, rawWord) },
      ...(ocrLookup.examples ?? []).map((example, index) => ({ example, translation: ocrLookup.exampleTranslations?.[index] })),
    ], rawWord, ocrLookup.meanings?.[0] ?? ""),
    collocations: ocrLookup.collocations?.slice(0, 8) ?? [],
    source: "course",
  };
  if (localExtraMeanings[word]) return {
    word: rawWord,
    phonetic: "",
    audio: "",
    meanings: [{ partOfSpeech: "本地词典", definition: localExtraMeanings[word] }],
    ...mergeExamplePairs([{ example: contextualExample(context, rawWord) }], rawWord, localExtraMeanings[word]),
    source: "offline",
  };
  if (basicMeanings[word]) return { word, phonetic: "", audio: "", meanings: [{ partOfSpeech: "基础词", definition: basicMeanings[word] }], ...mergeExamplePairs([{ example: contextualExample(context, rawWord) }], rawWord, basicMeanings[word]), source: "basic" };
  const offline = await fromOffline(word, context);
  if (offline) return offline;
  const cache = loadCache()[word];
  if (cache && cache.source !== "online") {
    const merged = mergeExamplePairs([
      { example: contextualExample(context, rawWord) },
      ...cache.examples.map((example, index) => ({ example, translation: cache.exampleTranslations?.[index] })),
    ], rawWord, cache.meanings[0]?.definition ?? "");
    return { ...cache, ...merged };
  }

  if (false) for (const candidate of candidatesFor(word)) {
    try {
      const response = await fetch(`${API_ROOT}${encodeURIComponent(candidate)}`, { signal });
      if (!response.ok) continue;
      const result: DictionaryResult | null = fromApi(await response.json() as ApiEntry[], word);
      if (result !== null) {
        const merged = mergeExamplePairs([
          { example: contextualExample(context, rawWord) },
          ...result!.examples.map((example, index) => ({ example, translation: result!.exampleTranslations?.[index] })),
        ], rawWord, result!.meanings[0]?.definition ?? "");
        const withContext: DictionaryResult = { word: rawWord, phonetic: result!.phonetic, audio: result!.audio, meanings: result!.meanings, source: result!.source, ...merged };
        saveCache(word, withContext);
        return withContext;
      }
    } catch (error) {
      const isAbort = String((error as { name?: unknown })?.name ?? "") === "AbortError";
      if (isAbort) throw error;
    }
  }
  return { word: rawWord, phonetic: "", audio: "", meanings: [{ partOfSpeech: "上下文词义", definition: "本地词典暂未收录该词。请结合下方原句理解，之后可补充到离线词库。" }], ...mergeExamplePairs([{ example: contextualExample(context, rawWord) }], rawWord, ""), source: "fallback" };
}
