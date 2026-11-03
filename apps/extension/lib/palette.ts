import type { ScoreBand, Severity } from '@cg/core';

/**
 * 配色 —— 界面、antd 主题与导出报告共用的唯一来源。
 *
 * 主色是偏深的靛蓝，和风险色（红 / 琥珀 / 青）拉开距离，
 * 免得「品牌色」和「风险等级色」在同一屏里打架。
 * 文字色都满足 WCAG AA（白底对比度 ≥ 4.5:1）。
 */
export const PALETTE = {
  brand: '#2F4BD8',
  brandHover: '#4863E6',
  brandSoft: '#EEF1FD',
  brandBorder: '#C9D2F8',
  ink: '#0F172A',
  text: '#1E293B',
  muted: '#475569',
  subtle: '#64748B',
  faint: '#94A3B8',
  border: '#E2E8F0',
  hairline: '#EDF0F4',
  fill: '#F1F5F9',
  surface: '#FFFFFF',
  canvas: '#F5F6F8',
  viewer: '#E6E9EE',
} as const;

export interface SeverityTone {
  /** 圆点、下划线 */
  solid: string;
  /** 浅底上的文字 */
  text: string;
  /** 浅底 */
  soft: string;
  border: string;
  /** PDF 上的半透明荧光底 */
  mark: string;
}

export const SEVERITY_TONE: Record<Severity, SeverityTone> = {
  high: { solid: '#DC2626', text: '#B91C1C', soft: '#FEF2F2', border: '#FECACA', mark: 'rgba(239, 68, 68, 0.24)' },
  medium: { solid: '#D97706', text: '#B45309', soft: '#FFF7E6', border: '#FCD9A0', mark: 'rgba(245, 158, 11, 0.30)' },
  low: { solid: '#0891B2', text: '#0E7490', soft: '#ECFEFF', border: '#A5E8F3', mark: 'rgba(6, 182, 212, 0.22)' },
};

/** 评分档位的颜色（分数环、档位标签） */
export const BAND_COLOR: Record<ScoreBand, string> = {
  safe: '#16A34A',
  negotiate: '#D97706',
  risky: '#DC2626',
};

export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif";
