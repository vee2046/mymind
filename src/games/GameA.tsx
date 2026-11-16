// ABOUTME: 游戏 A「找一找」：UFOV 视觉加工速度训练，两步作答（中央动物 + 外周方向）
// ABOUTME: 时长微调（×0.85/×1.2）+ 级别爬升双维自适应；答错重演重训；无红色无倒计时

import { useEffect, useRef, useState } from 'react';
import { TopInfo } from '../components/ui';
import { playSoftChime, playSuccess } from '../lib/audio';
import {
  A_CENTER_NAMES,
  A_CENTER_POOL,
  A_LEVELS,
  A_MAX_LEVEL,
  A_PERIPHERAL_NAMES,
  A_PERIPHERAL_POOL,
  DIRECTIONS,
  FADE_OUT_MS,
  FEED_GOOD_MS,
  GAME_NAMES,
  IDLE_HINT_MS,
  SET_SIZE,
  TEXTS,
  UP_STREAK,
  aInitialShowMs,
  aShowMsFloor,
} from '../lib/constants';
import { clearProgress, loadLevelPool, saveLevelPool, saveProgress } from '../lib/storage';
import { speak, stopSpeak } from '../lib/tts';
import { clamp, pickOne, sample, shuffle } from '../lib/utils';
import type { GameProps, LogDraft } from '../pages/Game';

type Phase = 'show' | 'fading' | 'mask' | 'askCenter' | 'askDir' | 'good' | 'relearn';

interface Distractor {
  emoji: string;
  dirKey: string;
}

interface QuestionA {
  center: string;
  peripheral: string;
  dirKey: string;
  distractors: Distractor[];
  options: string[];
  showMs: number;
  maskMs: number;
  ringRatio: number;
  level: number; // 本题实际出题级别（答错后临时降级）
}

interface GS {
  phase: Phase;
  level: number;
  showMs: number;
  streak: number;
  qIndex: number;
  score: number;
  question: QuestionA | null;
  pickedCenter: string | null;
}

/** 8 方向按钮盘 3×3（中间留空） */
const DIR_GRID: (string | null)[] = [
  'top-left', 'top', 'top-right',
  'left', null, 'right',
  'bottom-left', 'bottom', 'bottom-right',
];

function dirLabel(key: string): string {
  return DIRECTIONS.find((d) => d.key === key)?.label ?? key;
}

/** 方位名词（TTS/无障碍朗读用）：上→上方、右上→右上角 */
function dirWord(key: string): string {
  return DIRECTIONS.find((d) => d.key === key)?.word ?? key;
}

/** 外周目标位置：极角转直角坐标（% 相对舞台，对角向内收 0.72 防出屏） */
function posOf(dirKey: string, ringRatio: number): { left: string; top: string } {
  const dir = DIRECTIONS.find((d) => d.key === dirKey) ?? DIRECTIONS[0];
  const rad = (dir.angle * Math.PI) / 180;
  const diagonal = dir.angle % 90 !== 0;
  const r = ringRatio * 50 * (diagonal ? 0.72 : 1);
  const x = Math.sin(rad) * r;
  const y = -Math.cos(rad) * r;
  return { left: `calc(50% + ${x}%)`, top: `calc(50% + ${y}%)` };
}

export default function GameA({ playId, resume, onFinish }: GameProps): React.JSX.Element {
  const resumeA = resume && resume.gameId === 'A' ? resume : null;
  const initial = loadLevelPool().A;

  const gsRef = useRef<GS>({
    phase: 'show',
    level: initial.level,
    showMs: initial.showMs,
    streak: initial.streak,
    qIndex: resumeA?.qIndex ?? 0,
    score: resumeA?.score ?? 0,
    question: null,
    pickedCenter: null,
  });
  const [tick, setTick] = useState(0);
  const update = (patch: Partial<GS>): void => {
    gsRef.current = { ...gsRef.current, ...patch };
    setTick((t) => t + 1);
  };
  const gs = gsRef.current;

  const timerRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const draftsRef = useRef<LogDraft[]>([]);
  const startedAtRef = useRef(resumeA?.startedAt ?? Date.now());
  const startLevelRef = useRef(initial.level);
  const lastCenterRef = useRef<string | null>(resumeA?.lastCenter ?? null);
  const bootedRef = useRef(false);

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  /** 生成一题：中央不与上题重复；中央/外周池不交叉天然不同图；干扰项与目标不同图不同向 */
  const genQuestion = (lv: number, showMs: number): QuestionA => {
    const spec = A_LEVELS[lv];
    const excludeCenter = lastCenterRef.current ? [lastCenterRef.current] : [];
    const center = sample(A_CENTER_POOL, 1, excludeCenter)[0];
    lastCenterRef.current = center;
    const peripheral = pickOne(A_PERIPHERAL_POOL);
    const dir = pickOne(DIRECTIONS);
    const distractEmojis = sample(A_PERIPHERAL_POOL, spec.distractors, [peripheral]);
    const otherDirs = shuffle(DIRECTIONS.filter((d) => d.key !== dir.key));
    const distractors = distractEmojis.map((emoji, i) => ({
      emoji,
      dirKey: otherDirs[i % otherDirs.length].key,
    }));
    const options = shuffle([center, ...sample(A_CENTER_POOL, 3, [center])]);
    return {
      center,
      peripheral,
      dirKey: dir.key,
      distractors,
      options,
      showMs,
      maskMs: spec.maskMs,
      ringRatio: spec.ringRatio,
      level: lv,
    };
  };

  /** 进入一题的展示阶段（E-07：展示期无任何可作答控件） */
  const startQuestion = (lv: number, showMs: number): void => {
    clearTimer();
    const q = genQuestion(lv, showMs);
    update({ question: q, pickedCenter: null, phase: 'show' });
    timerRef.current = window.setTimeout(() => {
      update({ phase: 'fading' });
      timerRef.current = window.setTimeout(() => {
        if (q.maskMs > 0) {
          update({ phase: 'mask' });
          timerRef.current = window.setTimeout(() => update({ phase: 'askCenter' }), q.maskMs);
        } else {
          update({ phase: 'askCenter' });
        }
      }, FADE_OUT_MS);
    }, q.showMs);
  };

  /** 挂载：从 progress 恢复时当前题重新展示（E-02，不重复计分） */
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    startQuestion(gsRef.current.level, gsRef.current.showMs);
    return () => {
      clearTimer();
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      stopSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 进度落盘：任何状态下回家/刷新都可恢复 */
  useEffect(() => {
    saveProgress({
      gameId: 'A',
      level: gs.level,
      qIndex: gs.qIndex,
      score: gs.score,
      lastCenter: lastCenterRef.current,
      usedSeqKey: '',
      startedAt: startedAtRef.current,
    });
  }, [tick, gs.level, gs.qIndex, gs.score]);

  /** 答题待机 ≥8s → TTS 提示（每阶段一次） */
  useEffect(() => {
    if (gs.phase !== 'askCenter' && gs.phase !== 'askDir') return;
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => speak(TEXTS.aIdleHint), IDLE_HINT_MS);
    return () => {
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.phase, gs.qIndex, tick]);

  const persistPool = (level: number, showMs: number, streak: number): void => {
    const pool = loadLevelPool();
    saveLevelPool({ ...pool, A: { level, showMs, streak } });
  };

  const nextQuestion = (afterWrong: boolean): void => {
    const nextIdx = gsRef.current.qIndex + 1;
    if (nextIdx >= SET_SIZE) {
      finishSet();
      return;
    }
    update({ qIndex: nextIdx });
    // 答错重训后下一题降为当前 LEVEL-1 参数（已 L1 保持）
    const lv = afterWrong ? Math.max(1, gsRef.current.level - 1) : gsRef.current.level;
    const showMs =
      lv === gsRef.current.level ? gsRef.current.showMs : aInitialShowMs(lv);
    startQuestion(lv, showMs);
  };

  const finishSet = (): void => {
    clearTimer();
    const { level, showMs, streak, score } = gsRef.current;
    // 跨局难度：本局答对 ≤2 → LEVEL-1
    const finalLevel = score <= 2 ? Math.max(1, level - 1) : level;
    const finalShowMs = finalLevel === level ? showMs : aInitialShowMs(finalLevel);
    persistPool(finalLevel, finalShowMs, streak);
    clearProgress();
    onFinish(
      {
        playId,
        gameId: 'A',
        level: startLevelRef.current,
        correct: score,
        total: SET_SIZE,
        moves: -1,
        durationMs: Date.now() - startedAtRef.current,
      },
      draftsRef.current,
    );
  };

  /** 两步作答完成 → 判定 */
  const judge = (pickedDir: string): void => {
    const q = gsRef.current.question;
    if (!q) return;
    const correct = gsRef.current.pickedCenter === q.center && pickedDir === q.dirKey;
    draftsRef.current.push({
      level: q.level,
      seq: gsRef.current.qIndex + 1,
      isCorrect: correct,
      answer: `${gsRef.current.pickedCenter ?? '-'}|${pickedDir}`,
      target: `${q.center}|${q.dirKey}`,
      durationMs: q.showMs,
      inputMode: 'panel',
      movesCount: -1,
    });
    if (correct) {
      handleCorrect();
    } else {
      handleWrong(q);
    }
  };

  const handleCorrect = (): void => {
    playSuccess();
    const { level, showMs, streak, score } = gsRef.current;
    const newStreak = streak + 1;
    let newLevel = level;
    let newShowMs = Math.max(showMs * 0.85, aShowMsFloor(level));
    let finalStreak = newStreak;
    if (newStreak >= UP_STREAK) {
      newLevel = clamp(level + 1, 1, A_MAX_LEVEL);
      newShowMs = aInitialShowMs(newLevel);
      finalStreak = 0;
    }
    persistPool(newLevel, newShowMs, finalStreak);
    update({ level: newLevel, showMs: newShowMs, streak: finalStreak, score: score + 1, phase: 'good' });
    clearTimer();
    timerRef.current = window.setTimeout(() => nextQuestion(false), FEED_GOOD_MS);
  };

  /** G-08 答错处理次序恒定：柔和音 →「再看一遍」→ 重演正确 → 下一题 */
  const handleWrong = (q: QuestionA): void => {
    playSoftChime();
    const { level, showMs } = gsRef.current;
    const newShowMs = Math.min(showMs * 1.2, aInitialShowMs(level));
    persistPool(level, newShowMs, 0);
    update({ showMs: newShowMs, streak: 0, phase: 'relearn' });
    speak(
      TEXTS.aRelearn(
        A_CENTER_NAMES[q.center] ?? q.center,
        dirWord(q.dirKey),
        A_PERIPHERAL_NAMES[q.peripheral] ?? q.peripheral,
      ),
    );
    clearTimer();
    // 慢速重演：所在级标称 ×1.5，画面放大 1.2 倍
    const relearnMs = A_LEVELS[q.level].showMs * 1.5;
    timerRef.current = window.setTimeout(() => {
      update({ phase: 'fading' });
      timerRef.current = window.setTimeout(() => nextQuestion(true), FADE_OUT_MS);
    }, relearnMs);
  };

  const onPickCenter = (emoji: string): void => {
    update({ pickedCenter: emoji, phase: 'askDir' });
  };

  const onPickDir = (dirKey: string): void => {
    judge(dirKey);
  };

  const q = gs.question;
  const showing = gs.phase === 'show' || gs.phase === 'relearn';
  const fading = gs.phase === 'fading';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pt-6 pb-[calc(120px+env(safe-area-inset-bottom))]">
      <TopInfo text={`${GAME_NAMES.A} · 第${gs.qIndex + 1}题/${SET_SIZE} · L${gs.level}`} />

      {/* 主舞台：展示 / 遮罩 / 反馈 */}
      <div className="relative mt-4 min-h-[46dvh] flex-1">
        {q && (showing || fading) ? (
          <div
            className={`absolute inset-0 rounded-3xl border-2 border-dashed border-[#E4DACB] ${
              fading ? 'bf-fade-out' : 'bf-fade-in'
            }`}
          >
            {/* 中央大图标（≥120px，重演时 ×1.2） */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 leading-none"
              style={{ fontSize: gs.phase === 'relearn' ? '9rem' : '7.5rem' }}
              aria-label={`中央：${A_CENTER_NAMES[q.center] ?? ''}`}
            >
              {q.center}
            </div>
            {/* 外周目标（≥80px） */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 leading-none"
              style={{
                ...posOf(q.dirKey, q.ringRatio),
                fontSize: gs.phase === 'relearn' ? '6rem' : '5rem',
              }}
              aria-label={`外周在${dirWord(q.dirKey)}`}
            >
              {q.peripheral}
            </div>
            {/* 干扰图形（淡色，不构成信息主体） */}
            {q.distractors.map((d, i) => (
              <div
                key={`${d.dirKey}-${i}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 leading-none opacity-40"
                style={{ ...posOf(d.dirKey, q.ringRatio), fontSize: '3.5rem' }}
                aria-hidden
              >
                {d.emoji}
              </div>
            ))}
          </div>
        ) : null}

        {/* 遮罩（L4+）：防"过眼留痕" */}
        {gs.phase === 'mask' ? (
          <div className="bf-fade-in absolute inset-0 rounded-3xl bg-[#EDE6DA]" aria-hidden />
        ) : null}

        {/* 答对正反馈 1.2s */}
        {gs.phase === 'good' ? (
          <div className="bf-pop absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[#5C8A5A] text-[4rem] text-white">
              ✓
            </div>
            <p className="mt-4 text-[1.75rem] font-semibold text-[#5C8A5A]">答对啦</p>
          </div>
        ) : null}

        {/* 答错重演标题条 */}
        {gs.phase === 'relearn' ? (
          <div className="absolute left-0 right-0 top-2 z-10 text-center">
            <span className="rounded-full bg-white px-5 py-2 text-[1.375rem] text-[#8A7D6E] shadow-[0_2px_8px_rgb(62_52_43/0.08)]">
              {TEXTS.relearn}
            </span>
          </div>
        ) : null}
      </div>

      {/* 答题面板区 */}
      {gs.phase === 'askCenter' && q ? (
        <div className="bf-rise mt-4">
          <p className="mb-4 text-center text-[1.5rem] font-medium">正中出现的是哪个？</p>
          <div className="grid grid-cols-2 gap-4">
            {q.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onPickCenter(opt)}
                className="bf-press flex min-h-[88px] items-center justify-center gap-2 rounded-2xl bg-white px-3 shadow-[0_4px_16px_rgb(62_52_43/0.08)]"
              >
                <span aria-hidden className="text-[2.5rem]">{opt}</span>
                <span className="text-[1.375rem] font-medium">{A_CENTER_NAMES[opt] ?? ''}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {gs.phase === 'askDir' && q ? (
        <div className="bf-rise mt-4">
          <p className="mb-4 text-center text-[1.5rem] font-medium">另一个图案在哪个方向？</p>
          <div className="mx-auto grid w-full max-w-[340px] grid-cols-3 gap-3">
            {DIR_GRID.map((key, i) =>
              key === null ? (
                <div key={`hole-${i}`} aria-hidden />
              ) : (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPickDir(key)}
                  className="bf-press flex min-h-[72px] items-center justify-center rounded-2xl bg-white text-[1.375rem] font-medium shadow-[0_4px_16px_rgb(62_52_43/0.08)]"
                >
                  {dirLabel(key)}
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
