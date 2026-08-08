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
const coreVocabulary = JSON.parse(await readFile(path.join(projectRoot, "public", "data", "exam", "vocabulary_candidates", "textbook_english2_core.json"), "utf8")).words;
const coreByHeadword = new Map(coreVocabulary.map((entry) => [String(entry.headword).toLowerCase(), entry]));
const referenceVocabulary = JSON.parse(await readFile(path.join(projectRoot, "public", "data", "exam", "vocabulary_candidates", "user_english2_1800.json"), "utf8")).words;
const referenceByHeadword = new Map(referenceVocabulary.map((entry) => [String(entry.headword).toLowerCase(), entry]));

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
  spot: "地点；场所；斑点；发现；认出",
  consequently: "因此；所以；结果",
};
const curatedExampleTranslations = {
  content: "他想让它们感到满足。",
  baggage: "我只带着自己和一点点行李。",
  goodwill: "你的微笑是你善意的使者。",
  identify: "这意味着你必须仔细阅读，以便识别出任何假设。",
  current: "英语在他们目前的工作中。",
  dramatically: "在过去几十年里，科技使我们的世界发生了巨大的变化。",
  command: "我们可以在不使用语言的情况下，有意识地让命令得到执行。",
  infinite: "它限制了我们无限的能力，扼杀了创造力。",
  mess: "但辛迪并没有在想那片混乱。",
  tiny: "我只带着自己和一点点行李。",
  valuable: "在商业领域，一项有价值的技能是如何进行谈判。",
  gently: "‘亲爱的，’辛迪的父亲温柔地插话说，‘看看桌子。’",
  silently: "有几分钟，辛迪和她父亲默默地站着，谁也不知道该说什么。",
  moist: "最后她抬头看着他，双眼湿润而发红。",
  indeed: "但这确实就是答案。",
  thought: "语言是思想的外衣。",
  desert: "当其他所有朋友都离开时，它仍然陪伴着他。",
  poverty: "一个人的狗会在他富足和贫困、健康和生病时始终陪伴着他。",
  sickness: "一个人的狗会在他富足和贫困、健康和生病时始终陪伴着他。",
  unique: "网络公司要研究如何建立属于自己的独特网络形象。",
  can: "请给你的朋友一些建议，告诉他们可以在哪里度假。",
  various: "人们换工作往往相当频繁，原因各不相同。",
  mentally: "到了下午晚些时候，我的身体、精神和情绪都恢复了活力。",
  desperation: "正是绝望使作者的朋友们向他寻求建议。",
  value: "不要只接受字面上所写的内容。",
  imagine: "想象生活是一场游戏，你要在空中同时抛接五个球。",
  "life-threatening": "危及生命的疾病并不意味着要放弃。",
  financially: "如果你相信这些想法，你怎么期望在经济上取得成功呢？",
  available: "了解他们可以选择的不同方案，是这个过程的第一步。",
  abundance: "富足思维会对你的生活方式产生负面影响。",
  hit: "这就是为什么狗会如此受欢迎。",
  perspective: "它们可以帮助你换个角度看问题，也能给你带来启发。",
  tough: "狗在遇到艰难困境时会退缩。",
  contented: "他总是说，满足的奶牛才能产出好牛奶。",
  command: "我们可以在不使用语言的情况下，有意识地让命令得到执行。",
  tiny: "我只带着自己和一点点行李。",
  thought: "语言是思想的外衣。",
  mentally: "到了下午晚些时候，我的身体、精神和情绪都恢复了活力。",
  current: "英语在他们目前的工作中。",
  aid: "联邦学生资助申请。",
  majestically: "他痛苦地走着，却依然威严地走到自己的椅子旁。",
  reverently: "他们恭敬而安静地站着，而他解开腿上的扣子。",
  outburst: "礼堂的每个角落都爆发出异常热烈的掌声。",
  transport: "乘坐公共交通有助于保护环境。",
  determine: "确定市场是否有空间容纳你的企业。",
  consume: "医生：你不应该摄入过多的糖。",
  spa: "水疗中心通常是提供治疗性浴池或拥有矿泉的度假区。",
  emotionally: "到了下午晚些时候，我的身体、精神和情绪都恢复了活力。"
};

const additionalCuratedExampleTranslations = {
  grip: "他故意松开了对瓶子的紧握。",
  tender: "任何习惯的形成都始于年幼的时候。",
  akin: "朋友之间的忠诚，就像在银行账户里存了一笔钱。",
  seek: "从本质上说，水确实会寻找自己的水平面。",
  blessing: "工作是一种祝福。",
  career: "他对自己事业的独特忠诚。",
  deliberately: "他故意松开了对瓶子的紧握。",
  precisely: "但恰恰是自己最不了解自己。",
  characteristic: "在互联网上形成的恋情遵循一种典型的模式。",
  motivational: "尼克是一位真正具有启发性和激励性的演讲者。",
  profound: "在过去二十年里，互联网对社会产生了深远的影响。",
  recall: "回忆并描述你的父母如何分配零花钱，以及你如何花掉这些钱。",
  cinch: "但是一步一步来，生活可以变得轻而易举。",
  household: "你经常帮助父母做家务吗？",
  variety: "多样性是生活的调味品，而在涉及工作日时更是如此。",
  romance: "网络恋情与现实生活中的恋情有什么不同？",
  literary: "汉弗莱·戴维爵士不仅是一位优秀的文学评论家，也是一位伟大的科学家。",
  vary: "网络恋情与现实生活中的恋情有什么不同？",
  demon: "当我们决定如何面对网络带来的挑战时，把网络看成恶魔是很荒谬的。",
  tremendous: "在这方面，互联网的好处是巨大的。"
  ,evidence: "社交网络的使用证明了互联网的益处。",
  celeb: "Celeb 是 celebrity（名人）一词的缩写。",
  ultimately: "归根结底，你必须对自己感到满意。"
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
const vocabularySourceSentences = [];
for (const [index, unit] of includedUnits.entries()) {
  const raw = await readFile(path.join(sourceRoot, unit.file), "utf8");
  const englishSentences = extractEnglishSentences(raw);
  vocabularySourceSentences.push(...extractEnglishSentences(raw, 500));
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

const allSentences = [...new Set([...documents.flatMap((document) => document.englishSentences), ...vocabularySourceSentences])];
const vocabulary = extractedVocabulary
  .filter((entry) => /^[a-z][a-z'-]*$/i.test(entry.headword ?? "") && /[\u4e00-\u9fff]/.test(entry.meaning ?? ""))
  .filter((entry, index, list) => list.findIndex((candidate) => candidate.headword.toLowerCase() === entry.headword.toLowerCase()) === index)
  .map((entry, index) => {
    const headword = entry.headword.toLowerCase();
    const appendixEntry = appendixByBase.get(headword);
    const coreEntry = coreByHeadword.get(headword);
    const referenceEntry = referenceByHeadword.get(headword);
    const pattern = new RegExp(`\\b${headword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const coreExample = coreEntry?.exampleSentences?.[0] ?? "";
    const coreEnglishExample = coreExample.split(/[\u4e00-\u9fff]/)[0].trim().replace(/[。；，、,;]+$/, "");
    const coreChineseExample = coreExample.match(/[\u4e00-\u9fff].*$/)?.[0]?.replace(/[（(].*$/, "") || "";
    const referenceExample = referenceEntry?.exampleSentences?.[0] ?? "";
    const referenceEnglishExample = referenceExample.split(/[\u4e00-\u9fff]/)[0].trim().replace(/[。；，、,;]+$/, "");
    const referenceChineseExample = referenceExample.match(/[\u4e00-\u9fff].*$/)?.[0]?.replace(/[（(].*$/, "") || "";
    return {
      headword,
      phonetic: entry.phonetic || "发音待核对",
      partOfSpeech: entry.partOfSpeech || "词性待核对",
      meaning: curatedMeanings[headword] || cleanMeaning(appendixEntry?.translation || entry.meaning),
      example: allSentences.find((sentence) => pattern.test(sentence)) || coreEnglishExample || referenceEnglishExample,
      exampleTranslation: { ...curatedExampleTranslations, ...additionalCuratedExampleTranslations }[headword] || coreChineseExample || referenceChineseExample,
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
