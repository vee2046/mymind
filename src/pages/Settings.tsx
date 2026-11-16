// ABOUTME: 设置页：语音播报 / 音效 / 语速 / 特大字
// ABOUTME: 语音与音效默认关闭；与游戏内快捷开关读写同一份 bf_settings

import { useState } from 'react';
import { Card, HomeButton, PageShell, ToggleRow } from '../components/ui';
import { TEXTS } from '../lib/constants';
import { primeAudio } from '../lib/audio';
import { loadSettings, saveSettings } from '../lib/storage';
import { stopSpeak } from '../lib/tts';
import type { Settings as SettingsState } from '../lib/types';

const RATES: { value: number; label: string }[] = [
  { value: 0.7, label: TEXTS.settingsRateSlow },
  { value: 1.0, label: TEXTS.settingsRateOk },
  { value: 1.3, label: TEXTS.settingsRateFast },
];

export default function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings());

  const patch = (next: Partial<SettingsState>): void => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    saveSettings(merged);
    if (next.ttsOn === false) stopSpeak(); // 关语音即刻停掉正在播的内容
    if (next.sfxOn === true) primeAudio(); // 开音效：趁这次点击创建 AudioContext
    if (next.fontSize !== undefined) {
      document.documentElement.classList.toggle('big-font', next.fontSize > 1);
    }
  };

  return (
    <PageShell>
      <h1 className="pt-2 text-center text-[2rem] font-bold">{TEXTS.settingsTitle}</h1>

      {/* 语音播报 */}
      <Card className="mt-4 flex flex-col gap-5 px-5 py-5">
        <ToggleRow
          label={TEXTS.settingsVoice}
          hint={TEXTS.settingsVoiceHint}
          checked={settings.ttsOn}
          onChange={(v) => patch({ ttsOn: v })}
        />
        <div>
          <p className="text-[1.375rem]">{TEXTS.settingsRate}</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {RATES.map((r) => (
              <button
                key={r.value}
                type="button"
                disabled={!settings.ttsOn}
                onClick={() => patch({ ttsRate: r.value })}
                className={`bf-press flex min-h-[64px] items-center justify-center rounded-2xl text-[1.25rem] font-medium ${
                  settings.ttsRate === r.value
                    ? 'bg-[#C2703E] text-white'
                    : 'bg-[#F3EDE3] text-[#3E342B]'
                } ${settings.ttsOn ? '' : 'opacity-50'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {settings.ttsOn ? null : (
            <p className="mt-2 text-[1.125rem] text-[#8A7D6E]">先打开语音播报，才能调语速</p>
          )}
        </div>
      </Card>

      {/* 音效 */}
      <Card className="mt-4 px-5 py-5">
        <ToggleRow
          label={TEXTS.settingsSfx}
          hint={TEXTS.settingsSfxHint}
          checked={settings.sfxOn}
          onChange={(v) => patch({ sfxOn: v })}
        />
      </Card>

      {/* 特大字 */}
      <Card className="mt-4 px-5 py-5">
        <ToggleRow
          label={TEXTS.settingsBigFont}
          hint={TEXTS.settingsBigFontHint}
          checked={settings.fontSize > 1}
          onChange={(v) => patch({ fontSize: v ? 1.15 : 1 })}
        />
      </Card>

      <HomeButton />
    </PageShell>
  );
}
