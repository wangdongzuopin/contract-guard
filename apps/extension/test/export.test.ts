import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '@cg/core';
import { reportFileName, reportToHtml } from '../lib/export';
import { SAMPLE_CONTRACT } from '../../../packages/core/test/fixtures/sample-contract';

describe('导出报告', () => {
  it('中文报告', () => {
    const { report } = analyzeDocument(SAMPLE_CONTRACT, { fileName: '某合同.pdf', pageCount: 2 });
    const html = reportToHtml(report, 'zh');
    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toContain('合同审查报告');
    for (const f of report.findings) expect(html).toContain(f.ruleTitle);
    expect(reportFileName(report, 'zh')).toBe('某合同-审查报告.html');
  });

  it('英文报告不夹带中文界面词', () => {
    const { report } = analyzeDocument(SAMPLE_CONTRACT, { fileName: 'deal.pdf', locale: 'en' });
    const html = reportToHtml(report, 'en');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Contract Review Report');
    expect(html).toContain('Payment term');
    for (const word of ['合同审查报告', '修改建议', '贵司红线', '高风险', '安全分']) {
      expect(html, word).not.toContain(word);
    }
    expect(reportFileName(report, 'en')).toBe('deal-review-report.html');
  });

  it('文件名等外部输入会被转义', () => {
    const { report } = analyzeDocument(SAMPLE_CONTRACT, { fileName: '<img src=x onerror=alert(1)>.pdf' });
    const html = reportToHtml(report, 'zh');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
