import { describe, expect, it } from 'vitest';
import { cnToNumber, parseNumber } from '../src/cn-numbers';

describe('cnToNumber', () => {
  it('基本单位', () => {
    expect(cnToNumber('三')).toBe(3);
    expect(cnToNumber('十')).toBe(10);
    expect(cnToNumber('十五')).toBe(15);
    expect(cnToNumber('二十')).toBe(20);
    expect(cnToNumber('九十九')).toBe(99);
  });

  it('百与千', () => {
    expect(cnToNumber('一百')).toBe(100);
    expect(cnToNumber('一百二十')).toBe(120);
    expect(cnToNumber('两百')).toBe(200);
    expect(cnToNumber('一千')).toBe(1000);
    expect(cnToNumber('一千二百')).toBe(1200);
    expect(cnToNumber('三千五百')).toBe(3500);
  });

  it('万与亿分节', () => {
    expect(cnToNumber('一万')).toBe(10_000);
    expect(cnToNumber('三万五千')).toBe(35_000);
    expect(cnToNumber('二十万')).toBe(200_000);
    expect(cnToNumber('一亿')).toBe(100_000_000);
    expect(cnToNumber('三亿二千万')).toBe(320_000_000);
    expect(cnToNumber('一亿二千万')).toBe(120_000_000);
  });

  it('大写数字', () => {
    expect(cnToNumber('壹拾')).toBe(10);
    expect(cnToNumber('叁佰')).toBe(300);
  });

  it('非法字符返回 null', () => {
    expect(cnToNumber('abc')).toBeNull();
    expect(cnToNumber('第')).toBeNull();
    expect(cnToNumber('')).toBeNull();
  });
});

describe('parseNumber', () => {
  it('阿拉伯数字直通', () => {
    expect(parseNumber('90')).toBe(90);
    expect(parseNumber('3.5')).toBe(3.5);
  });

  it('中文数字转换', () => {
    expect(parseNumber('九十')).toBe(90);
    expect(parseNumber('两')).toBe(2);
  });

  it('混合非法返回 null', () => {
    expect(parseNumber('90日')).toBeNull();
  });
});
