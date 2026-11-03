import type { Finding } from '@cg/core';
import type { PdfLine } from './pdf-lines';

/**
 * 发现项与 PDF 坐标之间的换算 —— 纯逻辑，可单独测试。
 */

/** 与语言无关的发现项 key：切换中英文后选中项不丢 */
export function findingKey(f: Pick<Finding, 'ruleId' | 'kind' | 'start' | 'actual'>): string {
  return [f.ruleId, f.kind, f.start ?? '', f.actual ?? ''].join('|');
}

/** 页面坐标系（scale = 1）里的一个高亮框 */
export interface HighlightRect {
  /** 1-based */
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 二分查找：最后一个起始偏移 ≤ offset 的行号；offset 在第一行之前时返回 -1 */
export function lineAt(lineStart: readonly number[], offset: number): number {
  let lo = 0;
  let hi = lineStart.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((lineStart[mid] ?? 0) <= offset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** 字符的大致宽度：中文与全角标点记 1，半角（数字、字母、空格）记 0.55 */
function charWeight(code: number): number {
  return code >= 0x2e80 ? 1 : 0.55;
}

/**
 * 行内第 offset 个字符边界的横坐标。
 *
 * 片段内按字符宽度插值 —— 中文合同里「90 日」这种半角数字夹在全角字之间，
 * 按字数平均分会偏出好几个字。
 * edge = 'start' 时落在片段交界处取右边片段的起点，'end' 取左边片段的终点。
 */
export function xAtChar(line: PdfLine, offset: number, edge: 'start' | 'end'): number {
  const spans = line.spans?.length
    ? line.spans
    : [{ start: 0, length: line.text.length, x: line.x, width: line.width }];

  let span = spans[spans.length - 1]!;
  for (const s of spans) {
    const end = s.start + s.length;
    if (edge === 'start' ? offset < end : offset <= end) {
      span = s;
      break;
    }
  }

  const local = Math.min(Math.max(offset - span.start, 0), span.length);
  let before = 0;
  let total = 0;
  for (let i = 0; i < span.length; i += 1) {
    const w = charWeight(line.text.charCodeAt(span.start + i));
    if (i < local) before += w;
    total += w;
  }
  return total === 0 ? span.x : span.x + span.width * (before / total);
}

/** 把全文区间 [start, end) 换算成页面上的高亮框（跨行时每行一个） */
export function highlightRects(
  lines: readonly PdfLine[],
  lineStart: readonly number[],
  start: number,
  end: number,
): HighlightRect[] {
  const rects: HighlightRect[] = [];
  const stop = end > start ? end : start + 1;

  for (let i = Math.max(0, lineAt(lineStart, start)); i < lines.length; i += 1) {
    const line = lines[i]!;
    const s = lineStart[i] ?? 0;
    const e = s + line.text.length;
    if (s >= stop) break;
    if (e <= start) continue;

    const a = Math.max(start, s) - s;
    const b = Math.min(stop, e) - s;
    const x0 = xAtChar(line, a, 'start');
    const x1 = xAtChar(line, b, 'end');
    rects.push({
      page: line.page,
      x: Math.min(x0, x1),
      y: line.y,
      width: Math.max(Math.abs(x1 - x0), 4),
      height: line.height,
    });
  }

  return rects;
}

export interface Locatable {
  lines: readonly PdfLine[];
  lineStart: readonly number[];
}

/** 每个可定位的发现项 → 它在页面上的高亮框。缺失类发现没有位置，不在结果里 */
export function locateFindings(doc: Locatable, findings: readonly Finding[]): Map<string, HighlightRect[]> {
  const out = new Map<string, HighlightRect[]>();
  for (const f of findings) {
    if (f.start == null) continue;
    const rects = highlightRects(doc.lines, doc.lineStart, f.start, f.end ?? f.start + 1);
    if (rects.length) out.set(findingKey(f), rects);
  }
  return out;
}
