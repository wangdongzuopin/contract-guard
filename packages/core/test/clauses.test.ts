import { describe, expect, it } from 'vitest';
import { segmentClauses } from '../src/clauses';

const TEXT = `第一条 总则
本协议由双方在平等基础上签订。

第二条 服务内容
乙方为甲方提供系统开发服务，内容详见附件。

2.1 开发范围
包括前端与后端开发工作。

第三条 付款
甲方应在 90 日内支付。`;

describe('segmentClauses', () => {
  it('按「第X条」切分', () => {
    const clauses = segmentClauses(TEXT);
    expect(clauses.length).toBe(4);
    expect(clauses[0]?.number).toBe('第一条');
    expect(clauses[1]?.number).toBe('第二条');
    expect(clauses[2]?.number).toBe('2.1');
    expect(clauses[3]?.number).toBe('第三条');
  });

  it('提取标题', () => {
    const clauses = segmentClauses(TEXT);
    expect(clauses[0]?.title).toBe('总则');
    expect(clauses[2]?.title).toBe('开发范围');
  });

  it('条款正文不含编号', () => {
    const clauses = segmentClauses(TEXT);
    expect(clauses[3]?.text.startsWith('甲方应在')).toBe(true);
  });

  it('偏移量可回指原文', () => {
    const clauses = segmentClauses(TEXT);
    const c = clauses[3]!;
    expect(TEXT.slice(c.start, c.end)).toBe(c.text);
  });

  it('无结构文本退化为单条款', () => {
    const clauses = segmentClauses('这是一段没有任何编号的合同正文。');
    expect(clauses.length).toBe(1);
    expect(clauses[0]?.confidence).toBe('low');
  });

  it('识别中文序号', () => {
    const clauses = segmentClauses('一、付款\n甲方向乙方支付。\n二、交付\n乙方交付成果。');
    expect(clauses.length).toBe(2);
    expect(clauses[0]?.number).toBe('一、');
  });

  it('识别括号序号', () => {
    const clauses = segmentClauses('第三条 内容\n（一）第一项\n（二）第二项');
    expect(clauses.length).toBe(3);
  });
});
