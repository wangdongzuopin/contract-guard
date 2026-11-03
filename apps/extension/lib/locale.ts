import { storage } from 'wxt/utils/storage';
import { isLocale, type Locale } from '@cg/core';

/**
 * 界面语言偏好
 *
 * 存在 chrome.storage.local（manifest 里唯一的 storage 权限），
 * 审查页与弹窗共用，任何一边切换，另一边通过 watch 实时跟上。
 * 没存过偏好时跟随浏览器语言：中文环境用中文，其余用英文。
 */

const localeItem = storage.defineItem<Locale>('local:locale');

export function detectLocale(): Locale {
  const langs = typeof navigator === 'undefined' ? [] : [...(navigator.languages ?? []), navigator.language];
  const first = langs.find((l) => !!l)?.toLowerCase() ?? 'zh';
  return first.startsWith('zh') ? 'zh' : 'en';
}

export async function loadLocale(): Promise<Locale> {
  try {
    const saved = await localeItem.getValue();
    if (isLocale(saved)) return saved;
  } catch {
    // 不在扩展环境里（例如直接打开 HTML）时没有 storage，退回浏览器语言
  }
  return detectLocale();
}

export async function saveLocale(locale: Locale): Promise<void> {
  await localeItem.setValue(locale);
}

export function watchLocale(onChange: (locale: Locale) => void): () => void {
  try {
    return localeItem.watch((value) => {
      if (isLocale(value)) onChange(value);
    });
  } catch {
    return () => {};
  }
}
