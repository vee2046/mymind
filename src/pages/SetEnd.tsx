// ABOUTME: P3 局末页：结果 + 鼓励语 + 再来一局/回家/本周记录
// ABOUTME: 当日上限触发时主按钮变灰跳 P4；不显示难度变化；TTS 播鼓励语 1 次

import { useEffect, useMemo, useState } from 'react';
import { Card, PageShell, PrimaryButton, SoftButton } from '../components/ui';
import { DAILY_LIMIT_SETS, GAME_ICONS, GAME_NAMES } from '../lib/constants';
import { getAllLogs } from '../lib/db';
import { goHome, navigate } from '../lib/router';
import { loadDaily } from '../lib/storage';
import { aggregatePlays, pickEncouragement, type PlayAgg } from '../lib/stats';
import { speak } from '../lib/tts';

export default function SetEnd({ playId }: { playId: string }): React.JSX.Element {
  const [play, setPlay] = useState<PlayAgg | null>(null);
  const daily = useMemo(loadDaily, []);

  useEffect(() => {
    void getAllLogs().then((logs) => {
      const found = aggregatePlays(logs).find((p) => p.playId === playId) ?? null;
      setPlay(found);
    });
  }, [playId]);

  const isC = play?.gameId === 'C';
  const encourage = useMemo(
    () => (play ? pickEncouragement(play.gameId, play.correct, play.moves) : ''),
    [play],
  );

  // TTS 播鼓励语 1 次
  useEffect(() => {
    if (encourage) speak(encourage);
  }, [encourage]);

  if (!play) {
    return (
      <PageShell>
        <p className="mt-20 text-center text-[1.5rem] text-[#8A7D6E]">准备中…</p>
      </PageShell>
    );
  }

  const hitLimit = daily.sessionsDone >= DAILY_LIMIT_SETS;
  const leftSets = Math.max(0, DAILY_LIMIT_SETS - daily.sessionsDone);

  return (
    <PageShell>
      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <span className="text-[4.5rem]">{GAME_ICONS[play.gameId]}</span>
        <h1 className="mt-2 text-[2rem] font-bold">{GAME_NAMES[play.gameId]}</h1>

        <p className="mt-6 text-[2.5rem] font-bold text-[#3E342B]">
          {isC ? `用了 ${play.moves} 次` : `本局答对 ${play.correct}/${play.total}`}
        </p>

        <Card className="bf-rise mt-6 w-full px-6 py-5">
          <p className="text-[1.5rem] leading-relaxed">{encourage}</p>
        </Card>

        <p className="mt-4 text-[1.375rem] text-[#8A7D6E]">
          {hitLimit ? '今天到这儿就很棒' : `今天还够玩 ${leftSets} 局`}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {hitLimit ? (
          <PrimaryButton tone="gray" onClick={() => navigate('/daily-done', { replace: true })}>
            今天到这儿就很棒
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => navigate(`/game/${play.gameId}`, { replace: true })}>
            再来一局
          </PrimaryButton>
        )}
        <div className="grid grid-cols-2 gap-4">
          <SoftButton onClick={() => goHome()}>回家</SoftButton>
          <SoftButton onClick={() => navigate('/records')}>本周记录</SoftButton>
        </div>
      </div>
    </PageShell>
  );
}
