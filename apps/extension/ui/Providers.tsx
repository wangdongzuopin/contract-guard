import type { ReactNode } from 'react';
import { App as AntApp, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import type { Locale } from '@cg/core';
import { LocaleProvider, useI18n } from './i18n';
import { antdTheme } from './theme';

/** antd 自带组件（分页、空状态等）的文案也跟着界面语言走 */
function AntdBridge({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  return (
    <ConfigProvider locale={locale === 'zh' ? zhCN : enUS} theme={antdTheme}>
      <AntApp className="cg-app">{children}</AntApp>
    </ConfigProvider>
  );
}

export function AppProviders({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <AntdBridge>{children}</AntdBridge>
    </LocaleProvider>
  );
}
