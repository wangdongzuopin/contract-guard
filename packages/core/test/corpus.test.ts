import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '@cg/core';
import { CORPUS, renderContractText, type CorpusContract } from './corpus/contracts';

/**
 * 语料库精度测试
 *
 * 每份合同都带一份人工标注的期望发现列表。
 * 比对维度是 **(规则, 实际值, 条款号)** 三元组，不是规则集合 ——
 * 只比规则集合会漏掉「同一条规则报错了数值」这种问题，
 * 而这恰恰是法务最不能容忍的：结论看着对，数字是错的。
 *
 *   多出来 = 误报（假阳性）—— 伤信任
 *   少掉了 = 漏报（假阴性）—— 伤专业性
 */

interface Found {
  ruleId: string;
  actual: string;
  clause: string;
  key: string;
}

function keyOf(ruleId: string, actual: string | undefined, clause: string | undefined): string {
  return `${ruleId}|${actual ?? ''}|${clause ?? ''}`;
}

function evaluate(spec: CorpusContract): {
  id: string;
  fileName: string;
  expected: string[];
  actual: string[];
  falsePositive: string[];
  falseNegative: string[];
} {
  const text = renderContractText(spec);
  const { report } = analyzeDocument(text);

  const found: Found[] = report.findings.map((f) => ({
    ruleId: f.ruleId,
    // 缺失类发现的 actual 是「期望包含哪些词」，不是检出值 —— 归一化为空
    actual: f.kind === 'missing' ? '' : (f.actual ?? ''),
    clause: f.clauseNumber ?? '',
    key: keyOf(f.ruleId, f.kind === 'missing' ? '' : f.actual, f.clauseNumber),
  }));

  const expected = spec.expect.map((e) => keyOf(e.ruleId, e.actual, e.clause));
  const actual = found.map((f) => f.key);

  return {
    id: spec.id,
    fileName: spec.fileName,
    expected,
    actual,
    falsePositive: actual.filter((k) => !expected.includes(k)),
    falseNegative: expected.filter((k) => !actual.includes(k)),
  };
}

describe('语料库 · 误报与漏报', () => {
  const rows = CORPUS.map(evaluate);

  it('误报与漏报都要归零', () => {
    const table = rows
      .map(
        (r) =>
          `${r.id.padEnd(14)} 期望 ${String(r.expected.length).padStart(2)} ｜ 实际 ${String(
            r.actual.length,
          ).padStart(2)}` +
          (r.falsePositive.length ? ` ｜ ❌误报 ${r.falsePositive.join(' / ')}` : '') +
          (r.falseNegative.length ? ` ｜ ❌漏报 ${r.falseNegative.join(' / ')}` : '') +
          (!r.falsePositive.length && !r.falseNegative.length ? ' ｜ ✅' : ''),
      )
      .join('\n');

    const tp = rows.reduce((n, r) => n + r.expected.filter((x) => r.actual.includes(x)).length, 0);
    const fp = rows.reduce((n, r) => n + r.falsePositive.length, 0);
    const fn = rows.reduce((n, r) => n + r.falseNegative.length, 0);
    const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 1 : tp / (tp + fn);

    console.log(
      `\n${table}\n\n命中 ${tp} ｜ 误报 ${fp} ｜ 漏报 ${fn} ｜ 精确率 ${(precision * 100).toFixed(
        1,
      )}% ｜ 召回率 ${(recall * 100).toFixed(1)}%\n`,
    );

    const bad = rows.filter((r) => r.falsePositive.length || r.falseNegative.length);
    expect(bad, `存在误报或漏报的样本：${bad.map((b) => b.id).join(', ')}`).toHaveLength(0);
  });

  it('合规基准版不应报任何风险（负样本）', () => {
    const a = rows.find((r) => r.id === 'a-baseline')!;
    expect(a.actual, `合规基准版却报了：${a.actual.join(' / ')}`).toEqual([]);
  });

  it('边界值不应被当成超限（抓 >= 误用）', () => {
    const c = rows.find((r) => r.id === 'c-boundary')!;
    expect(c.actual, `边界值被误判为超限：${c.actual.join(' / ')}`).toEqual([]);
  });

  it('后付款、不涉个人数据的合同不应被要求写担保与数据合规', () => {
    const e = rows.find((r) => r.id === 'e-postpay')!;
    expect(e.actual, `触发条件失效：${e.actual.join(' / ')}`).toEqual([]);
  });

  it('文书类型识别正确', () => {
    for (const spec of CORPUS) {
      const text = renderContractText(spec);
      const { docType } = analyzeDocument(text);
      expect(docType, `${spec.id} 文书类型识别错误`).toBe(spec.docType);
    }
  });

  it('结果可复现（同样输入同样输出）', () => {
    for (const spec of CORPUS) {
      const text = renderContractText(spec);
      const key = (f: { ruleId: string; actual?: string; clauseNumber?: string; kind: string }) =>
        keyOf(f.ruleId, f.kind === 'missing' ? '' : f.actual, f.clauseNumber);
      const a = analyzeDocument(text).report.findings.map(key);
      const b = analyzeDocument(text).report.findings.map(key);
      expect(a).toEqual(b);
    }
  });
});
