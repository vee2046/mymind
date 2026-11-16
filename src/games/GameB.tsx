// ABOUTME: 游戏 B「数口令」：数字瞬示记忆 + 反向广度 + 干扰
// ABOUTME: 自绘数字面板（0 系统键盘）；等待期提前按键有效（E-08）；答错重训降级

import { useEffect, useRef, useState } from 'react';
import { TopInfo } from '../components/ui';
import { playSoftChime, playSuccess } from '../lib/audio';
import {
  AUTO_SUBMIT_MS,
  B_DISTRACT_EMOJI,
  B_DISTRACT_LINES,
  B_LEVELS,
  B_MAX_LEVEL,
  FADE_OUT_MS,
  FEED_GOOD_MS,
  GAME_NAMES,
  SET_SIZE,
  TEXTS,
  UP_STREAK,
  genDigitString,
} from '../lib/constants';
import {
  clearProgress,
  loadFlags,
  loadLevelPool,
  saveFlags,
  saveLevelPool,
  saveProgress,
} from '../lib/storage';
import { speak, stopSpeak } from '../lib/tts';
import { clamp, pickOne, sample } from '../lib/utils';
import type { GameProps, LogDraft } from '../pages/Game';

type Phase = 'show' | 'fading' | 'wait' | 'answer' | 'good' | 'relearn';

interface GS {
  phase: Phase;
  level: number;
  streak: number;
  qIndex: number;
  score: number;
  seq: string; // 本题原始数字串
  qLevel: number; // 本题出题级别（答错后临时降级）
  input: string;
}

const KEY_LAYOUT: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

export default function GameB({ playId, resume, onFinish }: GameProps): React.JSX.Element {
  const resumeB = resume && resume.gameId === 'B' ? resume : null;
  const initial = loadLevelPool().B;

  const gsRef = useRef<GS>({
    phase: 'show',
    level: initial.level,
    streak: initial.streak,
    qIndex: resumeB?.qIndex ?? 0,
    score: resumeB?.score ?? 0,
    seq: '',
    qLevel: initial.level,
    input: '',
  });
  const [tick, setTick] = useState(0);
  const update = (patch: Partial<GS>): void => {
    gsRef.current = { ...gsRef.current, ...patch };
    setTick((t) => t + 1);
  };
  const gs = gsRef.current;

  const timerRef = useRef<number | null>(null);
  const autoSubmitRef = useRef<number | null>(null);
  const draftsRef = useRef<LogDraft[]>([]);
  const startedAtRef = useRef(resumeB?.startedAt ?? Date.now());
  const startLevelRef = useRef(initial.level);
  const usedSeqsRef = useRef<string[]>(resumeB?.usedSeqs ?? []);
  const bootedRef = useRef(false);
  // 视觉干扰按题固定（避免渲染期跳动）
  const distractorsRef = useRef<string[]>([]);

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const clearAutoSubmit = (): void => {
    if (autoSubmitRef.current !== null) {
      window.clearTimeout(autoSubmitRef.current);
      autoSubmitRef.current = null;
    }
  };

  const spec = (): { digits: number; reverse: boolean; showMs: number; waitMs: number; distract: 'none' | 'visual' | 'both' } =>
    B_LEVELS[gsRef.current.qLevel];

  const targetOf = (seq: string, reverse: boolean): string =>
    reverse ? seq.split('').reverse().join('') : seq;

  /** 生成一题并进入展示阶段 */
  const startQuestion = (lv: number): void => {
    clearTimer();
    clearAutoSubmit();
    const flags = loadFlags();
    // 同局 5 串互不重复；首题与上一局首题不重复
    const exclude = [...usedSeqsRef.current];
    if (gsRef.current.qIndex === 0 && flags.lastBFirst) exclude.push(flags.lastBFirst);
    const seq = genDigitString(B_LEVELS[lv].digits, exclude);
    usedSeqsRef.current = [...usedSeqsRef.current, seq];
    if (gsRef.current.qIndex === 0) {
      saveFlags({ ...flags, lastBFirst: seq });
    }
    // 生成本题视觉干扰（固定，不随渲染变化）
    distractorsRef.current = sample(B_DISTRACT_EMOJI, 3);
    update({ seq, qLevel: lv, input: '', phase: 'show' });
    speak(TEXTS.bBeforeShow);
    timerRef.current = window.setTimeout(() => {
      update({ phase: 'fading' });
      timerRef.current = window.setTimeout(() => {
        const s = spec();
        // 等待阶段：面板已可用（E-08 提前按键有效），干扰仅装饰
        update({ phase: 'wait' });
        if (s.distract === 'both') {
          speak(pickOne(B_DISTRACT_LINES), { volume: 0.4 }); // -6dB 语音干扰
        }
        timerRef.current = window.setTimeout(() => {
          update({ phase: 'answer' });
          const cur = spec();
          speak(cur.reverse ? TEXTS.bAskReverse : TEXTS.bAskOrder);
        }, s.waitMs);
      }, FADE_OUT_MS);
    }, B_LEVELS[lv].showMs);
  };

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    startQuestion(gsRef.current.level);
    return () => {
      clearTimer();
      clearAutoSubmit();
      stopSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 进度落盘 */
  useEffect(() => {
    saveProgress({
      gameId: 'B',
      level: gs.level,
      qIndex: gs.qIndex,
      score: gs.score,
      usedSeqs: usedSeqsRef.current,
      startedAt: startedAtRef.current,
    });
  }, [tick, gs.level, gs.qIndex, gs.score]);

  const persistPool = (level: number, streak: number): void => {
    const pool = loadLevelPool();
    saveLevelPool({ ...pool, B: { level, streak } });
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
    clearAutoSubmit();
    const { level, streak, score } = gsRef.current;
    const finalLevel = score <= 2 ? Math.max(1, level - 1) : level;
    persistPool(finalLevel, streak);
    clearProgress();
    onFinish(
      {
        playId,
        gameId: 'B',
        level: startLevelRef.current,
        correct: score,
        total: SET_SIZE,
        moves: -1,
        durationMs: Date.now() - startedAtRef.current,
      },
      draftsRef.current,
    );
  };

  /** 提交判定：全对计 1 分；部分对走重训但反馈温和 */
  const submit = (): void => {
    const { seq, qLevel, qIndex } = gsRef.current;
    if (gsRef.current.input.length < B_LEVELS[qLevel].digits) return;
    clearAutoSubmit();
    const s = B_LEVELS[qLevel];
    const target = targetOf(seq, s.reverse);
    const answer = gsRef.current.input;
    let aligned = 0;
    for (let i = 0; i < target.length; i++) {
      if (answer[i] === target[i]) aligned++;
    }
    const correct = answer === target;
    draftsRef.current.push({
      level: qLevel,
      seq: qIndex + 1,
      isCorrect: correct,
      answer,
      target,
      durationMs: s.showMs,
      inputMode: 'panel',
      movesCount: -1,
    });
    if (correct) {
      handleCorrect(s.digits);
    } else {
      handleWrong(aligned, seq, s.reverse);
    }
  };

  const handleCorrect = (digits: number): void => {
    playSuccess();
    speak(TEXTS.bPerfect(digits));
    const { level, streak, score } = gsRef.current;
    const newStreak = streak + 1;
    let newLevel = level;
    let finalStreak = newStreak;
    if (newStreak >= UP_STREAK) {
      newLevel = clamp(level + 1, 1, B_MAX_LEVEL);
      finalStreak = 0;
    }
    persistPool(newLevel, finalStreak);
    update({ level: newLevel, streak: finalStreak, score: score + 1, phase: 'good' });
    clearTimer();
    timerRef.current = window.setTimeout(() => nextQuestion(false), FEED_GOOD_MS + 600);
  };

  /** G-08：柔和音 →「再看一遍」→ 亮出正确数串（反向局也先亮原串）→ 下一题降级 */
  const handleWrong = (aligned: number, seq: string, reverse: boolean): void => {
    playSoftChime();
    const { level } = gsRef.current;
    persistPool(level, 0);
    update({ streak: 0, phase: 'relearn' });
    const feedback = aligned > 0 ? TEXTS.bPartial(aligned) : TEXTS.bMiss;
    const relearn = reverse
      ? TEXTS.bRelearnReverse(seq, targetOf(seq, true))
      : TEXTS.bRelearnOrder(seq);
    speak(`${feedback} ${relearn}`);
    clearTimer();
    timerRef.current = window.setTimeout(() => nextQuestion(true), 5200);
  };

  const onKey = (key: string): void => {
    const cur = gsRef.current;
    if (cur.phase !== 'wait' && cur.phase !== 'answer') return;
    const digits = B_LEVELS[cur.qLevel].digits;
    if (key === '⌫') {
      update({ input: cur.input.slice(0, -1) });
      clearAutoSubmit();
      return;
    }
    if (key === 'C') {
      update({ input: '' });
      clearAutoSubmit();
      return;
    }
    if (cur.input.length >= digits) return;
    const next = cur.input + key;
    update({ input: next });
    clearAutoSubmit();
    if (next.length >= digits) {
      // 输满后 800ms 无新键自动提交
      autoSubmitRef.current = window.setTimeout(() => submit(), AUTO_SUBMIT_MS);
    }
  };

  const s = spec();
  const digits = B_LEVELS[gs.qLevel].digits;
  const visualDistract = s.distract === 'visual' || s.distract === 'both';
  const panelVisible = gs.phase === 'wait' || gs.phase === 'answer';
  const canSubmit = gs.input.length >= digits && panelVisible;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pt-6 pb-[calc(120px+env(safe-area-inset-bottom))]">
      <TopInfo text={`${GAME_NAMES.B} · 第${gs.qIndex + 1}题/${SET_SIZE} · L${gs.level}`} />

      {/* 主舞台 */}
      <div className="relative mt-4 flex min-h-[30dvh] flex-1 items-center justify-center">
        {gs.phase === 'show' || gs.phase === 'fading' ? (
          <div
            className={`text-center font-bold tracking-[0.2em] text-[#3E342B] ${
              gs.phase === 'fading' ? 'bf-fade-out' : ''
            }`}
            style={{ fontSize: '4.5rem' }}
            aria-label={`数字 ${gs.seq.split('').join(' ')}`}
          >
            {gs.seq.split('').map((ch, i) => (
              <span
                key={`${gs.qIndex}-${i}`}
                className="bf-pop mx-1 inline-block"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {ch}
              </span>
            ))}
          </div>
        ) : null}

        {gs.phase === 'wait' ? (
          <div className="bf-fade-in relative flex h-full w-full items-center justify-center">
            <p className="text-[1.5rem] text-[#8A7D6E]">记稳了——</p>
            {/* 视觉干扰：淡色漂浮 emoji，绝不遮挡面板 */}
            {visualDistract
              ? distractorsRef.current.map((emoji, i) => (
                  <span
                    key={`${gs.qIndex}-d${i}`}
                    aria-hidden
                    className="bf-float absolute text-[2.5rem] opacity-30"
                    style={{
                      left: `${12 + i * 32}%`,
                      top: `${12 + (i % 2) * 30}%`,
                      animationDelay: `${i * 500}ms`,
                    }}
                  >
                    {emoji}
                  </span>
                ))
              : null}
          </div>
        ) : null}

        {gs.phase === 'answer' ? (
          <p className="bf-fade-in text-center text-[1.5rem] font-medium">
            {B_LEVELS[gs.qLevel].reverse ? '请反过来，倒着说一遍' : '请按顺序说出'}
          </p>
        ) : null}

        {gs.phase === 'good' ? (
          <div className="bf-pop flex flex-col items-center">
            <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[#5C8A5A] text-[4rem] text-white">
              ✓
            </div>
            <p className="mt-4 text-[1.75rem] font-semibold text-[#5C8A5A]">
              {TEXTS.bPerfect(digits)}
            </p>
          </div>
        ) : null}

        {gs.phase === 'relearn' ? (
          <div className="bf-fade-in flex flex-col items-center">
            <p className="rounded-full bg-white px-5 py-2 text-[1.375rem] text-[#8A7D6E] shadow-[0_2px_8px_rgb(62_52_43/0.08)]">
              {TEXTS.relearn}
            </p>
            <p className="mt-6 text-center font-bold tracking-[0.2em]" style={{ fontSize: '4.5rem' }}>
              {gs.seq.split('').join(' ')}
            </p>
            {B_LEVELS[gs.qLevel].reverse ? (
              <p className="mt-3 text-[1.5rem] text-[#8A7D6E]">
                反着说：{targetOf(gs.seq, true).split('').join(' ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 数字面板（等待期即可用，E-08） */}
      {panelVisible ? (
        <div className="bf-rise mt-2">
          <p className="mb-3 text-center text-[1.375rem] text-[#8A7D6E]">
            已输入 <span className="font-semibold text-[#3E342B]">{gs.input.length}</span>/{digits} 位
          </p>
          <div className="grid grid-cols-3 gap-3">
            {KEY_LAYOUT.map((key) => (
              <button
                key={key}
                type="button"
                aria-label={key === 'C' ? '清空' : key === '⌫' ? '退格' : `数字 ${key}`}
                onClick={() => onKey(key)}
                className="bf-press flex min-h-[72px] items-center justify-center rounded-2xl bg-white text-[2rem] font-semibold shadow-[0_4px_16px_rgb(62_52_43/0.08)]"
              >
                {key === 'C' ? <span className="text-[1.375rem]">清空</span> : key === '⌫' ? <span className="text-[1.375rem]">退格</span> : key}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => submit()}
            className={`bf-press mt-4 flex h-[88px] w-full items-center justify-center rounded-2xl text-[1.625rem] font-semibold shadow-[0_4px_16px_rgb(62_52_43/0.12)] ${
              canSubmit ? 'bg-[#C2703E] text-white' : 'bg-[#F3EDE3] text-[#8A7D6E] opacity-60'
            }`}
          >
            说完了
          </button>
        </div>
      ) : null}
    </div>
  );
}
