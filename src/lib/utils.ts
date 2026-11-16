// ABOUTME: 通用工具函数（日期、随机、数组）

/** 本地日期串 YYYY-MM-DD（E-05：以本地时间戳为准） */
export function dateStrOf(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return dateStrOf(Date.now());
}

export function daysAgoStr(n: number): string {
  return dateStrOf(Date.now() - n * 86_400_000);
}

/** ISO 周标识（周末提示按周去重用）：YYYY-Www */
export function weekKeyOf(ts: number): string {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // 周一为 0
  const thursday = new Date(d.getTime() - day * 86_400_000 + 3 * 86_400_000);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function isWeekendNow(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 从数组随机取 n 个（可排除指定项） */
export function sample<T>(arr: readonly T[], n: number, exclude: readonly T[] = []): T[] {
  const pool = arr.filter((x) => !exclude.includes(x));
  return shuffle(pool).slice(0, n);
}

export function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 安全整数解析 */
export function toInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** CSV 单元格转义（Excel 兼容） */
export function csvEscape(v: string | number | boolean | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
