import { describe, it, expect, vi } from 'vitest';
import { send, attach, detach } from '../lib/cdp/client';
import { evalJs, typeText, pressEnter } from '../lib/cdp/actions';

describe('cdp client', () => {
  it('send 调用 chrome.debugger.sendCommand', async () => {
    const spy = vi.spyOn(chrome.debugger, 'sendCommand' as any).mockResolvedValue({ result: { result: { value: 42 } } } as any);
    const r = await send({ tabId: 1 }, 'Runtime.evaluate', { expression: '6*7' });
    expect(spy).toHaveBeenCalledWith({ tabId: 1 }, 'Runtime.evaluate', { expression: '6*7' });
    expect((r as any).result.result.value).toBe(42);
    spy.mockRestore();
  });
  it('attach/detach 用 1.3', async () => {
    const a = vi.spyOn(chrome.debugger, 'attach' as any).mockResolvedValue(undefined);
    const d = vi.spyOn(chrome.debugger, 'detach' as any).mockResolvedValue(undefined);
    await attach({ tabId: 2 });
    expect(a).toHaveBeenCalledWith({ tabId: 2 }, '1.3');
    await detach({ tabId: 2 });
    expect(d).toHaveBeenCalledWith({ tabId: 2 });
    a.mockRestore(); d.mockRestore();
  });
});

describe('cdp actions', () => {
  it('evalJs 提取 value', async () => {
    vi.spyOn(chrome.debugger, 'sendCommand' as any).mockResolvedValue({ result: { result: { value: 'hello' } } } as any);
    const v = await evalJs<string>({ tabId: 1 }, "'hello'");
    expect(v).toBe('hello');
  });
  it('typeText 用 Input.insertText', async () => {
    const spy = vi.spyOn(chrome.debugger, 'sendCommand' as any).mockResolvedValue({} as any);
    await typeText({ tabId: 1 }, 'apple');
    expect(spy).toHaveBeenCalledWith({ tabId: 1 }, 'Input.insertText', { text: 'apple' });
    spy.mockRestore();
  });
  it('pressEnter 派发 keyDown/char/keyUp', async () => {
    const spy = vi.spyOn(chrome.debugger, 'sendCommand' as any).mockResolvedValue({} as any);
    await pressEnter({ tabId: 1 });
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});
