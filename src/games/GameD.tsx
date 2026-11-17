// ABOUTME: 游戏 D「赶集」：按老板的规矩挑货，练语义选择、抑制、改口更新与心算
// ABOUTME: 老板改口 = 规则失效提示；命中集一律由规则推导，答案唯一

import { useEffect, useRef, useState } from 'react';
import { AudioToggles, GameHeader, PrimaryButton } from '../components/ui';
import { playSoftChime, playSuccess } from '../lib/audio';
import {
  D_LEVELS,
  D_MAX_LEVEL,
  FEED_GOOD_MS,
  GAME_NAMES,
  SET_SIZE,
  TEXTS,
  UP_STREAK,
} from '../lib/constants';
import { genPlan, genRound, targetIds } from '../lib/market';
import { clearProgress, loadLevelPool, saveLevelPool, saveProgress } from '../lib/storage';
import { speak, stopSpeak } from '../lib/tts';
import type { DRound, DRoundPlan } from '../lib/types';
import { clamp } from '../lib/utils';
import type { GameProps, LogDraft } from '../pages/Game';

type Phase = 'rule' | 'pick' | 'good' | 'relearn';

interface GS {
  phase: Phase;
  level: number; // 局内当前级别（连对会升）
  qLevel: number; // 本题出题级别（答错后临时降级）
  streak: number;
  qIndex: number;
  score: number;
  round: DRound | null;
  selected: string[]; // 已挑中的商品 id
  sumChoice: number | null; // 算账题选中的价钱
  switched: boolean; // 老板是否已经改过口
  banner: boolean; // 「改主意了」横幅是否显示
  recalled: boolean; // 高难度下规矩是否被想起
}

/** 摊位列数：4 件以内两列，5–6 件三列，7–8 件四列 */
function colsOf(n: number): 2 | 3 | 4 {
  if (n <= 4) return 2;
  if (n <= 6) return 3;
  return 4;
}

const COL_CLASS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export default function GameD({ playId, resume, onFinish }: GameProps): React.JSX.Element {
  const resumeD = resume && resume.gameId === 'D' ? resume : null;
  const initial = loadLevelPool().D;

  // 懒初始化：出题计划与首题只生成一次
  const initRef = useRef<{ plan: DRoundPlan[]; round: DRound } | null>(null);
  if (initRef.current === null) {
    const plan = resumeD?.plan ?? genPlan(initial.level);
    const q = resumeD?.qIndex ?? 0;
    const entry = plan[q] ?? { kind: 'pick' as const, switch: false };
    initRef.current = { plan, round: genRound(entry, resumeD?.level ?? initial.level) };
  }
  const plan = initRef.current.plan;
  const firstRound = initRef.current.round;

  const gsRef = useRef<GS>({
    phase: firstRound.kind === 'sum' ? 'pick' : 'rule',
    level: resumeD?.level ?? initial.level,
    qLevel: resumeD?.level ?? initial.level,
    streak: initial.streak,
    qIndex: resumeD?.qIndex ?? 0,
    score: resumeD?.score ?? 0,
    round: firstRound,
    selected: [],
    sumChoice: null,
    switched: false,
    banner: false,
    recalled: false,
  });
  const [tick, setTick] = useState(0);
  const update = (patch: Partial<GS>): void => {
    gsRef.current = { ...gsRef.current, ...patch };
    setTick((t) => t + 1);
  };
  const gs = gsRef.current;

  const timerRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const recallTimerRef = useRef<number | null>(null);
  const draftsRef = useRef<LogDraft[]>([]);
  const startedAtRef = useRef(resumeD?.startedAt ?? Date.now());
  const startLevelRef = useRef(resumeD?.level ?? initial.level);
  const qStartRef = useRef(Date.now());
  const bootedRef = useRef(false);

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const clearBanner = (): void => {
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
  };
  const clearRecall = (): void => {
    if (recallTimerRef.current !== null) {
      window.clearTimeout(recallTimerRef.current);
      recallTimerRef.current = null;
    }
  };

  /** 出题（换下一题）：算账题直接作答，挑货题先亮规矩 */
  const startQuestion = (lv: number): void => {
    clearTimer();
    clearBanner();
    clearRecall();
    const q = gsRef.current.qIndex;
    const entry = plan[q] ?? { kind: 'pick' as const, switch: false };
    const round = genRound(entry, lv);
    qStartRef.current = Date.now();
    update({
      qLevel: lv,
      round,
      selected: [],
      sumChoice: null,
      switched: false,
      banner: false,
      recalled: false,
      phase: round.kind === 'sum' ? 'pick' : 'rule',
    });
    if (round.kind === 'sum') {
      speak(TEXTS.dSumAsk);
      return;
    }
    speak(`${TEXTS.dGreeting}，${round.rule.say}`);
    timerRef.current = window.setTimeout(() => update({ phase: 'pick' }), D_LEVELS[lv].ruleShowMs);
  };

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    const round = gsRef.current.round;
    if (round && round.kind === 'pick') {
      speak(`${TEXTS.dGreeting}，${round.rule.say}`);
      timerRef.current = window.setTimeout(
        () => update({ phase: 'pick' }),
        D_LEVELS[gsRef.current.qLevel].ruleShowMs,
      );
    } else if (round) {
      speak(TEXTS.dSumAsk);
    }
    return () => {
      clearTimer();
      clearBanner();
      clearRecall();
      stopSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 进度落盘 */
  useEffect(() => {
    saveProgress({
      gameId: 'D',
      level: gs.level,
      qIndex: gs.qIndex,
      score: gs.score,
      plan,
      startedAt: startedAtRef.current,
    });
  }, [tick, gs.level, gs.qIndex, gs.score, plan]);

  const persistPool = (level: number, streak: number): void => {
    const pool = loadLevelPool();
    saveLevelPool({ ...pool, D: { level, streak } });
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
    clearBanner();
    clearRecall();
    const { level, streak, score } = gsRef.current;
    const finalLevel = score <= 2 ? Math.max(1, level - 1) : level;
    persistPool(finalLevel, streak);
    clearProgress();
    onFinish(
      {
        playId,
        gameId: 'D',
        level: startLevelRef.current,
        correct: score,
        total: SET_SIZE,
        moves: -1,
        durationMs: Date.now() - startedAtRef.current,
      },
      draftsRef.current,
    );
  };

  const handleCorrect = (): void => {
    playSuccess();
    const round = gsRef.current.round;
    speak(round && round.kind === 'sum' ? TEXTS.dGoodSum : TEXTS.dGood);
    const { level, streak, score } = gsRef.current;
    const newStreak = streak + 1;
    let newLevel = level;
    let finalStreak = newStreak;
    if (newStreak >= UP_STREAK) {
      newLevel = clamp(level + 1, 1, D_MAX_LEVEL);
      finalStreak = 0;
    }
    persistPool(newLevel, finalStreak);
    update({ level: newLevel, streak: finalStreak, score: score + 1, phase: 'good' });
    clearTimer();
    timerRef.current = window.setTimeout(() => nextQuestion(false), FEED_GOOD_MS + 600);
  };

  const handleWrong = (): void => {
    playSoftChime();
    const { level, round } = gsRef.current;
    persistPool(level, 0);
    update({ streak: 0, phase: 'relearn' });
    let detail = '';
    if (round && round.kind === 'sum') {
      detail = TEXTS.dTotal(round.answer);
    } else if (round && round.kind === 'pick') {
      const names = targetIds(round.rule, round.items)
        .map((id) => {
          const hit = round.items.find((i) => i.id === id);
          return hit ? hit.name : id;
        })
        .join('、');
      detail = names ? `${TEXTS.dTake}：${names}` : '';
    }
    speak(`${TEXTS.dMiss} ${TEXTS.dRelearn}${detail ? ` ${detail}` : ''}`);
    clearTimer();
    timerRef.current = window.setTimeout(() => nextQuestion(true), 6500);
  };

  /** 提交：挑货题比命中集，算账题比总价 */
  const submit = (): void => {
    const cur = gsRef.current;
    const round = cur.round;
    if (!round || cur.phase !== 'pick') return;
    const qLevel = cur.qLevel;
    if (round.kind === 'pick') {
      if (cur.selected.length === 0) return;
      const target = targetIds(round.rule, round.items);
      const nameOf = (id: string): string => {
        const hit = round.items.find((i) => i.id === id);
        return hit ? hit.name : id;
      };
      const correct =
        cur.selected.length === target.length && target.every((id) => cur.selected.includes(id));
      draftsRef.current.push({
        level: qLevel,
        seq: cur.qIndex + 1,
        isCorrect: correct,
        answer: cur.selected.map(nameOf).join('、'),
        target: target.map(nameOf).join('、'),
        durationMs: Date.now() - qStartRef.current,
        inputMode: 'panel',
        movesCount: -1,
      });
      if (correct) handleCorrect();
      else handleWrong();
      return;
    }
    if (cur.sumChoice === null) return;
    const correct = cur.sumChoice === round.answer;
    draftsRef.current.push({
      level: qLevel,
      seq: cur.qIndex + 1,
      isCorrect: correct,
      answer: String(cur.sumChoice),
      target: String(round.answer),
      durationMs: Date.now() - qStartRef.current,
      inputMode: 'panel',
      movesCount: -1,
    });
    if (correct) handleCorrect();
    else handleWrong();
  };

  /** 挑一件货：第一次点先触发「老板改口」，改完口再挑 */
  const onTapItem = (id: string): void => {
    const cur = gsRef.current;
    if (cur.phase !== 'pick') return;
    const round = cur.round;
    if (!round || round.kind !== 'pick') return;
    if (!cur.switched && round.nextRule) {
      const newRule = round.nextRule;
      update({
        round: { kind: 'pick', rule: newRule, nextRule: null, items: round.items },
        switched: true,
        banner: true,
        selected: [],
      });
      speak(TEXTS.dSwitchIntro(newRule.say));
      clearBanner();
      bannerTimerRef.current = window.setTimeout(() => update({ banner: false }), 2600);
      return;
    }
    const next = cur.selected.includes(id)
      ? cur.selected.filter((x) => x !== id)
      : [...cur.selected, id];
    update({ selected: next });
  };

  /** 高难度：想起规矩（显示 2.5 秒） */
  const onRecall = (): void => {
    update({ recalled: true });
    speak(TEXTS.dRecallHint);
    clearRecall();
    recallTimerRef.current = window.setTimeout(() => update({ recalled: false }), 2500);
  };

  const onChooseSum = (v: number): void => {
    const cur = gsRef.current;
    if (cur.phase !== 'pick') return;
    update({ sumChoice: v });
  };

  // ===== 渲染 =====
  const round = gs.round;
  const items = round ? round.items : [];
  const cols = colsOf(items.length);
  const isPick = round ? round.kind === 'pick' : false;
  const targetSet: string[] =
    round && round.kind === 'pick' ? targetIds(round.rule, round.items) : [];
  const spec = D_LEVELS[gs.qLevel];
  const rule = round ? round.rule : null;
  const canSubmit = isPick ? gs.selected.length > 0 : gs.sumChoice !== null;
  const ruleText = rule
    ? spec.ruleDisplay === 'slim' && gs.phase === 'pick'
      ? rule.short
      : rule.say
    : '';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))]">
      <GameHeader text={`${GAME_NAMES.D} · 第${gs.qIndex + 1}题/${SET_SIZE} · L${gs.qLevel}`} />
      <AudioToggles />

      {/* 规则阶段：老板先把话说清楚 */}
      {gs.phase === 'rule' && rule && (
        <div className="bf-fade-in mt-6 flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="text-[5rem] leading-none">🧺</div>
          <div className="text-[1.75rem] text-[#8A7D6E]">{TEXTS.dGreeting}</div>
          <div className="flex items-center gap-3 rounded-3xl bg-white px-6 py-5 shadow-[0_6px_20px_rgba(62,52,43,0.06)]">
            <span className="text-[3rem] leading-none">{rule.icon}</span>
            <span className="text-[2.25rem] leading-snug text-[#3E342B]">{rule.say}</span>
          </div>
          <div className="text-[1.5rem] text-[#8A7D6E]">{TEXTS.dSeeStall}</div>
        </div>
      )}

      {/* 答题阶段 */}
      {gs.phase !== 'rule' && (
        <div className="bf-fade-in mt-4 flex flex-1 flex-col">
          {/* 规矩条 */}
          {rule && (
            <div className="mb-3 flex min-h-[64px] items-center gap-3 rounded-2xl bg-white px-4 py-3">
              {spec.ruleDisplay === 'hidden' && gs.phase === 'pick' && !gs.recalled ? (
                <button
                  type="button"
                  onClick={onRecall}
                  className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl bg-[#F3EDE3] text-[1.75rem] text-[#C2703E]"
                >
                  {TEXTS.dRecall}
                </button>
              ) : (
                <>
                  <span className="text-[2.25rem] leading-none">{rule.icon}</span>
                  <span className="flex-1 text-[1.75rem] leading-snug text-[#3E342B]">
                    {ruleText}
                  </span>
                  {gs.switched && (
                    <span className="shrink-0 rounded-full bg-[#E8B84B] px-3 py-1 text-[1.25rem] text-white">
                      {TEXTS.dSwitchTag}
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {/* 改主意了 */}
          {gs.banner && (
            <div className="bf-rise mb-3 rounded-2xl bg-[#E8B84B] px-4 py-3 text-center text-[1.75rem] text-white">
              {TEXTS.dSwitchBanner}
            </div>
          )}

          {/* 算账题的题目 */}
          {round && round.kind === 'sum' && (
            <div className="mb-3 rounded-2xl bg-white px-4 py-3 text-[1.75rem] leading-snug text-[#3E342B]">
              {TEXTS.dSumAsk}
            </div>
          )}

          {/* 摊位 */}
          <div className={`grid gap-3 ${COL_CLASS[cols]}`}>
            {items.map((item) => {
              const selected = gs.selected.includes(item.id);
              const isTarget = targetSet.includes(item.id);
              const showPrice = round !== null && round.kind === 'sum';
              const done = gs.phase === 'good' || gs.phase === 'relearn';
              const borderCls = done
                ? isTarget
                  ? 'border-[#5C8A5A] bg-[#F1F6F0]'
                  : 'border-[#E4DACB] bg-white'
                : selected
                  ? 'border-[#C2703E] bg-[#FBF1E7]'
                  : 'border-[#E4DACB] bg-white';
              const badge = done
                ? isTarget
                  ? 'bg-[#5C8A5A]'
                  : null
                : selected
                  ? 'bg-[#E8B84B]'
                  : null;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTapItem(item.id)}
                  disabled={gs.phase !== 'pick'}
                  className={`relative flex min-h-[104px] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-3 transition-colors duration-300 ${borderCls}`}
                >
                  {badge && (
                    <span
                      className={`absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full text-[1.5rem] leading-none text-white ${badge}`}
                    >
                      ✓
                    </span>
                  )}
                  <span className="text-[3rem] leading-none">{item.emoji}</span>
                  <span className="text-[1.5rem] leading-tight text-[#3E342B]">{item.name}</span>
                  {showPrice && (
                    <span className="text-[1.5rem] leading-tight text-[#8A7D6E]">
                      {item.price} 元
                    </span>
                  )}
                  {gs.phase === 'relearn' && !isTarget && (
                    <span className="text-[1.25rem] leading-tight text-[#8A7D6E]">
                      {TEXTS.dSkip}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 算账选项 */}
          {round && round.kind === 'sum' && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {round.options.map((opt) => {
                const chosen = gs.sumChoice === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onChooseSum(opt)}
                    disabled={gs.phase !== 'pick'}
                    className={`flex min-h-[104px] items-center justify-center gap-1 rounded-2xl border-2 transition-colors duration-300 ${
                      chosen ? 'border-[#C2703E] bg-[#FBF1E7]' : 'border-[#E4DACB] bg-white'
                    }`}
                  >
                    <span className="text-[4.5rem] leading-none text-[#3E342B]">{opt}</span>
                    <span className="text-[1.5rem] leading-none text-[#8A7D6E]">元</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 反馈 */}
          {gs.phase === 'good' && (
            <div className="bf-pop mt-4 rounded-2xl bg-[#5C8A5A] px-4 py-3 text-center text-[1.75rem] text-white">
              {round && round.kind === 'sum' ? TEXTS.dGoodSum : TEXTS.dGood}
            </div>
          )}
          {gs.phase === 'relearn' && (
            <div className="bf-rise mt-4 rounded-2xl bg-white px-4 py-3 text-center">
              <div className="text-[1.75rem] text-[#3E342B]">{TEXTS.dRelearn}</div>
              {round && round.kind === 'sum' ? (
                <div className="mt-1 text-[1.5rem] leading-snug text-[#8A7D6E]">
                  {round.items.map((i) => `${i.name} ${i.price} 元`).join(' ＋ ')} ＝{' '}
                  <span className="text-[#5C8A5A]">{TEXTS.dTotal(round.answer)}</span>
                </div>
              ) : (
                <div className="mt-1 text-[1.5rem] leading-snug text-[#8A7D6E]">
                  {TEXTS.dTake}：
                  {targetSet
                    .map((id) => {
                      const hit = items.find((i) => i.id === id);
                      return hit ? hit.name : id;
                    })
                    .join('、')}
                </div>
              )}
            </div>
          )}

          {/* 提交 */}
          {gs.phase === 'pick' && (
            <div className="mt-5 pb-4">
              {(!canSubmit || gs.qLevel <= 3) && (
                <div className="mb-2 text-center text-[1.5rem] text-[#8A7D6E]">
                  {!canSubmit
                    ? isPick
                      ? TEXTS.dPickNeed
                      : TEXTS.dSumNeed
                    : TEXTS.dPickHint}
                </div>
              )}
              <PrimaryButton onClick={submit} disabled={!canSubmit} tone="primary">
                {isPick ? TEXTS.dConfirm : TEXTS.dConfirmSum}
              </PrimaryButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
