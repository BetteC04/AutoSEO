import { describe, it, expect, vi, beforeAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIndexNowKey } from '../entrypoints/sidepanel/hooks/useIndexNowKey';
import { getSettings } from '../lib/storage/settings';

// jsdom 未实现 URL.createObjectURL / revokeObjectURL，polyfill 兜底（download 用例需要）。
beforeAll(() => {
  if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = () => 'blob:mock';
  if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = () => {};
});

describe('useIndexNowKey', () => {
  it('初始无 key → key 为 undefined', async () => {
    const { result } = renderHook(() => useIndexNowKey());
    // 等 getSettings 的 useEffect 跑完
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.key).toBeUndefined();
  });

  it('generate 后 key 非空且合法（落库 + onChanged 回写）', async () => {
    const { result } = renderHook(() => useIndexNowKey());
    await act(async () => { result.current.generate(); await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.key).toBeTruthy();
    expect(result.current.key).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
    const s = await getSettings();
    expect(s.indexnowKey).toBe(result.current.key);
  });

  it('预置 key 后 hook 能读到', async () => {
    const { updateSettings } = await import('../lib/storage/settings');
    await updateSettings({ indexnowKey: 'preconfigured-key-1234567890' });
    const { result } = renderHook(() => useIndexNowKey());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.key).toBe('preconfigured-key-1234567890');
  });

  it('refresh 未确认（confirm=false）不换 key', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = renderHook(() => useIndexNowKey());
    await act(async () => { result.current.generate(); await Promise.resolve(); await Promise.resolve(); });
    const first = result.current.key;
    act(() => { result.current.refresh(); });
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(result.current.key).toBe(first);
    confirmSpy.mockRestore();
  });

  it('refresh 确认（confirm=true）换新 key', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => useIndexNowKey());
    await act(async () => { result.current.generate(); await Promise.resolve(); await Promise.resolve(); });
    const first = result.current.key;
    await act(async () => { result.current.refresh(); await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.key).not.toBe(first);
    vi.restoreAllMocks();
  });

  it('download：无 key 时 no-op；有 key 时触发 <a>.click', async () => {
    const { result } = renderHook(() => useIndexNowKey());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    // 无 key：不抛错
    act(() => { result.current.download(); });
    // 有 key
    await act(async () => { result.current.generate(); await Promise.resolve(); await Promise.resolve(); });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    act(() => { result.current.download(); });
    expect(clickSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });
});

describe('useIndexNowKey - testConnection', () => {
  it('预置 key 后 testConnection 成功 → testStatus:ok + 成功消息含 host', async () => {
    const { updateSettings } = await import('../lib/storage/settings');
    await updateSettings({ indexnowKey: 'preconfigured-key-1234567890' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('preconfigured-key-1234567890'),
    } as unknown as Response);
    const { result } = renderHook(() => useIndexNowKey());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.testStatus).toBe('idle');
    await act(async () => { await result.current.testConnection('example.com'); });
    expect(result.current.testStatus).toBe('ok');
    expect(result.current.testMessage).toMatch(/已正确部署/);
    expect(result.current.testMessage).toContain('example.com');
    vi.restoreAllMocks();
  });

  it('testConnection 失败（404）→ testStatus:fail + 原因', async () => {
    const { updateSettings } = await import('../lib/storage/settings');
    await updateSettings({ indexnowKey: 'preconfigured-key-1234567890' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 404 } as Response);
    const { result } = renderHook(() => useIndexNowKey());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await result.current.testConnection('example.com'); });
    expect(result.current.testStatus).toBe('fail');
    expect(result.current.testMessage).toMatch(/未找到/);
    vi.restoreAllMocks();
  });

  it('testing 期间 testStatus 为 testing', async () => {
    const { updateSettings } = await import('../lib/storage/settings');
    await updateSettings({ indexnowKey: 'preconfigured-key-1234567890' });
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useIndexNowKey());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => {
      result.current.testConnection('example.com'); // 不 await，让 fetch 挂起
      await Promise.resolve();
    });
    expect(result.current.testStatus).toBe('testing');
    vi.restoreAllMocks();
  });
});
