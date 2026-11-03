/**
 * 本地预览：用一个全新的临时浏览器配置加载构建产物，并打开审查页。
 *
 *   pnpm preview            优先用 Chrome，没装就用 Edge
 *   pnpm preview --chrome   指定 Chrome
 *   pnpm preview --edge     指定 Edge
 *
 * 为什么 Chrome 和 Edge 走两条路：
 *   Chrome 137 起，正式版不再支持 --load-extension 命令行参数，
 *   只能通过调试管道（--remote-debugging-pipe）调用 CDP 的 Extensions.loadUnpacked 加载。
 *   调试管道要求一个进程一直连着浏览器，所以 Chrome 模式下本命令会一直运行，关掉浏览器窗口才结束。
 *   Edge 仍支持 --load-extension，启动后命令立即返回。
 *
 * 两种方式都用临时配置目录，不影响你平时用的浏览器、账号和已安装的扩展。
 * 先 pnpm build。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXT_DIR = join(ROOT, 'apps', 'extension', '.output', 'chrome-mv3');

const CHROME = [
  process.env.CG_CHROME_PATH,
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const EDGE = [
  process.env.CG_EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const find = (list) => list.find((p) => p && existsSync(p));

if (!existsSync(join(EXT_DIR, 'manifest.json'))) {
  console.error('未找到构建产物，请先运行 pnpm build');
  process.exit(1);
}

const want = process.argv.includes('--edge') ? 'edge' : process.argv.includes('--chrome') ? 'chrome' : 'auto';
const chrome = want === 'edge' ? undefined : find(CHROME);
const edge = want === 'chrome' ? undefined : find(EDGE);
const profile = mkdtempSync(join(tmpdir(), 'cg-preview-'));

if (chrome) {
  await previewInChrome(chrome);
} else if (edge) {
  previewInEdge(edge);
} else {
  console.error(`找不到${want === 'chrome' ? ' Chrome' : want === 'edge' ? ' Edge' : ' Chrome 或 Edge'}。`);
  console.error(`可手动加载：扩展管理页 → 开发者模式 → 加载已解压的扩展程序 → ${EXT_DIR}`);
  process.exit(1);
}

async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
  return undefined;
}

async function previewInChrome(exe) {
  const { chromium } = await import('playwright');
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: exe,
    headless: false,
    // 用真实窗口尺寸，不做视口模拟
    viewport: null,
    // 保留沙箱（Playwright 默认会关掉，Chrome 还会弹出不安全提示）
    chromiumSandbox: true,
    ignoreDefaultArgs: [
      '--disable-extensions',
      // 去掉「Chrome 正受到自动测试软件的控制」提示条
      '--enable-automation',
      // 这两项是测试用的放宽，给人用的窗口要恢复默认的安全行为
      '--disable-popup-blocking',
      '--disable-client-side-phishing-detection',
    ],
    args: ['--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check', '--start-maximized'],
  });

  const cdp = await context.browser().newBrowserCDPSession();
  const { id } = await cdp.send('Extensions.loadUnpacked', { path: EXT_DIR });
  const reviewUrl = `chrome-extension://${id}/review.html`;

  // 首次安装时扩展自己会打开审查页；等一会儿，没有再手动打开，避免开出两个标签
  let review = await waitFor(() => context.pages().find((p) => p.url().startsWith(reviewUrl)), 3000);
  if (!review) {
    review = context.pages().find((p) => p.url() === 'about:blank') ?? (await context.newPage());
    await review.goto(reviewUrl);
  }
  for (const p of context.pages()) {
    if (p !== review && p.url() === 'about:blank') await p.close();
  }
  await review.bringToFront();
  await review.waitForSelector('#dropzone', { timeout: 15000 });
  if (process.env.CG_PREVIEW_SHOT) await review.screenshot({ path: process.env.CG_PREVIEW_SHOT });

  console.log(`已启动 Chrome：${exe}`);
  console.log(`扩展已加载，ID = ${id}`);
  console.log(`审查页：${reviewUrl}`);
  console.log('点地址栏右侧的拼图图标可以把扩展固定到工具栏。关掉这个浏览器窗口即结束预览。');

  await new Promise((r) => context.on('close', r));
  console.log('浏览器已关闭，预览结束');
}

function previewInEdge(exe) {
  const child = spawn(
    exe,
    [
      `--user-data-dir=${profile}`,
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--start-maximized',
    ],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();
  console.log(`已启动 Edge：${exe}`);
  console.log(`扩展目录：${EXT_DIR}`);
  console.log('审查页会自动打开；也可以点工具栏里的扩展图标。');
}
