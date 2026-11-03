import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '@cg/core';
import { groupIntoRows, detectGutter, rowsToLines, buildText, type RawItem } from '../lib/pdf-lines';
import { CORPUS } from '../../../packages/core/test/corpus/contracts';

/**
 * 语料库 PDF 层回归
 *
 * 文本层测试证明「引擎判断准确」，这一层证明「解析链路不丢内容」——
 * 从 PDF 里读回来的文字，必须还能得出同样的结论。
 *
 * PDF 折行位置由排版决定，与文本层测试的硬换行不同，
 * 因此两层要分别验证，不能互相替代。
 */

const PDF_DIR = resolve(__dirname, '../../../test/fixtures/corpus');

/** PDF 读回的文本里可能有换行/空格，比对时归一化 */
function norm(s: string): string {
  return s.replace(/\s+/g, '');
}

async function extractPdfText(path: string): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = readFileSync(path);
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
  await task.destroy();
  return { text, pageCount: doc.numPages };
}

describe('语料库 · PDF 端到端', () => {
  for (const spec of CORPUS) {
    it(`${spec.id}：PDF 解析后结论不变`, async () => {
      const pdf = resolve(PDF_DIR, `${spec.id}.pdf`);
      expect(existsSync(pdf), `缺少 PDF 样本：${pdf}（设 CG_RENDER_CORPUS=1 生成）`).toBe(true);

      const { text } = await extractPdfText(pdf);
      expect(text.length, 'PDF 没有解析出文本').toBeGreaterThan(200);

      const { report, docType } = analyzeDocument(text);
      expect(docType, `${spec.id} 文书类型识别错误`).toBe(spec.docType);

      const actual = report.findings.map(
        (f) =>
          `${f.ruleId}|${f.kind === 'missing' ? '' : norm(f.actual ?? '')}|${f.clauseNumber ?? ''}`,
      );
      const expected = spec.expect.map(
        (e) => `${e.ruleId}|${norm(e.actual ?? '')}|${e.clause ?? ''}`,
      );

      const fp = actual.filter((x) => !expected.includes(x));
      const fn = expected.filter((x) => !actual.includes(x));

      console.log(
        `${spec.id.padEnd(14)} 期望 ${String(expected.length).padStart(2)} ｜ 实际 ${String(
          actual.length,
        ).padStart(2)}${fp.length ? ` ｜ ❌误报 ${fp.join(' / ')}` : ''}${
          fn.length ? ` ｜ ❌漏报 ${fn.join(' / ')}` : ''
        }${!fp.length && !fn.length ? ' ｜ ✅' : ''}`,
      );

      expect(fp, `${spec.id} PDF 层误报`).toEqual([]);
      expect(fn, `${spec.id} PDF 层漏报`).toEqual([]);
    });
  }
});
