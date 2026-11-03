import type { Rule } from '../types';

/**
 * 内置规则集 v1 —— 面向 B2B 商务/法务场景的通用红线。
 *
 * 阈值是「默认值」，可被企业私有红线库覆盖。
 * 判定逻辑全部确定性：数值阈值比对 + 禁用表述 + 必备条款存在性检查。
 *
 * metricAnchors 用来做「语义隔离」：
 *   同一个条款里可能同时出现「预付款比例 40%」和「违约金 30%」，
 *   没有隔离就会互相串味。数值只有在附近出现对应锚点词时才参与该规则的比对。
 *
 * i18n.en 只翻译标题与建议；锚点词、禁用词、必备词是匹配中文原文用的，不翻译。
 */
export const BUILTIN_RULES: Rule[] = [
  {
    id: 'payment-term',
    type: 'payment-term',
    title: '付款账期',
    severity: 'high',
    anchors: ['付款期限', '付款周期', '账期', '付款', '结算', '支付', '尾款', '质保金'],
    metricAnchors: ['付款期限', '付款周期', '账期', '付款', '结算', '支付', '尾款', '质保金'],
    exclude: ['不含税', '预付款'],
    limits: { maxDays: 60 },
    appliesTo: ['commercial'],
    advice: '账期每延长 30 天，占用的授信额度与资金成本按年化 6% 计。建议压缩至 60 日以内，或要求对方提供付款保函。',
    basis: '企业常见红线：账期 ≤ 60 天',
    i18n: {
      en: {
        title: 'Payment term',
        advice:
          'Every extra 30 days ties up credit and costs about 6% a year in financing. Shorten the term to 60 days or less, or ask the other party for a payment guarantee.',
      },
    },
  },
  {
    id: 'payment-first-ratio',
    type: 'payment-first-ratio',
    title: '预付款比例',
    severity: 'medium',
    anchors: ['预付款', '首付款', '首付', '定金', '预付'],
    metricAnchors: ['预付款', '首付款', '首付', '定金', '预付'],
    limits: { maxPercent: 30 },
    appliesTo: ['commercial'],
    advice: '预付比例超过 30% 会放大资金占用与坏账敞口。建议压降至 30% 以内，或要求同比例履约保函对冲。',
    basis: '企业常见红线：预付 ≤ 30%',
    i18n: {
      en: {
        title: 'Advance payment ratio',
        advice:
          'An advance above 30% ties up more cash and raises bad-debt exposure. Reduce it to 30% or less, or require a performance bond of the same amount.',
      },
    },
  },
  {
    id: 'penalty-cap',
    type: 'penalty-cap',
    title: '违约金总额上限',
    severity: 'high',
    anchors: ['违约金总额', '赔偿总额', '违约金上限', '累计不超过', '最高不超过', '违约金'],
    metricAnchors: ['违约金'],
    limits: { maxPercent: 10 },
    appliesTo: ['commercial'],
    advice: '违约金上限建议不超过合同总额的 10%，且双向对等。超过该比例时，风险与收益明显失衡。',
    basis: '企业常见红线：违约金 ≤ 合同额 10%',
    i18n: {
      en: {
        title: 'Liquidated damages cap',
        advice:
          'Cap liquidated damages at 10% of the contract value and apply the same cap to both parties. Above that, risk and reward are clearly out of balance.',
      },
    },
  },
  {
    id: 'penalty-rate',
    type: 'penalty-rate',
    title: '逾期违约金利率',
    severity: 'high',
    anchors: ['逾期利息', '逾期付款', '滞纳金', '日利率', '日息', '逾期', '万分之'],
    metricAnchors: ['逾期', '滞纳金', '万分之', '千分之', '日利率', '日息'],
    limits: { maxRate: 0.0003 },
    appliesTo: ['commercial'],
    advice: '日万分之三对应年化约 10.95%，已接近 LPR 上限的合理区间。更高则存在被认定过高而调减的风险。',
    basis: '企业常见红线：日息 ≤ 万分之三',
    i18n: {
      en: {
        title: 'Late payment interest',
        advice:
          '0.03% per day is about 10.95% a year, already near the reasonable ceiling relative to the LPR (China’s loan prime rate). A higher rate may be cut by a court as excessive.',
      },
    },
  },
  {
    id: 'liability-cap',
    type: 'liability-cap',
    title: '赔偿责任上限',
    severity: 'medium',
    anchors: ['赔偿责任', '责任上限', '赔偿上限', '累计赔偿', '赔偿'],
    metricAnchors: ['赔偿'],
    limits: { maxPercent: 100 },
    appliesTo: ['commercial'],
    advice: '赔偿责任上限应不超过合同总金额，且排除人身伤害、知识产权侵权、故意或重大过失等情形。',
    basis: '企业常见红线：赔偿上限 = 合同总额',
    i18n: {
      en: {
        title: 'Liability cap',
        advice:
          'Total liability should not exceed the contract value, with the usual carve-outs: personal injury, IP infringement, wilful misconduct and gross negligence.',
      },
    },
  },
  {
    id: 'ip-ownership',
    type: 'ip-ownership',
    title: '知识产权归属',
    severity: 'high',
    anchors: ['知识产权', '著作权', '专利', '职务作品', '成果归属'],
    forbiddenPhrases: ['全部归甲方', '全部归对方', '无偿转让', '永久转让', '不可撤销'],
    appliesTo: ['commercial', 'nda'],
    advice: '避免全部成果无条件归对方。核心资产应保留共有或明确的后续改进归属权，并区分既有背景知识产权。',
    basis: '红线：无偿/永久/不可撤销转让不予接受',
    i18n: {
      en: {
        title: 'IP ownership',
        advice:
          'Do not hand all work product to the other party unconditionally. Keep joint ownership of core assets or clear rights to later improvements, and carve out pre-existing background IP.',
      },
    },
  },
  {
    id: 'confidential-term',
    type: 'confidential-term',
    title: '保密期限',
    severity: 'high',
    anchors: ['保密期限', '保密义务', '保密', '机密'],
    metricAnchors: ['保密期限', '保密期', '保密', '机密'],
    limits: { minYears: 3 },
    appliesTo: ['commercial', 'nda', 'employment', 'commitment'],
    advice: '保密期限不应少于 3 年，涉及技术秘密的可要求 5 年以上；保密义务应在合同终止后继续有效。',
    basis: '企业常见红线：保密期 ≥ 3 年',
    i18n: {
      en: {
        title: 'Confidentiality period',
        advice:
          'The confidentiality period should be at least 3 years, or 5 years or more for technical secrets. The obligation should survive termination of the contract.',
      },
    },
  },
  {
    id: 'confidential-scope',
    type: 'confidential-scope',
    title: '保密范围过宽',
    severity: 'medium',
    anchors: ['保密范围', '保密信息', '保密'],
    forbiddenPhrases: ['全部信息', '所有信息', '任何信息', '一切信息'],
    appliesTo: ['commercial', 'nda', 'employment'],
    advice: '保密范围应限定为「双方明示或默示标注为保密的信息」，避免因范围过宽导致己方违约风险不可控。',
    basis: '红线：保密范围须可识别',
    i18n: {
      en: {
        title: 'Overly broad confidentiality',
        advice:
          'Limit the scope to information either party expressly or impliedly designates as confidential. An open-ended scope makes your own breach risk impossible to control.',
      },
    },
  },
  {
    id: 'dispute-resolution',
    type: 'dispute-resolution',
    title: '争议解决方式',
    severity: 'high',
    anchors: ['争议解决', '管辖', '仲裁', '人民法院'],
    requiredPhrases: ['管辖', '仲裁', '诉讼', '人民法院', '起诉'],
    appliesTo: ['commercial', 'nda', 'employment'],
    advice: '全文未见管辖或仲裁约定，纠纷时将无法确定管辖法院，可能被迫在对方所在地应诉，维权成本极高。',
    basis: '必备条款：争议解决方式',
    i18n: {
      en: {
        title: 'Dispute resolution',
        advice:
          'With no jurisdiction or arbitration clause, the competent court is unclear in a dispute. You may have to litigate where the other party is based, at a high cost.',
      },
    },
  },
  {
    id: 'auto-renew',
    type: 'auto-renew',
    title: '自动续约',
    severity: 'high',
    anchors: ['自动续约', '自动续期', '自动顺延', '续约', '续期', '展期'],
    forbiddenPhrases: ['自动续约', '自动续期', '自动顺延', '自动延长'],
    appliesTo: ['commercial'],
    advice: '自动续约极易造成无意展期。建议改为「双方书面确认方可续期」，或至少约定到期前 30 日的书面提醒义务。',
    basis: '红线：不接受自动续约',
    i18n: {
      en: {
        title: 'Automatic renewal',
        advice:
          'Automatic renewal easily leads to unintended extensions. Require written confirmation from both parties to renew, or at least a written reminder 30 days before expiry.',
      },
    },
  },
  {
    id: 'noncompete',
    type: 'noncompete',
    title: '竞业限制期限',
    severity: 'medium',
    anchors: ['竞业限制', '竞业', '离职后', '竞争关系'],
    metricAnchors: ['竞业限制', '竞业', '离职', '竞争关系'],
    limits: { maxDays: 730 },
    appliesTo: ['commercial', 'employment'],
    advice: '竞业限制不超过 2 年。超出部分在中国大陆通常不被支持，反而可能被认定条款整体无效而失去保护。',
    basis: '法律实践：竞业期 ≤ 2 年',
    i18n: {
      en: {
        title: 'Non-compete period',
        advice:
          'Keep non-compete obligations to 2 years or less. Longer periods are usually not enforced in mainland China, and the whole clause may be held invalid.',
      },
    },
  },
  {
    id: 'acceptance',
    type: 'acceptance',
    title: '验收期限',
    severity: 'medium',
    anchors: ['验收', '交付确认', '确认单', '验收标准'],
    metricAnchors: ['验收', '确认', '交付'],
    limits: { maxDays: 30 },
    appliesTo: ['commercial'],
    advice: '验收期限过长会让尾款与质保长期挂账，也会使「未提出异议即视为验收」条款对我方不利。',
    basis: '企业常见红线：验收 ≤ 30 天',
    i18n: {
      en: {
        title: 'Acceptance period',
        advice:
          'A long acceptance period leaves the final payment and warranty pending, and makes "deemed accepted if no objection" clauses work against you.',
      },
    },
  },
  {
    id: 'warranty',
    type: 'warranty',
    title: '质保期',
    severity: 'medium',
    anchors: ['质保期', '保修期', '质量保证期', '质保', '保修'],
    metricAnchors: ['质保期', '保修期', '质量保证期', '质保', '保修', '质量保证'],
    limits: { minDays: 365 },
    appliesTo: ['commercial'],
    advice: '质保期不应少于 1 年；涉及软件/系统集成的建议 2 年，并明确免费修复与响应时限。',
    basis: '企业常见红线：质保 ≥ 1 年',
    i18n: {
      en: {
        title: 'Warranty period',
        advice:
          'The warranty period should be at least 1 year, or 2 years for software and system integration, with clear free-repair and response times.',
      },
    },
  },
  {
    id: 'unilateral-termination',
    type: 'unilateral-termination',
    title: '单方任意解除权',
    severity: 'high',
    anchors: ['解除', '终止', '解约'],
    forbiddenPhrases: ['随时解除', '单方解除', '单方面解除', '有权随时终止', '可随时终止'],
    appliesTo: ['commercial', 'employment'],
    advice: '对方保留随时解除权意味着前期投入无法回收。应争取「双方对等解除 + 已完成部分据实结算」。',
    basis: '红线：解除权须对等',
    i18n: {
      en: {
        title: 'Termination at will',
        advice:
          'If the other party can terminate at any time, your upfront investment may never be recovered. Negotiate mutual termination rights and payment for work already completed.',
      },
    },
  },
  {
    id: 'force-majeure',
    type: 'force-majeure',
    title: '不可抗力条款',
    severity: 'medium',
    anchors: ['不可抗力', '情势变更'],
    requiredPhrases: ['不可抗力'],
    appliesTo: ['commercial'],
    advice: '缺少不可抗力条款时，疫情管控、限电、政策变化等都可能被认定为对方违约。建议补充并明确通知期限与证明义务。',
    basis: '必备条款：不可抗力',
    i18n: {
      en: {
        title: 'Force majeure',
        advice:
          'Without a force majeure clause, lockdowns, power rationing or policy changes may be treated as a breach. Add one, with a notice period and proof requirements.',
      },
    },
  },
  {
    id: 'tax-invoice',
    type: 'tax-invoice',
    title: '发票与税率',
    severity: 'medium',
    anchors: ['发票', '税率', '增值税', '含税'],
    requiredPhrases: ['发票'],
    appliesTo: ['commercial'],
    advice: '未约定发票类型与税率，会导致进项无法抵扣、付款被财务卡住。须明确「先票后款」与发票不合规时的处理。',
    basis: '必备条款：发票与税率',
    i18n: {
      en: {
        title: 'Invoices and tax rate',
        advice:
          'Without an agreed invoice type and VAT rate, input tax may not be deductible and payments can get stuck in finance. Specify "invoice before payment" and how non-compliant invoices are handled.',
      },
    },
  },
  {
    id: 'data-compliance',
    type: 'data-compliance',
    title: '数据与个人信息合规',
    severity: 'medium',
    anchors: ['个人信息', '数据安全', '隐私', '数据合规', '数据处理'],
    requiredPhrases: ['个人信息', '数据安全'],
    triggerPhrases: ['个人信息', '数据', '用户信息', '客户资料', '数据处理', '数据迁移'],
    appliesTo: ['commercial'],
    advice: '涉及客户数据或政务数据的合作，必须约定处理目的、存储期限、跨境限制与泄露通知义务，否则面临《个保法》《数安法》责任。',
    basis: '政企必备条款：数据合规',
    i18n: {
      en: {
        title: 'Data and privacy compliance',
        advice:
          'If the deal involves customer or government data, specify the processing purpose, retention period, cross-border limits and breach notification. Otherwise you face liability under China’s PIPL and Data Security Law.',
      },
    },
  },
  {
    id: 'payment-guarantee',
    type: 'payment-guarantee',
    title: '履约与付款担保',
    severity: 'medium',
    anchors: ['保函', '保证金', '担保', '履约保证'],
    requiredPhrases: ['保函', '保证金', '履约保证'],
    triggerPhrases: ['预付款', '首付款', '定金', '预付'],
    appliesTo: ['commercial'],
    advice: '大额或长周期项目建议要求对方提供等额履约保函或预付款保函，把回款风险前置转移。',
    basis: '风控建议：付款担保',
    i18n: {
      en: {
        title: 'Performance and payment guarantees',
        advice:
          'For large or long-running projects, ask for a performance bond or advance payment guarantee of equal value, so collection risk is covered upfront.',
      },
    },
  },
  {
    id: 'audit-right',
    type: 'audit-right',
    title: '核查与审计权',
    severity: 'low',
    anchors: ['审计', '核查', '检查', '监督'],
    requiredPhrases: ['审计', '核查'],
    triggerPhrases: ['服务费', '价款', '费用', '结算', '付款', '人工费', '差旅'],
    appliesTo: ['commercial'],
    advice: '缺少核查权时，无法验证对方是否按约定履约、费用是否真实。建议约定合理的核查频次与提前通知期。',
    basis: '风控建议：核查权',
    i18n: {
      en: {
        title: 'Audit rights',
        advice:
          'Without audit rights you cannot verify that the other party performs as agreed or that its charges are genuine. Agree on a reasonable audit frequency and notice period.',
      },
    },
  },
  {
    id: 'scope-change',
    type: 'scope-change',
    title: '变更与签证流程',
    severity: 'low',
    anchors: ['变更', '签证', '洽商', '追加'],
    requiredPhrases: ['变更', '签证'],
    appliesTo: ['commercial'],
    advice: '缺少变更签证机制时，范围蔓延将无法计价。建议约定「书面签证 + 工期费用同步调整」。',
    basis: '风控建议：变更签证',
    i18n: {
      en: {
        title: 'Change orders',
        advice:
          'Without a change order process, scope creep cannot be priced. Require written change orders with matching adjustments to schedule and fees.',
      },
    },
  },
];

export const RULE_SET_VERSION = 'builtin-1.1.0';
