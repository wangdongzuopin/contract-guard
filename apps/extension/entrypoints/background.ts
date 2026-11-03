import { browser } from 'wxt/browser';

export default defineBackground(() => {
  // 首次安装直接打开审查页：空状态里有拖放区和示例合同，比让用户去找扩展图标更直接
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') void browser.tabs.create({ url: browser.runtime.getURL('/review.html') });
  });
});
