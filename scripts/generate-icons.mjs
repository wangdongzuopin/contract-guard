/**
 * 生成扩展图标：把 apps/extension/public/logo.svg 渲染成 16/32/48/128 PNG。
 * 界面里的 logo 和工具栏图标用同一个 SVG，改一处即可。
 *
 * 用法：node scripts/generate-icons.mjs
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '../apps/extension/public');
const OUT = join(PUBLIC, 'icon');
const svg = readFileSync(join(PUBLIC, 'logo.svg'), 'utf8');
mkdirSync(OUT, { recursive: true });

const CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

async function launch() {
  try {
    return await chromium.launch({ channel: 'chromium', headless: true });
  } catch {
    // 优先用系统浏览器，避免下载
    const exe = CANDIDATES.find((p) => existsSync(p));
    if (!exe) throw new Error('找不到可用的 Chromium 内核浏览器');
    return chromium.launch({ executablePath: exe, headless: true });
  }
}

// 商店规范：128 图标的实际图形应为 96×96，四周各留 16px 透明边。
// 工具栏用的小尺寸不留边，否则 16px 下图形太小看不清。
const ART = { 16: 16, 32: 32, 48: 48, 128: 96 };

const browser = await launch();
for (const size of [16, 32, 48, 128]) {
  const art = ART[size];
  const pad = (size - art) / 2;
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const sized = svg.replace('<svg ', `<svg width="${art}" height="${art}" style="position:absolute;left:${pad}px;top:${pad}px" `);
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:transparent">${sized}</body></html>`);
  const file = join(OUT, `icon${size}.png`);
  await page.screenshot({ path: file, omitBackground: true });
  await page.close();
  console.log(`  ${file} (${size}x${size})`);
}
await browser.close();
console.log(`图标已生成到 ${OUT}`);
