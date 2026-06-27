import { describe, it, expect } from 'vitest';
import { buildAhrefsUrl, isValidCountryCode, COUNTRIES } from '../lib/ahrefs/url';

describe('ahrefs url', () => {
  it('拼接示例链接', () => {
    expect(buildAhrefsUrl('us', 'apple')).toBe('https://ahrefs.com/keyword-difficulty/?country=us&input=apple');
  });
  it('关键词需 URL 编码', () => {
    expect(buildAhrefsUrl('uk', 'best laptop 2026')).toContain('input=best%20laptop%202026');
  });
  it('国家代码转小写', () => {
    expect(buildAhrefsUrl('US', 'apple')).toContain('country=us');
  });
  it('非法国家代码抛错', () => {
    expect(() => buildAhrefsUrl('usa', 'apple')).toThrow();
  });
  it('预置列表含 us/uk', () => {
    expect(COUNTRIES.some((c) => c.code === 'us')).toBe(true);
    expect(COUNTRIES.some((c) => c.code === 'uk')).toBe(true);
  });
});
