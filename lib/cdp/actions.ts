import { send, type Target } from './client';

export async function waitForLoad(target: Target, timeoutMs = 30000): Promise<void> {
  await send(target, 'Page.enable');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await send<{ result?: { value?: string } }>(target, 'Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    if (r.result?.value === 'complete') return;
    await new Promise((res) => setTimeout(res, 500));
  }
}

export async function evalJs<T>(target: Target, expression: string): Promise<T> {
  // chrome.debugger.sendCommand 对 Runtime.evaluate 的 resolve 值是单层结构
  // { result: <RemoteObject>, exceptionDetails? }：exceptionDetails 与 result 平级，
  // 而非嵌套在 result 内。与 waitForLoad 的解构保持一致。
  const r = await send<{ result?: { value?: T }; exceptionDetails?: { text?: string } }>(
    target, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true },
  );
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? 'eval failed');
  return r.result!.value as T;
}

export async function waitForPredicate(
  target: Target, jsPredicate: string, opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const timeoutMs = opts.timeoutMs ?? 30000;
  const intervalMs = opts.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await evalJs<boolean>(target, `!!(${jsPredicate})`);
    if (ok) return true;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return false;
}

export async function focusSelector(target: Target, selector: string): Promise<boolean> {
  return evalJs<boolean>(target, `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;el.scrollIntoView({block:'center'});el.focus();return true;})()`);
}

export function typeText(target: Target, text: string): Promise<void> {
  return send(target, 'Input.insertText', { text }).then(() => undefined);
}

export async function pressEnter(target: Target): Promise<void> {
  const base = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 };
  await send(target, 'Input.dispatchKeyEvent', { type: 'keyDown', ...base });
  await send(target, 'Input.dispatchKeyEvent', { type: 'char', text: '\r', ...base });
  await send(target, 'Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

export async function clickReal(target: Target, selector: string): Promise<boolean> {
  const coord = await evalJs<{ x: number; y: number } | null>(target,
    `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  if (!coord) return false;
  await send(target, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: coord.x, y: coord.y, button: 'left', clickCount: 1 });
  await send(target, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: coord.x, y: coord.y, button: 'left', clickCount: 1 });
  return true;
}
