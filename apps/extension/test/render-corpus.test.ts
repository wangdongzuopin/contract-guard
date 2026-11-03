import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import { CORPUS, renderContractHtml } from '../../../packages/core/test/corpus/contracts';

/**
 * 把语料库渲染成 PDF（开发工具）
 *
 * 设 CG_RENDER_CORPUS=1 运行。产物提交进仓库，
 * 这样 corpus-pdf.test.ts 就能离线验证「解析链路不丢内容」。
 *
 * 依赖本机 Edge/Chrome 的无头打印。
 */

const OUT_DIR = resolve(__dirname, '../../../test/fixtures/corpus');
const HTML_DIR = resolve(__dirname, '../../../test/fixtures/corpus/_html');

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function findBrowser(): string | null {
  for (const b of BROWSERS) if (existsSync(b)) return b;
  return null;
}

describe('语料库 PDF 生成', () => {
  it('render', { timeout: 300_000 }, () => {
    if (!process.env.CG_RENDER_CORPUS) {
      console.log('（未设置 CG_RENDER_CORPUS，跳过）');
      return;
    }

    const browser = findBrowser();
    if (!browser) throw new Error('找不到 Edge/Chrome 可执行文件，无法生成 PDF');

    mkdirSync(OUT_DIR, { recursive: true });
    mkdirSync(HTML_DIR, { recursive: true });

    for (const spec of CORPUS) {
      const html = resolve(HTML_DIR, `${spec.id}.html`);
      const pdf = resolve(OUT_DIR, `${spec.id}.pdf`);
      writeFileSync(html, renderContractHtml(spec), 'utf8');

      if (existsSync(pdf)) {
        console.log(`跳过（已存在）${spec.id}.pdf`);
        continue;
      }

      execFileSync(
        browser,
        [
          '--headless',
          '--disable-gpu',
          '--no-pdf-header-footer',
          `--print-to-pdf=${pdf}`,
          `file:///${html.replace(/\\/g, '/')}`,
        ],
        { stdio: 'ignore', timeout: 120_000 },
      );

      if (!existsSync(pdf)) throw new Error(`生成失败：${spec.id}.pdf`);
      console.log(`已生成 ${spec.id}.pdf`);
    }
  });
});
