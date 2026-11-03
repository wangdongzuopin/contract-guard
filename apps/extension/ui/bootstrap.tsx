import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { loadLocale } from '../lib/locale';
import { AppProviders } from './Providers';
import { applyCssVariables } from './theme';

/**
 * 挂载页面。先读语言偏好再渲染，避免先闪一下另一种语言。
 * chrome.storage 读一次只要几毫秒。
 */
export function mount(App: ComponentType): void {
  const el = document.getElementById('root');
  if (!el) throw new Error('缺少 #root 挂载点');
  applyCssVariables();

  void loadLocale().then((locale) => {
    createRoot(el).render(
      <StrictMode>
        <AppProviders initialLocale={locale}>
          <App />
        </AppProviders>
      </StrictMode>,
    );
  });
}
