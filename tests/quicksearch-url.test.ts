import { describe, it, expect } from 'vitest';
import { buildGoogleSearchUrl, buildBingSearchUrl } from '../lib/quicksearch/url';

describe('quicksearch url', () => {
  it('Google 结果页', () => {
    expect(buildGoogleSearchUrl('apple')).toBe('https://www.google.com/search?q=apple');
  });
  it('Bing 结果页（cn.bing.com）', () => {
    expect(buildBingSearchUrl('apple')).toBe('https://cn.bing.com/search?q=apple');
  });
  it('关键词含空格需编码', () => {
    expect(buildGoogleSearchUrl('best laptop')).toBe('https://www.google.com/search?q=best%20laptop');
  });
  it('空关键词抛错', () => {
    expect(() => buildGoogleSearchUrl('')).toThrow();
    expect(() => buildBingSearchUrl('   ')).toThrow();
  });
});
