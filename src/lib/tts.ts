// ABOUTME: TTS 语音播报（SpeechSynthesis）
// ABOUTME: G-01：首次用户手势后才允许自动播报；不可用时静默降级（E-01）

import { loadSettings } from './storage';
import { clamp } from './utils';

let unlocked = false;
let zhVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): void {
  try {
    const voices = speechSynthesis.getVoices();
    zhVoice =
      voices.find((v) => /^zh([-_]CN)?/i.test(v.lang) && /xiaoxiao|ting|mei|hui/i.test(v.name)) ??
      voices.find((v) => /^zh/i.test(v.lang)) ??
      null;
  } catch {
    zhVoice = null;
  }
}

function supported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** App 启动时调用：挂首次手势解锁 */
export function initTtsOnGesture(): void {
  if (!supported()) return;
  const unlock = (): void => {
    unlocked = true;
    pickVoice();
    try {
      // 部分内核需要一次空调用激活
      speechSynthesis.getVoices();
    } catch {
      // 静默
    }
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  try {
    speechSynthesis.onvoiceschanged = () => pickVoice();
  } catch {
    // 静默
  }
}

export function ttsReady(): boolean {
  return unlocked && supported();
}

export interface SpeakOptions {
  /** -6dB 干扰语音等场景：0.0–1.0 */
  volume?: number;
  /** 指定语速（默认取设置） */
  rate?: number;
}

/** 播报一段文本；新的播报会打断旧的（避免叠音延迟） */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!unlocked || !supported()) return; // E-01 静默降级
  const settings = loadSettings();
  if (!settings.ttsOn) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (zhVoice) u.voice = zhVoice;
    u.rate = clamp(opts.rate ?? settings.ttsRate, 0.7, 1.3); // E-06
    u.volume = clamp(opts.volume ?? 1, 0, 1);
    speechSynthesis.speak(u);
  } catch {
    // 静默
  }
}

export function stopSpeak(): void {
  if (!supported()) return;
  try {
    speechSynthesis.cancel();
  } catch {
    // 静默
  }
}
