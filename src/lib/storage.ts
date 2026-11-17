// ABOUTME: localStorage 键值存取（bf_settings / bf_progress / bf_daily / bf_level_pool / bf_flags）
// ABOUTME: 全部读操作带类型兜底，写操作静默容错

import { aInitialShowMs, D_MAX_LEVEL, E_MAX_LEVEL, LEVEL_START } from './constants';
import type { Daily, Flags, LevelPool, Progress, Settings } from './types';
import { clamp, todayStr } from './utils';

const KEYS = {
  settings: 'bf_settings',
  progress: 'bf_progress',
  daily: 'bf_daily',
  levelPool: 'bf_level_pool',
  flags: 'bf_flags',
} as const;

function readJson<T>(key: string): Partial<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<T>;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // E-03：写失败静默（记录数据在 IndexedDB 处理配额）
  }
}

// ===== settings =====
export const DEFAULT_SETTINGS: Settings = {
  fontSize: 1,
  ttsOn: false,
  sfxOn: false,
  ttsRate: 1.0,
  lastGameId: null,
  onboarded: false,
  welcomed: false,
};

export function loadSettings(): Settings {
  const raw = readJson<Settings>(KEYS.settings);
  if (!raw) return { ...DEFAULT_SETTINGS };
  return {
    fontSize: raw.fontSize === 1.15 ? 1.15 : 1,
    // 语音/音效默认关闭：仅当显式存过 true 才开启
    ttsOn: raw.ttsOn === true,
    sfxOn: raw.sfxOn === true,
    ttsRate: clamp(typeof raw.ttsRate === 'number' ? raw.ttsRate : 1.0, 0.7, 1.3),
    lastGameId:
      raw.lastGameId === 'A' ||
      raw.lastGameId === 'B' ||
      raw.lastGameId === 'C' ||
      raw.lastGameId === 'D' ||
      raw.lastGameId === 'E'
        ? raw.lastGameId
        : null,
    onboarded: raw.onboarded === true,
    welcomed: raw.welcomed === true,
  };
}

export function saveSettings(s: Settings): void {
  writeJson(KEYS.settings, s);
}

// ===== daily（按日期自动重置） =====
export function loadDaily(): Daily {
  const today = todayStr();
  const raw = readJson<Daily>(KEYS.daily);
  if (!raw || raw.date !== today) {
    return { date: today, totalPlayMs: 0, sessionsDone: 0 };
  }
  return {
    date: today,
    totalPlayMs: Math.max(0, raw.totalPlayMs ?? 0),
    sessionsDone: Math.max(0, raw.sessionsDone ?? 0),
  };
}

export function saveDaily(d: Daily): void {
  writeJson(KEYS.daily, d);
}

// ===== level pool（跨局难度） =====
export function loadLevelPool(): LevelPool {
  const raw = readJson<LevelPool>(KEYS.levelPool);
  const lvA = clamp(raw?.A?.level ?? LEVEL_START, 1, 8);
  return {
    A: {
      level: lvA,
      showMs:
        typeof raw?.A?.showMs === 'number' && raw.A.showMs > 0
          ? raw.A.showMs
          : aInitialShowMs(lvA),
      streak: clamp(raw?.A?.streak ?? 0, 0, 3),
    },
    B: {
      level: clamp(raw?.B?.level ?? LEVEL_START, 1, 10),
      streak: clamp(raw?.B?.streak ?? 0, 0, 3),
    },
    C: { level: clamp(raw?.C?.level ?? 1, 1, 4) },
    D: {
      level: clamp(raw?.D?.level ?? LEVEL_START, 1, D_MAX_LEVEL),
      streak: clamp(raw?.D?.streak ?? 0, 0, 3),
    },
    E: {
      level: clamp(raw?.E?.level ?? LEVEL_START, 1, E_MAX_LEVEL),
      streak: clamp(raw?.E?.streak ?? 0, 0, 3),
    },
  };
}

export function saveLevelPool(p: LevelPool): void {
  writeJson(KEYS.levelPool, p);
}

// ===== progress（进行中局，仅当天有效） =====
export function loadProgress(): Progress | null {
  const raw = readJson<Progress & { startedAt: number }>(KEYS.progress);
  if (!raw || typeof raw.startedAt !== 'number') return null;
  // E-10：隔天丢弃（题号回 Q1 重开，级别由 level_pool 继承）
  const dayMs = 86_400_000;
  const sameDay =
    new Date(raw.startedAt).toDateString() === new Date().toDateString();
  if (!sameDay || Date.now() - raw.startedAt > dayMs) {
    clearProgress();
    return null;
  }
  const gid = raw.gameId;
  if (gid !== 'A' && gid !== 'B' && gid !== 'C' && gid !== 'D' && gid !== 'E')
    return null;
  return raw as Progress;
}

export function saveProgress(p: Progress): void {
  writeJson(KEYS.progress, p);
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(KEYS.progress);
  } catch {
    // 静默
  }
}

// ===== flags =====
export function loadFlags(): Flags {
  const raw = readJson<Flags>(KEYS.flags);
  return {
    p4ShownDate: typeof raw?.p4ShownDate === 'string' ? raw.p4ShownDate : null,
    weeklyHintWeek:
      typeof raw?.weeklyHintWeek === 'string' ? raw.weeklyHintWeek : null,
    storageTrimmed: raw?.storageTrimmed === true,
    lastBFirst: typeof raw?.lastBFirst === 'string' ? raw.lastBFirst : null,
  };
}

export function saveFlags(f: Flags): void {
  writeJson(KEYS.flags, f);
}

/** 清空全部业务数据，保留 settings（F-P5-07） */
export function clearAllData(): void {
  try {
    localStorage.removeItem(KEYS.progress);
    localStorage.removeItem(KEYS.daily);
    localStorage.removeItem(KEYS.levelPool);
    localStorage.removeItem(KEYS.flags);
  } catch {
    // 静默
  }
}
