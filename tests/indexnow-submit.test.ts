import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitUrls, reasonFor, groupByHost } from '../lib/indexnow/submit';

beforeEach(() => vi.restoreAllMocks());

describe('submitUrls', () => {
  it('POST 到 api.indexnow.org/IndexNow，body 含 host/key/urlList + 正确 header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 200 } as Response);
    const r = await submitUrls('abc123def456abc123def456', 'example.com', ['https://example.com/a']);
    expect(r).toEqual({ ok: true, status: 200 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.indexnow.org/IndexNow');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json; charset=utf-8' });
    expect(JSON.parse(init?.body as string)).toEqual({
      host: 'example.com',
      key: 'abc123def456abc123def456',
      urlList: ['https://example.com/a'],
    });
  });

  it('200 → ok:true，不带 reason', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 200 } as Response);
    const r = await submitUrls('k', 'h', ['https://h/x']);
    expect(r.ok).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it('403 → ok:false + 密钥无效原因', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 403 } as Response);
    const r = await submitUrls('k', 'h', ['https://h/x']);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.reason).toMatch(/密钥无效/);
  });

  it('422 → URL 不属于该域名', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 422 } as Response);
    expect((await submitUrls('k', 'h', [])).reason).toMatch(/不属于该域名/);
  });

  it('429 → 频率限制', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 429 } as Response);
    expect((await submitUrls('k', 'h', [])).reason).toMatch(/频繁/);
  });

  it('400 → 格式错误', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 400 } as Response);
    expect((await submitUrls('k', 'h', [])).reason).toMatch(/格式错误/);
  });

  it('未知状态码（500）→ 兜底文案', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 500 } as Response);
    expect((await submitUrls('k', 'h', [])).reason).toBe('IndexNow 返回 500');
  });

  it('fetch 抛错 → 透传抛出（由 background catch 兜底）', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(submitUrls('k', 'h', [])).rejects.toThrow('network down');
  });
});

describe('reasonFor', () => {
  it('已知码均有文案', () => {
    expect(reasonFor(400)).toMatch(/格式/);
    expect(reasonFor(403)).toMatch(/密钥/);
    expect(reasonFor(422)).toMatch(/不属于/);
    expect(reasonFor(429)).toMatch(/频繁/);
  });
  it('未知码兜底', () => {
    expect(reasonFor(503)).toBe('IndexNow 返回 503');
  });
});

describe('groupByHost', () => {
  it('同 host 归一组', () => {
    const m = groupByHost(['https://example.com/a', 'https://example.com/b']);
    expect([...m.entries()]).toEqual([['example.com', ['https://example.com/a', 'https://example.com/b']]]);
  });
  it('www 与裸域名分两组', () => {
    const m = groupByHost(['https://example.com/a', 'https://www.example.com/b']);
    expect(m.size).toBe(2);
    expect(m.get('example.com')).toEqual(['https://example.com/a']);
    expect(m.get('www.example.com')).toEqual(['https://www.example.com/b']);
  });
  it('非法 URL 跳过', () => {
    const m = groupByHost(['not-a-url', 'https://example.com/a', '']);
    expect(m.size).toBe(1);
    expect(m.get('example.com')).toEqual(['https://example.com/a']);
  });
  it('空列表 → 空 Map', () => {
    expect(groupByHost([]).size).toBe(0);
  });
});
