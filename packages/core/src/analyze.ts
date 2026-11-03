import { segmentClauses } from './clauses';
import { classify } from './classify';
import { evaluate } from './rules';
import { buildReport } from './report';
import { detectDocumentType, filterRulesByType, isSupportedLanguage } from './doc-type';
import { DEFAULT_LOCALE } from './i18n';
import { BUILTIN_RULES, RULE_SET_VERSION } from './rules/built-in';
import type { Clause, DocumentType, Locale, Report, Rule } from './types';

/**
 * 一站式分析管线
 *
 *   文本 → 文档类型识别 → 条款切分 → 归类 → 规则比对 → 报告
 *
 * 纯函数、无 IO、无模型调用，可在任何运行时环境执行。
 */

export interface AnalyzeOptions {
  /** 自定义规则集，缺省使用内置规则 */
  rules?: Rule[];
  fileName?: string;
  pageCount?: number;
  durationMs?: number;
  toolVersion?: string;
  /** 强制指定文档类型；缺省则自动识别 */
  docType?: DocumentType;
  /** 关闭文档类型门控（所有规则一律生效） */
  ignoreDocType?: boolean;
  /** 报告文案语言，缺省中文。只影响文案，不影响判定 */
  locale?: Locale;
}

export interface AnalyzeResult {
  report: Report;
  clauses: Clause[];
  /** 切分后的条款文本（用于页内高亮的坐标映射） */
  text: string;
  /** 识别到的文档类型 */
  docType: DocumentType;
}

export function analyzeDocument(docText: string, options: AnalyzeOptions = {}): AnalyzeResult {
  const allRules = options.rules ?? BUILTIN_RULES;
  const locale = options.locale ?? DEFAULT_LOCALE;

  // 文档类型门控 —— 控制误报的第一道闸门
  const docType = options.docType ?? detectDocumentType(docText);
  const { rules, skipped } = options.ignoreDocType
    ? { rules: allRules, skipped: 0 }
    : filterRulesByType(allRules, docType);

  const clauses = segmentClauses(docText);
  classify(clauses, rules);
  const findings = evaluate(docText, clauses, rules, locale);

  const report = buildReport({
    findings,
    clauses,
    docText,
    fileName: options.fileName,
    pageCount: options.pageCount,
    durationMs: options.durationMs,
    // 注意比较的是「用户传入的规则集」，不是门控后的结果数组
    ruleSetVersion: allRules === BUILTIN_RULES ? RULE_SET_VERSION : 'custom',
    toolVersion: options.toolVersion,
    docType,
    skippedByType: skipped,
    locale,
    languageSupported: isSupportedLanguage(docText),
  });

  return { report, clauses, text: docText, docType };
}
