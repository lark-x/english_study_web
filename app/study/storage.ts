import { createInitialState, defaultScores } from "./seed";
import { localDate } from "./planner";
import type { Ability, AppState, Interest, Mistake, ReviewItem, StageId, StudyMode } from "./types";

const DB_NAME = "daily-english-db";
const STORE_NAME = "state";
const STATE_KEY = "main";
const FALLBACK_KEY = "daily-english-state-v5";
const V4_FALLBACK_KEY = "daily-english-state-v4";
const PREVIOUS_FALLBACK_KEY = "daily-english-state-v3";
const V2_FALLBACK_KEY = "daily-english-state-v2";
const LEGACY_KEY = "jiangxi-english-study-state-v1";

const remoteState = async (): Promise<AppState | null> => {
  if (typeof window === "undefined") return null;
  try {
    const response = await fetch("/api/state", { credentials: "include" });
    if (!response.ok) return null;
    const result = await response.json() as { payload?: unknown };
    return normalizeState(result.payload);
  } catch {
    return null;
  }
};

const saveRemoteState = async (state: AppState) => {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/state", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: state }),
    });
  } catch {
    // Offline use continues through IndexedDB.
  }
};

export const remoteLogin = async (password: string) => {
  const response = await fetch("/api/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) throw new Error("登录密码不正确");
};

export const remoteRequiresLogin = async () => {
  try {
    const response = await fetch("/api/state", { credentials: "include" });
    return response.status === 401;
  } catch {
    return false;
  }
};

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const readIndexedState = async () => {
  const db = await openDatabase();
  return new Promise<unknown>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const writeIndexedState = async (state: AppState) => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(state, STATE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const mergeById = <T extends { id: string }>(local: T[], remote: T[]) => {
  const merged = new Map(remote.map((item) => [item.id, item]));
  for (const item of local) if (!merged.has(item.id)) merged.set(item.id, item);
  return [...merged.values()];
};

const mergeStates = (local: AppState, remote: AppState): AppState => ({
  ...remote,
  profile: { ...local.profile, ...remote.profile },
  sessions: mergeById(local.sessions, remote.sessions),
  reviewItems: mergeById(local.reviewItems, remote.reviewItems),
  mistakes: mergeById(local.mistakes, remote.mistakes),
  attempts: [...new Map([...remote.attempts, ...local.attempts].map((item) => [`${item.questionId}-${item.answeredAt}`, item])).values()],
  savedExpressions: [...new Set([...remote.savedExpressions, ...local.savedExpressions])],
  dailyPlans: { ...local.dailyPlans, ...remote.dailyPlans },
  mastery: {
    ...local.mastery,
    ...remote.mastery,
    vocabulary: { ...local.mastery.vocabulary, ...remote.mastery.vocabulary },
    grammar: { ...local.mastery.grammar, ...remote.mastery.grammar },
    syllabusNodeProgress: { ...local.mastery.syllabusNodeProgress, ...remote.mastery.syllabusNodeProgress },
  },
});

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object";

const validState = (value: unknown): value is AppState => {
  if (!isObject(value)) return false;
  return value.schemaVersion === 5
    && isObject(value.profile)
    && isObject(value.mastery)
    && Array.isArray(value.sessions)
    && Array.isArray(value.reviewItems)
    && Array.isArray(value.attempts);
};

const mapMode = (mode: unknown): StudyMode => Number(mode) <= 45 ? 45 : Number(mode) <= 90 ? 90 : 150;

const mapInterest = (value: unknown): Interest => {
  const text = String(value);
  if (text.includes("职") || text.toLowerCase().includes("work")) return "职场沟通";
  if (text.includes("教") || text.toLowerCase().includes("education")) return "教育成长";
  if (text.includes("社") || text.toLowerCase().includes("community")) return "社会文化";
  if (text.includes("健") || text.toLowerCase().includes("health")) return "健康生活";
  if (text.includes("科") || text.toLowerCase().includes("technology")) return "科技常识";
  return "日常生活";
};

const mapAbility = (value: unknown): Ability => {
  if (value === "writing" || value === "translation") return "translationWriting";
  if (value === "reading" || value === "grammar") return value;
  return ["vocabulary", "pronunciation", "sentence", "translationWriting"].includes(String(value)) ? value as Ability : "reading";
};

const createMastery = (stageId: StageId = "stage-1"): AppState["mastery"] => createInitialState().mastery && {
  ...createInitialState().mastery,
  activeStageId: stageId,
  placementStageId: stageId,
  syllabusNodeProgress: {},
  contentVersion: "textbook-00015-2012-v1",
};

export const upgradeV4 = (value: unknown): AppState | null => {
  if (!isObject(value) || value.schemaVersion !== 4 || !isObject(value.profile) || !isObject(value.mastery)) return null;
  const initial = createInitialState();
  const old = value as unknown as Omit<AppState, "schemaVersion"> & { schemaVersion: 4 };
  return {
    ...initial,
    ...old,
    schemaVersion: 5,
    dailyPlans: {},
    mastery: {
      ...initial.mastery,
      ...old.mastery,
      syllabusNodeProgress: old.mastery.syllabusNodeProgress ?? {},
      contentVersion: "textbook-00015-2012-v1",
    },
  };
};

export const upgradeV3 = (value: unknown): AppState | null => {
  if (!isObject(value) || value.schemaVersion !== 3 || !isObject(value.profile)) return null;
  const initial = createInitialState();
  const profile = value.profile;
  const sessions = Array.isArray(value.sessions) ? value.sessions.map((entry) => {
    const session = isObject(entry) ? entry : {};
    return {
      ...session,
      mode: mapMode(session.mode),
      minutes: Number(session.minutes ?? session.mode) || 0,
    };
  }) : [];
  const attempts = Array.isArray(value.attempts) ? value.attempts.map((entry) => {
    const attempt = isObject(entry) ? entry : {};
    return { ...attempt, skill: mapAbility(attempt.skill) };
  }) : [];
  const dailyPlans = Object.fromEntries(Object.entries((value.dailyPlans ?? {}) as Record<string, Record<string, unknown>>).map(([date, plan]) => [
    date,
    {
      date,
      lessonId: String(plan.lessonId ?? "day-01"),
      mode: mapMode(plan.mode),
      stageId: "stage-1" as StageId,
      rhythm: "new" as const,
      reason: "由旧版计划迁移，保留原课程和时长记录。",
      isRemedial: false,
    },
  ]));
  return {
    ...initial,
    profile: {
      ...initial.profile,
      ...profile,
      weekdayMinutes: mapMode(profile.weekdayMinutes),
      weekendMinutes: mapMode(profile.weekendMinutes),
      interests: Array.isArray(profile.interests) ? [...new Set(profile.interests.map(mapInterest))] : initial.profile.interests,
      startingStageId: "stage-1",
    },
    assessment: {
      ...defaultScores,
      reading: Number((value.assessment as Record<string, unknown> | undefined)?.reading ?? defaultScores.reading),
      grammar: Number((value.assessment as Record<string, unknown> | undefined)?.grammar ?? defaultScores.grammar),
      translationWriting: Math.round((Number((value.assessment as Record<string, unknown> | undefined)?.translation ?? defaultScores.translationWriting) + Number((value.assessment as Record<string, unknown> | undefined)?.writing ?? defaultScores.translationWriting)) / 2),
    },
    attempts: attempts as AppState["attempts"],
    reviewItems: Array.isArray(value.reviewItems) ? value.reviewItems as AppState["reviewItems"] : [],
    mistakes: Array.isArray(value.mistakes) ? value.mistakes as AppState["mistakes"] : [],
    sessions: sessions as AppState["sessions"],
    dailyPlans,
    savedExpressions: Array.isArray(value.savedExpressions) ? value.savedExpressions as string[] : [],
    mastery: createMastery("stage-1"),
  };
};

export const upgradeV2 = (value: unknown): AppState | null => {
  if (!isObject(value) || value.schemaVersion !== 2 || !isObject(value.profile)) return null;
  return upgradeV3({ ...value, schemaVersion: 3 });
};

const migrateLegacy = (): AppState | null => {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return null;
  try {
    const legacy = JSON.parse(raw) as Record<string, unknown>;
    const state = createInitialState();
    const memory = Array.isArray(legacy.memory) ? legacy.memory : [];
    state.reviewItems = memory.slice(0, 50).map((item, index): ReviewItem => {
      const card = isObject(item) ? item : {};
      return {
        id: `legacy-card-${index}`,
        kind: "expression",
        front: String(card.front ?? card.term ?? card.word ?? "旧版收藏表达"),
        back: String(card.back ?? card.meaning ?? card.translation ?? "来自旧版数据"),
        sourceLessonId: "legacy",
        dueAt: localDate(),
        intervalDays: 1,
        repetitions: 0,
      };
    });
    const mistakes = Array.isArray(legacy.mistakes) ? legacy.mistakes : [];
    state.mistakes = mistakes.slice(0, 100).map((item, index): Mistake => {
      const old = isObject(item) ? item : {};
      return {
        id: `legacy-mistake-${index}`,
        questionId: `legacy-${index}`,
        lessonId: "legacy",
        prompt: String(old.prompt ?? old.question ?? "旧版错题"),
        chosen: String(old.chosen ?? old.answer ?? ""),
        answer: String(old.correctAnswer ?? old.correct ?? "请重新学习"),
        explanation: String(old.explanation ?? "从旧版数据迁移"),
        createdAt: localDate(),
      };
    });
    return state;
  } catch {
    return null;
  }
};

const readFallback = () => {
  for (const key of [FALLBACK_KEY, V4_FALLBACK_KEY, PREVIOUS_FALLBACK_KEY, V2_FALLBACK_KEY]) {
    const raw = localStorage.getItem(key);
    if (raw) return raw;
  }
  return null;
};

const normalizeState = (value: unknown): AppState | null => {
  if (validState(value)) {
    const state = value;
    return {
      ...state,
      mastery: {
        ...state.mastery,
        syllabusNodeProgress: state.mastery.syllabusNodeProgress ?? {},
        contentVersion: "textbook-00015-2012-v1",
      },
    };
  }
  return upgradeV4(value) ?? upgradeV3(value) ?? upgradeV2(value);
};

export const loadState = async (): Promise<AppState> => {
  const remote = await remoteState();
  if (remote) {
    try {
      const local = normalizeState(await readIndexedState());
      if (local) {
        const merged = mergeStates(local, remote);
        await writeIndexedState(merged);
        void saveRemoteState(merged);
        return merged;
      }
    } catch {
      // Use the remote state when local storage is unavailable.
    }
    await writeIndexedState(remote);
    return remote;
  }
  try {
    const state = normalizeState(await readIndexedState());
    if (state) {
      await saveState(state);
      return state;
    }
  } catch {
    const fallback = readFallback();
    if (fallback) {
      try {
        const state = normalizeState(JSON.parse(fallback));
        if (state) {
          await saveState(state);
          return state;
        }
      } catch { /* start safely below */ }
    }
  }
  const migrated = migrateLegacy();
  const initial = migrated ?? createInitialState();
  await saveState(initial);
  return initial;
};

export const saveState = async (state: AppState) => {
  try {
    await writeIndexedState(state);
  } catch {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(state));
  }
  void saveRemoteState(state);
};

export const exportState = (state: AppState) => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `daily-english-backup-v5-${localDate()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const importState = async (file: File) => {
  const parsed = JSON.parse(await file.text()) as unknown;
  const usable = normalizeState(parsed);
  if (!usable) throw new Error("备份文件格式不正确或版本不受支持。请使用本站导出的 JSON 文件。");
  await saveState(usable);
  return usable;
};
