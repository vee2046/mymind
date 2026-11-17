// ABOUTME: PRD §0 全局常量 + 五游戏难度表 + 素材池 + 文案
// ABOUTME: 所有数值以 PRD 为准，禁止随意调整

import { clamp } from './utils';

export type GameId = 'A' | 'B' | 'C' | 'D' | 'E';

export const GAME_NAMES: Record<GameId, string> = {
  A: '找一找',
  B: '数口令',
  C: '配一对',
  D: '赶集',
  E: '数字找家',
};

export const GAME_ICONS: Record<GameId, string> = {
  A: '🔍',
  B: '🔢',
  C: '🧩',
  D: '🧺',
  E: '🏠',
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
  /** L1–3 恒为顺说；L4 起 reverse=true 表示该级可能出现反向局（每题按算法随机决定，不再恒反向） */
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

// ===== 游戏 D：赶集（语义选择 / 抑制 / 工作记忆更新 / 心算） =====
// 认知靶点：执行功能——语义提取、集合合并、属性推理、例外抑制、
// 「老板改口」造成的规则失效与工作记忆重更新，以及心算。

/** 规则种类：category 单一类目 / union 两类都要 / attribute 属性
 *  except 类目+例外 / negation 整体取补集 / sum 算总价 */
export type DRuleKind = 'category' | 'union' | 'attribute' | 'except' | 'negation' | 'sum';

/** 摊位上的一件货 */
export interface DItem {
  id: string;
  emoji: string;
  name: string;
  cat: string; // 所属类目
  price: number; // 价格（元）
  attr?: string; // 语义属性：canDrink / staple / canWork
}

/** 可作为规则目标的类目（其余类目只做陪衬，保证规则无歧义） */
export const D_RULE_CATS = ['fruit', 'veg', 'meat', 'clean', 'flower'] as const;

export const D_CAT_NAMES: Record<string, string> = {
  fruit: '水果',
  veg: '蔬菜',
  meat: '肉蛋',
  clean: '清洁用品',
  flower: '花木',
  grain: '主食',
  drink: '饮料',
  tool: '工具',
  toy: '杂货',
};

export const D_ATTR_NAMES: Record<string, string> = {
  canDrink: '能喝的',
  staple: '当饭吃的',
  canWork: '干活用的',
};

export const D_ATTR_ICONS: Record<string, string> = {
  canDrink: '💧',
  staple: '🍚',
  canWork: '🔧',
};

/** 商品池：规则可命中项一律不带属性，属性项一律不可被类目规则命中，两者不交叉 */
export const D_CATALOG: DItem[] = [
  // 水果
  { id: 'apple', emoji: '🍎', name: '苹果', cat: 'fruit', price: 5 },
  { id: 'banana', emoji: '🍌', name: '香蕉', cat: 'fruit', price: 3 },
  { id: 'grape', emoji: '🍇', name: '葡萄', cat: 'fruit', price: 9 },
  { id: 'orange', emoji: '🍊', name: '橘子', cat: 'fruit', price: 4 },
  { id: 'strawberry', emoji: '🍓', name: '草莓', cat: 'fruit', price: 10 },
  { id: 'peach', emoji: '🍑', name: '桃子', cat: 'fruit', price: 6 },
  // 蔬菜
  { id: 'cabbage', emoji: '🥬', name: '白菜', cat: 'veg', price: 2 },
  { id: 'carrot', emoji: '🥕', name: '胡萝卜', cat: 'veg', price: 3 },
  { id: 'eggplant', emoji: '🍆', name: '茄子', cat: 'veg', price: 4 },
  { id: 'cauliflower', emoji: '🥦', name: '花菜', cat: 'veg', price: 5 },
  { id: 'cucumber', emoji: '🥒', name: '黄瓜', cat: 'veg', price: 3 },
  { id: 'onion', emoji: '🧅', name: '洋葱', cat: 'veg', price: 3 },
  // 肉蛋
  { id: 'egg', emoji: '🥚', name: '鸡蛋', cat: 'meat', price: 6 },
  { id: 'chicken', emoji: '🐔', name: '鸡肉', cat: 'meat', price: 12 },
  { id: 'beef', emoji: '🥩', name: '牛肉', cat: 'meat', price: 15 },
  { id: 'fish', emoji: '🐟', name: '鱼', cat: 'meat', price: 10 },
  { id: 'shrimp', emoji: '🦐', name: '虾', cat: 'meat', price: 14 },
  // 清洁用品
  { id: 'soap', emoji: '🧴', name: '香皂', cat: 'clean', price: 6 },
  { id: 'tissue', emoji: '🧻', name: '纸巾', cat: 'clean', price: 3 },
  { id: 'toothbrush', emoji: '🪥', name: '牙刷', cat: 'clean', price: 5 },
  { id: 'detergent', emoji: '🧼', name: '洗衣粉', cat: 'clean', price: 8 },
  { id: 'sponge', emoji: '🧽', name: '海绵', cat: 'clean', price: 2 },
  // 花木
  { id: 'tulip', emoji: '🌷', name: '郁金香', cat: 'flower', price: 5 },
  { id: 'rose', emoji: '🌹', name: '玫瑰', cat: 'flower', price: 7 },
  { id: 'sunflower', emoji: '🌻', name: '向日葵', cat: 'flower', price: 4 },
  { id: 'pothos', emoji: '🌿', name: '绿萝', cat: 'flower', price: 6 },
  { id: 'cactus', emoji: '🌵', name: '仙人掌', cat: 'flower', price: 5 },
  // 主食（当饭吃的）
  { id: 'rice', emoji: '🍚', name: '米饭', cat: 'grain', price: 2, attr: 'staple' },
  { id: 'noodle', emoji: '🍜', name: '面条', cat: 'grain', price: 4, attr: 'staple' },
  { id: 'bread', emoji: '🍞', name: '面包', cat: 'grain', price: 5, attr: 'staple' },
  { id: 'dumpling', emoji: '🥟', name: '饺子', cat: 'grain', price: 8, attr: 'staple' },
  { id: 'onigiri', emoji: '🍙', name: '饭团', cat: 'grain', price: 6, attr: 'staple' },
  // 饮料（能喝的）
  { id: 'tea', emoji: '🍵', name: '茶', cat: 'drink', price: 4, attr: 'canDrink' },
  { id: 'milk', emoji: '🥛', name: '牛奶', cat: 'drink', price: 6, attr: 'canDrink' },
  { id: 'juice', emoji: '🥤', name: '果汁', cat: 'drink', price: 5, attr: 'canDrink' },
  { id: 'soda', emoji: '🧃', name: '汽水', cat: 'drink', price: 3, attr: 'canDrink' },
  { id: 'coffee', emoji: '☕', name: '咖啡', cat: 'drink', price: 8, attr: 'canDrink' },
  // 工具（干活用的）
  { id: 'hammer', emoji: '🔨', name: '锤子', cat: 'tool', price: 12, attr: 'canWork' },
  { id: 'scissors', emoji: '✂️', name: '剪刀', cat: 'tool', price: 8, attr: 'canWork' },
  { id: 'wrench', emoji: '🔧', name: '扳手', cat: 'tool', price: 15, attr: 'canWork' },
  { id: 'ladder', emoji: '🪜', name: '梯子', cat: 'tool', price: 18, attr: 'canWork' },
  { id: 'pickaxe', emoji: '⛏️', name: '镐子', cat: 'tool', price: 14, attr: 'canWork' },
  // 杂货（纯陪衬）
  { id: 'teddy', emoji: '🧸', name: '小熊', cat: 'toy', price: 25 },
  { id: 'balloon', emoji: '🎈', name: '气球', cat: 'toy', price: 1 },
  { id: 'kite', emoji: '🪁', name: '风筝', cat: 'toy', price: 6 },
];

export interface DLevelSpec {
  items: number; // 摊位商品数上限
  sumRounds: number; // 算账题占比（0–1）
  rules: DRuleKind[]; // 本级可用的规则种类
  switchable: boolean; // 本级是否可能「改口」
  minSwitches: number; // 一局至少改口次数
  sumItems: number; // 算账题参与求和的商品数
  maxTargets: number; // 挑货题最多命中件数
  negExcludes: number; // 「除了…」可排除件数
  ruleDisplay: 'full' | 'slim' | 'hidden'; // 规则呈现方式
  ruleShowMs: number; // 规则展示时长
}

export const D_MAX_LEVEL = 8;
export const D_LEVELS: Record<number, DLevelSpec> = {
  1: { items: 4, sumRounds: 0, rules: ['category'], switchable: false, minSwitches: 0, sumItems: 2, maxTargets: 2, negExcludes: 1, ruleDisplay: 'full', ruleShowMs: 2600 },
  2: { items: 5, sumRounds: 0, rules: ['category'], switchable: false, minSwitches: 0, sumItems: 2, maxTargets: 2, negExcludes: 1, ruleDisplay: 'full', ruleShowMs: 2400 },
  3: { items: 6, sumRounds: 0, rules: ['category', 'union'], switchable: false, minSwitches: 0, sumItems: 2, maxTargets: 3, negExcludes: 1, ruleDisplay: 'full', ruleShowMs: 2200 },
  4: { items: 6, sumRounds: 0.2, rules: ['category', 'union'], switchable: true, minSwitches: 1, sumItems: 3, maxTargets: 3, negExcludes: 1, ruleDisplay: 'slim', ruleShowMs: 2000 },
  5: { items: 7, sumRounds: 0.2, rules: ['category', 'union', 'attribute'], switchable: true, minSwitches: 1, sumItems: 3, maxTargets: 3, negExcludes: 1, ruleDisplay: 'slim', ruleShowMs: 1800 },
  6: { items: 8, sumRounds: 0.2, rules: ['category', 'union', 'attribute', 'except'], switchable: true, minSwitches: 1, sumItems: 4, maxTargets: 4, negExcludes: 1, ruleDisplay: 'slim', ruleShowMs: 1600 },
  7: { items: 8, sumRounds: 0.2, rules: ['category', 'union', 'attribute', 'except', 'negation'], switchable: true, minSwitches: 1, sumItems: 4, maxTargets: 4, negExcludes: 1, ruleDisplay: 'hidden', ruleShowMs: 2000 },
  8: { items: 8, sumRounds: 0.4, rules: ['category', 'union', 'attribute', 'except', 'negation'], switchable: true, minSwitches: 2, sumItems: 4, maxTargets: 4, negExcludes: 2, ruleDisplay: 'hidden', ruleShowMs: 2200 },
};

/** 算账题可用的商品类目（只挑日常买菜，单价温和好口算） */
export const D_SUM_CATS = ['fruit', 'veg', 'meat', 'grain', 'drink'] as const;
/** 算账题单价上限（保证总价不超两位数） */
export const D_SUM_MAX_PRICE = 12;

// ===== 游戏 E：数字找家（数轴估计） =====
export interface ELevelSpec {
  max: number; // 数轴右端（左端恒 0）
  ticks: number[]; // 标注刻度（含两端）
  tolerance: number; // 判对容差（±）
  step: number; // 目标取值步长（1 = 任意整数）
}

export const E_MAX_LEVEL = 6;
export const E_LEVELS: Record<number, ELevelSpec> = {
  1: { max: 10, ticks: [0, 5, 10], tolerance: 1, step: 1 },
  2: { max: 20, ticks: [0, 10, 20], tolerance: 2, step: 1 },
  3: { max: 50, ticks: [0, 25, 50], tolerance: 3, step: 5 },
  4: { max: 100, ticks: [0, 50, 100], tolerance: 5, step: 5 },
  5: { max: 100, ticks: [0, 25, 50, 75, 100], tolerance: 6, step: 1 },
  6: { max: 100, ticks: [0, 50, 100], tolerance: 5, step: 1 },
};

/** 生成一题的目标数：非刻度值、本局不重复 */
export function genETarget(level: number, exclude: number[]): number {
  const s = E_LEVELS[clamp(level, 1, E_MAX_LEVEL)];
  const cands: number[] = [];
  for (let v = s.step; v <= s.max - s.step; v += s.step) {
    if (s.ticks.includes(v)) continue;
    if (exclude.includes(v)) continue;
    cands.push(v);
  }
  if (cands.length === 0) {
    return Math.max(s.step, Math.round(s.max / 2 / s.step) * s.step);
  }
  return cands[Math.floor(Math.random() * cands.length)];
}

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
  dGreeting: '老板说',
  dSwitchBanner: '等等，改主意了',
  dSwitchIntro: (say: string) => `等等，改主意了 —— ${say}`,
  dGood: '挑得真准，就这么办。',
  dGoodSum: '算得对，一点没错。',
  dMiss: '没关系，我们再看一遍。',
  dRelearn: '我们再看一遍',
  dTake: '该拿',
  dSkip: '不用拿',
  dTotal: (n: number) => `一共是 ${n} 元`,
  dSumAsk: '这些一起买，算算一共多少钱？',
  dSumPick: '选一个价钱',
  dRecall: '👀 想起来了',
  dRecallHint: '看一眼刚才的规矩',
  dHidden: '规矩收起来啦',
  dConfirm: '挑好了',
  dConfirmSum: '就这些',
  dSwitchTag: '改过主意',
  dSeeStall: '看看摊位上的货',
  dDaily: (t: number, y: number) => `今天赶集挑对 ${t} 题，昨天是 ${y} 题。`,
  dPickHint: '照规矩挑好，再按下面的按钮',
  dPickNeed: '先挑几样，再按下面的按钮',
  dSumNeed: '先选一个价钱，再按下面的按钮',
  eHow: '在线上点一下，再按「放好了」。',
  eAsk: (n: number) => `帮 ${n} 找家，点一点下面的线。`,
  eGood: '对了，就是这里，正合适。',
  eNear: '很近了，就差一点点。',
  eFar: '没关系，看看它的家在哪儿。',
  eReveal: (n: number) => `${n} 的家在这里。`,
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
