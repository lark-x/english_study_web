import type { UnitData, WordDictionary } from "./types";

let _unitsCache: UnitData[] | null = null;
let _dictCache: WordDictionary | null = null;

export async function loadUnits(): Promise<UnitData[]> {
  if (_unitsCache) return _unitsCache;
  const res = await fetch("/data/modules/units.json");
  _unitsCache = await res.json();
  return _unitsCache!;
}

export async function loadWordDictionary(): Promise<WordDictionary> {
  if (_dictCache) return _dictCache;
  const res = await fetch("/data/modules/word-dictionary.json");
  _dictCache = await res.json();
  return _dictCache!;
}

export function lookupWord(word: string, dict: WordDictionary) {
  const key = word.toLowerCase().replace(/[^a-z\-']/g, "");
  return dict[key] || null;
}

export function clearCache() {
  _unitsCache = null;
  _dictCache = null;
}
