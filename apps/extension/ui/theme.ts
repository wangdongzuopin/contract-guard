import type { ThemeConfig } from 'antd';
import { FONT_STACK, PALETTE, SEVERITY_TONE } from '../lib/palette';

/**
 * antd 主题令牌 + 自定义样式用的 CSS 变量。
 * 颜色只在 lib/palette.ts 里定义一次，这里负责分发给 antd 与 global.css。
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: PALETTE.brand,
    colorInfo: PALETTE.brand,
    colorLink: PALETTE.brand,
    colorSuccess: '#16A34A',
    colorWarning: SEVERITY_TONE.medium.solid,
    colorError: SEVERITY_TONE.high.solid,
    colorText: PALETTE.ink,
    colorTextSecondary: PALETTE.muted,
    colorTextTertiary: PALETTE.subtle,
    colorTextQuaternary: PALETTE.faint,
    colorBorder: PALETTE.border,
    colorBorderSecondary: PALETTE.hairline,
    colorBgLayout: PALETTE.canvas,
    fontFamily: FONT_STACK,
    fontSize: 14,
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    controlHeight: 34,
    wireframe: false,
  },
  components: {
    Button: { primaryShadow: 'none', defaultShadow: 'none', fontWeight: 500 },
    Segmented: { trackBg: PALETTE.fill, itemSelectedBg: PALETTE.surface, itemColor: PALETTE.muted },
  },
};

/** 把调色板写成 CSS 变量（global.css 只引用变量，不写死颜色） */
export function applyCssVariables(root: HTMLElement = document.documentElement): void {
  const vars: Record<string, string> = {
    '--cg-brand': PALETTE.brand,
    '--cg-brand-hover': PALETTE.brandHover,
    '--cg-brand-soft': PALETTE.brandSoft,
    '--cg-brand-border': PALETTE.brandBorder,
    '--cg-ink': PALETTE.ink,
    '--cg-text': PALETTE.text,
    '--cg-muted': PALETTE.muted,
    '--cg-subtle': PALETTE.subtle,
    '--cg-faint': PALETTE.faint,
    '--cg-border': PALETTE.border,
    '--cg-hairline': PALETTE.hairline,
    '--cg-fill': PALETTE.fill,
    '--cg-surface': PALETTE.surface,
    '--cg-canvas': PALETTE.canvas,
    '--cg-viewer': PALETTE.viewer,
    '--cg-font': FONT_STACK,
  };
  for (const [sev, tone] of Object.entries(SEVERITY_TONE)) {
    vars[`--cg-${sev}`] = tone.solid;
    vars[`--cg-${sev}-text`] = tone.text;
    vars[`--cg-${sev}-soft`] = tone.soft;
    vars[`--cg-${sev}-border`] = tone.border;
    vars[`--cg-${sev}-mark`] = tone.mark;
  }
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}
