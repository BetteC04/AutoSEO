import { describe, it, expect, vi } from 'vitest';
import { send, attach, detach } from '../lib/cdp/client';
import { evalJs, typeText, pressEnter } from '../lib/cdp/actions';

describe('cdp client', () => {
  it('send 调用 chrome.debugger.sendCommand', async () => {
    // chrome.debugger.sendCommand 对 Runtime.evaluate 的 resolve 值是单层结构
    // { result: <RemoteObject>, exceptionDetails? }（顶层 result 已被剥离）。
    const spy = vi.spyOn(chrome.debugger, 'sendCommand' as any).mockResolvedValue({ result: { value: 42 } } as any);
    const r = await send({ tabId: 1 }, 'Runtime.evaluate', { expression: '6*7' });
    expect(spy).toHaveBeenCalledWith({ tabId: 1 }, 'Runtime.evaluate', { expression: '6*7' });
    expect((r as any).result.value).toBe(42);
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
  it('evalJs 提取 value（单层 { result: <RemoteObject> } 结构）', async () => {
    vi.spyOn(chrome.debugger, 'sendCommand' as any).mockResolvedValue({ result: { value: 'hello' } } as any);
    const v = await evalJs<string>({ tabId: 1 }, "'hello'");
    expect(v).toBe('hello');
  });
  it('evalJs 在页面抛异常时抛错（exceptionDetails 与 result 平级，非嵌套在 result 内）', async () => {
    vi.spyOn(chrome.debugger, 'sendCommand' as any).mockResolvedValue({
      result: { type: 'object' },
      exceptionDetails: { text: '页面执行异常' },
    } as any);
    await expect(evalJs({ tabId: 1 }, 'bad')).rejects.toThrow('页面执行异常');
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
