import { describe, it, expect } from 'vitest';
import { isValidIndexNowKey, generateIndexNowKey } from '../lib/storage/settings';

describe('isValidIndexNowKey', () => {
  it('合法 32 位 hex 通过', () => {
    expect(isValidIndexNowKey('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4')).toBe(true);
  });
  it('含短横线通过', () => {
    expect(isValidIndexNowKey('abc-def-12345678')).toBe(true);
  });
  it('过短（<8）不通过', () => {
    expect(isValidIndexNowKey('abc123')).toBe(false);
  });
  it('超长（>128）不通过', () => {
    expect(isValidIndexNowKey('a'.repeat(129))).toBe(false);
  });
  it('非法字符（含下划线）不通过', () => {
    expect(isValidIndexNowKey('abc_defgh1234567')).toBe(false);
  });
  it('空串不通过', () => {
    expect(isValidIndexNowKey('')).toBe(false);
  });
});

describe('generateIndexNowKey', () => {
  it('输出合法（匹配协议正则）', () => {
    expect(isValidIndexNowKey(generateIndexNowKey())).toBe(true);
  });
  it('长度为 32（16 字节 hex）', () => {
    expect(generateIndexNowKey()).toHaveLength(32);
  });
  it('两次调用结果不同（随机性）', () => {
    expect(generateIndexNowKey()).not.toBe(generateIndexNowKey());
  });
});
