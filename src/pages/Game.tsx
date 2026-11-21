// ABOUTME: P2 游戏容器：难度池读取、局结算（写日志/日累计/难度持久化）、P3/P4 跳转
// ABOUTME: 游戏流内跳转全部 replace，返回键任何时候直接回 P1

import { useEffect, useMemo } from 'react';
import { DAILY_LIMIT_MS, DAILY_LIMIT_SETS, type GameId } from '../lib/constants';
import { addLog } from '../lib/db';
import { navigate } from '../lib/router';
import {
  clearProgress,
  loadDaily,
  loadFlags,
  loadProgress,
  loadSettings,
  saveDaily,
  saveFlags,
  saveSettings,
} from '../lib/storage';
import type { Progress, SetSummary } from '../lib/types';
import { todayStr, uid } from '../lib/utils';
import GameA from '../games/GameA';
import GameB from '../games/GameB';
import GameC from '../games/GameC';
import GameD from '../games/GameD';
import GameE from '../games/GameE';

/** 单题日志草稿（游戏内生成，容器补齐公共字段） */
export interface LogDraft {
  level: number; // 该题实际级别
  seq: number;
  isCorrect: boolean;
  answer: string;
  target: string;
  durationMs: number;
  inputMode: 'panel' | 'voice';
  movesCount: number; // 仅 C 有效，其他 -1
}

export interface GameProps {
  playId: string;
  resume: Progress | null; // 已确保与当前游戏同 id
  onFinish: (summary: SetSummary, drafts: LogDraft[]) => void;
}

export default function Game({ id }: { id: GameId }): React.JSX.Element {
  const playId = useMemo(() => uid(), []);
  const progress = loadProgress();
  const resume = progress && progress.gameId === id ? progress : null;

  // 记录「最近玩这个游戏的时间」：首页游戏卡按此排序（进入即算，不要求玩完整局）
  useEffect(() => {
    const s = loadSettings();
    saveSettings({ ...s, lastGameId: id, lastPlayed: { ...s.lastPlayed, [id]: Date.now() } });
  }, [id]);

  const handleFinish = (summary: SetSummary, drafts: LogDraft[]): void => {
    const now = Date.now();
    const date = todayStr();
    // 1) 写 session_log（IndexedDB，含配额自整理）
    for (const d of drafts) {
      void addLog({
        playId: summary.playId,
        date,
        gameId: id,
        level: d.level,
        seq: d.seq,
        isCorrect: d.isCorrect,
        answer: d.answer,
        target: d.target,
        durationMs: d.durationMs,
        inputMode: d.inputMode,
        movesCount: d.movesCount,
        createdAt: now,
      });
    }
    // 2) 更新当日累计
    const daily = loadDaily();
    daily.sessionsDone += 1;
    daily.totalPlayMs += summary.durationMs;
    saveDaily(daily);
    // 3) 记录最近游戏
    const s = loadSettings();
    saveSettings({ ...s, lastGameId: id });
    // 4) 清进行中局
    clearProgress();
    // 5) F-P4-01：日上限触发 → 自动进 P4（同日仅一次）
    const flags = loadFlags();
    const hitLimit =
      daily.sessionsDone >= DAILY_LIMIT_SETS || daily.totalPlayMs >= DAILY_LIMIT_MS;
    if (hitLimit && flags.p4ShownDate !== date) {
      saveFlags({ ...flags, p4ShownDate: date });
      navigate('/daily-done', { replace: true });
      return;
    }
    navigate(`/end/${summary.playId}`, { replace: true });
  };

  return (
    <div className="min-h-dvh">
      {id === 'A' ? (
        <GameA playId={playId} resume={resume} onFinish={handleFinish} />
      ) : id === 'B' ? (
        <GameB playId={playId} resume={resume} onFinish={handleFinish} />
      ) : id === 'C' ? (
        <GameC playId={playId} resume={resume} onFinish={handleFinish} />
      ) : id === 'D' ? (
        <GameD playId={playId} resume={resume} onFinish={handleFinish} />
      ) : (
        <GameE playId={playId} resume={resume} onFinish={handleFinish} />
      )}
    </div>
  );
}
