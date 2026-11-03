/**
 * 合同风险检查引擎 —— 核心类型定义
 *
 * 设计原则：全部为纯数据结构，无任何浏览器/Node 依赖。
 * 同一套类型可运行于：浏览器扩展 / Web Worker / CLI / 私有化服务端。
 */

export type Severity = 'high' | 'medium' | 'low';

/** 引擎输出文案的语言（规则标题、建议、偏离说明、结论） */
export type Locale = 'zh' | 'en';

/** 阈值方向：max = 不得超过，min = 不得少于 */
export type Bound = 'max' | 'min';

/** 评分档位：可推进签署 / 需谈判 / 高风险 */
export type ScoreBand = 'safe' | 'negotiate' | 'risky';

/** 规则的可翻译文本；缺省回落到中文原文 */
export interface RuleText {
  title?: string;
  advice?: string;
}

/**
 * 文档类型
 *
 * 同一套红线在不同类型的文书上意义完全不同：
 * 对一份商务合同来说「未见发票与税率约定」是风险，
 * 对一份雇佣合同来说这根本不是应有条款 —— 报出来就是误报。
 *
 * 所以规则必须声明自己适用于哪些文档类型，由引擎按识别到的类型门控。
 */
export type DocumentType =
  | 'commercial' // 商务合同：服务/采购/销售/供货/技术开发
  | 'employment' // 雇佣/劳务/劳动/聘用
  | 'nda' // 保密协议
  | 'commitment' // 承诺书 / 责任书 / 申请书
  | 'unknown'; // 无法识别 —— 按最宽松口径（全部规则）处理

/** 可比较的量纲 */
export type Dimension =
  | 'days' // 期限（统一折算为天）
  | 'percent' // 百分比（值即百分数，5 表示 5%）
  | 'amount' // 金额（统一折算为元）
  | 'times' // 倍数
  | 'rate' // 费率（统一为「每日小数」，0.0005 表示万分之五）
  | 'years'; // 年数（用于保密期等）

/** 数值的极性 */
export type Polarity =
  | 'max' // 上限表述（不超过 / 至多 / 最长）
  | 'min' // 下限表述（不得少于 / 至少 / 不早于）
  | 'obligation' // 承诺值（应当 / 须 / 无条件）
  | 'neutral'; // 中性陈述

/** 一个条款 */
export interface Clause {
  id: string;
  /** 层级：0=章 1=条 2=1.1 3=（一） */
  level: number;
  /** 条款编号原文，如 "第三条" / "3.1" */
  number?: string;
  /** 条款标题，如 "付款方式" */
  title?: string;
  /** 条款正文（不含编号与标题） */
  text: string;
  /** 在文档全文中的字符区间 [start, end) */
  start: number;
  end: number;
  /** 切分置信度 */
  confidence: 'high' | 'medium' | 'low';
  /** 归类到的条款类型（规则 id） */
  type?: string;
}

/** 从条款中抽取出的一个数值 */
export interface ExtractedValue {
  /** 原始文本，如 "90 日" / "百分之五" */
  raw: string;
  /** 归一化后的数值（按 dimension 语义，如期限已折算为天） */
  value: number;
  /** 原始单位下的数值（如 "3 年" → 3），用于按年/按月比较 */
  unitValue: number;
  dimension: Dimension;
  /** 原始单位，如 "工作日" / "万元" */
  unit: string;
  polarity: Polarity;
  /** 命中的限定词，如 "不超过" */
  modifier?: string;
  /** 在条款文本中的区间 */
  start: number;
  end: number;
}

/** 规则的数值阈值 */
export interface RuleLimits {
  /** 期限上限（天） */
  maxDays?: number;
  /** 期限下限（天） */
  minDays?: number;
  /** 百分比上限（百分数） */
  maxPercent?: number;
  /** 百分比下限（百分数） */
  minPercent?: number;
  /** 金额上限（元） */
  maxAmount?: number;
  /** 倍数上限 */
  maxTimes?: number;
  /** 年数上限 */
  maxYears?: number;
  /** 年数下限 */
  minYears?: number;
  /** 费率上限（每日小数，万分之五 = 0.0005） */
  maxRate?: number;
}

/** 一条风险规则 */
export interface Rule {
  id: string;
  /** 条款类型标识；同时作为条款归类的目标类型 */
  type: string;
  /** 标题（中文） */
  title: string;
  severity: Severity;
  /** 锚点词：命中即认为该条款属于此类型 */
  anchors: string[];
  /**
   * 数值语义锚点：只有当数值附近（或条款标题里）出现这些词时，该数值才参与本规则的阈值比对。
   * 这是防止「预付款比例 40%」被「违约金上限」规则误判的关键。
   */
  metricAnchors?: string[];
  /** 排除词：出现则降低匹配分 */
  exclude?: string[];
  /** 数值阈值 */
  limits?: RuleLimits;
  /** 出现即违规的表述 */
  forbiddenPhrases?: string[];
  /** 全文必须出现的表述；缺失即违规 */
  requiredPhrases?: string[];
  /**
   * 触发词：只有当全文出现其中之一时，这条「必备条款」规则才生效。
   *
   * 没有触发词的必备条款规则会在**每一份**合同上报警，久而久之就是噪声。
   * 例：
   *   付款担保 —— 只有合同先收了预付款，才谈得上要担保；
   *   数据合规 —— 只有合同涉及个人信息/数据，才需要约定义务；
   *   核查审计 —— 只有合同涉及费用结算，才有核查的必要。
   */
  triggerPhrases?: string[];
  /** 修改建议（中文） */
  advice: string;
  /** 依据说明（法条/惯例） */
  basis?: string;
  /**
   * 适用文档类型。
   * 不填 = 适用于所有类型（保守默认）。
   * 填了则只在这些类型下生效 —— 这是控制误报的第一道闸门。
   */
  appliesTo?: DocumentType[];
  /** 其他语言的标题与建议；缺省回落到 title / advice */
  i18n?: Partial<Record<Locale, RuleText>>;
}

/** 一条发现 */
export interface Finding {
  ruleId: string;
  ruleTitle: string;
  severity: Severity;
  kind: 'limit' | 'forbidden' | 'missing';
  clauseId?: string;
  clauseNumber?: string;
  /** 原文摘录 */
  excerpt: string;
  /** 实际值（合同原文表述，不翻译） */
  actual?: string;
  /** 标准值 */
  limit?: string;
  /** 偏离说明 */
  delta?: string;
  /** 阈值方向（仅 limit 类） */
  bound?: Bound;
  /** 期望出现的表述（仅 missing 类） */
  expected?: string[];
  /** 人类可读的风险说明 */
  message: string;
  /** 修改建议 */
  advice: string;
  /** 在文档全文中的区间，用于高亮 */
  start?: number;
  end?: number;
}

/** 审查报告 */
export interface Report {
  meta: {
    tool: string;
    toolVersion: string;
    ruleSetVersion: string;
    createdAt: string;
    fileName?: string;
    pageCount?: number;
    charCount: number;
    durationMs?: number;
    /** 识别到的文档类型（决定哪些规则生效） */
    docType?: DocumentType;
    /** 因文档类型不匹配而未启用的规则数 */
    skippedByType?: number;
    /** 报告文案的语言 */
    locale: Locale;
    /** 文本是否为规则支持的语言（中文）；为 false 时结论不可靠 */
    languageSupported: boolean;
  };
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
    /** 0-100，越高越安全 */
    score: number;
    verdict: string;
  };
  findings: Finding[];
  clauseStats: {
    total: number;
    classified: number;
    unclassified: number;
    avgConfidence: number;
  };
}
