import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../src/analyze';
import { EXPECTED_RULE_IDS, SAMPLE_CONTRACT } from './fixtures/sample-contract';

describe('analyzeDocument', () => {
  const result = analyzeDocument(SAMPLE_CONTRACT);
  const found = new Set(result.report.findings.map((f) => f.ruleId));

  it('切分出足够多的条款', () => {
    expect(result.clauses.length).toBeGreaterThanOrEqual(10);
  });

  it('检出全部预期偏离项', () => {
    const missing = EXPECTED_RULE_IDS.filter((id) => !found.has(id));
    expect(missing, `未检出：${missing.join(', ')}`).toEqual([]);
  });

  it('账期偏离定位到具体条款与偏移', () => {
    const f = result.report.findings.find((x) => x.ruleId === 'payment-term');
    expect(f).toBeDefined();
    expect(f?.clauseNumber).toBe('第三条');
    expect(f?.actual).toContain('90');
    expect(f?.limit).toContain('60');
    expect(f?.start).toBeGreaterThan(0);
    // 偏移能回指原文
    const slice = SAMPLE_CONTRACT.slice(f!.start!, f!.end!);
    expect(slice).toContain('90');
  });

  it('缺失条款被检出', () => {
    const f = result.report.findings.find((x) => x.ruleId === 'force-majeure');
    expect(f).toBeDefined();
    expect(f?.kind).toBe('missing');
  });

  it('报告评分合理', () => {
    expect(result.report.summary.high).toBeGreaterThan(0);
    expect(result.report.summary.score).toBeLessThan(100);
    expect(result.report.summary.score).toBeGreaterThanOrEqual(0);
    expect(result.report.summary.total).toBe(result.report.findings.length);
  });

  it('数值不串味：违约金比例与赔偿责任比例归属不同规则', () => {
    // 第八条同时出现「违约金 30%」和「赔偿责任 120%」，两者必须分开判定
    const penalty = result.report.findings.find((x) => x.ruleId === 'penalty-cap');
    const liability = result.report.findings.find((x) => x.ruleId === 'liability-cap');
    expect(penalty?.actual).toBe('30%');
    expect(penalty?.limit).toBe('10%');
    expect(liability?.actual).toBe('120%');
    expect(liability?.limit).toBe('100%');
  });

  it('预付款比例不会被违约金规则误判', () => {
    // 第三条同时有「预付款 40%」「违约金万分之五」「账期 90 日」
    const first = result.report.findings.find((x) => x.ruleId === 'payment-first-ratio');
    expect(first?.actual).toBe('40%');
    const term = result.report.findings.find((x) => x.ruleId === 'payment-term');
    expect(term?.actual).toBe('90 日');
    const rate = result.report.findings.find((x) => x.ruleId === 'penalty-rate');
    expect(rate?.actual).toBe('万分之五');
    expect(rate?.delta).toContain('2‱');
  });

  it('结果可复现（同样输入同样输出）', () => {
    const a = analyzeDocument(SAMPLE_CONTRACT);
    const b = analyzeDocument(SAMPLE_CONTRACT);
    expect(JSON.stringify(a.report.findings)).toBe(JSON.stringify(b.report.findings));
  });

  it('报告含规则版本号，便于审计', () => {
    expect(result.report.meta.ruleSetVersion).toMatch(/^builtin-/);
    expect(result.report.meta.charCount).toBe(SAMPLE_CONTRACT.length);
  });
});
