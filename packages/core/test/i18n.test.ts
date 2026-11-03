import { describe, expect, it } from 'vitest';
import {
  BUILTIN_RULES,
  analyzeDocument,
  docTypeLabel,
  formatClauseNumber,
  isSupportedLanguage,
  localizeRule,
  type Finding,
} from '@cg/core';
import { SAMPLE_CONTRACT } from './fixtures/sample-contract';

/**
 * 引擎文案的中英文
 *
 * 语言只影响文案，不影响判定：同一份合同两种语言下的发现项必须一一对应。
 */

const CJK = /[\u4e00-\u9fff]/;

/** 与语言无关的发现项身份 */
function identity(f: Finding): string {
  return [f.ruleId, f.kind, f.actual ?? '', f.clauseNumber ?? '', f.start ?? '', f.end ?? ''].join('|');
}

describe('引擎文案 · 中英文', () => {
  const zh = analyzeDocument(SAMPLE_CONTRACT).report;
  const en = analyzeDocument(SAMPLE_CONTRACT, { locale: 'en' }).report;

  it('缺省输出中文，文案与改版前逐字一致', () => {
    expect(zh.meta.locale).toBe('zh');
    const term = zh.findings.find((f) => f.ruleId === 'payment-term');
    expect(term?.message).toBe('付款账期：合同约定「90 日」，贵司红线为不超过 60 天（超出 30 天）。');
    expect(term?.bound).toBe('max');
    expect(zh.summary.verdict).toMatch(CJK);
  });

  it('切换语言不改变判定结果', () => {
    expect(en.findings.map(identity)).toEqual(zh.findings.map(identity));
    expect(en.summary.score).toBe(zh.summary.score);
  });

  it('英文文案不夹带引擎自己写的中文', () => {
    for (const f of en.findings) {
      expect(f.ruleTitle, f.ruleId).not.toMatch(CJK);
      expect(f.advice, f.ruleId).not.toMatch(CJK);
      // 引号里与「looked for」后面是合同原文证据，允许是中文
      const own = f.message.replace(/"[^"]*"/g, '').replace(/looked for:[^)]*/g, '');
      expect(own, f.ruleId).not.toMatch(CJK);
      if (f.limit) expect(f.limit, f.ruleId).not.toMatch(CJK);
      if (f.delta) expect(f.delta, f.ruleId).not.toMatch(CJK);
    }
    expect(en.summary.verdict).not.toMatch(CJK);
    expect(en.meta.tool).toBe('Contract Guard');
  });

  it('英文的数值与偏离写法', () => {
    const term = en.findings.find((f) => f.ruleId === 'payment-term');
    expect(term?.limit).toBe('60 days');
    expect(term?.delta).toBe('30 days over');
    const rate = en.findings.find((f) => f.ruleId === 'penalty-rate');
    expect(rate?.limit).toBe('0.03%/day');
    expect(rate?.delta).toBe('0.02%/day over');
    const conf = en.findings.find((f) => f.ruleId === 'confidential-term');
    expect(conf?.delta).toBe('2 years short');
  });

  it('20 条内置规则都有英文标题与建议', () => {
    expect(BUILTIN_RULES).toHaveLength(20);
    for (const rule of BUILTIN_RULES) {
      const copy = localizeRule(rule, 'en');
      expect(copy.title, rule.id).not.toMatch(CJK);
      expect(copy.advice, rule.id).not.toMatch(CJK);
    }
  });

  it('文书类型与条款编号的展示', () => {
    expect(docTypeLabel('commercial', 'zh')).toBe('商务合同');
    expect(docTypeLabel('commercial', 'en')).toBe('Commercial contract');
    expect(formatClauseNumber('第三条', 'zh')).toBe('第三条');
    expect(formatClauseNumber('第十五条', 'en')).toBe('Art. 15');
    expect(formatClauseNumber('（二）', 'en')).toBe('(2)');
    expect(formatClauseNumber('3.1', 'en')).toBe('3.1');
  });

  it('非中文文本被标记为不支持，避免「看起来安全」的误导', () => {
    expect(isSupportedLanguage(SAMPLE_CONTRACT)).toBe(true);
    const english =
      'SERVICE AGREEMENT\nArticle 1. The Client shall pay within 90 days of invoice.\nArticle 2. This agreement renews automatically each year.';
    expect(isSupportedLanguage(english)).toBe(false);
    const zhReport = analyzeDocument(english).report;
    const enReport = analyzeDocument(english, { locale: 'en' }).report;
    expect(zhReport.meta.languageSupported).toBe(false);
    // 分数可能很高（规则什么都没读懂），但结论绝不能说「可推进签署」
    expect(zhReport.summary.verdict).not.toContain('可推进签署');
    expect(zhReport.summary.verdict).toContain('无法可靠判断');
    expect(enReport.summary.verdict).toContain('not in Chinese');
    expect(zh.meta.languageSupported).toBe(true);
  });
});
