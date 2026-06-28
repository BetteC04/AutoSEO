import { describe, it, expect } from 'vitest';
import { buildTrendsUrl, TRENDS_DATE_RANGES, TRENDS_GEOS } from '../lib/trends/url';

describe('trends url', () => {
  it('30天 + 全球 + 对比词 gpts', () => {
    expect(buildTrendsUrl('apple', 'gpts', 'today 1-m', 'Worldwide'))
      .toBe('https://trends.google.com/explore?q=apple%2Cgpts&date=today%201-m&geo=Worldwide');
  });
  it('1年 + 美国 + 无对比词（不带逗号）', () => {
    expect(buildTrendsUrl('apple', '', 'today 1-y', 'US'))
      .toBe('https://trends.google.com/explore?q=apple&date=today%201-y&geo=US');
  });
  it('7天 date 含空格需编码', () => {
    expect(buildTrendsUrl('apple', 'gpts', 'now 7-d', 'US'))
      .toBe('https://trends.google.com/explore?q=apple%2Cgpts&date=now%207-d&geo=US');
  });
  it('主词含空格需编码', () => {
    expect(buildTrendsUrl('best laptop', 'gpts', 'today 1-m', 'Worldwide'))
      .toContain('q=best%20laptop%2Cgpts');
  });
  it('空主词抛错', () => {
    expect(() => buildTrendsUrl('  ', 'gpts', 'today 1-m', 'Worldwide')).toThrow();
  });
  it('日期常量含三档', () => {
    const values = TRENDS_DATE_RANGES.map((d) => d.value);
    expect(values).toEqual(['now 7-d', 'today 1-m', 'today 1-y']);
  });
  it('地区常量默认全球 + 主流国家（大写）', () => {
    expect(TRENDS_GEOS[0].value).toBe('Worldwide');
    expect(TRENDS_GEOS.some((g) => g.value === 'US')).toBe(true);
    expect(TRENDS_GEOS.some((g) => g.value === 'JP')).toBe(true);
  });
});
