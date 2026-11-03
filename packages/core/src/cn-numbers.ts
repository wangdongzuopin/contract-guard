/**
 * 中文数字 → 阿拉伯数字
 *
 * 覆盖合同里常见写法：三十 / 九十 / 两百 / 一千二百 / 三万五千 / 一亿二千万 /
 * 十五 / 廿 / 卅，以及大写「壹贰叁…拾佰仟」。
 */

const DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  壹: 1,
  二: 2,
  贰: 2,
  貳: 2,
  两: 2,
  三: 3,
  叁: 3,
  四: 4,
  肆: 4,
  五: 5,
  伍: 5,
  六: 6,
  陆: 6,
  七: 7,
  柒: 7,
  八: 8,
  捌: 8,
  九: 9,
  玖: 9,
};

const SMALL_UNITS: Record<string, number> = {
  十: 10,
  拾: 10,
  百: 100,
  佰: 100,
  千: 1000,
  仟: 1000,
};

const BIG_UNITS: Record<string, number> = {
  万: 10_000,
  萬: 10_000,
  亿: 100_000_000,
  億: 100_000_000,
};

/** 可被识别为中文数字的字符集合 */
export const CN_NUM_CHARS = '零〇一二三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖拾佰仟萬億';

const CN_NUM_CLASS = `[${CN_NUM_CHARS}]{1,14}`;

/**
 * 把中文数字串转为数值。非法字符返回 null。
 *
 * 算法按「万 / 亿分节」处理：
 *   三亿二千万 → section(亿)=3e8 + section(万)=2e7 = 320,000,000
 */
export function cnToNumber(input: string): number | null {
  const s = input.trim();
  if (!s) return null;

  // 纯阿拉伯数字直接返回
  if (/^\d+(\.\d+)?$/.test(s)) return Number.parseFloat(s);

  // 廿 = 20，卅 = 30（合同里少见但存在）
  if (s === '廿') return 20;
  if (s === '卅') return 30;

  let total = 0;
  let section = 0;
  let num = 0;

  for (const ch of s) {
    if (ch in DIGITS) {
      num = DIGITS[ch]!;
      continue;
    }
    if (ch in SMALL_UNITS) {
      // 「十五」的十前面没有数字，按 1 处理
      if (num === 0 && ch === '十') num = 1;
      section += num * SMALL_UNITS[ch]!;
      num = 0;
      continue;
    }
    if (ch in BIG_UNITS) {
      section += num;
      num = 0;
      section *= BIG_UNITS[ch]!;
      total += section;
      section = 0;
      continue;
    }
    return null; // 出现非法字符
  }

  return total + section + num;
}

/**
 * 宽松解析：优先按阿拉伯数字，再按中文数字。
 * 传入的 token 必须只包含数字字符，否则返回 null。
 */
export function parseNumber(token: string): number | null {
  const s = token.trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Number.parseFloat(s);
  if (/^[\d.]+$/.test(s)) return null;
  return cnToNumber(s);
}

export { CN_NUM_CLASS };
