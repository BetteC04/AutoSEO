import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// chrome.storage.local 内存实现（兼容 callback 与 Promise 两种调用风格）
const memStore = new Map<string, unknown>();
const storageArea = {
  get(keys: string | string[] | null | object, cb?: (items: Record<string, unknown>) => void) {
    const out: Record<string, unknown> = {};
    const keyList = keys == null ? [...memStore.keys()] : Array.isArray(keys) ? keys : typeof keys === 'object' ? Object.keys(keys) : [keys];
    for (const k of keyList) if (memStore.has(k)) out[k] = memStore.get(k);
    const result = out;
    cb?.(result);
    return Promise.resolve(result);
  },
  set(items: Record<string, unknown>, cb?: () => void) {
    for (const [k, v] of Object.entries(items)) memStore.set(k, v);
    cb?.();
    return Promise.resolve();
  },
  remove(keys: string | string[], cb?: () => void) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) memStore.delete(k);
    cb?.();
    return Promise.resolve();
  },
  clear(cb?: () => void) { memStore.clear(); cb?.(); return Promise.resolve(); },
};

function resetChromeMock() { memStore.clear(); }

const chromeMock = {
  storage: { local: storageArea, session: storageArea },
  runtime: {
    id: 'test-extension-id',
    onMessage: { addListener: () => {}, removeListener: () => {} },
    connect: () => ({ postMessage: () => {}, onMessage: { addListener: () => {} }, onDisconnect: { addListener: () => {} }, disconnect: () => {} }),
    sendMessage: () => Promise.resolve(),
  },
  tabs: { create: () => Promise.resolve({ id: 1 }), query: () => Promise.resolve([]), remove: () => Promise.resolve() },
  debugger: { attach: () => Promise.resolve(), detach: () => Promise.resolve(), sendCommand: () => Promise.resolve({}) },
  sidePanel: { setPanelBehavior: () => Promise.resolve() },
};

Object.defineProperty(globalThis, 'chrome', { value: chromeMock, writable: true, configurable: true });

// 每个测试前重置 storage，避免用例间污染
beforeEach(() => { resetChromeMock(); });

export { resetChromeMock };
