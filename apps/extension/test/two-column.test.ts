import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '@cg/core';
import { buildText, detectGutter, groupIntoRows, rowsToLines, type RawItem } from '../lib/pdf-lines';

/**
 * 双栏 PDF 回归
 *
 * 背景：真实合同里双栏很常见（如责任书、公告、附件）。
 * 早期实现用「行的起始 x」判断栏数，但双栏文档左右栏的片段会被合并进同一行，
 * 每行起始 x 都在左栏 → 永远判定为单栏 → 左右栏文字交错成乱码。
 *
 * 正确做法是看**行内**相邻片段之间是否反复出现同一条空隙带（栏缝）。
 */

const PDF = resolve(__dirname, '../../../test/fixtures/two-column.pdf');

describe('双栏 PDF', () => {
  it('能定位栏缝，并按「左栏整列 → 右栏整列」的顺序还原', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const bytes = readFileSync(PDF);
    const data = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const task = pdfjs.getDocument({ data, useSystemFonts: true });
    const doc = await task.promise;

    const lines: any[] = [];
    let gutter: number | null = null;
    let pageWidth = 0;

    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      pageWidth = viewport.width;
      const content = await page.getTextContent();
      const raw: RawItem[] = [];
      for (const item of content.items as any[]) {
        if (!item.str || !item.str.trim()) continue;
        raw.push({
          str: item.str,
          x: item.transform[4] as number,
          y: item.transform[5] as number,
          width: (item.width as number) ?? 0,
          height: Math.abs((item.transform[3] as number) ?? 10),
        });
      }
      const rows = groupIntoRows(raw);
      const g = detectGutter(rows, viewport.width);
      if (g != null) gutter = g;
      lines.push(...rowsToLines(rows, p, viewport, g));
    }

    // 1) 必须判定为双栏，且栏缝落在页面中部附近
    expect(gutter, '未检测到栏缝').not.toBeNull();
    expect(gutter!).toBeGreaterThan(pageWidth * 0.35);
    expect(gutter!).toBeLessThan(pageWidth * 0.65);

    const { text } = buildText(lines);

    // 2) 阅读顺序必须是「左栏一路读到底，再读右栏」
    //    若左右栏交错，同一段落会被另一栏的句子切断
    //    （段落内部有换行，所以用 \s* 容忍）
    expect(text).toMatch(/甲方委托乙方提供软件系统的定制开发服\s*务，服务范围包括需求分析/);
    expect(text).toMatch(/乙方保证交付物不侵犯任何第三方的知识产\s*权/);

    // 第一段内部不得混入右栏内容
    const p1 = text.slice(
      text.indexOf('甲方委托乙方提供软件系统的定制开发服'),
      text.indexOf('关标准。'),
    );
    expect(p1).not.toContain('乙方应当指派');

    await task.destroy();
  });

  it('双栏内容也能进入条款切分与规则引擎', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const bytes = readFileSync(PDF);
    const data = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const task = pdfjs.getDocument({ data, useSystemFonts: true });
    const doc = await task.promise;

    const lines: any[] = [];
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const raw: RawItem[] = [];
      for (const item of content.items as any[]) {
        if (!item.str || !item.str.trim()) continue;
        raw.push({
          str: item.str,
          x: item.transform[4] as number,
          y: item.transform[5] as number,
          width: (item.width as number) ?? 0,
          height: Math.abs((item.transform[3] as number) ?? 10),
        });
      }
      const rows = groupIntoRows(raw);
      const gutter = detectGutter(rows, viewport.width);
      lines.push(...rowsToLines(rows, p, viewport, gutter));
    }

    const { text } = buildText(lines);
    const { report, clauses } = analyzeDocument(text);

    // 条款应被识别出来
    expect(clauses.length).toBeGreaterThan(0);
    expect(clauses.some((c) => c.number === '第一条')).toBe(true);

    // 文档类型应为商务合同（标题「软件技术服务合同」）
    expect(report.meta.docType).toBe('commercial');

    await task.destroy();
  });
});
