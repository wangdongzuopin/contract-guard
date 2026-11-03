/**
 * 候选 PDF 探针（开发工具）
 *
 * 用项目自己的引擎跑一遍候选文件，回答三个问题：
 *   1. 有没有文本层（扫描件 = 产品当前不支持）
 *   2. 条款切分是否有效
 *   3. 规则引擎命中了什么
 *
 * 用法：
 *   $env:CG_PROBE = '["D:\\a.pdf","D:\\b.pdf"]'
 *   pnpm vitest run apps/extension/test/probe.test.ts
 */
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { analyzeDocument } from '@cg/core';
import { buildText, detectGutter, groupIntoRows, rowsToLines, type RawItem } from '../lib/pdf-lines';

const rawProbe = process.env.CG_PROBE ?? '[]';
const parsed = JSON.parse(rawProbe);
// 单个文件时 PowerShell 可能传进来一个裸字符串
const files: string[] = Array.isArray(parsed) ? parsed : [parsed];

describe('候选 PDF 探针', () => {
  it('逐个探针', async () => {
    if (files.length === 0) {
      console.log('（未设置 CG_PROBE，跳过）');
      return;
    }
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    for (const path of files) {
      console.log('\n' + '='.repeat(78));
      console.log(path);
      console.log('='.repeat(78));

      let text = '';
      let pageCount = 0;
      let lineCount = 0;
      let scanned = true;
      let gutter: number | null = null;

      try {
        const bytes = readFileSync(path);
        const data = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
        const doc = await loadingTask.promise;
        pageCount = doc.numPages;

        const lines: any[] = [];
        for (let p = 1; p <= pageCount; p += 1) {
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
          if (raw.length > 0) scanned = false;
          const rows = groupIntoRows(raw);
          const g = detectGutter(rows, viewport.width);
          if (g != null) gutter = g;
          lines.push(...rowsToLines(rows, p, viewport, g));
        }
        lineCount = lines.length;
        text = buildText(lines).text;
        await loadingTask.destroy();
      } catch (err: any) {
        console.log(`  打开失败：${err?.message ?? err}`);
        continue;
      }

      console.log(
        `  页数 ${pageCount} ｜ 文本 ${text.length} 字 ｜ 行 ${lineCount} ｜ 栏缝 ${
          gutter != null ? gutter.toFixed(0) : '无（单栏）'
        } ｜ ${scanned ? '❌ 扫描件（无文本层）' : '✅ 有文本层'}`,
      );

      if (scanned || text.trim().length < 50) {
        console.log('  → 产品当前不支持扫描件（刻意不内嵌 OCR）');
        continue;
      }

      const t0 = performance.now();
      const { report, clauses } = analyzeDocument(text, { fileName: path.split(/[\\/]/).pop() });
      const ms = Math.round(performance.now() - t0);

      console.log(
        `  切分条款 ${clauses.length} ｜ 命中 ${report.findings.length} 条 ｜ 评分 ${report.summary.score} ｜ 耗时 ${ms}ms`,
      );

      const byRule = new Map<string, number>();
      for (const x of report.findings) byRule.set(x.ruleId, (byRule.get(x.ruleId) ?? 0) + 1);
      if (byRule.size) {
        console.log('  命中规则：' + [...byRule].map(([k, v]) => `${k}×${v}`).join(', '));
      }

      console.log('  条款编号：' + clauses.map((c) => c.number ?? '·').join(' | '));
      console.log('  --- 正文前 400 字 ---');
      console.log('  ' + text.slice(0, 400).replace(/\n/g, '\n  '));

      if (process.env.CG_PROBE_VERBOSE === '1') {
        console.log('  --- 逐条明细 ---');
        clauses.forEach((c, i) => {
          console.log(
            `   [${i}] ${c.number ?? '·'} ${c.title ?? ''} | ${c.text.slice(0, 50).replace(/\n/g, '⏎')}`,
          );
        });
        console.log('  --- 原始行（带编号的行） ---');
        text
          .split('\n')
          .forEach((l, i) => {
            if (/^\s*(第\s*[零〇一二三四五六七八九十百千万亿两\d]+\s*[条章节]|[（(]\s*[零〇一二三四五六七八九十\d]+\s*[)）]|[零〇一二三四五六七八九十]+\s*[、．]|\d{1,2}\s*[、．.])/.test(l)) {
              console.log(`   L${i}: ${l.slice(0, 60)}`);
            }
          });
      }
    }
  }, 300_000);
});
