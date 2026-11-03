import { browser } from 'wxt/browser';

/**
 * 打开审查页：已经开着就切过去，不重复开新标签。
 *
 * runtime.getContexts 不需要 tabs 权限就能找到扩展自己的页面；
 * 老版本浏览器没有这个 API，就直接新开一个。
 */
export async function openReviewTab(): Promise<void> {
  const url = browser.runtime.getURL('/review.html');
  try {
    const contexts = await browser.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [url] });
    const ctx = contexts.find((c) => c.tabId >= 0);
    if (ctx) {
      await browser.tabs.update(ctx.tabId, { active: true });
      if (ctx.windowId >= 0) await browser.windows.update(ctx.windowId, { focused: true });
      return;
    }
  } catch {
    // 落到下面新开标签
  }
  await browser.tabs.create({ url });
}
