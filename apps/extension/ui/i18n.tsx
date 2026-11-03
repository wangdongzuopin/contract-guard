import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '@cg/core';
import { MESSAGES, type Messages } from '../lib/i18n';
import { saveLocale, watchLocale } from '../lib/locale';

interface LocaleContextValue {
  locale: Locale;
  t: Messages;
  setLocale(next: Locale): void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // 另一个页面（弹窗 / 审查页）改了语言，这里跟着变
  useEffect(() => watchLocale(setLocaleState), []);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void saveLocale(next).catch(() => {});
  }, []);

  const value = useMemo(() => ({ locale, t: MESSAGES[locale], setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useI18n 必须在 <LocaleProvider> 内使用');
  return ctx;
}
