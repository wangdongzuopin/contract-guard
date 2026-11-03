import { countPhrase, hasPhrase } from './phrase';
import type { Clause, Rule } from './types';

/**
 * 条款归类
 *
 * 用锚点词表做确定性打分，不调用模型。
 * 标题命中的权重远高于正文 —— 「第三条 付款方式」几乎不需要猜。
 *
 * 所有匹配都容忍 PDF 换行（见 phrase.ts）：
 * 「不可抗力」被排版劈成「不可抗\n力」时仍要能认出来，否则整条款会被漏检。
 */

/** 匹配阈值：低于此分认为该条款与该规则无关 */
export const MATCH_THRESHOLD = 2;

/**
 * 计算一个条款对某条规则的匹配分。
 * - 标题命中：+5（标题是强信号）
 * - 正文命中：按词长加权，长词更具体
 * - 排除词：-4
 */
export function scoreClause(clause: Clause, rule: Rule): number {
  let score = 0;

  if (clause.title) {
    for (const a of rule.anchors) {
      if (hasPhrase(clause.title, a)) {
        score += 5;
        break;
      }
    }
  }

  for (const a of rule.anchors) {
    const hits = countPhrase(clause.text, a);
    if (hits > 0) {
      const weight = a.length >= 3 ? 2 : 1;
      score += Math.min(hits, 2) * weight;
    }
  }

  if (rule.exclude) {
    for (const e of rule.exclude) {
      if (hasPhrase(clause.text, e) || (clause.title && hasPhrase(clause.title, e))) {
        score -= 4;
      }
    }
  }

  return Math.max(0, score);
}

/**
 * 为每个条款选出最佳类型，并写回 clause.type。
 * 同时返回「条款 → 各规则匹配分」的明细，供规则引擎使用。
 */
export function classify(
  clauses: Clause[],
  rules: Rule[],
): { scores: Map<string, Map<string, number>> } {
  const scores = new Map<string, Map<string, number>>();

  for (const clause of clauses) {
    const map = new Map<string, number>();
    let bestType: string | undefined;
    let bestScore = 0;

    for (const rule of rules) {
      const s = scoreClause(clause, rule);
      if (s > 0) map.set(rule.id, s);
      if (s > bestScore) {
        bestScore = s;
        bestType = rule.type;
      }
    }

    if (bestType && bestScore >= MATCH_THRESHOLD) {
      clause.type = bestType;
    }
    scores.set(clause.id, map);
  }

  return { scores };
}
