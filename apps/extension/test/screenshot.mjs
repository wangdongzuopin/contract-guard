/**
 * 界面截图（开发工具）
 *
 * 加载扩展 → 打开 PDF → 截下中英文两套界面、选中联动、拖拽遮罩、窄窗口与弹窗。
 * 改 UI 时用它肉眼确认。
 *
 * 用法：
 *   node apps/extension/test/screenshot.mjs [pdf路径]
 *   CG_HEADED=1 node apps/extension/test/screenshot.mjs
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const EXT_DIR = join(ROOT, 'apps/extension/.output/chrome-mv3');
const OUT_DIR = join(ROOT, 'apps/extension/.output/shots');
const PDF = process.argv[2] || join(ROOT, 'test/fixtures/sample-contract.pdf');

const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

if (!existsSync(EXT_DIR)) {
  console.error('未找到构建产物，请先 pnpm build');
  process.exit(1);
}
if (!existsSync(PDF)) {
  console.error(`未找到 PDF：${PDF}`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

const executablePath = process.env.CG_BROWSER_PATH || BROWSER_CANDIDATES.find((p) => existsSync(p));
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'cg-shot-')), {
  ...(executablePath ? { executablePath } : { channel: 'chromium' }),
  headless: process.env.CG_HEADED !== '1',
  locale: 'zh-CN',
  viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`, '--no-first-run', '--no-default-browser-check'],
});

const shot = async (page, name) => {
  await page.screenshot({ path: join(OUT_DIR, name) });
  console.log(`✓ ${name}`);
};

async function waitForResult(page) {
  await page.waitForSelector('#findings .cg-finding', { timeout: 30000 });
  await page.waitForSelector('.cg-page[data-page="1"].is-ready', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(700);
}

try {
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15000 }));
  const id = new URL(sw.url()).host;
  const reviewUrl = `chrome-extension://${id}/review.html`;

  const page = await context.newPage();
  await page.goto(reviewUrl);
  await page.waitForSelector('#dropzone', { timeout: 10000 });
  await page.waitForTimeout(500);
  await shot(page, '01-empty.png');

  await page.setInputFiles('#file', PDF);
  await waitForResult(page);
  await shot(page, '02-result.png');

  await page.locator('#findings .cg-finding').first().click();
  await page.waitForTimeout(900);
  await shot(page, '03-selected.png');

  await page.locator('#lang-switch').getByText('EN', { exact: true }).click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.waitForTimeout(500);
  await shot(page, '04-result-en.png');

  // 拖拽遮罩：派发一个带文件的 dragenter
  const dt = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    d.items.add(new File(['x'], 'contract.pdf', { type: 'application/pdf' }));
    return d;
  });
  await page.dispatchEvent('body', 'dragenter', { dataTransfer: dt });
  await page.waitForTimeout(300);
  await shot(page, '05-drop-en.png');
  await page.dispatchEvent('body', 'dragleave', { dataTransfer: dt });

  // 窄窗口
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(600);
  await shot(page, '06-narrow-en.png');

  // 空状态英文
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click('#close-file');
  await page.waitForSelector('#dropzone');
  await page.waitForTimeout(500);
  await shot(page, '07-empty-en.png');

  // 弹窗（英文 → 中文）
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 340, height: 300 });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.waitForSelector('#open-review', { timeout: 10000 });
  await popup.waitForTimeout(400);
  await shot(popup, '08-popup-en.png');
  await popup.locator('#lang-switch').getByText('中文', { exact: true }).click();
  await popup.waitForTimeout(400);
  await shot(popup, '09-popup.png');

  // 商店截图：1280×800（Chrome 应用商店要求的尺寸），中英文各一套
  const STORE_DIR = join(OUT_DIR, 'store');
  mkdirSync(STORE_DIR, { recursive: true });
  const store = await context.newPage();
  await store.setViewportSize({ width: 1280, height: 800 });
  for (const lang of ['zh', 'en']) {
    await store.goto(reviewUrl);
    await store.waitForSelector('#dropzone', { timeout: 10000 });
    await store.locator('#lang-switch').getByText(lang === 'zh' ? '中文' : 'EN', { exact: true }).click();
    await store.waitForFunction((l) => document.documentElement.lang === (l === 'zh' ? 'zh-CN' : 'en'), lang);
    await store.waitForTimeout(500);
    await store.screenshot({ path: join(STORE_DIR, `${lang}-1-empty.png`) });
    await store.click('#try-sample');
    await waitForResult(store);
    await store.locator('#findings .cg-finding').first().click();
    await store.waitForTimeout(900);
    await store.screenshot({ path: join(STORE_DIR, `${lang}-2-review.png`) });
    console.log(`✓ store/${lang}-1-empty.png, store/${lang}-2-review.png`);
  }

  console.log(`\n截图目录：${OUT_DIR}`);
} finally {
  await context.close();
}
