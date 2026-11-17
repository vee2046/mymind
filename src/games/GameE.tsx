// ABOUTME: 游戏 E「数字找家」：数轴估计（数字↔空间映射 / 数感 / 比例推理）
// ABOUTME: 先点线后确认（防误触）；容差判对；答错亮出小房子即时纠错，无负向文案

import { useEffect, useRef, useState } from 'react';
import { AudioToggles, GameHeader } from '../components/ui';
import { playSoftChime, playSuccess } from '../lib/audio';
import {
  E_LEVELS,
  E_MAX_LEVEL,
  FEED_GOOD_MS,
  GAME_NAMES,
  SET_SIZE,
  TEXTS,
  UP_STREAK,
  genETarget,
  type ELevelSpec,
} from '../lib/constants';
import {
  clearProgress,
  loadLevelPool,
  saveLevelPool,
  saveProgress,
} from '../lib/storage';
import { speak, stopSpeak } from '../lib/tts';
import { clamp } from '../lib/utils';
import type { GameProps, LogDraft } from '../pages/Game';

type Phase = 'play' | 'good' | 'reveal';

interface GS {
  phase: Phase;
  level: number;
  streak: number;
  qIndex: number;
  score: number;
  target: number; // 本题目标数
  qLevel: number; // 本题出题级别（答错后临时降级）
  placed: number | null; // 已点到但未确认的位置
  answer: number | null; // 已确认提交的位置
}

const REVEAL_MS = 5000; // 答错后展示正确位置时长

export default function GameE({ playId, resume, onFinish }: GameProps): React.JSX.Element {
  const resumeE = resume && resume.gameId === 'E' ? resume : null;
  const initial = loadLevelPool().E;

  const gsRef = useRef<GS>({
    phase: 'play',
    level: initial.level,
    streak: initial.streak,
    qIndex: resumeE?.qIndex ?? 0,
    score: resumeE?.score ?? 0,
    target: 0,
    qLevel: initial.level,
    placed: null,
    answer: null,
  });
  const [tick, setTick] = useState(0);
  const update = (patch: Partial<GS>): void => {
    gsRef.current = { ...gsRef.current, ...patch };
    setTick((t) => t + 1);
  };
  const gs = gsRef.current;

  const timerRef = useRef<number | null>(null);
  const draftsRef = useRef<LogDraft[]>([]);
  const startedAtRef = useRef(resumeE?.startedAt ?? Date.now());
  const startLevelRef = useRef(initial.level);
  const usedTargetsRef = useRef<number[]>(resumeE?.usedTargets ?? []);
  const qStartRef = useRef(Date.now()); // 本题开始时刻（计 durationMs）
  const trackRef = useRef<HTMLButtonElement | null>(null);
  const bootedRef = useRef(false);

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const spec = (): ELevelSpec => E_LEVELS[gsRef.current.qLevel];

  /** 生成一题并进入作答阶段 */
  const startQuestion = (lv: number): void => {
    clearTimer();
    const target = genETarget(lv, usedTargetsRef.current);
    usedTargetsRef.current = [...usedTargetsRef.current, target];
    qStartRef.current = Date.now();
    update({ target, qLevel: lv, placed: null, answer: null, phase: 'play' });
    speak(TEXTS.eAsk(target));
  };

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    startQuestion(gsRef.current.level);
    return () => {
      clearTimer();
      stopSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 进度落盘 */
  useEffect(() => {
    saveProgress({
      gameId: 'E',
      level: gs.level,
      qIndex: gs.qIndex,
      score: gs.score,
      usedTargets: usedTargetsRef.current,
      startedAt: startedAtRef.current,
    });
  }, [tick, gs.level, gs.qIndex, gs.score]);

  const persistPool = (level: number, streak: number): void => {
    const pool = loadLevelPool();
    saveLevelPool({ ...pool, E: { level, streak } });
  };

  const nextQuestion = (afterWrong: boolean): void => {
    const nextIdx = gsRef.current.qIndex + 1;
    if (nextIdx >= SET_SIZE) {
      finishSet();
      return;
    }
    update({ qIndex: nextIdx });
    const lv = afterWrong ? Math.max(1, gsRef.current.level - 1) : gsRef.current.level;
    startQuestion(lv);
  };

  const finishSet = (): void => {
    clearTimer();
    const { level, streak, score } = gsRef.current;
    const finalLevel = score <= 2 ? Math.max(1, level - 1) : level;
    persistPool(finalLevel, streak);
    clearProgress();
    onFinish(
      {
        playId,
        gameId: 'E',
        level: startLevelRef.current,
        correct: score,
        total: SET_SIZE,
        moves: -1,
        durationMs: Date.now() - startedAtRef.current,
      },
      draftsRef.current,
    );
  };

  /** 点线：记录暂定位置（可反复点调整，按「放好了」才提交） */
  const onTrackTap = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (gsRef.current.phase !== 'play') return;
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const s = spec();
    const value = Math.round(ratio * s.max);
    update({ placed: value });
  };

  /** 确认提交：容差判对 */
  const submit = (): void => {
    const cur = gsRef.current;
    if (cur.phase !== 'play' || cur.placed === null) return;
    clearTimer();
    const s = spec();
    const answer = cur.placed;
    const correct = Math.abs(answer - cur.target) <= s.tolerance;
    draftsRef.current.push({
      level: cur.qLevel,
      seq: cur.qIndex + 1,
      isCorrect: correct,
      answer: String(answer),
      target: String(cur.target),
      durationMs: Date.now() - qStartRef.current,
      inputMode: 'panel',
      movesCount: -1,
    });
    update({ answer, placed: null });
    if (correct) {
      handleCorrect();
    } else {
      handleWrong(answer, cur.target);
    }
  };

  const handleCorrect = (): void => {
    playSuccess();
    speak(TEXTS.eGood);
    const { level, streak, score } = gsRef.current;
    const newStreak = streak + 1;
    let newLevel = level;
    let finalStreak = newStreak;
    if (newStreak >= UP_STREAK) {
      newLevel = clamp(level + 1, 1, E_MAX_LEVEL);
      finalStreak = 0;
    }
    persistPool(newLevel, finalStreak);
    update({ level: newLevel, streak: finalStreak, score: score + 1, phase: 'good' });
    clearTimer();
    timerRef.current = window.setTimeout(() => nextQuestion(false), FEED_GOOD_MS + 600);
  };

  /** 柔和音 → 亮出小房子（正确位置）→ 下一题降级 */
  const handleWrong = (answer: number, target: number): void => {
    playSoftChime();
    const { level } = gsRef.current;
    persistPool(level, 0);
    update({ streak: 0, phase: 'reveal', answer });
    const err = Math.abs(answer - target);
    const feedback = err <= spec().tolerance * 2 ? TEXTS.eNear : TEXTS.eFar;
    speak(`${feedback} ${TEXTS.eReveal(target)}`);
    clearTimer();
    timerRef.current = window.setTimeout(() => nextQuestion(true), REVEAL_MS);
  };

  const s = spec();
  const pctOf = (v: number): number => (v / s.max) * 100;
  const housePct = pctOf(gs.target);
  const chipPct = gs.placed !== null ? pctOf(gs.placed) : null;
  const chipClamped = chipPct !== null ? Math.min(92, Math.max(8, chipPct)) : null;
  const houseClamped = Math.min(92, Math.max(8, housePct));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))]">
      <GameHeader text={`${GAME_NAMES.E} · 第${gs.qIndex + 1}题/${SET_SIZE} · L${gs.level}`} />
      <AudioToggles />

      {/* 目标数字卡 */}
      <div className="mt-4 flex flex-col items-center">
        <p className="text-[1.5rem] text-[#8A7D6E]">帮这个数字找家</p>
        <div className="bf-pop mt-3 flex items-center gap-3 rounded-3xl bg-white px-10 py-4 shadow-[0_4px_16px_rgb(62_52_43/0.08)]">
          <span aria-hidden className="text-[2.75rem]">🏠</span>
          <span className="font-bold text-[#3E342B]" style={{ fontSize: '4.5rem' }}>
            {gs.target}
          </span>
        </div>
        {gs.phase === 'play' ? (
          <p className="mt-3 text-[1.375rem] text-[#8A7D6E]">{TEXTS.eHow}</p>
        ) : null}
        {gs.phase === 'reveal' ? (
          <p className="bf-fade-in mt-3 rounded-full bg-white px-5 py-2 text-[1.5rem] font-medium text-[#3E342B] shadow-[0_2px_8px_rgb(62_52_43/0.08)]">
            {Math.abs((gs.answer ?? 0) - gs.target) <= s.tolerance * 2 ? TEXTS.eNear : TEXTS.eFar}
          </p>
        ) : null}
      </div>

      {/* 主舞台（good 反馈 / 数轴） */}
      <div className="mt-4 flex flex-1 flex-col justify-center">
        {gs.phase === 'good' ? (
          <div className="bf-pop mb-4 flex flex-col items-center">
            <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[#5C8A5A] text-[4rem] text-white">
              ✓
            </div>
            <p className="mt-4 text-[1.75rem] font-semibold text-[#5C8A5A]">{TEXTS.eGood}</p>
          </div>
        ) : null}

        {/* 数轴（整条都可点，≥64px 触达高度） */}
        <div className="px-1">
          <button
            ref={trackRef}
            type="button"
            aria-label="数轴，点一下选择位置"
            onPointerDown={onTrackTap}
            className="relative block h-[136px] w-full touch-manipulation"
          >
            {/* 轨道 */}
            <span
              aria-hidden
              className="absolute left-0 right-0 top-1/2 h-[10px] -translate-y-1/2 rounded-full bg-[#E4DACB]"
            />
            {/* 刻度短线 */}
            {s.ticks.map((t) => (
              <span
                key={t}
                aria-hidden
                className="absolute top-1/2 h-[24px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8A7D6E] opacity-40"
                style={{ left: `${pctOf(t)}%` }}
              />
            ))}
            {/* 我点的位置（数字小牌） */}
            {gs.placed !== null && chipClamped !== null ? (
              <span
                className="bf-pop absolute bottom-[calc(50%+16px)] -translate-x-1/2 rounded-2xl bg-[#C2703E] px-4 py-1 text-[1.75rem] font-bold text-white shadow-[0_4px_16px_rgb(62_52_43/0.16)]"
                style={{ left: `${chipClamped}%` }}
              >
                {gs.placed}
              </span>
            ) : null}
            {/* 小房子 = 正确位置 */}
            {gs.answer !== null ? (
              <span
                aria-hidden
                className="bf-pop absolute top-[calc(50%+12px)] -translate-x-1/2 text-[2.5rem]"
                style={{ left: `${houseClamped}%` }}
              >
                🏠
              </span>
            ) : null}
          </button>
          {/* 刻度数字行（纯展示） */}
          <div className="relative mt-1 h-[44px]">
            {s.ticks.map((t) => (
              <span
                key={t}
                aria-hidden
                className="absolute -translate-x-1/2 text-[1.5rem] font-medium text-[#8A7D6E]"
                style={{ left: `${pctOf(t)}%` }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 确认按钮（点过线才可用） */}
      {gs.phase === 'play' ? (
        <button
          type="button"
          disabled={gs.placed === null}
          onClick={() => submit()}
          className={`bf-press mt-2 flex h-[88px] w-full items-center justify-center rounded-2xl text-[1.625rem] font-semibold shadow-[0_4px_16px_rgb(62_52_43/0.12)] ${
            gs.placed !== null
              ? 'bg-[#C2703E] text-white'
              : 'bg-[#F3EDE3] text-[#8A7D6E] opacity-60'
          }`}
        >
          放好了
        </button>
      ) : null}
    </div>
  );
}
