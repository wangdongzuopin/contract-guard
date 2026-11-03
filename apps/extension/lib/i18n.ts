import type { ScoreBand, Severity } from '@cg/core';

/**
 * 界面文案（中 / 英）
 *
 * 纯数据，不依赖 React 与浏览器 API：导出报告与单元测试也直接用它。
 * 规则标题、建议、偏离说明这类引擎文案在 packages/core/src/i18n.ts。
 * 英文字典的类型就是中文字典的类型 —— 少翻一个 key，类型检查就会报错。
 */

const zh = {
  appName: '合同风险检查',
  appFullName: '合同风险检查助手',
  language: '界面语言',
  colon: '：',
  withDetail: (desc: string, detail: string) => `${desc}（${detail}）`,

  localBadge: '本地解析',
  localBadgeTip: '文件只在这台电脑上解析。扩展只申请了存储权限，不能访问任何网站，也不会上传文件。',
  openFile: '打开 PDF',
  export: '导出报告',
  exportTip: '下载 HTML 报告，可直接转发或打印',
  exported: '报告已下载',
  closeFile: '关闭文件',
  fileMeta: (pages: number, ms: number) =>
    `${pages} 页 · ${ms < 1000 ? `${ms} 毫秒` : `${(ms / 1000).toFixed(1)} 秒`}`,

  heroTitle: '合同里的风险条款，一眼看清',
  heroSubtitle: '拖入合同 PDF，按 20 条企业红线逐条比对，并在原文里标出每一处偏离。',
  dropTitle: '把合同 PDF 拖到这里',
  dropHint: '或点击选择文件',
  dropMeta: '支持带文字层的 PDF，文件不会被上传或保存',
  trySample: '手边没有合同？用示例合同试试',
  sampleFileName: '示例-软件技术服务合同.pdf',
  features: [
    { title: '文件不出本机', desc: '在浏览器里完成解析，没有服务器，也不需要账号。' },
    { title: '结果可复现', desc: '固定规则逐条计算，同一份合同每次结论都一样。' },
    { title: '原文定位', desc: '点击风险项，直接跳到合同里对应的位置。' },
  ],

  loading: {
    reading: '正在读取文件…',
    parsing: (page: number, total: number) => `正在解析第 ${page} / ${total} 页…`,
    analyzing: '正在比对红线…',
  },

  errors: {
    notPdf: { title: '只支持 PDF 文件', desc: 'Word 等格式请先另存为 PDF 再打开。' },
    scanned: {
      title: '这份 PDF 没有文字层',
      desc: '它可能是扫描件或图片，暂时无法检查。可以先用 OCR 工具转成可搜索的 PDF 再试。',
    },
    password: { title: '这份 PDF 设有打开密码', desc: '请先解除密码保护，再重新打开。' },
    invalid: { title: '文件无法解析', desc: '文件可能已损坏，或者不是有效的 PDF。' },
    unknown: { title: '处理失败', desc: '请重试，或换一份文件。' },
  },

  summaryLabel: '检查摘要',
  scoreLabel: '安全分',
  scoreTip: '满分 100。每条高风险扣 8 分，中风险扣 3 分，低风险扣 1 分。',
  band: { safe: '可推进签署', negotiate: '建议谈判', risky: '高风险' } as Record<ScoreBand, string>,
  bandUnsupported: '无法判断',
  docTypeSkipped: (n: number) => `${n} 条不适用于该类型的规则未启用`,
  docTypeAll: '全部适用规则均已启用',
  docTypeUnknown: '未识别文书类型，已按全部规则检查，请人工确认文书性质',
  docTypeTip: '不同文书适用的红线不同，例如雇佣合同不检查发票条款。类型根据合同标题识别。',
  languageWarning: {
    title: '这份文件似乎不是中文合同',
    desc: '内置规则只识别中文条款，下面的结论可能不完整。',
  },

  severity: { high: '高风险', medium: '中风险', low: '低风险' } as Record<Severity, string>,
  severityShort: { high: '高', medium: '中', low: '低' } as Record<Severity, string>,
  filterAll: '全部',
  filterLabel: '按风险等级筛选',

  findingsTitle: '风险清单',
  noFindings: { title: '没有发现偏离红线的条款', desc: '仍建议人工复核关键条款。' },
  noFindingsInFilter: '这个等级下没有风险项',
  contract: '合同',
  redLine: '红线',
  found: '出现',
  lookedFor: '未找到',
  missingWhere: '全文缺失',
  pageShort: (n: number) => `第 ${n} 页`,
  advice: '修改建议',
  copy: '复制',
  copied: '已复制修改建议',
  copyFailed: '复制失败，请手动选择文字',
  notLocatable: '缺失项在原文里没有可标注的位置。',
  disclaimer: '仅供参考，不构成法律意见',

  viewerLabel: '合同预览',
  prevPage: '上一页',
  nextPage: '下一页',
  pageInput: '页码',
  zoomIn: '放大',
  zoomOut: '缩小',
  fitWidth: '适合宽度',
  highlights: '标注',
  renderFailed: '这一页预览失败，不影响检查结果',

  dropOverlay: '松开即可检查',
  dropOverlayReplace: '将替换当前文件',

  openReview: '打开审查页',
  popupTagline: '按企业红线检查合同，文件不出本机',
  steps: ['拖入或选择合同 PDF', '自动比对 20 条企业红线', '定位偏离条款，导出报告'],
  popupFooter: '无后端 · 无账号 · 不上传',

  report: {
    title: '合同审查报告',
    fileSuffix: '审查报告',
    defaultName: '合同',
    file: '文件',
    pages: '页数',
    chars: '字符数',
    generated: '生成时间',
    ruleSet: '规则版本',
    toolVersion: '工具版本',
    score: '安全分',
    total: '合计',
    docType: '文书类型',
    docTypeUnknown: '未识别文书类型，已按全部规则检查，建议人工确认文书性质。',
    docTypeKnown: (label: string, skipped: number) =>
      `${label}，已按该类型口径检查${skipped > 0 ? `；${skipped} 条不适用的规则未启用` : ''}。`,
    reproducible: '本报告由确定性规则引擎生成，结果可复现、可审计；仍需人工复核。',
    columns: {
      severity: '等级',
      finding: '风险项',
      location: '位置',
      actual: '合同约定',
      limit: '贵司红线',
      advice: '修改建议',
    },
    noFindings: '未发现偏离项。',
    footerLegal: '本报告为辅助审查工具输出，不构成法律意见；合同效力与具体条款请以专业法律判断为准。',
    footerLocal: '所有解析与检查均在本机完成，合同内容未上传至任何服务器。',
  },
};

export type Messages = typeof zh;

const en: Messages = {
  appName: 'Contract Guard',
  appFullName: 'Contract Guard',
  language: 'Language',
  colon: ': ',
  withDetail: (desc, detail) => `${desc} (${detail})`,

  localBadge: 'Local only',
  localBadgeTip:
    'Files are parsed on this computer only. The extension can only use its own storage: it cannot read any website and never uploads files.',
  openFile: 'Open PDF',
  export: 'Export report',
  exportTip: 'Download an HTML report you can forward or print',
  exported: 'Report downloaded',
  closeFile: 'Close file',
  fileMeta: (pages, ms) =>
    `${pages} ${pages === 1 ? 'page' : 'pages'} · ${ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}`,

  heroTitle: 'Spot risky contract clauses at a glance',
  heroSubtitle:
    'Drop in a contract PDF. Every clause is checked against 20 company red lines, and each deviation is marked on the page.',
  dropTitle: 'Drop a contract PDF here',
  dropHint: 'or click to choose a file',
  dropMeta: 'PDFs with a text layer. Files are never uploaded or stored.',
  trySample: 'No contract at hand? Try the sample contract',
  sampleFileName: 'sample-software-services-contract.pdf',
  features: [
    { title: 'Stays on your device', desc: 'Parsed in the browser. No server, no account.' },
    { title: 'Reproducible', desc: 'Fixed rules, so the same contract always gets the same result.' },
    { title: 'Pinpointed', desc: 'Click a finding to jump to the exact spot in the contract.' },
  ],

  loading: {
    reading: 'Reading file…',
    parsing: (page, total) => `Parsing page ${page} of ${total}…`,
    analyzing: 'Checking red lines…',
  },

  errors: {
    notPdf: { title: 'Only PDF files are supported', desc: 'Save Word and other formats as PDF first.' },
    scanned: {
      title: 'This PDF has no text layer',
      desc: 'It is probably a scan or an image, so it cannot be checked yet. Convert it to a searchable PDF with an OCR tool and try again.',
    },
    password: { title: 'This PDF is password-protected', desc: 'Remove the password protection and open it again.' },
    invalid: { title: 'The file could not be read', desc: 'It may be damaged or not a valid PDF.' },
    unknown: { title: 'Something went wrong', desc: 'Try again, or try a different file.' },
  },

  summaryLabel: 'Summary',
  scoreLabel: 'Safety score',
  scoreTip: 'Out of 100. Each high-risk finding deducts 8 points, medium 3 and low 1.',
  band: { safe: 'Ready to sign', negotiate: 'Negotiate', risky: 'High risk' },
  bandUnsupported: 'Not reliable',
  docTypeSkipped: (n) => `${n} ${n === 1 ? 'rule' : 'rules'} not applicable to this type skipped`,
  docTypeAll: 'All applicable rules checked',
  docTypeUnknown: 'Document type not recognized. All rules were applied; please confirm the type yourself',
  docTypeTip:
    'Different documents need different red lines. For example, employment contracts are not checked for invoice terms. The type is detected from the title.',
  languageWarning: {
    title: 'This does not look like a Chinese contract',
    desc: 'The built-in rules only read Chinese clauses, so these results may be incomplete.',
  },

  severity: { high: 'High risk', medium: 'Medium risk', low: 'Low risk' },
  severityShort: { high: 'High', medium: 'Med', low: 'Low' },
  filterAll: 'All',
  filterLabel: 'Filter by risk level',

  findingsTitle: 'Findings',
  noFindings: { title: 'No red-line deviations found', desc: 'A manual review of key clauses is still advised.' },
  noFindingsInFilter: 'No findings at this level',
  contract: 'Contract',
  redLine: 'Limit',
  found: 'Contains',
  lookedFor: 'Not found',
  missingWhere: 'Missing',
  pageShort: (n) => `p. ${n}`,
  advice: 'Suggested change',
  copy: 'Copy',
  copied: 'Suggestion copied',
  copyFailed: 'Copy failed. Select the text manually.',
  notLocatable: 'Missing clauses have no location to mark in the document.',
  disclaimer: 'For reference only. Not legal advice',

  viewerLabel: 'Contract preview',
  prevPage: 'Previous page',
  nextPage: 'Next page',
  pageInput: 'Page number',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fitWidth: 'Fit width',
  highlights: 'Highlights',
  renderFailed: 'This page could not be previewed. Results are not affected.',

  dropOverlay: 'Drop to check',
  dropOverlayReplace: 'This replaces the current file',

  openReview: 'Open review page',
  popupTagline: 'Check contracts against your red lines, on this device only',
  steps: ['Drop in or choose a contract PDF', 'It is checked against 20 red lines', 'Jump to each deviation, export a report'],
  popupFooter: 'No server · No account · No uploads',

  report: {
    title: 'Contract Review Report',
    fileSuffix: 'review-report',
    defaultName: 'contract',
    file: 'File',
    pages: 'Pages',
    chars: 'Characters',
    generated: 'Generated',
    ruleSet: 'Rule set',
    toolVersion: 'Tool version',
    score: 'Safety score',
    total: 'Total',
    docType: 'Document type',
    docTypeUnknown: 'Not recognized. All rules were applied; please confirm the document type.',
    docTypeKnown: (label, skipped) =>
      `${label}. Checked with the rules for this type${
        skipped > 0 ? `; ${skipped} rules that do not apply were skipped` : ''
      }.`,
    reproducible:
      'Generated by a deterministic rule engine, so results are reproducible and auditable. A manual review is still required.',
    columns: {
      severity: 'Level',
      finding: 'Finding',
      location: 'Location',
      actual: 'Contract says',
      limit: 'Your limit',
      advice: 'Suggested change',
    },
    noFindings: 'No deviations found.',
    footerLegal:
      'This report is produced by a review aid and is not legal advice. Rely on professional legal judgment for contract validity and terms.',
    footerLocal: 'All parsing and checks ran on this device. The contract was not uploaded to any server.',
  },
};

export const MESSAGES = { zh, en } as const;
