// ABOUTME: P4 日结算页：今天完成 ✓ + 成就句（只与本人昨天比）+ 告别语 + 分享
// ABOUTME: 同日不重复弹（Game.tsx 已置标记）；TTS 整段播报 1 次

import { useEffect, useMemo, useState } from 'react';
import { HomeButton, PageShell, PrimaryButton, SoftButton } from '../components/ui';
import { DAILY_LIMIT_SETS, TEXTS } from '../lib/constants';
import { getAllLogs } from '../lib/db';
import { goHome } from '../lib/router';
import { loadDaily } from '../lib/storage';
import {
  aggregatePlays,
  bMaxDigits,
  todayBest,
  todayGames,
  yesterdayBest,
  type PlayAgg,
} from '../lib/stats';
import { speak } from '../lib/tts';
import type { SessionLog } from '../lib/types';

/** 成就句：基线只有本人昨天；禁百分比/人比人/夸大词 */
function buildAchievement(logs: SessionLog[], plays: PlayAgg[]): string[] {
  const games = todayGames(plays);
  const { today: bT, yesterday: bY } = bMaxDigits(logs);
  const aT = todayBest(plays, 'A');
  const aY = yesterdayBest(plays, 'A');
  const cT = todayBest(plays, 'C');
  const cY = yesterdayBest(plays, 'C');

  const hasYesterday = bY !== null || aY !== null || cY !== null;
  if (!hasYesterday) return [TEXTS.dailyFirstDay];

  const lines: string[] = [];
  if (games.includes('B') && bT !== null && bY !== null) {
    const op = bT === bY + 1 ? '，比昨天多 1 位，' : '，';
    lines.push(`今天稳稳记住 ${bT} 位数${op}昨天是 ${bY} 位。`);
  }
  if (games.includes('A') && aT !== null && aY !== null) {
    lines.push(`今天袋鼠眼看见 ${aT} 题全中，昨天是 ${aY} 题。`);
  }
  if (games.includes('C') && cT !== null && cY !== null) {
    const extra = cT < cY ? '，更利索' : '';
    lines.push(`今天拼图用了 ${cT} 次，昨天是 ${cY} 次${extra}。`);
  }
  return lines.length > 0 ? lines : [TEXTS.dailyFirstDay];
}

export default function DailyDone(): React.JSX.Element {
  const [data, setData] = useState<{ logs: SessionLog[]; plays: PlayAgg[] } | null>(null);
  const daily = useMemo(loadDaily, []);

  useEffect(() => {
    void getAllLogs().then((logs) => setData({ logs, plays: aggregatePlays(logs) }));
  }, []);

  const { lines, shareText } = useMemo(() => {
    if (!data) return { lines: [] as string[], shareText: '' };
    const lines = buildAchievement(data.logs, data.plays);
    const { today: bT } = bMaxDigits(data.logs);
    return {
      lines,
      shareText: bT !== null && bT > 0 ? TEXTS.shareText(bT) : TEXTS.shareFallback,
    };
  }, [data]);

  // TTS 整段播报 1 次（今日成就 + 告别语）
  useEffect(() => {
    if (lines.length > 0) speak([...lines, TEXTS.dailyBye].join(' '));
  }, [lines]);

  const onShare = async (): Promise<void> => {
    const url = window.location.origin;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '脑力慢养', text: shareText, url });
        return;
      } catch {
        /* 用户取消分享，无需提示 */
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      window.alert('链接已复制，去发给家人吧');
    } catch {
      /* 剪贴板不可用时静默 */
    }
  };

  if (!data) {
    return (
      <PageShell>
        <p className="mt-20 text-center text-[1.5rem] text-[#8A7D6E]">准备中…</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        {/* 大字「今天完成 ✓」 */}
        <h1 className="text-[2.5rem] font-bold leading-snug">
          今天完成 <span className="text-[#5C8A5A]">✓</span>
        </h1>
        <p className="mt-2 text-[1.375rem] text-[#8A7D6E]">
          今天练了 {Math.min(daily.sessionsDone, DAILY_LIMIT_SETS)} 局
        </p>

        <div className="mt-8 flex w-full flex-col gap-4">
          {lines.map((line) => (
            <p
              key={line}
              className="bf-rise rounded-2xl bg-white px-6 py-5 text-left text-[1.5rem] leading-relaxed shadow-[0_4px_16px_rgb(62_52_43/0.08)]"
            >
              {line}
            </p>
          ))}
        </div>

        <p className="mt-8 text-[1.625rem] font-medium text-[#8A7D6E]">{TEXTS.dailyBye}</p>
      </div>

      <div className="flex flex-col gap-4">
        <PrimaryButton onClick={() => void onShare()}>把今天发给家人</PrimaryButton>
        <SoftButton onClick={() => goHome()}>回家</SoftButton>
      </div>

      <HomeButton />
    </PageShell>
  );
}
