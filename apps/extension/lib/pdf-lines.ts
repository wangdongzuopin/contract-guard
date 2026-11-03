/**
 * PDF 行重组 —— 纯逻辑，不依赖 pdf.js，可单独测试。
 *
 * pdf.js 的 getTextContent() 返回的是「绘制片段」（text item），不是行。
 * 一个中文 PDF 往往一页就有上千个片段，直接喂给条款切分器必然失败。
 * 必须先用 y 坐标把片段聚类成行，再按 x 排序拼成整行文本。
 *
 * 双栏文档还要再切一层：同一视觉行上可能同时有左栏和右栏的文字，
 * 必须先找到「栏缝」，把一行拆成两条线，否则左右栏内容会交错成乱码。
 */

/** 一个绘制片段 */
export interface RawItem {
  str: string;
  /** 左下角 x（PDF 用户空间） */
  x: number;
  /** 左下角 y（PDF 用户空间，向上为正） */
  y: number;
  width: number;
  height: number;
}

/** 一行 */
export interface Row {
  y: number;
  height: number;
  items: RawItem[];
}

/** 行内一个绘制片段的位置，用于把字符区间换算成横向范围（页内高亮） */
export interface LineSpan {
  /** 在行文本中的起始字符偏移 */
  start: number;
  length: number;
  x: number;
  width: number;
}

/** 一行文本及其在页面上的位置（CSS 像素，相对左上角） */
export interface PdfLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 1-based */
  page: number;
  /** 组成这一行的绘制片段 */
  spans?: LineSpan[];
}

/** 仿射变换（与 pdf.js 的 Util.transform 等价） */
export function applyTransform(m: number[], x: number, y: number): [number, number] {
  return [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!];
}

/**
 * 按 y 坐标把绘制片段聚类成行。
 * 先按 y 降序排序，使相邻行在数组中相邻，再用容差分组 —— O(n log n)。
 */
export function groupIntoRows(items: RawItem[]): Row[] {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows: Row[] = [];

  for (const item of sorted) {
    const last = rows[rows.length - 1];
    const tol = Math.max(last?.height ?? 0, item.height) * 0.6;
    if (last && Math.abs(last.y - item.y) <= tol) {
      last.items.push(item);
      last.height = Math.max(last.height, item.height);
    } else {
      rows.push({ y: item.y, height: item.height, items: [item] });
    }
  }

  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

/**
 * 双栏检测 —— 找「栏缝」（gutter）。
 *
 * 关键：不能用「行的起始 x」判断，因为双栏文档里左右栏的片段会被合并进同一行，
 * 每行的起始 x 都在左栏，看起来就像单栏。
 *
 * 正确做法：看**行内**相邻片段之间的间隙。
 * 单栏文档的间隙是随机的（换行、标点），双栏文档则会在**同一个 x 位置**
 * 反复出现一条稳定的空隙带。统计各位置出现频次即可判定。
 *
 * @returns 栏缝的 x 坐标；单栏文档返回 null
 */
export function detectGutter(rows: Row[], pageWidth: number): number | null {
  if (rows.length < 4) return null;

  const minGap = pageWidth * 0.04;
  const bucketSize = pageWidth * 0.05; // 约 5% 页宽的容差带

  /** 桶索引 → 该桶内所有间隙中心 */
  const votes = new Map<number, number[]>();

  for (const row of rows) {
    for (let i = 1; i < row.items.length; i += 1) {
      const prev = row.items[i - 1]!;
      const cur = row.items[i]!;
      const gap = cur.x - (prev.x + prev.width);
      if (gap <= minGap) continue;
      const center = (prev.x + prev.width + cur.x) / 2;
      const bucket = Math.round(center / bucketSize);
      const arr = votes.get(bucket);
      if (arr) arr.push(center);
      else votes.set(bucket, [center]);
    }
  }

  if (votes.size === 0) return null;

  let best: number[] | undefined;
  for (const arr of votes.values()) {
    if (!best || arr.length > best.length) best = arr;
  }
  if (!best) return null;

  // 至少三行、且占比达到 25% 才认定为双栏，避免个别空隙被误判
  if (best.length < 3 || best.length < rows.length * 0.25) return null;

  // 取中位数，比平均值更抗离群值
  const sorted = [...best].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** 用一行片段构建一条文本行 */
function buildLine(row: Row, page: number, viewport: { transform: number[] }): PdfLine {
  const text = row.items.map((i) => i.str).join('');
  const first = row.items[0]!;
  const last = row.items[row.items.length - 1]!;
  const width = last.x + last.width - first.x;

  const p1 = applyTransform(viewport.transform, first.x, row.y);
  const p2 = applyTransform(viewport.transform, first.x + width, row.y);
  const p3 = applyTransform(viewport.transform, first.x, row.y + row.height);

  const x = Math.min(p1[0], p2[0]);
  const y = Math.min(p1[1], p2[1], p3[1]);

  const spans: LineSpan[] = [];
  let offset = 0;
  for (const item of row.items) {
    const a = applyTransform(viewport.transform, item.x, row.y);
    const b = applyTransform(viewport.transform, item.x + item.width, row.y);
    spans.push({ start: offset, length: item.str.length, x: Math.min(a[0], b[0]), width: Math.abs(b[0] - a[0]) });
    offset += item.str.length;
  }

  return {
    text,
    x,
    y,
    width: Math.abs(p2[0] - p1[0]),
    height: Math.abs(p3[1] - p1[1]) || row.height,
    page,
    spans,
  };
}

/**
 * 把行转成文本行。
 *
 * 单栏：每行 → 一条线。
 * 双栏：每行按栏缝拆成左/右两条线，阅读顺序为「左栏整列 → 右栏整列」。
 */
export function rowsToLines(
  rows: Row[],
  page: number,
  viewport: { width: number; transform: number[] },
  gutter: number | null,
): PdfLine[] {
  if (gutter == null) {
    return rows.map((row) => buildLine(row, page, viewport));
  }

  const leftRows: Row[] = [];
  const rightRows: Row[] = [];

  for (const row of rows) {
    const left: RawItem[] = [];
    const right: RawItem[] = [];
    for (const item of row.items) {
      const center = item.x + item.width / 2;
      if (center < gutter) left.push(item);
      else right.push(item);
    }
    if (left.length) leftRows.push({ ...row, items: left });
    if (right.length) rightRows.push({ ...row, items: right });
  }

  return [...leftRows, ...rightRows].map((row) => buildLine(row, page, viewport));
}

/** 把各页的行拼成全文，并记录每行在全文中的起始偏移 */
export function buildText(lines: PdfLine[]): { text: string; lineStart: number[] } {
  const parts: string[] = [];
  const lineStart: number[] = [];
  let cursor = 0;

  for (const l of lines) {
    lineStart.push(cursor);
    cursor += l.text.length + 1; // +1 为换行符
    parts.push(l.text);
  }

  return { text: parts.join('\n'), lineStart };
}
