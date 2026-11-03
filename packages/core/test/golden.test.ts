// 引入现有测试工具，用于检查仿真文本的短语匹配。
import { describe, expect, it } from 'vitest';
// 引入核心引擎方法，验证换行时仍能识别条款和短语。
import { findPhrase, segmentClauses } from '@cg/core';
describe('金标准 · 换行劈词（PDF 中文排版通病）', () => {
  it('短语匹配容忍换行', () => {
    const text = '模拟条款：协商不成可向人民法院起\n诉。';
    const pos = findPhrase(text, '起诉');
    expect(pos).toBeDefined();
    expect(pos!.start).toBe(text.indexOf('起'));
  });

  it('不匹配的词仍然匹配不到', () => {
    // 「起诉」不是「诉讼」—— 词表该有的还得有
    expect(findPhrase('模拟条款：依法向人民法院起\n诉。', '诉讼')).toBeUndefined();
  });

  it('锚点词被换行劈开时仍能归类', () => {
    const text = '第一条 本合同履行过程中因不可抗\n力原因导致合同无法继续履行。';
    const clauses = segmentClauses(text);
    expect(clauses.length).toBeGreaterThan(0);
    expect(clauses[0]!.text).toContain('不可抗');
  });
});
