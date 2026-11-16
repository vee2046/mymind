// ABOUTME: WebAudio 合成音效（成功上行三音 / 柔和二音），无音频文件
// ABOUTME: 首次用户手势后创建 AudioContext；不可用时静默

let ctx: AudioContext | null = null;
let tried = false;

function ensureCtx(): AudioContext | null {
  if (ctx) {
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }
    return ctx;
  }
  if (tried) return ctx;
  tried = true;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** App 启动时调用：挂手势解锁（iOS/微信需要） */
export function initAudioOnGesture(): void {
  const unlock = (): void => {
    ensureCtx();
  };
  window.addEventListener('pointerdown', unlock);
}

interface ToneOpts {
  freq: number;
  startAt: number; // 相对现在的秒
  duration: number;
  type?: OscillatorType;
  peak?: number;
}

function tone({ freq, startAt, duration, type = 'sine', peak = 0.22 }: ToneOpts): void {
  const ac = ensureCtx();
  if (!ac) return;
  try {
    const t0 = ac.currentTime + startAt;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch {
    // 静默
  }
}

/** 答对：上行三音（C5 → E5 → G5） */
export function playSuccess(): void {
  tone({ freq: 523.25, startAt: 0, duration: 0.22 });
  tone({ freq: 659.25, startAt: 0.1, duration: 0.22 });
  tone({ freq: 783.99, startAt: 0.2, duration: 0.34, peak: 0.26 });
}

/** 答错重训：柔和木琴二音（G4 → E4），温和下行 */
export function playSoftChime(): void {
  tone({ freq: 392.0, startAt: 0, duration: 0.28, type: 'triangle', peak: 0.18 });
  tone({ freq: 329.63, startAt: 0.18, duration: 0.4, type: 'triangle', peak: 0.16 });
}
