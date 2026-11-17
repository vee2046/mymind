// ABOUTME: PRD §0 全局常量 + 三游戏难度表 + 素材池 + 文案
// ABOUTME: 所有数值以 PRD 为准，禁止随意调整

export type GameId = 'A' | 'B' | 'C';

export const GAME_NAMES: Record<GameId, string> = {
  A: '找一找',
  B: '数口令',
  C: '配一对',
};

export const GAME_ICONS: Record<GameId, string> = {
  A: '🔍',
  B: '🔢',
  C: '🧩',
};

// ===== 时间常量 =====
export const FADE_OUT_MS = 600;
export const STAGE_TRANSITION_MS = 600;
export const TAP_FEEDBACK_MS = 80;
export const FEED_GOOD_MS = 1200; // 答对正反馈时长
export const IDLE_HINT_MS = 8000; // 找一找待机提示
export const AUTO_SUBMIT_MS = 800; // 数口令输满后自动提交

// ===== 难度通用 =====
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 10;
export const LEVEL_START = 2;
export const UP_STREAK = 4;
export const SET_SIZE = 5;

// ===== 日额度 =====
export const DAILY_LIMIT_MS = 600_000;
export const DAILY_LIMIT_SETS = 3;

// ===== 游戏 A：找一找 =====
export interface ALevelSpec {
  showMs: number;
  ringRatio: number; // PRD 原值（外周目标离中心半径，屏宽比）；布局已改用固定 3×3 网格，故不再用于渲染
  distractors: number;
  maskMs: number;
}

export const A_MAX_LEVEL = 8;
export const A_LEVELS: Record<number, ALevelSpec> = {
  1: { showMs: 3000, ringRatio: 0.3, distractors: 1, maskMs: 0 },
  2: { showMs: 2400, ringRatio: 0.3, distractors: 1, maskMs: 0 },
  3: { showMs: 1800, ringRatio: 0.45, distractors: 2, maskMs: 0 },
  4: { showMs: 1400, ringRatio: 0.45, distractors: 3, maskMs: 1000 },
  5: { showMs: 1000, ringRatio: 0.6, distractors: 4, maskMs: 1000 },
  6: { showMs: 800, ringRatio: 0.6, distractors: 5, maskMs: 1200 },
  7: { showMs: 600, ringRatio: 0.6, distractors: 6, maskMs: 1500 },
  8: { showMs: 450, ringRatio: 0.6, distractors: 6, maskMs: 1500 },
};

/** 某级的起始展示时长：取上一级标称（更慢，老年友好）；L1 用自身标称 */
export function aInitialShowMs(level: number): number {
  const lv = Math.max(1, Math.min(A_MAX_LEVEL, level));
  return lv === 1 ? A_LEVELS[1].showMs : A_LEVELS[lv - 1].showMs;
}

/** 某级 showMs 微调下限 = 本级标称 × 0.8 */
export function aShowMsFloor(level: number): number {
  const lv = Math.max(1, Math.min(A_MAX_LEVEL, level));
  return A_LEVELS[lv].showMs * 0.8;
}

export const A_CENTER_POOL = [
  '🐇', '🐱', '🐶', '🐼', '🐰', '🦊',
  '🐵', '🐸', '🐔', '🦆', '🦉', '🦋',
] as const;

export const A_CENTER_NAMES: Record<string, string> = {
  '🐇': '野兔', '🐱': '小猫', '🐶': '小狗', '🐼': '熊猫', '🐰': '兔子', '🦊': '狐狸',
  '🐵': '猴子', '🐸': '青蛙', '🐔': '小鸡', '🦆': '鸭子', '🦉': '猫头鹰', '🦋': '蝴蝶',
};

export const A_PERIPHERAL_POOL = [
  '🌸', '🌳', '🌈', '⭐', '☀️', '🍎',
  '🍇', '🥕', '🐟', '🚗', '🏠', '🔔',
] as const;

export const A_PERIPHERAL_NAMES: Record<string, string> = {
  '🌸': '花', '🌳': '树', '🌈': '彩虹', '⭐': '星星', '☀️': '太阳', '🍎': '苹果',
  '🍇': '葡萄', '🥕': '胡萝卜', '🐟': '小鱼', '🚗': '汽车', '🏠': '房子', '🔔': '铃铛',
};

/** 8 方向：angle 为屏幕极角（0=上，顺时针，度）；word 为方位名词（TTS 用） */
export interface DirectionSpec {
  key: string;
  label: string;
  word: string;
  angle: number;
}

export const DIRECTIONS: DirectionSpec[] = [
  { key: 'top', label: '上', word: '上方', angle: 0 },
  { key: 'top-right', label: '右上', word: '右上角', angle: 45 },
  { key: 'right', label: '右', word: '右侧', angle: 90 },
  { key: 'bottom-right', label: '右下', word: '右下角', angle: 135 },
  { key: 'bottom', label: '下', word: '下方', angle: 180 },
  { key: 'bottom-left', label: '左下', word: '左下角', angle: 225 },
  { key: 'left', label: '左', word: '左侧', angle: 270 },
  { key: 'top-left', label: '左上', word: '左上角', angle: 315 },
];

// ===== 游戏 B：数口令 =====
export interface BLevelSpec {
  digits: number;
  reverse: boolean;
  showMs: number;
  waitMs: number;
  distract: 'none' | 'visual' | 'both';
}

export const B_MAX_LEVEL = 10;
export const B_LEVELS: Record<number, BLevelSpec> = {
  1: { digits: 2, reverse: false, showMs: 5000, waitMs: 1000, distract: 'none' },
  2: { digits: 3, reverse: false, showMs: 4000, waitMs: 1000, distract: 'none' },
  3: { digits: 4, reverse: false, showMs: 3500, waitMs: 1500, distract: 'none' },
  4: { digits: 4, reverse: true, showMs: 3500, waitMs: 2000, distract: 'none' },
  5: { digits: 4, reverse: true, showMs: 3000, waitMs: 2000, distract: 'visual' },
  6: { digits: 5, reverse: true, showMs: 3000, waitMs: 2500, distract: 'visual' },
  7: { digits: 5, reverse: true, showMs: 2500, waitMs: 2500, distract: 'both' },
  8: { digits: 6, reverse: true, showMs: 2500, waitMs: 3000, distract: 'both' },
  9: { digits: 7, reverse: true, showMs: 2000, waitMs: 3500, distract: 'both' },
  10: { digits: 7, reverse: true, showMs: 1500, waitMs: 4000, distract: 'both' },
};

export const B_DISTRACT_EMOJI = ['🌳', '🏀', '☂️'];
export const B_DISTRACT_LINES = ['隔壁有辆小汽车驶过', '风把窗帘吹起来啦'];

/** 手机号段前缀（出数规则：禁止开头 3 位形似电话段） */
const PHONE_PREFIX = /^(1(?:3\d|4[5-9]|5\d|6[2566]|7\d|8\d|9\d))/;

/** 生成合法数字串：首尾非 0、无相邻重复、不似电话段 */
export function genDigitString(digits: number, exclude: string[]): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const out: number[] = [];
    for (let i = 0; i < digits; i++) {
      let d = Math.floor(Math.random() * 10);
      let guard = 0;
      while (
        ((i === 0 || i === digits - 1) && d === 0) ||
        (i > 0 && d === out[i - 1])
      ) {
        d = Math.floor(Math.random() * 10);
        guard++;
        if (guard > 30) break;
      }
      out.push(d);
    }
    const s = out.join('');
    if (PHONE_PREFIX.test(s)) continue;
    if (exclude.includes(s)) continue;
    return s;
  }
  // 兜底：理论上不会到达
  return Array.from({ length: digits }, (_, i) => (i % 9) + 1).join('');
}

// ===== 游戏 C：配一对 =====
export interface CLevelSpec {
  pairs: number;
  cols: number;
  rows: number;
  flipBackMs: number;
}

export const C_MAX_LEVEL = 4;
export const C_LEVELS: Record<number, CLevelSpec> = {
  1: { pairs: 4, cols: 4, rows: 2, flipBackMs: 800 },
  2: { pairs: 5, cols: 5, rows: 2, flipBackMs: 700 },
  3: { pairs: 6, cols: 4, rows: 3, flipBackMs: 600 },
  4: { pairs: 6, cols: 4, rows: 3, flipBackMs: 500 },
};

export const C_THEMES: { name: string; emojis: string[] }[] = [
  { name: '水果', emojis: ['🍎', '🍌', '🍇', '🍊', '🍓', '🍑'] },
  { name: '动物', emojis: ['🐳', '🐘', '🦒', '🐨', '🦜', '🐙'] },
  { name: '生活', emojis: ['☂️', '🔑', '🧦', '🍵', '📱', '🧸'] },
];

// ===== 文案（PRD 逐字） =====
export const TEXTS = {
  welcome: '欢迎回来，不着急，我们从最稳的强度开始。',
  aIdleHint: '不着急，慢慢想。',
  aRelearn: (center: string, dirWord: string, peri: string) =>
    `刚才中央是${center}，周围在${dirWord}是${peri}。我们再看一遍。`,
  bBeforeShow: '别急，看稳了——',
  bReverseHint: '这回倒着说',
  bReverseLabel: '反着说',
  bAskOrder: '请按顺序说出',
  bAskReverse: '请反过来，倒着说一遍',
  bPerfect: (n: number) => `太棒了，${n}位全部记住！`,
  bPartial: (k: number) => `记住 ${k}个，很稳。`,
  bMiss: '没关系，我们再看一遍。',
  bRelearnOrder: (seq: string) =>
    `刚才出现的是 ${seq.split('').join('、')}。一起再看一遍。`,
  bRelearnReverse: (seq: string, rev: string) =>
    `刚才出现的是 ${seq.split('').join('、')}，反着说就是 ${rev.split('').join('、')}。一起再看一遍。`,
  cFirstFlip: '记住它们在哪儿。',
  cDone: (moves: number) => `全部找到啦，用了 ${moves} 次。`,
  relearn: '我们再看一遍',
  p4Farewell: '明天我来等您，不着急。',
  dailyFirstDay: '第一步就完成了，很棒的做法。',
  dailyBye: '明天我来等您，不着急。',
  shareText: (n: number) => `我在『脑力慢养』今天记住了 ${n} 个数！你也可以来玩 →`,
  shareFallback: '我在『脑力慢养』完成了今天的练习，你也可以来玩 →',

  // ===== 设置页 / 游戏内快捷开关 =====
  settingsTitle: '设置',
  settingsEntry: '设置',
  settingsVoice: '语音播报',
  settingsVoiceHint: '关掉后，游戏里就不会说话了',
  settingsSfx: '音效',
  settingsSfxHint: '关掉后，游戏里就没有提示音了',
  settingsBigFont: '特大字',
  settingsBigFontHint: '字放大一点，看着更清楚',
  settingsRate: '语速',
  settingsRateSlow: '慢一点',
  settingsRateOk: '正好',
  settingsRateFast: '快一点',
  settingsOn: '开',
  settingsOff: '关',
  settingsGameVoice: '语音',
  settingsGameSfx: '音效',
};

/** P3 鼓励语池（按成绩选择，随机取一） */
export const P3_PRAISE: Record<string, string[]> = {
  '5': ['全对登场，稳如泰山。', '5 题回合全对，漂亮的节奏。'],
  '4': ['4 题稳稳答对，很不错的成绩。'],
  '3': ['3 题都稳住了，继续保持。'],
  '2': ['2 题都稳住了，剩下的我们慢慢来。'],
  low: ['不着急，我们慢慢来，明天会更稳。'],
};

export const WEEKLY_PRAISE = {
  5: '一周 5 天，你比大多数人做得好。',
  4: '四天都来了，节奏很稳。',
  3: '这周三次，不错的节奏。',
  few: '开始就好，我们慢慢来。',
  none: '随时开始都不晚。',
} as const;
