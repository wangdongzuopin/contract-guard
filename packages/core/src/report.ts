import { DEFAULT_LOCALE, engineStrings } from './i18n';
import type { Clause, DocumentType, Finding, Locale, Report, ScoreBand, Severity } from './types';

const CONFIDENCE_SCORE = { high: 1, medium: 0.7, low: 0.4 } as const;

/** 每条风险扣分：越严重扣得越多 */
export const SEVERITY_PENALTY: Record<Severity, number> = { high: 8, medium: 3, low: 1 };

/** 评分档位分界：≥ safe 可推进签署，≥ negotiate 需谈判，其余为高风险 */
export const SCORE_BANDS = { safe: 85, negotiate: 60 } as const;

export function scoreBand(score: number): ScoreBand {
  if (score >= SCORE_BANDS.safe) return 'safe';
  if (score >= SCORE_BANDS.negotiate) return 'negotiate';
  return 'risky';
}

export interface ReportInput {
  findings: Finding[];
  clauses: Clause[];
  docText: string;
  fileName?: string;
  pageCount?: number;
  durationMs?: number;
  ruleSetVersion?: string;
  toolVersion?: string;
  docType?: DocumentType;
  skippedByType?: number;
  locale?: Locale;
  languageSupported?: boolean;
}

export function buildReport(input: ReportInput): Report {
  const { findings, clauses, docText } = input;
  const locale = input.locale ?? DEFAULT_LOCALE;
  const strings = engineStrings(locale);

  const high = findings.filter((f) => f.severity === 'high').length;
  const medium = findings.filter((f) => f.severity === 'medium').length;
  const low = findings.filter((f) => f.severity === 'low').length;

  const score = Math.max(
    0,
    Math.min(
      100,
      100 -
        high * SEVERITY_PENALTY.high -
        medium * SEVERITY_PENALTY.medium -
        low * SEVERITY_PENALTY.low,
    ),
  );

  const classified = clauses.filter((c) => !!c.type).length;
  const languageSupported = input.languageSupported ?? true;
  const avgConfidence =
    clauses.length === 0
      ? 0
      : clauses.reduce((acc, c) => acc + CONFIDENCE_SCORE[c.confidence], 0) / clauses.length;

  return {
    meta: {
      tool: strings.toolName,
      toolVersion: input.toolVersion ?? '0.1.0',
      ruleSetVersion: input.ruleSetVersion ?? 'builtin-1',
      createdAt: new Date().toISOString(),
      fileName: input.fileName,
      pageCount: input.pageCount,
      charCount: docText.length,
      durationMs: input.durationMs,
      docType: input.docType,
      skippedByType: input.skippedByType,
      locale,
      languageSupported,
    },
    summary: {
      total: findings.length,
      high,
      medium,
      low,
      score,
      verdict: languageSupported ? strings.verdict[scoreBand(score)] : strings.unsupportedVerdict,
    },
    findings,
    clauseStats: {
      total: clauses.length,
      classified,
      unclassified: clauses.length - classified,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
    },
  };
}
