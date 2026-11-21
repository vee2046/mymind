// ABOUTME: P1 首页：打开后 ≤1 次点击进入游戏
// ABOUTME: 主按钮 / 3 游戏卡 / 本周天数 / 欢迎播报 / 主屏引导卡 / 发给家人 / 周末圆点

import { useEffect, useMemo, useState } from 'react';
import { Card, PageShell, PrimaryButton, SoftButton } from '../components/ui';
import {
  DAILY_LIMIT_MS,
  DAILY_LIMIT_SETS,
  GAME_ICONS,
  GAME_NAMES,
  TEXTS,
  type GameId,
} from '../lib/constants';
import { getAllLogs } from '../lib/db';
import { navigate } from '../lib/router';
import { speak, ttsReady } from '../lib/tts';
import {
  clearProgress,
  loadDaily,
  loadFlags,
  loadProgress,
  loadSettings,
  saveFlags,
  saveSettings,
  sortGamesByRecent,
} from '../lib/storage';
import { aggregatePlays, playedDaysWithin } from '../lib/stats';
import type { Progress, Settings } from '../lib/types';
import { isWeekendNow, weekKeyOf } from '../lib/utils';

/** 欢迎播报每会话仅 1 次（P1-4：首次用户手势后） */
let welcomedThisSession = false;

export default function Home(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [progress] = useState<Progress | null>(() => loadProgress());
  const [weekDays, setWeekDays] = useState(0);
  const [daily] = useState(() => loadDaily());
  const [copied, setCopied] = useState(false);

  const dailyDone =
    daily.sessionsDone >= DAILY_LIMIT_SETS || daily.totalPlayMs >= DAILY_LIMIT_MS;

  const weekendHintVisible = (() => {
    if (!isWeekendNow()) return false;
    const flags = loadFlags();
    return flags.weeklyHintWeek !== weekKeyOf(Date.now());
  })();

  useEffect(() => {
    void getAllLogs().then((logs) => {
      setWeekDays(playedDaysWithin(aggregatePlays(logs), 7));
    });
  }, []);

  // P1-4：欢迎播报（首次用户手势后 TTS 1 次）
  useEffect(() => {
    if (welcomedThisSession) return;
    let mounted = true;
    const onGesture = (): void => {
      welcomedThisSession = true;
      window.setTimeout(() => {
        if (mounted && ttsReady()) speak(TEXTS.welcome);
      }, 350);
    };
    window.addEventListener('pointerdown', onGesture, { once: true });
    return () => {
      mounted = false;
      window.removeEventListener('pointerdown', onGesture);
    };
  }, []);

  /** F-P1-01：主按钮——优先恢复未完成局，否则进入上次游戏 */
  const onPrimary = (): void => {
    const p = loadProgress();
    if (p) {
      navigate(`/game/${p.gameId}`);
      return;
    }
    const s = loadSettings();
    navigate(`/game/${s.lastGameId ?? 'A'}`);
  };

  /** F-P1-02：游戏卡一律新开一局 */
  const onPick = (id: GameId): void => {
    clearProgress();
    navigate(`/game/${id}`);
  };

  const onWeekendHint = (): void => {
    const flags = loadFlags();
    saveFlags({ ...flags, weeklyHintWeek: weekKeyOf(Date.now()) });
    navigate('/records');
  };

  /** P1-9：发给家人（系统分享优先，降级复制链接） */
  const onShare = async (): Promise<void> => {
    const url = window.location.origin;
    const text = '每天几分钟，陪着爸妈慢慢练。';
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '脑力慢养', text, url });
        return;
      } catch {
        return; // 用户取消，静默
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // 静默
    }
  };

  const dismissOnboard = (): void => {
    const next: Settings = { ...settings, onboarded: true };
    saveSettings(next);
    setSettings(next);
  };

  const progressLabel = ((): string | null => {
    if (!progress) return null;
    if (progress.gameId === 'C') {
      return `${GAME_NAMES.C} · 已翻 ${progress.moves} 次`;
    }
    return `${GAME_NAMES[progress.gameId]} · 第 ${progress.qIndex + 1} 题`;
  })();

  // 游戏卡顺序：最近玩过的排最上面，没玩过的按默认顺序补在后面（不写死顺序）
  const gameOrder = useMemo(() => sortGamesByRecent(settings), [settings]);

  return (
    <PageShell>
      {/* 继续刚才的（中断恢复卡） */}
      {progress && progressLabel ? (
        <button
          type="button"
          onClick={onPrimary}
          className="bf-press bf-rise flex min-h-[64px] w-full items-center justify-between rounded-2xl border border-[#E4DACB] bg-[#F3EDE3] px-5 py-3 text-left"
        >
          <span className="text-[1.375rem] font-medium">继续刚才的：{progressLabel}</span>
          <span aria-hidden className="text-[1.5rem]">▶</span>
        </button>
      ) : null}

      {/* P1-1 主按钮 */}
      <div className="bf-rise mt-5">
        <PrimaryButton onClick={onPrimary}>
          {dailyDone ? '再玩一会儿' : '继续今天的练习'}
        </PrimaryButton>
      </div>

      {/* P1-2 游戏卡（垂直排列，卡高 ≥96px；顺序按最近玩过的时间排） */}
      <div className="mt-6 flex flex-col gap-4">
        {gameOrder.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className="bf-press flex min-h-[96px] w-full items-center gap-4 rounded-2xl bg-white px-6 text-left shadow-[0_4px_16px_rgb(62_52_43/0.08)]"
          >
            <span aria-hidden className="text-[2.75rem]">{GAME_ICONS[id]}</span>
            <span className="text-[1.625rem] font-semibold">{GAME_NAMES[id]}</span>
            <span aria-hidden className="ml-auto text-[1.5rem] text-[#8A7D6E]">›</span>
          </button>
        ))}
      </div>

      {/* F-P5-06：周末小圆点提示 → 直达 P5 */}
      {weekendHintVisible ? (
        <button
          type="button"
          onClick={onWeekendHint}
          className="bf-press mt-5 flex min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 shadow-[0_4px_16px_rgb(62_52_43/0.08)]"
        >
          <span className="h-3 w-3 rounded-full bg-[#C2703E]" aria-hidden />
          <span className="text-[1.375rem]">这周的记录好了，点我看看</span>
        </button>
      ) : null}

      {/* P1-3 本周天数 */}
      <p className="mt-6 text-center text-[1.375rem] text-[#8A7D6E]">
        本周玩了 <span className="font-semibold text-[#3E342B]">{weekDays}</span> 天
      </p>

      {/* 记录 + 分享 */}
      <div className="mt-4 flex gap-4">
        <SoftButton className="flex-1" onClick={() => navigate('/records')}>
          本周记录
        </SoftButton>
        <SoftButton className="flex-1" onClick={() => void onShare()}>
          {copied ? '链接已复制' : '发给家人'}
        </SoftButton>
      </div>

      {/* 设置入口（语音 / 音效 / 语速 / 特大字） */}
      <div className="mt-4">
        <SoftButton className="w-full" onClick={() => navigate('/settings')}>
          {TEXTS.settingsEntry}
        </SoftButton>
      </div>

      {/* P1-5 添加到主屏引导卡（仅首次访问） */}
      {!settings.onboarded ? (
        <Card className="bf-rise mt-6 px-6 py-5">
          <p className="text-[1.375rem] font-medium leading-relaxed">
            把「脑力慢养」放到手机主屏，下次点一下就能进来。
          </p>
          <p className="mt-2 text-[1.125rem] leading-relaxed text-[#8A7D6E]">
            微信里点右上角「···」，再选「添加到桌面」。
          </p>
          <div className="mt-4">
            <SoftButton className="w-full" onClick={dismissOnboard}>
              知道啦
            </SoftButton>
          </div>
        </Card>
      ) : null}
    </PageShell>
  );
}
