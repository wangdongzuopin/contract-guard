import { cnToNumber } from './cn-numbers';
import type { Bound, DocumentType, Locale, Rule, RuleLimits, ScoreBand } from './types';

/**
 * 引擎输出文案（中 / 英）
 *
 * 只翻译引擎自己写的话：规则标题与建议、阈值与偏离说明、结论、文书类型。
 * 从合同里摘出来的原文（actual、期望词）保持原样 —— 那是证据，不能翻译。
 *
 * 判定逻辑与语言无关：同一份合同在两种语言下的发现项完全一致，只有文案不同。
 */

export const LOCALES: readonly Locale[] = ['zh', 'en'];
export const DEFAULT_LOCALE: Locale = 'zh';

export function isLocale(value: unknown): value is Locale {
  return value === 'zh' || value === 'en';
}

export type LimitKey = keyof RuleLimits;

/** max* 超过即违规，min* 不足即违规 */
export function boundOf(key: LimitKey): Bound {
  return key.startsWith('min') ? 'min' : 'max';
}

/** 规则在某种语言下的标题与建议 */
export interface RuleCopy {
  title: string;
  advice: string;
}

export function localizeRule(rule: Rule, locale: Locale = DEFAULT_LOCALE): RuleCopy {
  const t = rule.i18n?.[locale];
  return { title: t?.title ?? rule.title, advice: t?.advice ?? rule.advice };
}

export interface EngineStrings {
  toolName: string;
  docType: Record<DocumentType, string>;
  verdict: Record<ScoreBand, string>;
  /** 文本不是中文时的结论：规则读不懂，分数不能当真 */
  unsupportedVerdict: string;
  formatLimit(key: LimitKey, value: number): string;
  /** diff 已换算到展示单位（费率为 ‱） */
  formatDelta(key: LimitKey, diff: number): string;
  limitMessage(p: { title: string; actual: string; key: LimitKey; limit: string; delta: string }): string;
  forbiddenMessage(p: { title: string; phrase: string }): string;
  missingMessage(p: { title: string; expected: string[] }): string;
}

/* ------------------------------------------------------------------ *
 * 中文 —— 与改版前的输出逐字一致
 * ------------------------------------------------------------------ */

const ZH_BOUND: Record<LimitKey, string> = {
  maxDays: '不超过',
  minDays: '不少于',
  maxPercent: '不超过',
  minPercent: '不低于',
  maxAmount: '不超过',
  maxTimes: '不超过',
  maxYears: '不超过',
  minYears: '不少于',
  maxRate: '不超过',
};

const ZH_DELTA_UNIT: Record<LimitKey, string> = {
  maxDays: ' 天',
  minDays: ' 天',
  maxPercent: ' 个百分点',
  minPercent: ' 个百分点',
  maxAmount: ' 元',
  maxTimes: ' 倍',
  maxYears: ' 年',
  minYears: ' 年',
  maxRate: '‱',
};

const zh: EngineStrings = {
  toolName: '合同风险检查助手',
  docType: {
    commercial: '商务合同',
    employment: '雇佣/劳务合同',
    nda: '保密协议',
    commitment: '承诺/责任书',
    unknown: '未识别类型',
  },
  verdict: {
    safe: '未发现明显偏离项，可推进签署（仍建议人工复核）',
    negotiate: '存在需谈判的偏离条款，建议修改后再签署',
    risky: '存在高风险条款，建议暂缓签署并逐条谈判',
  },
  unsupportedVerdict: '文本不是中文，内置规则无法可靠判断，请勿据此推进签署',
  formatLimit(key, value) {
    switch (key) {
      case 'maxDays':
      case 'minDays':
        return `${value} 天`;
      case 'maxPercent':
      case 'minPercent':
        return `${value}%`;
      case 'maxAmount':
        return `${value.toLocaleString('zh-CN')} 元`;
      case 'maxTimes':
        return `${value} 倍`;
      case 'maxYears':
      case 'minYears':
        return `${value} 年`;
      case 'maxRate':
        return `日 ${(value * 10000).toFixed(2)}‱`;
      default:
        return String(value);
    }
  },
  formatDelta: (key, diff) => `${boundOf(key) === 'max' ? '超出' : '不足'} ${diff}${ZH_DELTA_UNIT[key]}`,
  limitMessage: ({ title, actual, key, limit, delta }) =>
    `${title}：合同约定「${actual}」，贵司红线为${ZH_BOUND[key]} ${limit}（${delta}）。`,
  forbiddenMessage: ({ title, phrase }) => `${title}：条款中出现「${phrase}」。`,
  missingMessage: ({ title, expected }) =>
    `${title}：全文未发现相关约定（期望包含：${expected.join('、')}）。`,
};

/* ------------------------------------------------------------------ *
 * English
 * ------------------------------------------------------------------ */

/** 去掉浮点尾数：0.030000000000000002 → "0.03" */
function num(v: number): string {
  return String(Number(v.toFixed(4)));
}

function count(v: number, one: string, many: string): string {
  return `${num(v)} ${v === 1 ? one : many}`;
}

const en: EngineStrings = {
  toolName: 'Contract Guard',
  docType: {
    commercial: 'Commercial contract',
    employment: 'Employment contract',
    nda: 'NDA',
    commitment: 'Commitment letter',
    unknown: 'Unrecognized type',
  },
  verdict: {
    safe: 'No major deviations found. You can proceed to signing, but a manual review is still advised.',
    negotiate: 'Some clauses deviate from your red lines. Negotiate changes before signing.',
    risky: 'High-risk clauses found. Hold off signing and negotiate clause by clause.',
  },
  unsupportedVerdict:
    'The text is not in Chinese, so the built-in rules cannot judge it reliably. Do not rely on this result to sign.',
  formatLimit(key, value) {
    switch (key) {
      case 'maxDays':
      case 'minDays':
        return count(value, 'day', 'days');
      case 'maxPercent':
      case 'minPercent':
        return `${num(value)}%`;
      case 'maxAmount':
        return `CNY ${value.toLocaleString('en-US')}`;
      case 'maxTimes':
        return `${num(value)}×`;
      case 'maxYears':
      case 'minYears':
        return count(value, 'year', 'years');
      case 'maxRate':
        return `${num(value * 100)}%/day`;
      default:
        return String(value);
    }
  },
  formatDelta(key, diff) {
    const dir = boundOf(key) === 'max' ? 'over' : 'short';
    switch (key) {
      case 'maxDays':
      case 'minDays':
        return `${count(diff, 'day', 'days')} ${dir}`;
      case 'maxPercent':
      case 'minPercent':
        return `${num(diff)} pts ${dir}`;
      case 'maxAmount':
        return `CNY ${diff.toLocaleString('en-US')} ${dir}`;
      case 'maxTimes':
        return `${num(diff)}× ${dir}`;
      case 'maxYears':
      case 'minYears':
        return `${count(diff, 'year', 'years')} ${dir}`;
      case 'maxRate':
        return `${num(diff / 100)}%/day ${dir}`;
      default:
        return `${num(diff)} ${dir}`;
    }
  },
  limitMessage: ({ title, actual, key, limit, delta }) =>
    `${title}: the contract says "${actual}", but your limit is ${
      boundOf(key) === 'max' ? 'at most' : 'at least'
    } ${limit} (${delta}).`,
  forbiddenMessage: ({ title, phrase }) => `${title}: the clause contains "${phrase}".`,
  missingMessage: ({ title, expected }) =>
    `${title}: no matching clause found (looked for: ${expected.join(', ')}).`,
};

const STRINGS: Record<Locale, EngineStrings> = { zh, en };

export function engineStrings(locale: Locale = DEFAULT_LOCALE): EngineStrings {
  return STRINGS[locale] ?? zh;
}

export function docTypeLabel(type: DocumentType, locale: Locale = DEFAULT_LOCALE): string {
  return engineStrings(locale).docType[type];
}


/**
 * 条款编号的展示形式。
 *
 * 中文原样返回；英文把「第三条」写成「Art. 3」，否则英文界面里满屏中文编号。
 * 只换展示，Finding.clauseNumber 仍保留原文，供审计与回归比对。
 */
export function formatClauseNumber(raw: string, locale: Locale = DEFAULT_LOCALE): string {
  const s = raw.replace(/\s+/g, '');
  if (locale === 'zh') return s;
  const n = (x: string): string => {
    const v = cnToNumber(x);
    return v == null ? x : String(v);
  };
  const patterns: [RegExp, (m: RegExpExecArray) => string][] = [
    [/^第(.+?)节之(.+)$/, (m) => `Sec. ${n(m[1]!)}-${n(m[2]!)}`],
    [/^第(.+)条$/, (m) => `Art. ${n(m[1]!)}`],
    [/^第(.+)章$/, (m) => `Ch. ${n(m[1]!)}`],
    [/^第(.+)[篇部]$/, (m) => `Part ${n(m[1]!)}`],
    [/^[（(](.+)[)）]$/, (m) => `(${n(m[1]!)})`],
    [/^(.+?)[、．.]$/, (m) => `${n(m[1]!)}.`],
  ];
  for (const [re, format] of patterns) {
    const m = re.exec(s);
    if (m) return format(m);
  }
  return s;
}
