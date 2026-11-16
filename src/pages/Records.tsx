// ABOUTME: P5 记录页：本周天数 + 三游戏打卡块（三态箭头）+ 周鼓励语
// ABOUTME: 底部辅助：导出 CSV / 清空数据（双确认）/ 添加到主屏 / 特大字与语音设置

import { useEffect, useState } from 'react';
import { Card, HomeButton, PageShell, SoftButton } from '../components/ui';
import { GAME_ICONS, GAME_NAMES, WEEKLY_PRAISE, type GameId } from '../lib/constants';
import { clearLogs, getAllLogs } from '../lib/db';
import {
  clearAllData,
  loadFlags,
  loadSettings,
  saveSettings,
} from '../lib/storage';
import {
  aggregatePlays,
  arrowOf,
  playedDaysWithin,
  prevWeekBest,
  twoWeekDown,
  weekGameStat,
  type ArrowDir,
  type PlayAgg,
} from '../lib/stats';
import { csvEscape } from '../lib/utils';
import type { SessionLog, Settings } from '../lib/types';

const GAME_IDS: GameId[] = ['A', 'B', 'C'];

const ARROW_VIEW: Record<ArrowDir, { icon: string; cls: string; text: string }> = {
  up: { icon: '↑', cls: 'text-[#5C8A5A]', text: '比上周更稳' },
  flat: { icon: '—', cls: 'text-[#8A7D6E]', text: '和上周一样' },
  down: { icon: '↓', cls: 'text-[#8A7D6E]', text: '这周再来一次就赶上了' },
  none: { icon: '—', cls: 'text-[#8A7D6E]', text: '这周还没玩' },
};

function weeklyPraise(days: number): string {
  if (days >= 5) return WEEKLY_PRAISE[5];
  if (days === 4) return WEEKLY_PRAISE[4];
  if (days === 3) return WEEKLY_PRAISE[3];
  if (days >= 1) return WEEKLY_PRAISE.few;
  return WEEKLY_PRAISE.none;
}

/** 导出 CSV：session_log 全列 + UTF-8 BOM（Excel/WPS 不乱码） */
function exportCsv(logs: SessionLog[]): void {
  const header = [
    'playId', 'date', 'gameId', 'level', 'seq', 'isCorrect',
    'answer', 'target', 'durationMs', 'inputMode', 'movesCount', 'createdAt',
  ];
  const rows = logs.map((l) =>
    [
      l.playId, l.date, l.gameId, l.level, l.seq, l.isCorrect,
      l.answer, l.target, l.durationMs, l.inputMode, l.movesCount,
      new Date(l.createdAt).toLocaleString('zh-CN'),
    ]
      .map(csvEscape)
      .join(','),
  );
  const bom = '﻿';
  const blob = new Blob([bom + header.join(',') + '\n' + rows.join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `brainfit-records-${ymd}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Records(): React.JSX.Element {
  const [logs, setLogs] = useState<SessionLog[] | null>(null);
  const [plays, setPlays] = useState<PlayAgg[]>([]);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [confirming, setConfirming] = useState(false);
  const [showA2HS, setShowA2HS] = useState(false);
  const [trimmed] = useState(() => loadFlags().storageTrimmed);

  const reload = (): void => {
    void getAllLogs().then((ls) => {
      setLogs(ls);
      setPlays(aggregatePlays(ls));
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const weekDays = playedDaysWithin(plays, 7);

  /** 清空数据：双确认，保留 settings（F-P5-07） */
  const onClearAll = async (): Promise<void> => {
    await clearLogs();
    clearAllData();
    setConfirming(false);
    reload();
  };

  const patchSettings = (patch: Partial<Settings>): void => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    if (patch.fontSize !== undefined) {
      document.documentElement.classList.toggle('big-font', patch.fontSize > 1);
    }
  };

  if (!logs) {
    return (
      <PageShell>
        <p className="mt-20 text-center text-[1.5rem] text-[#8A7D6E]">准备中…</p>
      </PageShell>
    );
  }

  const anyTwoWeekDown = GAME_IDS.some((id) => twoWeekDown(plays, id));

  return (
    <PageShell>
      <h1 className="pt-2 text-center text-[2rem] font-bold">本周记录</h1>

      {/* P5-1 顶部条 */}
      <Card className="mt-4 px-6 py-5 text-center">
        <p className="text-[1.75rem] font-semibold">本周玩了 {weekDays} 天</p>
        {trimmed ? (
          <p className="mt-2 text-[1.25rem] text-[#8A7D6E]">记录较满，已自动整理</p>
        ) : null}
      </Card>

      {/* P5-2 三游戏打卡块 */}
      <div className="mt-5 flex flex-col gap-4">
        {GAME_IDS.map((id) => {
          const wk = weekGameStat(plays, id);
          const prev = prevWeekBest(plays, id);
          const arrow = arrowOf(id, wk, prev);
          const view = ARROW_VIEW[arrow];
          return (
            <Card key={id} className="flex items-center gap-4 px-5 py-4">
              <span className="text-[2.5rem]">{GAME_ICONS[id]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[1.5rem] font-semibold">{GAME_NAMES[id]}</p>
                <p className="text-[1.25rem] text-[#8A7D6E]">
                  本周 {wk.plays} 局
                  {wk.best !== null
                    ? id === 'C'
                      ? ` · 最少用了 ${wk.best} 次`
                      : ` · 最好答对 ${wk.best} 题`
                    : ''}
                </p>
                {arrow === 'down' ? (
                  <p className="mt-1 text-[1.125rem] text-[#8A7D6E]">{view.text}</p>
                ) : null}
              </div>
              <span aria-label={view.text} className={`text-[2rem] font-bold ${view.cls}`}>
                {view.icon}
              </span>
            </Card>
          );
        })}
      </div>

      {/* 连续两周下滑的温和提示（非红色） */}
      {anyTwoWeekDown ? (
        <p className="mt-4 text-center text-[1.25rem] text-[#8A7D6E]">
          最近有点下滑，找家人聊聊也挺好
        </p>
      ) : null}

      {/* P5-4 周鼓励语 */}
      <p className="mt-5 text-center text-[1.5rem] font-medium">{weeklyPraise(weekDays)}</p>

      {/* 设置区 */}
      <Card className="mt-6 flex flex-col gap-5 px-5 py-5">
        <p className="text-[1.375rem] font-semibold">舒心的设置</p>

        {/* 特大字开关（F-P5-08：立即生效无重载） */}
        <label className="flex min-h-[64px] items-center justify-between gap-4">
          <span className="text-[1.375rem]">特大字</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.fontSize > 1}
            onClick={() => patchSettings({ fontSize: settings.fontSize > 1 ? 1 : 1.15 })}
            className={`bf-press h-[64px] w-[112px] rounded-full p-2 transition-colors ${
              settings.fontSize > 1 ? 'bg-[#5C8A5A]' : 'bg-[#E4DACB]'
            }`}
          >
            <span
              className={`block h-[48px] w-[48px] rounded-full bg-white shadow transition-transform ${
                settings.fontSize > 1 ? 'translate-x-[48px]' : 'translate-x-0'
              }`}
            />
          </button>
        </label>

        {/* 语音播报开关（G-01） */}
        <label className="flex min-h-[64px] items-center justify-between gap-4">
          <span className="text-[1.375rem]">语音播报</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.ttsOn}
            onClick={() => patchSettings({ ttsOn: !settings.ttsOn })}
            className={`bf-press h-[64px] w-[112px] rounded-full p-2 transition-colors ${
              settings.ttsOn ? 'bg-[#5C8A5A]' : 'bg-[#E4DACB]'
            }`}
          >
            <span
              className={`block h-[48px] w-[48px] rounded-full bg-white shadow transition-transform ${
                settings.ttsOn ? 'translate-x-[48px]' : 'translate-x-0'
              }`}
            />
          </button>
        </label>

        {/* 语速（E-06：收敛 0.7–1.3） */}
        <div>
          <p className="text-[1.375rem]">语速</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {([
              { v: 0.7, label: '慢一点' },
              { v: 1.0, label: '正好' },
              { v: 1.3, label: '快一点' },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => patchSettings({ ttsRate: opt.v })}
                className={`bf-press flex min-h-[64px] items-center justify-center rounded-2xl text-[1.25rem] ${
                  settings.ttsRate === opt.v
                    ? 'bg-[#C2703E] text-white'
                    : 'bg-[#F3EDE3] text-[#3E342B]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* P5-6 底部辅助 */}
      <div className="mt-5 grid grid-cols-1 gap-3">
        <SoftButton onClick={() => exportCsv(logs)}>导出记录（CSV）</SoftButton>
        <SoftButton onClick={() => setShowA2HS((v) => !v)}>添加到主屏的方法</SoftButton>
        {showA2HS ? (
          <Card className="px-5 py-4">
            <p className="text-[1.25rem] leading-relaxed text-[#8A7D6E]">
              微信里点右上角「···」，选「添加到桌面」；Safari 点底部分享按钮，选「添加到主屏幕」。
            </p>
          </Card>
        ) : null}
        <SoftButton onClick={() => setConfirming(true)}>清空数据</SoftButton>
      </div>

      <HomeButton />

      {/* 双确认弹窗（两按钮均 ≥64px） */}
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(62_52_43/0.45)] px-6">
          <Card className="w-full max-w-[420px] px-6 py-6">
            <p className="text-center text-[1.5rem] font-semibold">
              要清空所有练习记录吗？
            </p>
            <p className="mt-3 text-center text-[1.25rem] text-[#8A7D6E]">
              字号和语音设置会保留
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="bf-press flex min-h-[64px] items-center justify-center rounded-2xl bg-[#F3EDE3] text-[1.375rem] font-semibold"
              >
                先不好
              </button>
              <button
                type="button"
                onClick={() => void onClearAll()}
                className="bf-press flex min-h-[64px] items-center justify-center rounded-2xl bg-[#C2703E] text-[1.375rem] font-semibold text-white"
              >
                真的清空
              </button>
            </div>
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}
