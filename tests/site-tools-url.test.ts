import { describe, it, expect } from 'vitest';
import { buildBacklinkCheckerUrl, buildWebsiteAuthorityCheckerUrl } from '../lib/site-tools/url';

describe('site-tools url', () => {
  it('Backlink Checker 拼接 input 与固定 mode=subdomains', () => {
    expect(buildBacklinkCheckerUrl('vercel.com'))
      .toBe('https://ahrefs.com/backlink-checker/?input=vercel.com&mode=subdomains');
  });
  it('Backlink Checker 规范化 origin(去协议/路径)', () => {
    expect(buildBacklinkCheckerUrl('https://vercel.com/foo/bar'))
      .toBe('https://ahrefs.com/backlink-checker/?input=vercel.com&mode=subdomains');
  });
  it('Backlink Checker 保留 www 子域', () => {
    expect(buildBacklinkCheckerUrl('www.example.com'))
      .toBe('https://ahrefs.com/backlink-checker/?input=www.example.com&mode=subdomains');
  });
  it('Website Authority Checker 拼 input,不带 mode', () => {
    expect(buildWebsiteAuthorityCheckerUrl('vercel.com'))
      .toBe('https://ahrefs.com/website-authority-checker/?input=vercel.com');
  });
  it('空输入抛错', () => {
    expect(() => buildBacklinkCheckerUrl('   ')).toThrow();
    expect(() => buildWebsiteAuthorityCheckerUrl('')).toThrow();
  });
  it('非法网址抛错', () => {
    expect(() => buildBacklinkCheckerUrl('not a url')).toThrow();
  });
});
