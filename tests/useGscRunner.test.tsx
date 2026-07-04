import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

function mockPort() {
  let msgCb: ((e: any) => void) | null = null;
  const port = {
    postMessage: vi.fn(),
    onMessage: { addListener: (cb: (e: any) => void) => { msgCb = cb; } },
    onDisconnect: { addListener: () => {} },
    disconnect: vi.fn(),
  };
  (chrome as any).runtime.connect = vi.fn(() => port);
  return { port, emit: (e: any) => msgCb!(e) };
}

describe('useGscRunner', () => {
  it('start 返回最终 results（DONE 时）', async () => {
    const { emit } = mockPort();
    const { useGscRunner } = await import('../entrypoints/sidepanel/hooks/useGscRunner');
    const { result } = renderHook(() => useGscRunner());
    let resolved: any;
    await act(async () => {
      const p = result.current.start('example.com', ['https://example.com/a']);
      resolved = undefined;
      emit({ type: 'GSC_STATE', state: 'running', total: 1, done: 1, currentUrl: 'https://example.com/a', results: [{ url: 'https://example.com/a', status: 'ok' }] });
      emit({ type: 'GSC_DONE', ok: 1, failed: 0, skipped: 0 });
      resolved = await p;
    });
    expect(resolved).toEqual([{ url: 'https://example.com/a', status: 'ok' }]);
  });
});
