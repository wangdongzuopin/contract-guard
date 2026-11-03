/**
 * 真实浏览器冒烟测试
 *
 * 验证 Node 里测不出来的事：
 *   1. MV3 扩展能被浏览器正常加载（manifest 本地化 / 权限 / service worker / CSP）
 *   2. pdf.js 的 worker 能在扩展页面里跑起来，页面真的画出来
 *   3. 风险清单、页内高亮、双向联动、键盘切换、筛选、导出都能用
 *   4. 中英文切换：界面、引擎输出、导出报告一起变；偏好能保存；弹窗与审查页同步
 *
 * 运行：node apps/extension/test/browser-smoke.mjs（先 pnpm build）
 */
import { chromium } from 'playwright';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const EXT_DIR = join(ROOT, 'apps/extension/.output/chrome-mv3');
const PDF = join(ROOT, 'test/fixtures/sample-contract.pdf');
const CJK = /[\u4e00-\u9fff]/;

let failures = 0;
const ok = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.error(`✗ ${msg}`);
};
const check = (cond, good, bad) => (cond ? ok(good) : fail(bad));

if (!existsSync(join(EXT_DIR, 'manifest.json'))) {
  console.error(`未找到构建产物：${EXT_DIR}（请先 pnpm build）`);
  process.exit(1);
}

/** 优先用系统已装的 Chromium 内核浏览器，避免额外下载 */
const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const executablePath = process.env.CG_BROWSER_PATH || BROWSER_CANDIDATES.find((p) => existsSync(p));
console.log(`启动浏览器：${executablePath ?? 'Playwright 内置 Chromium'}`);

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'cg-smoke-')), {
  ...(executablePath ? { executablePath } : { channel: 'chromium' }),
  headless: process.env.CG_HEADED !== '1',
  locale: 'zh-CN',
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
  args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`, '--no-first-run', '--no-default-browser-check'],
});

const errors = [];
function watch(page) {
  page.on('pageerror', (e) => errors.push(`${page.url()} ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${page.url()} ${m.text()}`);
  });
}

const titles = (page) => page.locator('#findings .cg-finding__title').allInnerTexts();
const lang = (page) => page.evaluate(() => document.documentElement.lang);

async function download(page) {
  const [file] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#export')]);
  return { name: file.suggestedFilename(), html: readFileSync(await file.path(), 'utf8') };
}

try {
  // 0) manifest
  const manifest = JSON.parse(readFileSync(join(EXT_DIR, 'manifest.json'), 'utf8'));
  const locales = ['zh_CN', 'en'].every((l) => existsSync(join(EXT_DIR, '_locales', l, 'messages.json')));
  check(
    manifest.name === '__MSG_extName__' &&
      manifest.action?.default_title === '__MSG_extName__' &&
      manifest.default_locale === 'zh_CN' &&
      locales,
    'manifest 已本地化（名称、描述、图标悬停提示；zh_CN / en）',
    `manifest 本地化不完整：${JSON.stringify({ name: manifest.name, title: manifest.action?.default_title, default_locale: manifest.default_locale, locales })}`,
  );
  check(
    JSON.stringify(manifest.permissions) === '["storage"]' && !manifest.host_permissions?.length,
    '权限只有 storage，没有任何网站访问权限',
    `权限超出预期：${JSON.stringify(manifest.permissions)} ${JSON.stringify(manifest.host_permissions)}`,
  );

  // 1) 扩展 ID
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15000 }));
  const id = new URL(sw.url()).host;
  ok(`扩展已加载，ID = ${id}`);

  // 2) 审查页
  const page = await context.newPage();
  watch(page);
  await page.goto(`chrome-extension://${id}/review.html`);
  await page.waitForSelector('#dropzone', { timeout: 10000 });
  check((await lang(page)) === 'zh-CN', '审查页打开成功，默认中文', `默认语言不是中文：${await lang(page)}`);

  // 3) 非 PDF：空状态下给出明确提示
  await page.setInputFiles('#file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await page.waitForSelector('#load-error', { timeout: 5000 }).then(
    () => ok('选了非 PDF 文件时给出提示'),
    () => fail('选了非 PDF 文件没有提示'),
  );

  // 4) 打开真实 PDF
  const t0 = Date.now();
  await page.setInputFiles('#file', PDF);
  await page.waitForSelector('#findings .cg-finding', { timeout: 30000 });
  const count = await page.locator('#findings .cg-finding').count();
  check(count >= 12, `PDF 解析完成，风险清单 ${count} 条（${Date.now() - t0}ms）`, `风险条数异常：${count}`);
  const zhTitles = await titles(page);
  const zhMissing = ['付款账期', '违约金总额上限', '赔偿责任上限', '保密期限', '自动续约', '预付款比例'].filter(
    (kw) => !zhTitles.includes(kw),
  );
  check(zhMissing.length === 0, '关键风险项均出现在清单中', `风险清单缺少：${zhMissing.join('、')}`);

  // 5) 画布真的画出来了
  await page.waitForSelector('.cg-page[data-page="1"].is-ready', { timeout: 25000 }).catch(() => {});
  const canvas = await page.evaluate(() => {
    const c = document.querySelector('.cg-page[data-page="1"] canvas');
    if (!c || !c.width) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) dark += 1;
    return { w: c.width, h: c.height, dark };
  });
  check(
    !!canvas && canvas.w > 100 && canvas.dark > 0,
    `第 1 页已渲染 ${canvas?.w}×${canvas?.h}，深色像素 ${canvas?.dark}`,
    `第 1 页没有渲染出来：${JSON.stringify(canvas)}`,
  );

  // 6) 高亮与摘要
  const marks = await page.locator('.cg-hl').count();
  check(marks > 0, `页内高亮 ${marks} 处`, 'PDF 上没有高亮');
  const docType = (await page.locator('#doctype').innerText()).replace(/\s+/g, ' ').trim();
  check(docType.includes('商务合同'), `文书类型：${docType}`, `文书类型未显示：${docType}`);
  const score = (await page.locator('#score').innerText()).trim();
  check(/^\d+$/.test(score), `安全分：${score}`, `安全分异常：${score}`);

  // 7) 清单 → 高亮
  const first = page.locator('#findings .cg-finding').first();
  await first.click();
  const firstKey = await first.getAttribute('data-key');
  check(await first.locator('.cg-finding__advice').isVisible(), '选中风险项后展开修改建议', '选中后没有展开修改建议');
  check(
    (await page.locator(`.cg-hl.is-selected[data-key="${firstKey}"]`).count()) > 0,
    'PDF 上对应的高亮同步选中',
    '选中风险项后 PDF 上没有对应的选中高亮',
  );

  // 8) 键盘切换
  await page.keyboard.press('ArrowDown');
  const second = page.locator('#findings .cg-finding').nth(1);
  check((await second.getAttribute('aria-selected')) === 'true', '↓ 键切换到下一条', '↓ 键没有切换选中项');

  // 9) 高亮 → 清单
  const secondKey = await second.getAttribute('data-key');
  const other = page.locator(`.cg-hl:not([data-key="${secondKey}"])`).first();
  const otherKey = await other.getAttribute('data-key');
  await other.click();
  check(
    (await page.locator(`#findings .cg-finding[data-key="${otherKey}"]`).getAttribute('aria-selected')) === 'true',
    '点击页内高亮会选中清单里的对应项',
    '点击高亮没有选中清单项',
  );

  // 10) 筛选
  await page.click('#severity-filter [data-filter="high"]');
  const classes = await page.locator('#findings .cg-finding').evaluateAll((els) => els.map((e) => e.className));
  check(
    classes.length > 0 && classes.every((c) => c.includes('cg-finding--high')),
    `按等级筛选后只剩 ${classes.length} 条高风险`,
    '筛选后仍有其他等级',
  );
  await page.click('#severity-filter [data-filter="all"]');

  // 11) 导出中文报告
  const zhReport = await download(page);
  check(
    zhReport.name === 'sample-contract-审查报告.html' && zhReport.html.includes('合同审查报告') && zhReport.html.includes('付款账期'),
    `导出中文报告：${zhReport.name}`,
    `中文报告异常：${zhReport.name}`,
  );

  // 12) 切到英文
  await page.locator('#lang-switch').getByText('EN', { exact: true }).click();
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 5000 });
  const enTitles = await titles(page);
  const enMissing = ['Payment term', 'Liquidated damages cap', 'Liability cap', 'Confidentiality period', 'Automatic renewal', 'Advance payment ratio'].filter(
    (kw) => !enTitles.includes(kw),
  );
  check(
    enMissing.length === 0 && enTitles.length === count && enTitles.every((s) => !CJK.test(s)),
    '切到英文后风险标题全部变为英文，条数不变',
    `英文标题异常：缺少 ${enMissing.join(' / ')}；${enTitles.join(' / ')}`,
  );
  check((await page.locator('#export').innerText()).trim() === 'Export report', '界面按钮同步变为英文', '按钮文案没有切换');
  check(
    (await page.locator('#findings .cg-finding.is-selected').count()) === 1,
    '切换语言后选中项保留',
    '切换语言后选中项丢失',
  );
  const enReport = await download(page);
  check(
    enReport.name === 'sample-contract-review-report.html' && enReport.html.includes('Contract Review Report') && !enReport.html.includes('修改建议'),
    `导出英文报告：${enReport.name}`,
    `英文报告异常：${enReport.name}`,
  );

  // 13) 偏好保存：刷新后仍是英文；示例合同可一键打开
  await page.reload();
  await page.waitForSelector('#dropzone', { timeout: 10000 });
  check((await lang(page)) === 'en', '刷新后仍为英文（偏好已保存）', '语言偏好没有保存');
  await page.click('#try-sample');
  await page.waitForSelector('#findings .cg-finding', { timeout: 30000 });
  check(
    (await page.locator('#findings .cg-finding').count()) === count,
    '示例合同可一键打开',
    '示例合同的结果与预期不符',
  );

  // 14) 弹窗跟随偏好，并能反向同步审查页
  const popup = await context.newPage();
  watch(popup);
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.waitForSelector('#open-review', { timeout: 10000 });
  check(
    (await popup.locator('#open-review').innerText()).trim() === 'Open review page',
    '弹窗打开成功，跟随英文偏好',
    '弹窗没有跟随语言偏好',
  );
  await popup.locator('#lang-switch').getByText('中文', { exact: true }).click();
  await page.waitForFunction(() => document.documentElement.lang === 'zh-CN', null, { timeout: 5000 }).then(
    () => ok('在弹窗里切回中文，审查页同步切换'),
    () => fail('弹窗切换语言后审查页没有同步'),
  );

  // 15) 关闭文件
  await page.click('#close-file');
  await page.waitForSelector('#dropzone', { timeout: 5000 }).then(
    () => ok('关闭文件后回到空状态'),
    () => fail('关闭文件后没有回到空状态'),
  );

  const real = errors.filter((e) => !/favicon|Download the React DevTools/i.test(e));
  check(real.length === 0, '无 JS 运行时错误', `页面报错 ${real.length} 条：\n${real.slice(0, 5).join('\n')}`);
} catch (err) {
  fail(`冒烟测试异常：${err?.stack ?? err}`);
} finally {
  await context.close();
}

console.log(failures ? `\n浏览器冒烟测试未通过（${failures} 项）` : '\n浏览器冒烟测试全部通过');
process.exitCode = failures ? 1 : 0;
