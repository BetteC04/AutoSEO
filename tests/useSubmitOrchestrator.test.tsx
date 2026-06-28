import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const gscStart = vi.fn();
const bingStart = vi.fn();
const baseRunner = (start: ReturnType<typeof vi.fn>) => ({
  start, cancel: vi.fn(),
  state: { running: false, total: 0, done: 0 },
  results: [], logs: [],
});

vi.mock('../entrypoints/sidepanel/hooks/useGscRunner', () => ({ useGscRunner: () => baseRunner(gscStart) }));
vi.mock('../entrypoints/sidepanel/hooks/useBingRunner', () => ({ useBingRunner: () => baseRunner(bingStart) }));

import { useSubmitOrchestrator } from '../entrypoints/sidepanel/hooks/useSubmitOrchestrator';

beforeEach(() => { gscStart.mockReset(); bingStart.mockReset(); });

describe('useSubmitOrchestrator', () => {
  it('串行：GSC 完成后才启动 Bing', async () => {
    let resolveGsc!: () => void;
    gscStart.mockImplementation(() => new Promise<void>((r) => { resolveGsc = r; }));
    bingStart.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSubmitOrchestrator());
    let done = false;
    act(() => { result.current.run({ gsc: true, bing: true }, 'example.com', ['https://x.com/']).then(() => { done = true; }); });

    expect(gscStart).toHaveBeenCalledWith('example.com', ['https://x.com/']);
    expect(bingStart).not.toHaveBeenCalled();

    await act(async () => { resolveGsc(); });
    await waitFor(() => expect(bingStart).toHaveBeenCalledWith('example.com', ['https://x.com/']));
    await waitFor(() => expect(done).toBe(true));
  });

  it('只勾选 Bing 时只调 bingStart', async () => {
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: false, bing: true }, 'example.com', ['https://x.com/']); });
    expect(gscStart).not.toHaveBeenCalled();
    expect(bingStart).toHaveBeenCalledOnce();
  });

  it('GSC 失败（reject）不影响 Bing 执行', async () => {
    gscStart.mockRejectedValue(new Error('boom'));
    bingStart.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: true }, 'example.com', ['https://x.com/']); });
    expect(bingStart).toHaveBeenCalledOnce();
  });
});
