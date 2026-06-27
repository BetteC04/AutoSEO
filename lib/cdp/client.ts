export interface Target { tabId: number; }

export function attach(target: Target): Promise<void> {
  return chrome.debugger.attach(target, '1.3');
}

export function detach(target: Target): Promise<void> {
  return chrome.debugger.detach(target);
}

export function send<T = unknown>(target: Target, method: string, params: { [key: string]: unknown } = {}): Promise<T> {
  return chrome.debugger.sendCommand(target, method, params) as unknown as Promise<T>;
}
