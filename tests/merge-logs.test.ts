import { describe, it, expect } from 'vitest';
import { mergeLogs } from '../lib/submit/logs';

const L = (ts: number, message: string, level: 'info' | 'warn' | 'error' = 'info') => ({ level, phase: 'p', message, ts });

describe('mergeLogs', () => {
  it('三路按 ts 升序合并', () => {
    const r = mergeLogs([L(3, 's3')], [L(1, 'g1')], [L(2, 'b2')]);
    expect(r.map((x) => x.message)).toEqual(['g1', 'b2', 's3']);
  });

  it('同 ts 时稳定顺序 sys→gsc→bing', () => {
    const r = mergeLogs([L(5, 's')], [L(5, 'g')], [L(5, 'b')]);
    expect(r.map((x) => x.message)).toEqual(['s', 'g', 'b']);
  });

  it('任一路为空正常工作', () => {
    const r = mergeLogs([L(1, 's1')], [], []);
    expect(r.map((x) => x.message)).toEqual(['s1']);
    expect(r[0].platform).toBe('sys');
  });

  it('全空返回空数组', () => {
    expect(mergeLogs([], [], [])).toEqual([]);
  });

  it('每条带正确 platform 标签', () => {
    const r = mergeLogs([L(1, 's')], [L(2, 'g')], [L(3, 'b')]);
    expect(r.map((x) => x.platform)).toEqual(['sys', 'gsc', 'bing']);
  });
});
