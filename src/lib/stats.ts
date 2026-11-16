// ABOUTME: session_log 聚合统计（weekly_stat 实时聚合，不落表）
// ABOUTME: P1「本周玩了 x 天」、P4 成就句、P5 三游戏打卡块的数据源

import type { GameId } from './constants';
import type { SessionLog } from './types';
import { dateStrOf, daysAgoStr, todayStr } from './utils';

/** 一局聚合视图（按 playId） */
export interface PlayAgg {
  playId: string;
  gameId: GameId;
  date: string;
  level: number;
  correct: number; // A/B 答对数
  total: number; // A/B 题数
  moves: number; // C 步数
  createdAt: number; // 局结束时间（取最大）
}

export function aggregatePlays(logs: SessionLog[]): PlayAgg[] {
  const map = new Map<string, PlayAgg>();
  for (const log of logs) {
    const correctInc = log.gameId === 'C' ? 0 : log.isCorrect ? 1 : 0;
    const totalInc = log.gameId === 'C' ? 0 : 1;
    const prev = map.get(log.playId);
    if (!prev) {
      map.set(log.playId, {
        playId: log.playId,
        gameId: log.gameId,
        date: log.date,
        level: log.level,
        correct: correctInc,
        total: totalInc,
        moves: log.gameId === 'C' ? Math.max(0, log.movesCount) : -1,
        createdAt: log.createdAt,
      });
    } else {
      prev.correct += correctInc;
      prev.total += totalInc;
      if (log.createdAt > prev.createdAt) prev.createdAt = log.createdAt;
      if (log.gameId === 'C' && log.movesCount >= 0) prev.moves = log.movesCount;
    }
  }
  return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
}

/** 近 days 天内有 ≥1 局记录的独立日数 */
export function playedDaysWithin(plays: PlayAgg[], days: number): number {
  const cutoff = new Set<string>();
  for (let i = 0; i < days; i++) cutoff.add(daysAgoStr(i));
  const hit = new Set<string>();
  for (const p of plays) {
    if (cutoff.has(p.date)) hit.add(p.date);
  }
  return hit.size;
}

export interface GameWeekStat {
  plays: number; // 本周局数
  best: number | null; // A/B 单局最高答对数；C 单局最少步数
}

/** C 步数越少越好，其余越多越好 */
function isBetter(gameId: GameId, a: number, b: number): boolean {
  return gameId === 'C' ? a < b : a > b;
}

function bestOf(plays: PlayAgg[], gameId: GameId, dayOffsets: number[]): number | null {
  const cutoff = new Set(dayOffsets.map((i) => daysAgoStr(i)));
  let best: number | null = null;
  for (const p of plays) {
    if (p.gameId !== gameId || !cutoff.has(p.date)) continue;
    const v = p.gameId === 'C' ? p.moves : p.correct;
    if (v < 0) continue;
    if (best === null || isBetter(gameId, v, best)) best = v;
  }
  return best;
}

/** 本周（近 7 天滚动窗口）某游戏统计 */
export function weekGameStat(plays: PlayAgg[], gameId: GameId): GameWeekStat {
  const offsets = [0, 1, 2, 3, 4, 5, 6];
  const cutoff = new Set(offsets.map((i) => daysAgoStr(i)));
  const count = plays.filter((p) => p.gameId === gameId && cutoff.has(p.date)).length;
  return { plays: count, best: bestOf(plays, gameId, offsets) };
}

/** 上周（前 7~14 天）某游戏最好指标 */
export function prevWeekBest(plays: PlayAgg[], gameId: GameId): number | null {
  return bestOf(plays, gameId, [7, 8, 9, 10, 11, 12, 13]);
}

export type ArrowDir = 'up' | 'flat' | 'down' | 'none';

/** 三态箭头（F-P5-02）：本周 best 对比上周 best */
export function arrowOf(gameId: GameId, week: GameWeekStat, prevBest: number | null): ArrowDir {
  if (week.best === null) return 'none';
  if (prevBest === null) return 'flat';
  if (week.best === prevBest) return 'flat';
  return isBetter(gameId, week.best, prevBest) ? 'up' : 'down';
}

/** 是否连续两周下滑（P5 温和文案触发） */
export function twoWeekDown(plays: PlayAgg[], gameId: GameId): boolean {
  const thisBest = weekGameStat(plays, gameId).best;
  const prev = prevWeekBest(plays, gameId);
  if (thisBest === null || prev === null) return false;
  if (thisBest === prev || isBetter(gameId, thisBest, prev)) return false;
  const older = bestOf(plays, gameId, [14, 15, 16, 17, 18, 19, 20]);
  if (older === null) return false;
  return prev !== older && !isBetter(gameId, prev, older);
}

function dayBest(plays: PlayAgg[], gameId: GameId, date: string): number | null {
  let best: number | null = null;
  for (const p of plays) {
    if (p.gameId !== gameId || p.date !== date) continue;
    const v = p.gameId === 'C' ? p.moves : p.correct;
    if (v < 0) continue;
    if (best === null || isBetter(gameId, v, best)) best = v;
  }
  return best;
}

/** 今日某游戏最好指标（P4 成就句用） */
export function todayBest(plays: PlayAgg[], gameId: GameId): number | null {
  return dayBest(plays, gameId, todayStr());
}

/** 昨日某游戏最好指标 */
export function yesterdayBest(plays: PlayAgg[], gameId: GameId): number | null {
  return dayBest(plays, gameId, dateStrOf(Date.now() - 86_400_000));
}

/** 今日玩过的游戏列表 */
export function todayGames(plays: PlayAgg[]): GameId[] {
  const today = todayStr();
  const set = new Set<GameId>();
  for (const p of plays) {
    if (p.date === today) set.add(p.gameId);
  }
  return [...set];
}

/** 数口令今日记住的最大位数（P4 成就句"今天稳稳记住 n 位数"） */
export function bMaxDigits(logs: SessionLog[]): { today: number | null; yesterday: number | null } {
  const today = todayStr();
  const yesterday = dateStrOf(Date.now() - 86_400_000);
  let t: number | null = null;
  let y: number | null = null;
  for (const log of logs) {
    if (log.gameId !== 'B' || !log.isCorrect) continue;
    const n = log.target.length;
    if (log.date === today && (t === null || n > t)) t = n;
    if (log.date === yesterday && (y === null || n > y)) y = n;
  }
  return { today: t, yesterday: y };
}

/** P3 鼓励语（按成绩从池中随机取一；游戏 C 固定句式） */
export function pickEncouragement(gameId: GameId, correct: number, moves: number): string {
  if (gameId === 'C') return `全部找到啦，用了 ${moves} 次。`;
  const pool =
    correct >= 5
      ? ['全对登场，稳如泰山。', '5 题回合全对，漂亮的节奏。']
      : correct === 4
        ? ['4 题稳稳答对，很不错的成绩。']
        : correct === 3
          ? ['3 题都稳住了，继续保持。']
          : correct === 2
            ? ['2 题都稳住了，剩下的我们慢慢来。']
            : ['不着急，我们慢慢来，明天会更稳。'];
  return pool[Math.floor(Math.random() * pool.length)];
}
