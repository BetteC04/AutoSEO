import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const refresh = vi.fn();
const mock: { state: any; refresh: typeof refresh } = { state: { loading: false }, refresh };
vi.mock('../entrypoints/sidepanel/hooks/useProgressQuery', () => ({
  useProgressQuery: () => mock,
}));

import ProgressDashboard from '../entrypoints/sidepanel/components/ProgressDashboard';

const REPORT = {
  total: 2,
  platforms: [
    { platform: 'gsc' as const, done: 1, total: 2, pending: 1 },
    { platform: 'bing' as const, done: 0, total: 2, pending: 2 },
  ],
  items: [
    { url: 'https://example.com/a', gsc: 'done' as const, bing: 'pending' as const },
    { url: 'https://example.com/b', gsc: 'pending' as const, bing: 'pending' as const },
  ],
  stale: [] as Array<{ url: string; platform: 'gsc' | 'bing' }>,
};

beforeEach(() => {
  refresh.mockReset();
  mock.state = { loading: false };
});

describe('ProgressDashboard', () => {
  it('点击「刷新」调用 refresh(sitemapUrl)', () => {
    render(<ProgressDashboard domain="example.com" sitemapUrl="https://example.com/sitemap.xml" />);
    fireEvent.click(screen.getByText('刷新'));
    expect(refresh).toHaveBeenCalledWith('https://example.com/sitemap.xml');
  });

  it('loading 时按钮禁用且文案「抓取中…」', () => {
    mock.state = { loading: true };
    render(<ProgressDashboard domain="example.com" sitemapUrl="https://example.com/sitemap.xml" />);
    expect(screen.getByText('抓取中…')).toBeDisabled();
  });

  it('sitemapUrl 为空时刷新按钮禁用', () => {
    render(<ProgressDashboard domain="example.com" sitemapUrl="" />);
    expect(screen.getByText('刷新')).toBeDisabled();
  });

  it('有 report 时显示分平台进度与百分比', () => {
    mock.state = { loading: false, report: REPORT };
    render(<ProgressDashboard domain="example.com" sitemapUrl="https://example.com/sitemap.xml" />);
    expect(screen.getByText('GSC')).toBeInTheDocument();
    expect(screen.getByText(/1\/2（50%/)).toBeInTheDocument();
    expect(screen.getByText(/0\/2（0%/)).toBeInTheDocument();
  });

  it('diff 存在时显示对账摘要与相对时间', () => {
    mock.state = { loading: false, report: REPORT, diff: { added: ['x'], removed: ['y'], unchanged: ['z'] }, updatedAt: Date.now() - 7200000 };
    render(<ProgressDashboard domain="example.com" sitemapUrl="https://example.com/sitemap.xml" />);
    expect(screen.getByText(/本次新增 1 · 清理 1 · 未变 1/)).toBeInTheDocument();
    expect(screen.getByText(/2h前/)).toBeInTheDocument();
  });

  it('error 存在时显示错误条', () => {
    mock.state = { loading: false, error: '抓取失败' };
    render(<ProgressDashboard domain="example.com" sitemapUrl="https://example.com/sitemap.xml" />);
    expect(screen.getByText('抓取失败')).toBeInTheDocument();
  });

  it('无 report 时显示空态', () => {
    render(<ProgressDashboard domain="example.com" sitemapUrl="https://example.com/sitemap.xml" />);
    expect(screen.getByText(/还没有进度数据/)).toBeInTheDocument();
  });

  it('筛选「GSC未提交」只显示 gsc=pending 的子集', () => {
    mock.state = { loading: false, report: REPORT };
    render(<ProgressDashboard domain="example.com" sitemapUrl="https://example.com/sitemap.xml" />);
    expect(screen.getByText(/example\.com\/a/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('GSC未提交'));
    expect(screen.queryByText(/example\.com\/a/)).not.toBeInTheDocument();
    expect(screen.getByText(/example\.com\/b/)).toBeInTheDocument();
  });

  it('超过 100 条时显示「加载更多」并追加', () => {
    const items = Array.from({ length: 150 }, (_, i) => ({ url: `https://example.com/p${i}`, gsc: 'pending' as const, bing: 'pending' as const }));
    mock.state = { loading: false, report: { ...REPORT, items } };
    render(<ProgressDashboard domain="example.com" sitemapUrl="https://example.com/sitemap.xml" />);
    expect(screen.getByText(/加载更多（剩余 50）/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/加载更多/));
    expect(screen.queryByText(/加载更多/)).not.toBeInTheDocument();
  });
});
