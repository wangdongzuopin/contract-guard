import { describe, expect, it } from 'vitest';
import { extractValues } from '../src/extract';

describe('extractValues', () => {
  it('抽取阿拉伯数字期限', () => {
    const v = extractValues('甲方应在 90 日内支付');
    expect(v).toHaveLength(1);
    expect(v[0]?.value).toBe(90);
    expect(v[0]?.dimension).toBe('days');
    expect(v[0]?.unit).toBe('日');
  });

  it('抽取中文数字期限', () => {
    const v = extractValues('保密期限为三年');
    expect(v[0]?.value).toBe(3 * 365);
    expect(v[0]?.unit).toBe('年');
  });

  it('区分工作日与自然日', () => {
    const v = extractValues('30 个工作日内完成');
    expect(v[0]?.unit).toBe('个工作日');
    expect(v[0]?.value).toBeCloseTo(42, 1);
  });

  it('月份折算为天数', () => {
    const v = extractValues('3 个月');
    expect(v[0]?.unit).toBe('个月');
    expect(v[0]?.value).toBeCloseTo(91.2, 1);
  });

  it('抽取百分比', () => {
    const v = extractValues('预付款比例为合同总价的 40%');
    expect(v[0]?.dimension).toBe('percent');
    expect(v[0]?.value).toBe(40);
  });

  it('抽取「百分之X」', () => {
    const v = extractValues('违约金为百分之五');
    expect(v[0]?.dimension).toBe('percent');
    expect(v[0]?.value).toBe(5);
  });

  it('抽取费率（万分之五）', () => {
    const v = extractValues('按日万分之五主张违约金');
    expect(v[0]?.dimension).toBe('rate');
    expect(v[0]?.value).toBeCloseTo(0.0005, 6);
  });

  it('抽取金额', () => {
    const v = extractValues('合同金额为人民币 120 万元');
    expect(v[0]?.dimension).toBe('amount');
    expect(v[0]?.value).toBe(1_200_000);
    expect(v[0]?.unit).toBe('万元');
  });

  it('抽取倍数', () => {
    const v = extractValues('赔偿金额为合同金额的三倍');
    expect(v[0]?.dimension).toBe('times');
    expect(v[0]?.value).toBe(3);
  });

  it('识别上限极性', () => {
    const v = extractValues('付款期限不超过 60 日');
    expect(v[0]?.polarity).toBe('max');
    expect(v[0]?.modifier).toBe('不超过');
  });

  it('识别下限极性', () => {
    const v = extractValues('保密期限不得少于三年');
    expect(v[0]?.polarity).toBe('min');
  });

  it('识别承诺极性', () => {
    const v = extractValues('甲方应当于 90 日内支付');
    expect(v[0]?.polarity).toBe('obligation');
  });

  it('不重叠重复抽取', () => {
    const v = extractValues('90 日内支付 30%');
    expect(v.length).toBe(2);
  });
});
