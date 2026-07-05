import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickSearchTool from '../entrypoints/sidepanel/pages/QuickSearchTool';

afterEach(() => { vi.restoreAllMocks(); });

describe('QuickSearchTool', () => {
  it('渲染「搜索引擎查询」标题与 Google / Bing / Yandex 三个按钮', () => {
    render(<QuickSearchTool keyword="apple" />);
    expect(screen.getByText('搜索引擎查询')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '用 Google 搜' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '用 Bing 搜' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '用 Yandex 搜' })).toBeEnabled();
  });
  it('关键词为空时三按钮均禁用', () => {
    render(<QuickSearchTool keyword="" />);
    expect(screen.getByRole('button', { name: '用 Google 搜' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '用 Bing 搜' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '用 Yandex 搜' })).toBeDisabled();
  });
  it('点击 Google / Bing / Yandex 分别打开对应结果页', () => {
    const spy = vi.spyOn(chrome.tabs, 'create');
    render(<QuickSearchTool keyword="apple" />);
    fireEvent.click(screen.getByRole('button', { name: '用 Google 搜' }));
    fireEvent.click(screen.getByRole('button', { name: '用 Bing 搜' }));
    fireEvent.click(screen.getByRole('button', { name: '用 Yandex 搜' }));
    expect(spy).toHaveBeenCalledTimes(3);
    expect((spy.mock.calls[0][0].url as string).startsWith('https://www.google.com/search?q=apple')).toBe(true);
    expect((spy.mock.calls[1][0].url as string).startsWith('https://cn.bing.com/search?q=apple')).toBe(true);
    expect((spy.mock.calls[2][0].url as string).startsWith('https://yandex.com/search/?text=apple')).toBe(true);
  });

  it('渲染「搜索定位」标签(不再有「仅 Google」)', () => {
    render(<QuickSearchTool keyword="apple" />);
    expect(screen.getByText('搜索定位')).toBeInTheDocument();
    expect(screen.queryByText(/仅 Google/)).toBeNull();
  });

  it('渲染分割线(首尾不贯穿)', () => {
    const { container } = render(<QuickSearchTool keyword="apple" />);
    const divider = container.querySelector('[data-testid="qs-divider"]');
    expect(divider).not.toBeNull();
  });

  it('渲染搜索位置下拉,默认选中美国', () => {
    const { container } = render(<QuickSearchTool keyword="apple" />);
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('US');
  });

  it('切换下拉写入 kw-tools:geo', async () => {
    const { container } = render(<QuickSearchTool keyword="apple" />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'DE' } });
    const items = (await chrome.storage.local.get('kw-tools:geo')) as Record<string, { code: string }>;
    expect(items['kw-tools:geo'].code).toBe('DE');
  });
});
