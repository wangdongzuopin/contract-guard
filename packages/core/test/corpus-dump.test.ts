import { describe, it } from 'vitest';
import { analyzeDocument } from '@cg/core';
import { CORPUS, renderContractText } from './corpus/contracts';

/**
 * 语料库逐条发现明细（开发工具）
 *
 * 平时空跑；设 CG_CORPUS=1 打印明细，设 CG_CORPUS_CLAUSES=1 附带条款切分。
 */
describe('语料库明细', () => {
  it('dump', () => {
    if (!process.env.CG_CORPUS) {
      console.log('（未设置 CG_CORPUS，跳过）');
      return;
    }
    for (const spec of CORPUS) {
      const text = renderContractText(spec);
      const { report, clauses } = analyzeDocument(text);
      console.log(`\n===== ${spec.id} · ${spec.fileName} =====`);
      console.log(
        `文书类型 ${report.meta.docType} ｜ 期望 ${spec.expect.length} ｜ 实际 ${report.findings.length}`,
      );
      for (const f of report.findings) {
        console.log(
          `  [${f.severity}] ${f.ruleId} ${f.kind} 条款=${f.clauseNumber ?? '-'} 实际=${
            f.actual ?? '-'
          } 红线=${f.limit ?? '-'} ${f.delta ?? ''}`,
        );
        if (f.start != null) {
          console.log(
            `      摘录: ${JSON.stringify(text.slice(Math.max(0, f.start - 20), (f.end ?? f.start) + 20))}`,
          );
        }
      }
      if (process.env.CG_CORPUS_CLAUSES === '1') {
        clauses.forEach((c, i) =>
          console.log(`   [${i}] ${c.number ?? '·'} ${c.title ?? ''} :: ${c.text.slice(0, 60)}`),
        );
      }
    }
  });
});
