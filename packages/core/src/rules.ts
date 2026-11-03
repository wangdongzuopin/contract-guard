import { MATCH_THRESHOLD, scoreClause } from './classify';
import { extractValues } from './extract';
import {
  DEFAULT_LOCALE,
  boundOf,
  engineStrings,
  localizeRule,
  type EngineStrings,
  type LimitKey,
  type RuleCopy,
} from './i18n';
import { allPhrasePositions, findPhrase, hasPhrase } from './phrase';
import type { Clause, ExtractedValue, Finding, Locale, Rule, Severity } from './types';

/**
 * 规则引擎
 *
 * 三种判定：
 *   limit     —— 数值阈值（与合同里的实际值比对）
 *   forbidden —— 出现即违规的表述
 *   missing   —— 全文缺失的必备条款
 *
 * 全部确定性计算，无模型参与，结果可复现、可审计。
 * 文案按 locale 输出；判定本身与语言无关。
 */

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** 锚点「特异性」权重：更长的锚点（更具体的词）优先于只差一个字符的短锚点 */
const SPECIFICITY_WEIGHT = 3;

/** 单条规则单条款最多报告几个超限值（避免噪声） */
const MAX_FINDINGS_PER_RULE_CLAUSE = 3;

/** 浮点比较的相对容差 */
const EPS = 1e-9;

function excerpt(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** 定位子串在条款正文中的位置，用于高亮（容忍换行） */
function locate(clause: Clause, needle: string): { start: number; end: number } | undefined {
  const pos = findPhrase(clause.text, needle);
  if (!pos) return undefined;
  return { start: clause.start + pos.start, end: clause.start + pos.end };
}

interface LimitSpec {
  key: LimitKey;
  dimension: 'days' | 'percent' | 'amount' | 'times' | 'rate';
  /** 只看「年」单位的值 */
  yearOnly?: boolean;
  /** 用原始单位下的数值比较（年规则用「年」而不是折算后的天） */
  useUnitValue?: boolean;
}

/** 比较方向由 key 决定（见 boundOf）：max* 超过即违规，min* 不足即违规 */
const LIMIT_SPECS: LimitSpec[] = [
  { key: 'maxDays', dimension: 'days' },
  { key: 'minDays', dimension: 'days' },
  { key: 'maxPercent', dimension: 'percent' },
  { key: 'minPercent', dimension: 'percent' },
  { key: 'maxAmount', dimension: 'amount' },
  { key: 'maxTimes', dimension: 'times' },
  { key: 'maxYears', dimension: 'days', yearOnly: true, useUnitValue: true },
  { key: 'minYears', dimension: 'days', yearOnly: true, useUnitValue: true },
  { key: 'maxRate', dimension: 'rate' },
];

/* ------------------------------------------------------------------ *
 * 数值 → 规则 的就近绑定
 *
 * 同一个条款里可能同时出现「预付款比例 40%」「违约金 30%」「赔偿责任 120%」。
 * 如果按「整条条款的同量纲数值」比对，就会互相串味。
 *
 * 做法：找出条款里所有「语义锚点词」的位置，把每个数值绑定到离它最近、
 * 且词形最具体的那个锚点上 —— 一个数值只归一条规则。
 * ------------------------------------------------------------------ */

interface AnchorHit {
  ruleId: string;
  anchor: string;
  /** 在条款正文坐标系里的等效位置（标题锚点为负数） */
  effPos: number;
  /** 是否来自条款标题 */
  isTitle: boolean;
}

/**
 * 句读断点 —— 锚点与数值必须落在同一句内。
 *
 * 注意**不含换行符**：PDF 的行尾换行是排版产物，不是句子边界。
 */
const SENTENCE_BREAK = /[。；！？]/;

/**
 * 锚点后紧跟这些词时，它只是时间状语（"质保期内"），不是被修饰的量词。
 *
 * 「乙方对交付物提供自验收合格之日起 3 个月的质量保证。质保期内出现缺陷的，
 *   乙方应在五个工作日内修复。」
 *
 * 这里的「五个工作日」是修复时限，不是质保期。
 * 若把「质保期内」的「质保」当成量词，质保期就会被误判成 5 个工作日 → 误报。
 */
const ADVERBIAL_AFTER = /^(内|期内|期间|中|以内|之内|前|后|起|届满|到期|失效|届期)/;

/** 正文锚点与数值的最大距离（字符）—— 超过即认为与该锚点无关 */
const MAX_ANCHOR_DISTANCE = 24;

/** 标题锚点与数值的最大距离 —— 标题映射到正文前部，天然更远 */
const MAX_TITLE_ANCHOR_DISTANCE = 30;

function collectAnchorHits(clause: Clause, rules: Rule[]): AnchorHit[] {
  const hits: AnchorHit[] = [];

  for (const rule of rules) {
    const anchors = rule.metricAnchors?.length ? rule.metricAnchors : rule.anchors;

    for (const a of anchors) {
      if (!a) continue;

      // 正文中的每一次出现（容忍 PDF 换行劈词）
      for (const p of allPhrasePositions(clause.text, a)) {
        // 时间状语不是量词，跳过
        if (ADVERBIAL_AFTER.test(clause.text.slice(p.end, p.end + 3))) continue;
        hits.push({ ruleId: rule.id, anchor: a, effPos: p.start, isTitle: false });
      }

      // 标题中的出现：映射到正文坐标系的前面（负数），距离按标题长度计
      if (clause.title) {
        for (const p of allPhrasePositions(clause.title, a)) {
          hits.push({
            ruleId: rule.id,
            anchor: a,
            effPos: p.start - (clause.title.length + 1),
            isTitle: true,
          });
        }
      }
    }
  }

  return hits;
}

/**
 * 把一个数值绑定到唯一一条规则。
 *
 * 三重约束，缺一不可：
 *   1. 距离 —— 数值离锚点太远，说明二者无关；
 *   2. 同句 —— 跨句的锚点与数值不是同一件事（「质保。…五个工作日内修复」）；
 *   3. 词形权重 —— 「保密期限」比「保密」更具体，优先。
 */
function bindValue(
  value: ExtractedValue,
  hits: AnchorHit[],
  clauseText: string,
): AnchorHit | undefined {
  let best: (AnchorHit & { score: number }) | undefined;

  for (const h of hits) {
    const dist = Math.abs(value.start - h.effPos);
    const maxDist = h.isTitle ? MAX_TITLE_ANCHOR_DISTANCE : MAX_ANCHOR_DISTANCE;
    if (dist > maxDist) continue;

    if (!h.isTitle) {
      const lo = Math.min(value.start, h.effPos);
      const hi = Math.max(value.start, h.effPos);
      if (SENTENCE_BREAK.test(clauseText.slice(lo, hi))) continue;
    }

    const score = -dist + h.anchor.length * SPECIFICITY_WEIGHT;
    if (!best || score > best.score) best = { ...h, score };
  }

  return best;
}

/* ------------------------------------------------------------------ *
 * 阈值比对
 * ------------------------------------------------------------------ */

function pickValues(values: ExtractedValue[], spec: LimitSpec): ExtractedValue[] {
  return values.filter((v) => {
    if (v.dimension !== spec.dimension) return false;
    if (spec.yearOnly) return v.unit === '年';
    return true;
  });
}

function applyLimits(
  clause: Clause,
  rule: Rule,
  values: ExtractedValue[],
  s: EngineStrings,
  copy: RuleCopy,
): Finding[] {
  const findings: Finding[] = [];
  const limits = rule.limits ?? {};

  for (const spec of LIMIT_SPECS) {
    const limit = limits[spec.key];
    if (limit == null) continue;

    const candidates = pickValues(values, spec);
    if (candidates.length === 0) continue;

    const bound = boundOf(spec.key);

    for (const v of candidates) {
      const actualNum = spec.useUnitValue ? v.unitValue : v.value;
      // 相对容差：合同里写「万分之三」而红线也是「万分之三」时必须判为未超限，
      // 否则浮点尾数会让它变成「超出 0‱」这种荒谬结论。
      const violated =
        bound === 'max' ? actualNum > limit * (1 + EPS) : actualNum < limit * (1 - EPS);
      if (!violated) continue;

      // 费率用「‱」（万分之）表达，否则 0.0005-0.0003 四舍五入会变成 0
      const scale = spec.key === 'maxRate' ? 10000 : 1;
      const diff = Math.round(Math.abs(actualNum - limit) * scale * 100) / 100;
      const delta = s.formatDelta(spec.key, diff);
      const limitText = s.formatLimit(spec.key, limit);

      findings.push({
        ruleId: rule.id,
        ruleTitle: copy.title,
        severity: rule.severity,
        kind: 'limit',
        clauseId: clause.id,
        clauseNumber: clause.number,
        excerpt: excerpt(clause.text),
        actual: v.raw,
        limit: limitText,
        delta,
        bound,
        message: s.limitMessage({ title: copy.title, actual: v.raw, key: spec.key, limit: limitText, delta }),
        advice: copy.advice,
        start: clause.start + v.start,
        end: clause.start + v.end,
      });

      if (findings.length >= MAX_FINDINGS_PER_RULE_CLAUSE) return findings;
    }
  }

  return findings;
}

/** 对一个条款执行所有已匹配规则的阈值比对 */
function evaluateClauseLimits(
  clause: Clause,
  matchedRules: Rule[],
  s: EngineStrings,
  locale: Locale,
): Finding[] {
  const limitRules = matchedRules.filter((r) => r.limits && Object.keys(r.limits).length > 0);
  if (limitRules.length === 0) return [];

  const values = extractValues(clause.text);
  if (values.length === 0) return [];

  const hits = collectAnchorHits(clause, limitRules);
  if (hits.length === 0) return [];

  // 每个数值只归一条规则
  const assigned = new Map<string, ExtractedValue[]>();
  for (const v of values) {
    const best = bindValue(v, hits, clause.text);
    if (!best) continue;
    const arr = assigned.get(best.ruleId);
    if (arr) arr.push(v);
    else assigned.set(best.ruleId, [v]);
  }

  const findings: Finding[] = [];
  for (const [ruleId, vs] of assigned) {
    const rule = limitRules.find((r) => r.id === ruleId);
    if (!rule) continue;
    findings.push(...applyLimits(clause, rule, vs, s, localizeRule(rule, locale)));
  }
  return findings;
}

/* ------------------------------------------------------------------ *
 * 主入口
 * ------------------------------------------------------------------ */

/**
 * 执行全部规则。
 *
 * @param docText 合同全文（用于「必备条款缺失」检查）
 * @param clauses 切分后的条款
 * @param rules 规则集
 * @param locale 文案语言（不影响判定结果）
 */
export function evaluate(
  docText: string,
  clauses: Clause[],
  rules: Rule[],
  locale: Locale = DEFAULT_LOCALE,
): Finding[] {
  const s = engineStrings(locale);
  const findings: Finding[] = [];

  for (const clause of clauses) {
    const matched = rules.filter((r) => scoreClause(clause, r) >= MATCH_THRESHOLD);
    if (matched.length === 0) continue;

    // 1) 数值阈值
    findings.push(...evaluateClauseLimits(clause, matched, s, locale));

    // 2) 出现即违规的表述
    for (const rule of matched) {
      if (!rule.forbiddenPhrases?.length) continue;
      const copy = localizeRule(rule, locale);
      for (const phrase of rule.forbiddenPhrases) {
        if (!hasPhrase(clause.text, phrase)) continue;
        const pos = locate(clause, phrase);
        findings.push({
          ruleId: rule.id,
          ruleTitle: copy.title,
          severity: rule.severity,
          kind: 'forbidden',
          clauseId: clause.id,
          clauseNumber: clause.number,
          excerpt: excerpt(clause.text),
          actual: phrase,
          message: s.forbiddenMessage({ title: copy.title, phrase }),
          advice: copy.advice,
          start: pos?.start,
          end: pos?.end,
        });
      }
    }
  }

  // 3) 必备条款缺失（全文级检查，不要求条款被匹配到）
  for (const rule of rules) {
    if (!rule.requiredPhrases?.length) continue;

    // 触发条件：合同里根本没涉及的事，不该要求对方写进来
    if (rule.triggerPhrases?.length) {
      const triggered = rule.triggerPhrases.some((p) => hasPhrase(docText, p));
      if (!triggered) continue;
    }

    const present = rule.requiredPhrases.some((p) => hasPhrase(docText, p));
    if (present) continue;

    const copy = localizeRule(rule, locale);
    findings.push({
      ruleId: rule.id,
      ruleTitle: copy.title,
      severity: rule.severity,
      kind: 'missing',
      excerpt: '',
      actual: rule.requiredPhrases.join(' / '),
      expected: [...rule.requiredPhrases],
      message: s.missingMessage({ title: copy.title, expected: rule.requiredPhrases }),
      advice: copy.advice,
    });
  }

  // 去重：同一规则 + 同一条款 + 同一类型只保留一条
  const seen = new Set<string>();
  const unique = findings.filter((f) => {
    const key = `${f.ruleId}|${f.clauseId ?? '-'}|${f.kind}|${f.actual ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((a, b) => {
    const s2 = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s2 !== 0) return s2;
    return (a.start ?? 0) - (b.start ?? 0);
  });
}
