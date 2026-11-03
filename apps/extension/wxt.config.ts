import { defineConfig } from 'wxt';
import { resolve } from 'node:path';

// 合同风险检查扩展 —— MV3 / 零后端 / 合同不出本机
// 名称与描述走 public/_locales，商店和扩展管理页按浏览器语言显示中文或英文
export default defineConfig({
  srcDir: '.',
  outDir: '.output',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'zh_CN',
    version: '0.1.0',
    permissions: ['storage'],
    icons: {
      16: 'icon/icon16.png',
      32: 'icon/icon32.png',
      48: 'icon/icon48.png',
      128: 'icon/icon128.png',
    },
    action: {
      // default_title 由 popup/index.html 的 <title> 生成（WXT 约定），那里写的是 __MSG_extName__
      default_popup: 'popup.html',
      default_icon: {
        16: 'icon/icon16.png',
        32: 'icon/icon32.png',
        48: 'icon/icon48.png',
        128: 'icon/icon128.png',
      },
    },
  },
  zip: {
    artifactTemplate: 'contract-guard-{{version}}-{{browser}}.zip',
  },
  vite: () => ({
    resolve: {
      alias: {
        '@cg/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      },
    },
    // pdf.js 体积较大，单独切块
    build: {
      chunkSizeWarningLimit: 1500,
    },
    worker: {
      format: 'es',
    },
  }),
});
