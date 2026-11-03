import type { Clause } from './types';

/**
 * 条款切分
 *
 * 输入是一份「带换行」的纯文本（PDF 行重组 / HTML 块级文本都会产出这种形态），
 * 输出条款列表。核心是「多模式打分」而不是单一正则 —— 中文合同的编号格式极不统一。
 */

export interface Line {
  text: string;
  /** 在文档全文中的起始偏移 */
  start: number;
  /** 结束偏移（不含换行符） */
  end: number;
}

interface Pattern {
  re: RegExp;
  level: number;
  weight: number;
  /** 纯数字编号：行内出现多个数字序号时不应切分（见 isInlineEnumeration） */
  numeric?: boolean;
}

/**
 * 编号模式，按优先级排列。
 * 注意顺序：先匹配更具体的（章 / 节 / 1.1.2），再匹配宽松的（一、/ 1、）。
 *
 * 纯数字编号必须限制为 1–2 位，否则「1980.03.05」（出生年月）
 * 这类日期会被当成「1.」编号切一刀，凭空多出一条条款。
 */
const NUMBER_PATTERNS: Pattern[] = [
  // 第X章 / 第X部分 / 第X篇
  { re: /^(\s*第\s*[零〇一二三四五六七八九十百千万亿两\d]+\s*[章篇部])\s*/, level: 0, weight: 3 },
  // 第X节之Y
  { re: /^(\s*第\s*[零〇一二三四五六七八九十百千万亿两\d]+\s*节\s*之\s*[一二三四五六七八九十]+)\s*/, level: 0, weight: 3 },
  // 第X条
  { re: /^(\s*第\s*[零〇一二三四五六七八九十百千万亿两\d]+\s*条)\s*/, level: 1, weight: 3 },
  // 1.1.2
  { re: /^(\s*\d{1,2}\.\d{1,2}\.\d{1,2})(?=\s|[^\d.]|$)/, level: 3, weight: 2.2, numeric: true },
  // 1.1
  { re: /^(\s*\d{1,2}\.\d{1,2})(?=\s|[^\d.]|$)/, level: 2, weight: 2.2, numeric: true },
  // 一、
  { re: /^(\s*[零〇一二三四五六七八九十]+\s*[、．])\s*/, level: 1, weight: 2.5 },
  // 1、
  { re: /^(\s*\d{1,2}\s*[、．.])(?=\s|[^\d]|$)/, level: 1, weight: 2.0, numeric: true },
  // （一）
  { re: /^(\s*[（(]\s*[零〇一二三四五六七八九十\d]+\s*[)）])\s*/, level: 3, weight: 1.6 },
];

/** 句读标点：出现即认为不是标题 */
const BODY_PUNCT = /[。；;！!？?]/;
/** 标题尾部标点 */
const TITLE_TAIL = /[。；;，,、：:]$/;
/** 标题最大长度 */
const TITLE_MAX = 40;

/**
 * 行内枚举检测
 *
 * 真实合同里经常把一串编号项写在同一行：
 *   「1.因乙方的过失给甲方造成经济损失的；2.乙方违反公司管理制度的；3.双方约定的其他情况。」
 *
 * 这种行以「1.」开头，但它是**正文的一部分**，不是条款标题。
 * 若照常切一刀，就会凭空多出一条条款，并把后面真正的条款边界弄乱。
 *
 * 判据：同一行出现 2 个以上「数字 + 序号符」即视为行内枚举。
 */
const NUM_MARKER = /\d{1,2}\s*[、．.]/g;

function isInlineEnumeration(line: string): boolean {
  NUM_MARKER.lastIndex = 0;
  const hits = line.match(NUM_MARKER);
  return !!hits && hits.length >= 2;
}

export function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') {
      lines.push({ text: text.slice(start, i), start, end: i });
      start = i + 1;
    }
  }
  lines.push({ text: text.slice(start), end: text.length, start });
  return lines;
}

interface Cut {
  lineIndex: number;
  level: number;
  number?: string;
  weight: number;
  /** 编号（含其后空白）占用的字符数 */
  prefixLen: number;
  /** 是否为「无编号的标题行」 */
  titleOnly: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/** 无编号的短行是否像标题 */
function isTitleLike(line: string, next: string | undefined): boolean {
  const t = line.trim();
  if (!t || t.length > 30) return false;
  if (BODY_PUNCT.test(t)) return false;
  if (TITLE_TAIL.test(t)) return false;
  if (!next) return false;
  const n = next.trim();
  return n.length > t.length * 1.5;
}

/**
 * 编号后同一行的内容是否是「条款标题」。
 *
 * 陷阱：PDF 会在排版换行处断开句子，编号后的第一行可能只是半句话：
 *   「第一条 本合同履行过程中因不可抗」   ← 下一行才是「力原因导致…」
 * 若把它当标题切走，正文就从「力原因…」开始，**把一个词劈成两半**，
 * 后续所有锚点匹配都会失效。
 *
 * 判据：标题很短，且下一行明显更长（真实标题后面跟的是完整段落）。
 */
function looksLikeTitle(rest: string, nextLineText: string | undefined): boolean {
  if (!rest || rest.length > TITLE_MAX) return false;
  if (BODY_PUNCT.test(rest)) return false;
  if (TITLE_TAIL.test(rest)) return false;
  if (!nextLineText) return false;
  const n = nextLineText.trim();
  if (!n) return false;
  return n.length > rest.length * 1.5;
}

interface Body {
  text: string;
  start: number;
  end: number;
}

/** 截取 [from, to) 区间并去除首尾空白，返回与原文对齐的偏移 */
function sliceBody(text: string, from: number, to: number): Body {
  const raw = text.slice(from, to);
  const trimmed = raw.trim();
  if (!trimmed) return { text: '', start: from, end: from };
  const start = from + (raw.length - raw.trimStart().length);
  return { text: trimmed, start, end: start + trimmed.length };
}

/**
 * 切分条款。
 *
 * @param text 带换行的合同全文
 */
export function segmentClauses(text: string): Clause[] {
  const lines = splitLines(text);
  const cuts: Cut[] = [];

  lines.forEach((line, i) => {
    const trimmedStart = line.text.length - line.text.trimStart().length;
    // 行内枚举（1.…；2.…；3.…）不是条款标题，纯数字编号模式一律不切
    const inlineEnum = isInlineEnumeration(line.text);
    for (const p of NUMBER_PATTERNS) {
      if (inlineEnum && p.numeric) continue;
      const m = p.re.exec(line.text);
      if (m && m[1]) {
        cuts.push({
          lineIndex: i,
          level: p.level,
          number: m[1].trim(),
          weight: p.weight,
          prefixLen: trimmedStart + m[0].length,
          titleOnly: false,
          confidence: p.weight >= 2.5 ? 'high' : 'medium',
        });
        return;
      }
    }
    if (isTitleLike(line.text, lines[i + 1]?.text)) {
      cuts.push({
        lineIndex: i,
        level: 1,
        weight: 1.5,
        prefixLen: trimmedStart,
        titleOnly: true,
        confidence: 'low',
      });
    }
  });

  // 第一个「有编号的切点」之前的标题行属于文档抬头（合同名、编号、双方），不是条款
  const firstNumbered = cuts.findIndex((c) => !c.titleOnly);
  if (firstNumbered > 0) {
    cuts.splice(0, firstNumbered);
  }

  if (cuts.length === 0) {
    const body = sliceBody(text, 0, text.length);
    if (!body.text) return [];
    return [
      {
        id: 'c0',
        level: 1,
        text: body.text,
        start: body.start,
        end: body.end,
        confidence: 'low',
      },
    ];
  }

  const clauses: Clause[] = [];

  for (let i = 0; i < cuts.length; i += 1) {
    const cut = cuts[i]!;
    const line = lines[cut.lineIndex]!;
    const nextCut = cuts[i + 1];
    const bodyEnd = nextCut ? lines[nextCut.lineIndex]!.start : text.length;

    const afterNumber = cut.lineIndex >= 0 ? line.start + cut.prefixLen : line.start;
    let title: string | undefined;
    let body: Body;

    const restOfLine = text.slice(afterNumber, line.end).trim();

    if (!restOfLine) {
      // 编号独占一行 → 正文在后续行
      const nextLine = lines[cut.lineIndex + 1];
      const nextIsInside = !!nextLine && (!nextCut || nextLine.start < lines[nextCut.lineIndex]!.start);
      if (!nextLine || !nextIsInside) continue;

      const candidate = nextLine.text.trim();
      const lineAfterNext = lines[cut.lineIndex + 2]?.text;
      if (looksLikeTitle(candidate, lineAfterNext)) {
        const after = sliceBody(text, nextLine.end + 1, bodyEnd);
        if (after.text) {
          title = candidate;
          body = after;
        } else {
          body = sliceBody(text, nextLine.start, bodyEnd);
        }
      } else {
        body = sliceBody(text, nextLine.start, bodyEnd);
      }
    } else {
      body = sliceBody(text, afterNumber, bodyEnd);
      // 编号后同行是短标题 → 标题单独成行，正文从下一行开始
      const nextLineText = lines[cut.lineIndex + 1]?.text;
      if (looksLikeTitle(restOfLine, nextLineText)) {
        const after = sliceBody(text, line.end + 1, bodyEnd);
        if (after.text) {
          title = restOfLine;
          body = after;
        }
      }
    }

    if (!body.text) continue;

    clauses.push({
      id: `c${clauses.length}`,
      level: cut.level,
      number: cut.number,
      title,
      text: body.text,
      start: body.start,
      end: body.end,
      confidence: cut.confidence,
    });
  }

  return clauses;
}
