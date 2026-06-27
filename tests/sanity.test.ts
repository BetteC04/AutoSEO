import { describe, it, expect } from 'vitest';
describe('sanity', () => {
  it('chrome mock 存在', () => {
    expect(chrome.storage.local).toBeDefined();
  });
});
