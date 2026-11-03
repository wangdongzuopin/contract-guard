/**
 * 布局诊断：打印某 PDF 每页的行与片段分布（开发工具）
 *
 * 用法：
 *   $env:CG_LAYOUT = 'D:\\file.pdf'
 *   pnpm vitest run apps/extension/test/layout.test.ts
 */
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { groupIntoRows, type RawItem } from '../lib/pdf-lines';

const path = process.env.CG_LAYOUT ?? '';

describe('布局诊断', () => {
  it('打印行与片段', async () => {
    if (!path) {
      console.log('（未设置 CG_LAYOUT，跳过）');
      return;
    }
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const bytes = readFileSync(path);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      console.log(`\n=== 第 ${p} 页  页面宽 ${viewport.width.toFixed(1)} ===`);

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
      console.log(`片段 ${raw.length} 个 → 行 ${rows.length} 行`);
      rows.forEach((r, i) => {
        const gaps: string[] = [];
        for (let k = 1; k < r.items.length; k += 1) {
          const prev = r.items[k - 1]!;
          const cur = r.items[k]!;
          const gap = cur.x - (prev.x + prev.width);
          if (gap > viewport.width * 0.04) {
            gaps.push(`间隙${gap.toFixed(0)}@${((prev.x + prev.width + cur.x) / 2).toFixed(0)}`);
          }
        }
        console.log(
          `  行${i} y=${r.y.toFixed(0)} 片段${r.items.length} x0=${r.items[0]?.x.toFixed(0)} ${gaps.length ? gaps.join(' ') : ''}`,
        );
        console.log(`       ${r.items.map((it) => it.str).join('').slice(0, 60)}`);
      });
    }
  }, 300_000);
});
