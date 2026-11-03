/**
 * 短语匹配 —— 容忍 PDF 换行
 *
 * 中文没有词边界。PDF 行重组必然会在排版换行处把词劈开：
 *
 *   原文：…任一方可向甲方所在地人民法院起
 *         诉。
 *
 * 「起诉」被劈成两行。此时若用 `text.includes('诉讼')` 判断必备条款是否存在，
 * 就会误报「全文未约定争议解决方式」—— 一个完全站不住脚的风险项。
 *
 * 做法：把短语编译成「字符之间允许有空白」的正则再搜。
 * 命中位置直接落在原文坐标上，页内高亮不受影响。
 *
 * 注意：这只解决「换行劈词」，不解决「词表不全」——
 * 「起诉」和「诉讼」是两个词，规则词表该有的还得有。
 */

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

function escapeChar(ch: string): string {
  return ch.replace(REGEX_SPECIAL, '\\$&');
}

/** 编译结果缓存：同一短语反复用，不必重复构造正则 */
const cache = new Map<string, RegExp>();

/** 把短语编译为容忍换行的全局正则 */
export function phraseRegex(phrase: string): RegExp {
  let re = cache.get(phrase);
  if (!re) {
    const chars = [...phrase];
    const body = chars
      .map((ch, i) => (i === 0 ? escapeChar(ch) : `\\s*${escapeChar(ch)}`))
      .join('');
    re = new RegExp(body, 'g');
    cache.set(phrase, re);
  }
  return re;
}

/** 在文本中查找短语，返回原文坐标区间；找不到返回 undefined */
export function findPhrase(
  text: string,
  phrase: string,
): { start: number; end: number } | undefined {
  if (!phrase || !text) return undefined;
  const re = phraseRegex(phrase);
  re.lastIndex = 0;
  const m = re.exec(text);
  if (!m) return undefined;
  return { start: m.index, end: m.index + m[0].length };
}

/** 短语是否出现 */
export function hasPhrase(text: string, phrase: string): boolean {
  return findPhrase(text, phrase) !== undefined;
}

/** 统计短语出现次数（上限 max，避免长文档上做无谓的扫描） */
export function countPhrase(text: string, phrase: string, max = 5): number {
  if (!phrase || !text) return 0;
  const re = phraseRegex(phrase);
  re.lastIndex = 0;
  let count = 0;
  while (count < max) {
    const m = re.exec(text);
    if (!m) break;
    count += 1;
    // 零长度匹配保护（短语为空时）
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return count;
}

/** 找出短语的所有出现位置（原文坐标） */
export function allPhrasePositions(
  text: string,
  phrase: string,
): { start: number; end: number }[] {
  if (!phrase || !text) return [];
  const re = phraseRegex(phrase);
  re.lastIndex = 0;
  const out: { start: number; end: number }[] = [];
  let m = re.exec(text);
  while (m) {
    out.push({ start: m.index, end: m.index + m[0].length });
    if (m[0].length === 0) re.lastIndex += 1;
    m = re.exec(text);
  }
  return out;
}
