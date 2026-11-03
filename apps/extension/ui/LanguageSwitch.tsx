import { Segmented } from 'antd';
import { isLocale, type Locale } from '@cg/core';
import { useI18n } from './i18n';

const OPTIONS: { label: string; value: Locale }[] = [
  { label: '中文', value: 'zh' },
  { label: 'EN', value: 'en' },
];

/** 中 / EN 切换。选项名用各自语言写，不随当前语言变，找起来最快 */
export default function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <Segmented<Locale>
      id="lang-switch"
      size="small"
      value={locale}
      options={OPTIONS}
      aria-label={t.language}
      onChange={(value) => {
        if (isLocale(value)) setLocale(value);
      }}
    />
  );
}
