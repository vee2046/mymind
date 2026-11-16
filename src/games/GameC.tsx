// ABOUTME: 游戏 C「配一对」：短时记忆编码（翻翻乐）
// ABOUTME: 无"答错"概念，不匹配只扣回；难度只随完成局数递增；步数越少越稳

import { useEffect, useRef, useState } from 'react';
import { AudioToggles, TopInfo } from '../components/ui';
import { playSuccess } from '../lib/audio';
import { C_LEVELS, C_MAX_LEVEL, C_THEMES, GAME_NAMES, TEXTS } from '../lib/constants';
import { clearProgress, loadLevelPool, saveLevelPool, saveProgress } from '../lib/storage';
import { speak, stopSpeak } from '../lib/tts';
import { clamp, pickOne, sample, shuffle } from '../lib/utils';
import type { GameProps, LogDraft } from '../pages/Game';

interface GS {
  level: number;
  deck: string[];
  matched: number[];
  flipped: number[];
  moves: number;
  locked: boolean;
  done: boolean;
}

export default function GameC({ playId, resume, onFinish }: GameProps): React.JSX.Element {
  const resumeC = resume && resume.gameId === 'C' ? resume : null;
  const initial = loadLevelPool().C;

  const buildDeck = (level: number): string[] => {
    const spec = C_LEVELS[level];
    // C-L4 起跨主题混合（已见过的牌面重新洗入，记忆应对新局面）
    const faces =
      level >= C_MAX_LEVEL
        ? shuffle(C_THEMES.flatMap((t) => t.emojis)).slice(0, spec.pairs)
        : sample(pickOne(C_THEMES).emojis, spec.pairs);
    return shuffle([...faces, ...faces]);
  };

  const gsRef = useRef<GS>({
    level: resumeC?.level ?? initial.level,
    deck: resumeC?.cardState.deck ?? [],
    matched: resumeC?.cardState.matchedIdx ?? [],
    flipped: [],
    moves: resumeC?.moves ?? 0,
    locked: false,
    done: false,
  });
  const [tick, setTick] = useState(0);
  const update = (patch: Partial<GS>): void => {
    gsRef.current = { ...gsRef.current, ...patch };
    setTick((t) => t + 1);
  };
  const gs = gsRef.current;

  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(resumeC?.startedAt ?? Date.now());
  const startLevelRef = useRef(gsRef.current.level);
  const firstFlipHintRef = useRef(resumeC?.firstFlipHintDone ?? false);
  const bootedRef = useRef(false);

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    if (gsRef.current.deck.length === 0) {
      update({ deck: buildDeck(gsRef.current.level) });
    }
    return () => {
      clearTimer();
      stopSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 进度落盘：已配对保持消隐，翻开的恢复为扣回（E-02 恢复一手牌状态） */
  useEffect(() => {
    if (gs.deck.length === 0 || gs.done) return;
    saveProgress({
      gameId: 'C',
      level: gs.level,
      moves: gs.moves,
      cardState: { deck: gs.deck, matchedIdx: gs.matched },
      firstFlipHintDone: firstFlipHintRef.current,
      startedAt: startedAtRef.current,
    });
  }, [tick, gs.deck, gs.matched, gs.moves, gs.level, gs.done]);

  const finishSet = (moves: number): void => {
    update({ done: true });
    speak(TEXTS.cDone(moves));
    // C 难度只随完成局数递增（上限 L4）
    const pool = loadLevelPool();
    const newLevel = clamp(gsRef.current.level + 1, 1, C_MAX_LEVEL);
    saveLevelPool({ ...pool, C: { level: newLevel } });
    const durationMs = Date.now() - startedAtRef.current;
    const drafts: LogDraft[] = [
      {
        level: gsRef.current.level,
        seq: 1,
        isCorrect: true, // C 无对错概念
        answer: '',
        target: '',
        durationMs,
        inputMode: 'panel',
        movesCount: moves,
      },
    ];
    timerRef.current = window.setTimeout(() => {
      clearProgress();
      onFinish(
        {
          playId,
          gameId: 'C',
          level: startLevelRef.current,
          correct: -1,
          total: -1,
          moves,
          durationMs,
        },
        drafts,
      );
    }, 2400);
  };

  const onFlip = (idx: number): void => {
    const cur = gsRef.current;
    if (cur.locked || cur.done) return;
    // E-09：已翻开/已匹配的卡再点不响应，保持当前翻开态
    if (cur.matched.includes(idx) || cur.flipped.includes(idx)) return;
    if (cur.flipped.length >= 2) return;
    const flipped = [...cur.flipped, idx];
    const moves = cur.moves + 1;
    update({ flipped, moves });
    if (flipped.length === 2) {
      if (!firstFlipHintRef.current) {
        firstFlipHintRef.current = true;
        speak(TEXTS.cFirstFlip);
      }
      const [a, b] = flipped;
      if (cur.deck[a] === cur.deck[b]) {
        // 匹配：消隐 + 正反馈
        playSuccess();
        const matched = [...cur.matched, a, b];
        update({ matched, flipped: [] });
        if (matched.length === cur.deck.length) {
          finishSet(moves);
        }
      } else {
        // 不匹配：延迟后自动扣回（无"答错"语义）
        update({ locked: true });
        const spec = C_LEVELS[cur.level];
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          update({ flipped: [], locked: false });
        }, spec.flipBackMs);
      }
    }
  };

  const spec = C_LEVELS[gs.level];
  const pairsTotal = gs.deck.length / 2;
  const pairsDone = gs.matched.length / 2;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pt-6 pb-[calc(120px+env(safe-area-inset-bottom))]">
      <TopInfo text={`${GAME_NAMES.C} · 已配对 ${pairsDone}/${pairsTotal} 对 · L${gs.level}`} />
      <AudioToggles />

      <p className="mt-3 text-center text-[1.375rem] text-[#8A7D6E]">
        翻开两张一样的，它们就会留下来
      </p>

      {/* 棋盘 */}
      <div
        className="mt-5 grid flex-1 content-center gap-3"
        style={{ gridTemplateColumns: `repeat(${spec.cols}, minmax(0, 1fr))` }}
      >
        {gs.deck.map((face, idx) => {
          const isOpen = gs.flipped.includes(idx) || gs.matched.includes(idx);
          const isGone = gs.matched.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              aria-label={isOpen ? `牌面 ${face}` : `第 ${idx + 1} 张牌，扣着`}
              disabled={isGone}
              onClick={() => onFlip(idx)}
              className={`bf-press flex aspect-square min-h-[64px] items-center justify-center rounded-2xl text-[2.25rem] transition-opacity duration-300 ${
                isGone
                  ? 'pointer-events-none opacity-0'
                  : isOpen
                    ? 'bg-white shadow-[0_4px_16px_rgb(62_52_43/0.12)]'
                    : 'bg-[#F3EDE3] shadow-[0_2px_8px_rgb(62_52_43/0.06)]'
              }`}
            >
              {isOpen ? (
                <span className="bf-pop inline-block">{face}</span>
              ) : (
                <span aria-hidden className="inline-block text-[1.5rem] text-[#C9BBA6]">
                  ✿
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 步数（中性展示，只有"用了 n 次"语义） */}
      <p className="mt-5 text-center text-[1.375rem] text-[#8A7D6E]">
        已翻开 <span className="font-semibold text-[#3E342B]">{gs.moves}</span> 次
      </p>

      {gs.done ? (
        <div className="bf-pop mt-4 flex flex-col items-center">
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[#5C8A5A] text-[4rem] text-white">
            ✓
          </div>
          <p className="mt-4 text-center text-[1.625rem] font-semibold text-[#5C8A5A]">
            {TEXTS.cDone(gs.moves)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
