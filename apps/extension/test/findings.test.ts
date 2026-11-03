import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '@cg/core';
import { findingKey, highlightRects, lineAt } from '../lib/findings';
import { buildText, type PdfLine } from '../lib/pdf-lines';
import { SAMPLE_CONTRACT } from '../../../packages/core/test/fixtures/sample-contract';

function line(text: string, page: number, y: number, width: number): PdfLine {
  return { text, page, x: 100, y, width, height: 12, spans: [{ start: 0, length: text.length, x: 100, width }] };
}

describe('页内高亮定位', () => {
  // 第一行：4 个中文 + 空格 + 「90」+ 空格 + 4 个中文
  const lines = [line('甲方应在 90 日内付款', 1, 50, 102), line('第二行文字', 1, 70, 60), line('第二页', 2, 50, 36)];
  const { lineStart } = buildText(lines);

  it('二分查找行号', () => {
    expect(lineAt(lineStart, 0)).toBe(0);
    expect(lineAt(lineStart, lineStart[1]!)).toBe(1);
    expect(lineAt(lineStart, lineStart[2]! + 1)).toBe(2);
  });

  it('只框住数值本身，不再整行高亮', () => {
    const start = lines[0]!.text.indexOf('90');
    const [rect] = highlightRects(lines, lineStart, start, start + 4); // 「90 日」
    expect(rect).toBeDefined();
    expect(rect!.x).toBeGreaterThan(100 + 102 * 0.4);
    expect(rect!.width).toBeLessThan(102 * 0.4);
    // 半角字符按窄宽度计：「90」起点应在 4 个中文之后，而不是按字数平均的 5/12 处
    expect(rect!.x).toBeCloseTo(100 + 102 * (4.55 / 10.2), 0);
  });

  it('跨行、跨页的区间拆成多个框', () => {
    const start = lineStart[0]! + 9;
    const end = lineStart[2]! + 2;
    const rects = highlightRects(lines, lineStart, start, end);
    expect(rects.map((r) => r.page)).toEqual([1, 1, 2]);
  });

  it('发现项的 key 与语言无关（切换中英文后选中项不丢）', () => {
    const zh = analyzeDocument(SAMPLE_CONTRACT).report.findings.map(findingKey);
    const en = analyzeDocument(SAMPLE_CONTRACT, { locale: 'en' }).report.findings.map(findingKey);
    expect(en).toEqual(zh);
    expect(new Set(zh).size).toBe(zh.length);
  });
});
