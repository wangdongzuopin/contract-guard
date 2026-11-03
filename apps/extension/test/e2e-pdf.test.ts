import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '@cg/core';
import { buildText, detectGutter, groupIntoRows, rowsToLines, type RawItem } from '../lib/pdf-lines';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF_PATH = resolve(__dirname, '../../../test/fixtures/sample-contract.pdf');

/**
 * 真实 PDF 端到端验证：
 *   PDF → pdf.js 取片段 → 行重组 → 条款切分 → 规则比对 → 报告
 *
 * 这一段是整个产品最容易翻车的地方：pdf.js 给的是「绘制片段」而不是行，
 * 重组错了，条款切分就全错，而且错得很安静。
 */
describe('PDF 端到端', () => {
  it('真实 PDF 能被解析出文本并检出全部偏离项', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const bytes = readFileSync(PDF_PATH);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    expect(doc.numPages).toBeGreaterThan(0);

    const lines = [];
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
      expect(gutter).toBeNull(); // 单栏样本，不应误判为双栏
      lines.push(...rowsToLines(rows, p, viewport, gutter));
    }

    const { text, lineStart } = buildText(lines);

    // 文本层必须非空
    expect(text.length).toBeGreaterThan(200);
    expect(text).toContain('第一条');
    expect(text).toContain('90 日内支付');
    expect(text).toContain('自动续约');

    // 行偏移必须与全文对齐
    expect(lineStart[0]).toBe(0);
    for (let i = 0; i < Math.min(lines.length, 20); i += 1) {
      const s = lineStart[i]!;
      expect(text.slice(s, s + lines[i]!.text.length)).toBe(lines[i]!.text);
    }

    // 端到端跑规则引擎
    const { report, clauses } = analyzeDocument(text, { fileName: 'sample-contract.pdf', pageCount: doc.numPages });
    const found = new Set(report.findings.map((f) => f.ruleId));

    for (const id of [
      'payment-term',
      'payment-first-ratio',
      'penalty-rate',
      'penalty-cap',
      'liability-cap',
      'confidential-term',
      'confidential-scope',
      'ip-ownership',
      'noncompete',
      'acceptance',
      'auto-renew',
      'unilateral-termination',
    ]) {
      expect(found.has(id), `PDF 路径未检出：${id}`).toBe(true);
    }

    // 条款切分数量应与文本路径接近
    expect(clauses.length).toBeGreaterThanOrEqual(10);

    // 数值不能串味
    expect(report.findings.find((f) => f.ruleId === 'penalty-cap')?.actual).toBe('30%');
    expect(report.findings.find((f) => f.ruleId === 'liability-cap')?.actual).toBe('120%');
  });
});
