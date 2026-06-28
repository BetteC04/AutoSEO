import { describe, it, expect } from 'vitest';
import { buildBingUrl } from '../lib/bing/url';
import { PROBES } from '../lib/bing/selectors';

describe('bing url', () => {
  it('拼接示例域名（siteUrl 带协议 + 结尾斜杠）', () => {
    expect(buildBingUrl('bottleneck-checker.com')).toBe(
      'https://www.bing.com/webmasters/urlinspection?siteUrl=https%3A%2F%2Fbottleneck-checker.com%2F',
    );
  });
  it('空域名抛错', () => {
    expect(() => buildBingUrl('   ')).toThrow();
  });
  it('域名首尾空白会被 trim', () => {
    expect(buildBingUrl('  bottleneck-checker.com  ')).toContain(
      'siteUrl=https%3A%2F%2Fbottleneck-checker.com%2F',
    );
  });
  it('siteUrl 已 URL 编码（: → %3A，/ → %2F）', () => {
    expect(buildBingUrl('example.com')).toContain('siteUrl=https%3A%2F%2Fexample.com%2F');
  });
});

describe('bing selectors', () => {
  const REQUIRED_KEYS = [
    'inspectInput',
    'inspectBtn',
    'requestIndexingButton',
    'submitBtn',
    'confirmDialog',
    'resultReady',
    'isAlreadyIndexed',
    'successIndicator',
    'isQuota',
  ] as const;

  it('PROBES 字段齐全', () => {
    for (const k of REQUIRED_KEYS) {
      expect(typeof PROBES[k]).toBe('string');
    }
  });

  it('每个 PROBES 是非空字符串', () => {
    for (const k of REQUIRED_KEYS) {
      expect(PROBES[k].length).toBeGreaterThan(0);
    }
  });

  it('inspectInput 用 data-tag 匹配（不依赖动态 id/class）', () => {
    // 实测：id 是动态 TextField+N（非 TextField107），稳定锚点是 data-tag=urlInspectionInput。
    expect(PROBES.inspectInput).toContain('data-tag');
    expect(PROBES.inspectInput).toContain('urlInspectionInput');
  });

  it('inspectBtn / requestIndexingButton / submitBtn 均用 data-tag', () => {
    expect(PROBES.inspectBtn).toContain('inspectBtn');
    expect(PROBES.requestIndexingButton).toContain('requestIndexingButton');
    expect(PROBES.submitBtn).toContain('submitBtn');
  });

  it('resultReady 用语义 class urlInspectionSectionTitle（getting 弹窗结束后非空）', () => {
    expect(PROBES.resultReady).toContain('urlInspectionSectionTitle');
  });

  it('isAlreadyIndexed 匹配真实文案（Indexed successfully）', () => {
    expect(PROBES.isAlreadyIndexed).toContain('indexed successfully');
  });

  it('successIndicator 匹配真实成功文案（Indexing requested）', () => {
    expect(PROBES.successIndicator).toContain('indexing requested');
  });
});
