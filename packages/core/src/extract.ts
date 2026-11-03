import { CN_NUM_CLASS, parseNumber } from './cn-numbers';
import type { Dimension, ExtractedValue, Polarity } from './types';

/**
 * 数值抽取
 *
 * 全部为确定性规则，不调用任何模型。抽取结果可复现、可审计 —— 这是法务场景的硬需求。
 */

interface DurationUnit {
  unit: string;
  /** 折算为天数 */
  days: number;
}

/** 期限单位。注意「工作日」与「自然日」必须区分（30 个工作日 ≈ 42 天）。 */
const DURATION_UNITS: DurationUnit[] = [
  { unit: '个工作自然月', days: 30.4 },
  { unit: '个自然月', days: 30.4 },
  { unit: '个自然日', days: 1 },
  { unit: '个工作日', days: 1.4 },
  { unit: '自然月', days: 30.4 },
  { unit: '自然日', days: 1 },
  { unit: '个月', days: 30.4 },
  { unit: '工作日', days: 1.4 },
  { unit: '个星期', days: 7 },
  { unit: '个季度', days: 91 },
  { unit: '星期', days: 7 },
  { unit: '季度', days: 91 },
  { unit: '月', days: 30.4 },
  { unit: '天', days: 1 },
  { unit: '日', days: 1 },
  { unit: '周', days: 7 },
  { unit: '年', days: 365 },
];

const AMOUNT_UNITS: { unit: string; mul: number }[] = [
  { unit: '亿元', mul: 1e8 },
  { unit: '万元', mul: 1e4 },
  { unit: '千元', mul: 1e3 },
  { unit: '元', mul: 1 },
];

function alt(units: string[]): string {
  return [...units].sort((a, b) => b.length - a.length).join('|');
}

const NUM = `(?:\\d+(?:\\.\\d+)?|${CN_NUM_CLASS})`;

const DURATION_RE = new RegExp(`(${NUM})\\s*(${alt(DURATION_UNITS.map((u) => u.unit))})`, 'g');
const AMOUNT_RE = new RegExp(`(${NUM})\\s*(${alt(AMOUNT_UNITS.map((u) => u.unit))})`, 'g');
const PERCENT_RE = new RegExp(`(${NUM})\\s*(%|％)`, 'g');
const PERCENT_CN_RE = new RegExp(`百分之\\s*(${NUM})`, 'g');
const TIMES_RE = new RegExp(`(${NUM})\\s*倍`, 'g');
const RATE_RE = new RegExp(`(万|千)分之\\s*(${NUM})`, 'g');

/**
 * 日期表达式 —— 必须先识别出来，否则会被当成期限。
 *
 * 「2026 年 8 月 31 日」若按期限抽取，会得到「2026 年 = 739490 天」这种荒谬值，
 * 进而把「交货日期」误判成「验收期超期」。
 *
 * 注意：只认「4 位数年 + 月 + 日」的完整日期形态，
 * 「3 个月」「2 年」这类真正的期限不会被误伤。
 */
const DATE_RE = /\d{4}\s*年(?:\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?)?|\d{1,2}\s*月\s*\d{1,2}\s*日/g;

const MAX_MARKERS = [
  '不超过',
  '不得超过',
  '不得高于',
  '不高于',
  '不多于',
  '不得多于',
  '不多于',
  '不超出',
  '至多',
  '最多',
  '最长',
  '最迟',
  '上限',
  '最高',
];
const MIN_MARKERS = [
  '不得少于',
  '不低于',
  '不少于',
  '不得低于',
  '至少',
  '最短',
  '不早于',
  '不晚于',
  '不迟于',
  '不得晚于',
  '不得迟于',
  '下限',
  '最低',
];
const OBLIGATION_MARKERS = [
  '应当',
  '应',
  '须',
  '必须',
  '承诺',
  '保证',
  '无条件',
  '视为',
  '承担',
  '逾期',
];

function detectPolarity(context: string): { polarity: Polarity; modifier?: string } {
  const win = context.slice(-14);
  for (const m of MAX_MARKERS) {
    if (win.includes(m)) return { polarity: 'max', modifier: m };
  }
  for (const m of MIN_MARKERS) {
    if (win.includes(m)) return { polarity: 'min', modifier: m };
  }
  for (const m of OBLIGATION_MARKERS) {
    if (win.includes(m)) return { polarity: 'obligation', modifier: m };
  }
  return { polarity: 'neutral' };
}

/** 「日利率 5%」这类按日计的百分比，应归入 rate 量纲 */
function isDailyPercent(after: string): boolean {
  const tail = after.slice(0, 6);
  return /(\/|每)\s*日|日\s*(利率|息)|按日|每日/.test(tail);
}

interface RawMatch {
  raw: string;
  start: number;
  end: number;
  number: number;
  unit: string;
  dimension: Dimension;
  /** 按 dimension 归一化后的值 */
  value: number;
  /** 原始单位下的数值（如「3 年」→ 3） */
  unitValue: number;
}

function collect(text: string): RawMatch[] {
  const out: RawMatch[] = [];
  const taken: { start: number; end: number }[] = [];

  // 先圈出日期区间，落在日期里的数字一律不作为期限/比例
  const dateSpans: { start: number; end: number }[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    dateSpans.push({ start: m.index, end: m.index + m[0].length });
  }
  const inDate = (s: number, e: number) => dateSpans.some((d) => s < d.end && e > d.start);

  const overlaps = (s: number, e: number) => taken.some((t) => s < t.end && e > t.start);

  const push = (m: RawMatch) => {
    if (inDate(m.start, m.end)) return;
    if (overlaps(m.start, m.end)) return;
    taken.push({ start: m.start, end: m.end });
    out.push(m);
  };

  // 费率：万分之 / 千分之
  for (const m of text.matchAll(RATE_RE)) {
    const n = parseNumber(m[2] ?? '');
    if (n == null) continue;
    // 用除法而不是乘 1e-4：3 * 1e-4 = 0.00030000000000000003 > 0.0003，
    // 会让「万分之三」被误判为超出「万分之三」的红线。
    const value = m[1] === '万' ? n / 10000 : n / 1000;
    push({
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
      number: n,
      unit: m[1] === '万' ? '万分之' : '千分之',
      dimension: 'rate',
      value,
      unitValue: n,
    });
  }

  // 百分比（百分之X 优先）
  for (const m of text.matchAll(PERCENT_CN_RE)) {
    const n = parseNumber(m[1] ?? '');
    if (n == null) continue;
    push({
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
      number: n,
      unit: '百分之',
      dimension: 'percent',
      value: n,
      unitValue: n,
    });
  }

  for (const m of text.matchAll(PERCENT_RE)) {
    const n = parseNumber(m[1] ?? '');
    if (n == null) continue;
    const after = text.slice(m.index + m[0].length);
    const daily = isDailyPercent(after);
    push({
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
      number: n,
      unit: daily ? '%/日' : '%',
      dimension: daily ? 'rate' : 'percent',
      value: daily ? n / 100 : n,
      unitValue: n,
    });
  }

  // 倍数
  for (const m of text.matchAll(TIMES_RE)) {
    const n = parseNumber(m[1] ?? '');
    if (n == null) continue;
    push({
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
      number: n,
      unit: '倍',
      dimension: 'times',
      value: n,
      unitValue: n,
    });
  }

  // 金额
  for (const m of text.matchAll(AMOUNT_RE)) {
    const n = parseNumber(m[1] ?? '');
    if (n == null) continue;
    const unit = AMOUNT_UNITS.find((u) => u.unit === m[2]);
    if (!unit) continue;
    push({
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
      number: n,
      unit: unit.unit,
      dimension: 'amount',
      value: n * unit.mul,
      unitValue: n,
    });
  }

  // 期限
  for (const m of text.matchAll(DURATION_RE)) {
    const n = parseNumber(m[1] ?? '');
    if (n == null) continue;
    const unit = DURATION_UNITS.find((u) => u.unit === m[2]);
    if (!unit) continue;
    push({
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
      number: n,
      unit: unit.unit,
      dimension: 'days',
      value: n * unit.days,
      unitValue: n,
    });
  }

  return out.sort((a, b) => a.start - b.start);
}

/**
 * 从一段文本中抽取全部数值。
 *
 * @param text 文本（通常是单个条款正文）
 */
export function extractValues(text: string): ExtractedValue[] {
  return collect(text).map((m) => {
    const { polarity, modifier } = detectPolarity(text.slice(0, m.start));
    return {
      raw: m.raw,
      value: m.value,
      unitValue: m.unitValue,
      dimension: m.dimension,
      unit: m.unit,
      polarity,
      modifier,
      start: m.start,
      end: m.end,
    };
  });
}

/** 按量纲筛选 */
export function valuesOfDimension(values: ExtractedValue[], dimension: Dimension): ExtractedValue[] {
  return values.filter((v) => v.dimension === dimension);
}
