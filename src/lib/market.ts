// ABOUTME: 游戏 D「赶集」出题器（纯函数）：规则 → 目标集合 → 摊位商品
// ABOUTME: 目标集一律由规则推导；类目与属性分区不交叉，保证一条规则只有一个答案

import {
  D_ATTR_ICONS,
  D_ATTR_NAMES,
  D_CATALOG,
  D_CAT_NAMES,
  D_LEVELS,
  D_MAX_LEVEL,
  D_RULE_CATS,
  D_SUM_CATS,
  D_SUM_MAX_PRICE,
  SET_SIZE,
  TEXTS,
  type DItem,
  type DLevelSpec,
  type DRuleKind,
} from './constants';
import type { DRule, DRound, DRoundPlan } from './types';
import { clamp, sample, shuffle } from './utils';

export function dSpec(level: number): DLevelSpec {
  return D_LEVELS[clamp(level, 1, D_MAX_LEVEL)];
}

function catPool(cat: string): DItem[] {
  return D_CATALOG.filter((i) => i.cat === cat);
}

function iconOf(kind: DRuleKind, attr: string | null): string {
  if (kind === 'attribute') return attr ? (D_ATTR_ICONS[attr] ?? '🧺') : '🧺';
  if (kind === 'except' || kind === 'negation') return '🙅';
  if (kind === 'sum') return '🧮';
  return '🧺';
}

function makeRule(
  kind: DRuleKind,
  say: string,
  short: string,
  cats: string[],
  attr: string | null,
  exclude: string[],
): DRule {
  return { kind, icon: iconOf(kind, attr), say, short, cats, attr, exclude };
}

/** 规则命中的商品 id 集合（唯一真源：所有判定都由它推出） */
export function targetIds(rule: DRule, items: DItem[]): string[] {
  const base =
    rule.kind === 'attribute'
      ? items.filter((i) => i.attr === rule.attr)
      : rule.kind === 'negation'
        ? items
        : items.filter((i) => rule.cats.includes(i.cat));
  return base.filter((i) => !rule.exclude.includes(i.name)).map((i) => i.id);
}

/** 陪衬商品不能命中规则，否则会出现第二个正确答案 */
function fillerAllowed(item: DItem, rule: DRule): boolean {
  if (rule.exclude.includes(item.name)) return false;
  if (rule.kind === 'negation') return true;
  if (rule.kind === 'attribute') return item.attr !== rule.attr;
  return !rule.cats.includes(item.cat);
}

function fillStall(focus: DItem[], total: number, rule: DRule): DItem[] | null {
  const need = total - focus.length;
  if (need < 0) return null;
  const used = new Set(focus.map((i) => i.id));
  const pool = D_CATALOG.filter((i) => !used.has(i.id) && fillerAllowed(i, rule));
  if (pool.length < need) return null;
  const chosen: DItem[] = [];
  // 预留「改口」素材：另一类可规则类目 + 一件带属性的商品
  const otherCat = D_RULE_CATS.find((c) => !rule.cats.includes(c));
  if (otherCat) {
    const cand = pool.find((i) => i.cat === otherCat);
    if (cand) {
      chosen.push(cand);
      used.add(cand.id);
    }
  }
  const attrCand = pool.find((i) => i.attr && !used.has(i.id));
  if (attrCand && chosen.length < need) {
    chosen.push(attrCand);
    used.add(attrCand.id);
  }
  const rest = pool.filter((i) => !used.has(i.id));
  chosen.push(...sample(rest, need - chosen.length));
  return shuffle([...focus, ...chosen]);
}

interface Stall {
  rule: DRule;
  items: DItem[];
}

// ===== 各类规则的摊位构造 =====

function buildCategory(spec: DLevelSpec): Stall | null {
  for (const cat of shuffle([...D_RULE_CATS])) {
    const pool = catPool(cat);
    if (pool.length === 0) continue;
    const focus = sample(pool, Math.min(spec.maxTargets, pool.length));
    const rule = makeRule(
      'category',
      `今天只要${D_CAT_NAMES[cat]}`,
      `只要${D_CAT_NAMES[cat]}`,
      [cat],
      null,
      [],
    );
    const items = fillStall(focus, spec.items, rule);
    if (items) return { rule, items };
  }
  return null;
}

function buildUnion(spec: DLevelSpec): Stall | null {
  const cats = shuffle([...D_RULE_CATS]);
  for (let a = 0; a < cats.length; a++) {
    for (let b = a + 1; b < cats.length; b++) {
      const c1 = cats[a];
      const c2 = cats[b];
      const p1 = catPool(c1);
      const p2 = catPool(c2);
      if (p1.length === 0 || p2.length === 0) continue;
      const focus = [...sample(p1, 1), ...sample(p2, 1)];
      const extraCount = Math.max(0, spec.maxTargets - 2);
      for (let k = 0; k < extraCount; k++) {
        const extraPool = Math.random() < 0.5 ? p1 : p2;
        const used = new Set(focus.map((i) => i.id));
        const rest = extraPool.filter((i) => !used.has(i.id));
        if (rest.length > 0) focus.push(sample(rest, 1)[0]);
      }
      const rule = makeRule(
        'union',
        `${D_CAT_NAMES[c1]}和${D_CAT_NAMES[c2]}都要`,
        `${D_CAT_NAMES[c1]}和${D_CAT_NAMES[c2]}`,
        [c1, c2],
        null,
        [],
      );
      const items = fillStall(focus, spec.items, rule);
      if (items) return { rule, items };
    }
  }
  return null;
}

function buildAttribute(spec: DLevelSpec): Stall | null {
  for (const attr of shuffle(Object.keys(D_ATTR_NAMES))) {
    const pool = D_CATALOG.filter((i) => i.attr === attr);
    if (pool.length === 0) continue;
    const focus = sample(pool, Math.min(spec.maxTargets, pool.length));
    const rule = makeRule(
      'attribute',
      `只要${D_ATTR_NAMES[attr]}`,
      `只要${D_ATTR_NAMES[attr]}`,
      [],
      attr,
      [],
    );
    const items = fillStall(focus, spec.items, rule);
    if (items) return { rule, items };
  }
  return null;
}

/** 「只要水果，除了苹果」：类目 + 例外，命中集更小、鉴别更细 */
function buildExcept(spec: DLevelSpec): Stall | null {
  for (const cat of shuffle([...D_RULE_CATS])) {
    const pool = catPool(cat);
    if (pool.length < 2) continue;
    const focus = sample(pool, Math.min(spec.maxTargets, pool.length));
    const exc = focus[0];
    const rule = makeRule(
      'except',
      `只要${D_CAT_NAMES[cat]}，除了${exc.name}`,
      `${D_CAT_NAMES[cat]}·去掉${exc.name}`,
      [cat],
      null,
      [exc.name],
    );
    const items = fillStall(focus, spec.items, rule);
    if (items) return { rule, items };
  }
  return null;
}

/** 「除了苹果，其余都要」：整体取补集，纯抑制，命中集很大 */
function buildNegation(spec: DLevelSpec): Stall | null {
  const total = Math.min(spec.items, 5);
  for (const cat of shuffle([...D_RULE_CATS])) {
    const pool = catPool(cat);
    if (pool.length < 2) continue;
    const excCount = clamp(spec.negExcludes, 1, pool.length - 1);
    const focus = sample(pool, Math.min(pool.length, excCount + 1));
    const excluded = focus.slice(0, excCount);
    const names = excluded.map((i) => i.name);
    const rule = makeRule(
      'negation',
      `除了${names.join('和')}，其余都要`,
      `除了${names.join('、')}，其余都要`,
      [],
      null,
      names,
    );
    const items = fillStall(focus, total, rule);
    if (items) return { rule, items };
  }
  return null;
}

function buildPickStall(kind: DRuleKind, spec: DLevelSpec): Stall | null {
  switch (kind) {
    case 'category':
      return buildCategory(spec);
    case 'union':
      return buildUnion(spec);
    case 'attribute':
      return buildAttribute(spec);
    case 'except':
      return buildExcept(spec);
    case 'negation':
      return buildNegation(spec);
    default:
      return null;
  }
}

/** 兜底：单一类目规则一定能构造出来（水果池足够大） */
function mustCategory(spec: DLevelSpec): Stall {
  const cat = 'fruit';
  const pool = catPool(cat);
  const focus = sample(pool, Math.min(spec.maxTargets, pool.length));
  const rule = makeRule(
    'category',
    `今天只要${D_CAT_NAMES[cat]}`,
    `只要${D_CAT_NAMES[cat]}`,
    [cat],
    null,
    [],
  );
  const items = fillStall(focus, spec.items, rule) ?? [...focus];
  return { rule, items };
}

// ===== 改口：只换规则，不换货架 =====

/** 用现有货架生成一条规则（不新增商品） */
function ruleFromItems(kind: DRuleKind, items: DItem[]): DRule | null {
  if (kind === 'category') {
    const present = D_RULE_CATS.filter((c) => items.some((i) => i.cat === c));
    if (present.length === 0) return null;
    const cat = present[Math.floor(Math.random() * present.length)];
    return makeRule(
      'category',
      `今天只要${D_CAT_NAMES[cat]}`,
      `只要${D_CAT_NAMES[cat]}`,
      [cat],
      null,
      [],
    );
  }
  if (kind === 'union') {
    const present = shuffle(D_RULE_CATS.filter((c) => items.some((i) => i.cat === c)));
    if (present.length < 2) return null;
    const c1 = present[0];
    const c2 = present[1];
    return makeRule(
      'union',
      `${D_CAT_NAMES[c1]}和${D_CAT_NAMES[c2]}都要`,
      `${D_CAT_NAMES[c1]}和${D_CAT_NAMES[c2]}`,
      [c1, c2],
      null,
      [],
    );
  }
  if (kind === 'attribute') {
    const attrs = Object.keys(D_ATTR_NAMES).filter((a) => items.some((i) => i.attr === a));
    if (attrs.length === 0) return null;
    const attr = attrs[Math.floor(Math.random() * attrs.length)];
    return makeRule(
      'attribute',
      `只要${D_ATTR_NAMES[attr]}`,
      `只要${D_ATTR_NAMES[attr]}`,
      [],
      attr,
      [],
    );
  }
  if (kind === 'except') {
    const present = D_RULE_CATS.filter((c) => items.filter((i) => i.cat === c).length >= 2);
    if (present.length === 0) return null;
    const cat = present[Math.floor(Math.random() * present.length)];
    const inCat = items.filter((i) => i.cat === cat);
    const exc = inCat[Math.floor(Math.random() * inCat.length)];
    return makeRule(
      'except',
      `只要${D_CAT_NAMES[cat]}，除了${exc.name}`,
      `${D_CAT_NAMES[cat]}·去掉${exc.name}`,
      [cat],
      null,
      [exc.name],
    );
  }
  if (kind === 'negation') {
    // 排除一件「同类里很典型」的，让类别启发式失效
    const counts = new Map<string, number>();
    for (const i of items) counts.set(i.cat, (counts.get(i.cat) ?? 0) + 1);
    const cand = items.filter((i) => (counts.get(i.cat) ?? 0) >= 2);
    if (cand.length === 0) return null;
    const exc = cand[Math.floor(Math.random() * cand.length)];
    return makeRule(
      'negation',
      `除了${exc.name}，其余都要`,
      `除了${exc.name}，其余都要`,
      [],
      null,
      [exc.name],
    );
  }
  return null;
}

/** 改口规则的优先顺序：例外 → 取补集 → 属性 → 合并 → 单一类目 */
const SWITCH_ORDER: DRuleKind[] = ['except', 'negation', 'attribute', 'union', 'category'];

function buildSwitchRule(ruleA: DRule, items: DItem[], spec: DLevelSpec): DRule | null {
  const targetA = targetIds(ruleA, items);
  for (const kind of SWITCH_ORDER) {
    if (!spec.rules.includes(kind)) continue;
    const cand = ruleFromItems(kind, items);
    if (!cand) continue;
    const t = targetIds(cand, items);
    if (t.length === 0) continue;
    const same = t.length === targetA.length && t.every((id) => targetA.includes(id));
    if (same) continue;
    return cand;
  }
  return null;
}

// ===== 算账题 =====

function makeOptions(answer: number): number[] {
  const set = new Set<number>([answer]);
  const deltas = shuffle([1, 2, -1, 3, -2, 4, -3, 5, -5, 10]);
  for (const d of deltas) {
    if (set.size >= 4) break;
    const v = answer + d;
    if (v > 0 && !set.has(v)) set.add(v);
  }
  let k = 2;
  while (set.size < 4) {
    if (!set.has(answer + k)) set.add(answer + k);
    k++;
  }
  return [...set].sort((a, b) => a - b);
}

function buildSumRound(spec: DLevelSpec): DRound {
  const pool = D_CATALOG.filter(
    (i) => (D_SUM_CATS as readonly string[]).includes(i.cat) && i.price <= D_SUM_MAX_PRICE,
  );
  const n = clamp(spec.sumItems, 2, 4);
  const chosen: DItem[] = [];
  const prices = new Set<number>();
  let guard = 0;
  while (chosen.length < n && guard < 80) {
    guard++;
    const cand = pool[Math.floor(Math.random() * pool.length)];
    if (!cand || prices.has(cand.price)) continue;
    prices.add(cand.price);
    chosen.push(cand);
  }
  while (chosen.length < n) {
    const cand = pool[Math.floor(Math.random() * pool.length)];
    if (cand) chosen.push(cand);
  }
  const answer = chosen.reduce((s, i) => s + i.price, 0);
  const rule = makeRule('sum', TEXTS.dSumAsk, '算总价', [], null, []);
  return { kind: 'sum', rule, items: chosen, answer, options: makeOptions(answer) };
}

// ===== 对外接口 =====

/** 一局 5 题的出题计划：哪些题算账、哪些题会「改口」 */
export function genPlan(level: number): DRoundPlan[] {
  const spec = dSpec(level);
  const sumCount = clamp(Math.round(spec.sumRounds * SET_SIZE), 0, SET_SIZE - 2);
  const positions = shuffle([...Array(SET_SIZE).keys()]);
  const sumPos = new Set(positions.slice(0, sumCount));
  const pickPos = positions.slice(sumCount);
  const switchCount = clamp(spec.minSwitches, 0, pickPos.length);
  const switchPos = new Set(pickPos.slice(0, switchCount));
  const plan: DRoundPlan[] = [];
  for (let i = 0; i < SET_SIZE; i++) {
    plan.push({ kind: sumPos.has(i) ? 'sum' : 'pick', switch: switchPos.has(i) });
  }
  return plan;
}

/** 按计划出一题（改口规则在同一次货架上生成） */
export function genRound(plan: DRoundPlan, level: number): DRound {
  const spec = dSpec(level);
  if (plan.kind === 'sum') return buildSumRound(spec);
  for (const kind of shuffle(spec.rules.filter((k) => k !== 'sum'))) {
    const built = buildPickStall(kind, spec);
    if (!built) continue;
    const nextRule =
      plan.switch && spec.switchable ? buildSwitchRule(built.rule, built.items, spec) : null;
    return { kind: 'pick', rule: built.rule, nextRule, items: built.items };
  }
  const fb = mustCategory(spec);
  return { kind: 'pick', rule: fb.rule, nextRule: null, items: fb.items };
}
