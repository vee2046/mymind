// ABOUTME: 全局类型定义（PRD §10 存储结构）
// ABOUTME: 对应 localStorage 键与 IndexedDB 表

import type { DItem, DRuleKind, GameId } from './constants';

/** bf_settings：保留在清空数据之后 */
export interface Settings {
  fontSize: 1 | 1.15;
  ttsOn: boolean; // 语音播报，默认关闭
  sfxOn: boolean; // 音效（WebAudio 合成音），默认关闭
  ttsRate: number; // 0.7–1.3
  lastGameId: GameId | null;
  onboarded: boolean; // 添加到主屏引导卡已关闭
  welcomed: boolean; // 本次会话是否已播欢迎语（运行期覆盖）
}

/** bf_daily：当日累计，按日期自动重置 */
export interface Daily {
  date: string; // YYYY-MM-DD
  totalPlayMs: number;
  sessionsDone: number;
}

/** bf_level_pool：跨局难度（含 A 连续量与连对计数） */
export interface LevelPool {
  A: { level: number; showMs: number; streak: number };
  B: { level: number; streak: number };
  C: { level: number };
  D: { level: number; streak: number };
}

/** bf_flags */
export interface Flags {
  p4ShownDate: string | null; // 今日 P4 已自动弹出
  weeklyHintWeek: string | null; // 本周周末提示已显示（ISO 周标识）
  storageTrimmed: boolean; // 记录较满已自动整理
  lastBFirst: string | null; // 上一局数口令首题数字串（跨局去重）
}

/** bf_progress：进行中局（仅当天有效） */
export interface ProgressA {
  gameId: 'A';
  level: number;
  qIndex: number;
  score: number;
  lastCenter: string | null; // 相邻两题中央不重复
  usedSeqKey: string; // 本局已出题标识
  startedAt: number;
}

export interface ProgressB {
  gameId: 'B';
  level: number;
  qIndex: number;
  score: number;
  usedSeqs: string[];
  startedAt: number;
}

export interface CCardState {
  deck: string[]; // 牌面（长度 = pairs*2，已洗牌）
  matchedIdx: number[]; // 已消隐的卡下标
}

export interface ProgressC {
  gameId: 'C';
  level: number;
  moves: number;
  cardState: CCardState;
  firstFlipHintDone: boolean;
  startedAt: number;
}

/** 游戏 D「赶集」：老板给的一条规矩 */
export interface DRule {
  kind: DRuleKind;
  icon: string;
  say: string; // 完整说法（展示 + 播报）
  short: string; // 简版说法（窄条展示）
  cats: string[]; // 涉及的类目
  attr: string | null; // 涉及的属性
  exclude: string[]; // 例外商品的名称
}

/** 一局的出题计划（第几题是算账题 / 是否改口） */
export interface DRoundPlan {
  kind: 'pick' | 'sum';
  switch: boolean;
}

/** 挑货题 */
export interface DPickRound {
  kind: 'pick';
  rule: DRule;
  nextRule: DRule | null; // 改口后的新规矩
  items: DItem[];
}

/** 算账题 */
export interface DSumRound {
  kind: 'sum';
  rule: DRule;
  items: DItem[];
  answer: number;
  options: number[];
}

export type DRound = DPickRound | DSumRound;

export interface ProgressD {
  gameId: 'D';
  level: number;
  qIndex: number;
  score: number;
  plan: DRoundPlan[]; // 本局 5 题的出题计划
  startedAt: number;
}

export type Progress = ProgressA | ProgressB | ProgressC | ProgressD;

/** IndexedDB session_log 行（PRD §10） */
export interface SessionLog {
  id?: number;
  playId: string;
  date: string; // YYYY-MM-DD
  gameId: GameId;
  level: number;
  seq: number; // 题号 1..5；游戏 C 固定 1
  isCorrect: boolean; // 游戏 C 无对错概念，恒 true
  answer: string;
  target: string;
  durationMs: number;
  inputMode: 'panel' | 'voice';
  movesCount: number; // 仅 C 有效，其他 -1
  createdAt: number;
}

/** 一局结束后的汇总（写日志 + 跳 P3/P4 用） */
export interface SetSummary {
  playId: string;
  gameId: GameId;
  level: number; // 本局起始级别
  correct: number; // A/B 答对题数；C 为 -1
  total: number; // A/B = SET_SIZE；C 为 -1
  moves: number; // C 步数；A/B 为 -1
  durationMs: number;
}
