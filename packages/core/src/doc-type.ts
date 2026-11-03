import type { DocumentType } from './types';

/**
 * 文档类型识别
 *
 * 为什么要识别类型：一份红线规则在「该不该出现」的判断上高度依赖文书性质。
 * 对一份雇佣合同报「未见发票与税率约定」「未见核查审计权」，是 100% 的误报 ——
 * 而误报比漏报更伤信任。
 *
 * 识别方式刻意保守：只看**标题区**（前若干行），
 * 因为正文里出现的「合同」「协议」等词不代表文书性质。
 *
 * 文书类型的展示名见 i18n.ts 的 docTypeLabel。
 */

interface TypeSpec {
  type: DocumentType;
  /** 标题区关键词 */
  anchors: string[];
  /** 命中权重（更具体的词优先） */
  weight: number;
}

/** 越靠前越具体 */
const SPECS: TypeSpec[] = [
  {
    type: 'employment',
    anchors: ['雇佣合同', '劳动合同', '劳务合同', '聘用合同', '用工合同', '派遣协议', '临时用工'],
    weight: 10,
  },
  {
    type: 'nda',
    anchors: ['保密协议', '保密合同', '不披露协议', '保密承诺'],
    weight: 10,
  },
  {
    type: 'commitment',
    anchors: ['承诺书', '承诺函', '责任书', '申请书', '情况说明', '说明书'],
    weight: 8,
  },
  {
    type: 'commercial',
    anchors: [
      '服务合同',
      '服务协议',
      '采购合同',
      '采购协议',
      '销售合同',
      '供货合同',
      '技术合同',
      '技术服务',
      '技术开发',
      '开发服务',
      '软件开发',
      '设备采购',
      '工程施工',
      '租赁合同',
      '框架协议',
      '合作协议',
      '承揽合同',
      '外包合同',
      '担保合同',
      '贸易合同',
    ],
    weight: 6,
  },
];

/** 标题区取前 N 行 —— 合同抬头一般在前 5 行内 */
const HEAD_LINES = 6;
/** 标题区最多取多少字 */
const HEAD_CHARS = 200;

/** 取文档抬头区文本 */
export function documentHead(text: string): string {
  const lines = text.split('\n').slice(0, HEAD_LINES);
  return lines.join('\n').slice(0, HEAD_CHARS);
}

/**
 * 识别文档类型。
 *
 * 规则：
 * 1. 只在标题区匹配；
 * 2. 同类型多个关键词命中，取权重最高的类型；
 * 3. 都不匹配则返回 'unknown'（引擎会按全部规则处理）。
 */
export function detectDocumentType(text: string): DocumentType {
  const head = documentHead(text);
  if (!head.trim()) return 'unknown';

  let best: { type: DocumentType; score: number } | null = null;

  for (const spec of SPECS) {
    let score = 0;
    for (const anchor of spec.anchors) {
      if (head.includes(anchor)) score += spec.weight;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { type: spec.type, score };
    }
  }

  return best?.type ?? 'unknown';
}

/**
 * 按文档类型过滤规则。
 * @returns 生效规则 + 被类型门控挡掉的规则数
 */
export function filterRulesByType<T extends { appliesTo?: DocumentType[] }>(
  rules: T[],
  docType: DocumentType,
): { rules: T[]; skipped: number } {
  if (docType === 'unknown') return { rules, skipped: 0 };

  const kept = rules.filter((r) => !r.appliesTo || r.appliesTo.includes(docType));
  return { rules: kept, skipped: rules.length - kept.length };
}

/* ------------------------------------------------------------------ *
 * 文本语言
 *
 * 规则的锚点词全是中文。一份英文合同进来，什么都匹配不上，
 * 结论却会显示「未发现明显偏离项」—— 这是最危险的一种错：看起来安全。
 * 所以先判断文本是不是中文，不是就明确告诉用户结论不可靠。
 * ------------------------------------------------------------------ */

/** 中文（CJK 统一表意文字）占「汉字 + 拉丁字母」的比例 */
export function cjkRatio(text: string): number {
  let cjk = 0;
  let latin = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c >= 0x4e00 && c <= 0x9fff) cjk += 1;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) latin += 1;
  }
  return cjk + latin === 0 ? 0 : cjk / (cjk + latin);
}

/**
 * 低于这个比例即判为非中文。
 * 取值偏低是为了放过中英对照合同：同样的内容，英文字母数约是汉字数的 3 倍。
 */
export const MIN_CJK_RATIO = 0.15;

export function isSupportedLanguage(text: string): boolean {
  return cjkRatio(text) >= MIN_CJK_RATIO;
}
