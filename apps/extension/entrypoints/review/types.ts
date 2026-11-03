import type { Severity } from '@cg/core';

export type LoadErrorCode = 'notPdf' | 'scanned' | 'password' | 'invalid' | 'unknown';

export interface LoadError {
  code: LoadErrorCode;
  /** 未知错误的原始信息，附在提示后面便于排查 */
  detail?: string;
}

export interface LoadProgress {
  fileName: string;
  stage: 'read' | 'parse' | 'analyze';
  /** 已解析页数 */
  done: number;
  total: number;
}

/** 选中项与它的来源：从清单选中要把 PDF 滚过去，从 PDF 点选则不用 */
export interface Selection {
  key: string;
  origin: 'list' | 'viewer';
}

export type SeverityFilter = 'all' | Severity;
