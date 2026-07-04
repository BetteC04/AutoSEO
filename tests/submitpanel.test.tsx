import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const run = vi.fn();
vi.mock('../entrypoints/sidepanel/hooks/useSubmitOrchestrator', () => ({
  useSubmitOrchestrator: () => ({
    run,
    cancel: vi.fn(),
    active: null,
    report: [],
    logs: [],
    clearReport: vi.fn(),
    gsc: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
    bing: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
  }),
}));

import SubmitPanel from '../entrypoints/sidepanel/pages/SubmitPanel';

describe('SubmitPanel', () => {
  it('默认 sitemapUrl = origin + /sitemap.xml', () => {
    render(<SubmitPanel site={{ domain: 'example.com' }} onBack={() => {}} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('https://example.com/sitemap.xml');
  });

  it('非法域名提交时显示错误且不调 run', () => {
    render(<SubmitPanel site={{ domain: 'not a domain' }} onBack={() => {}} />);
    fireEvent.click(screen.getByText('一次提交'));
    expect(screen.getByText(/请先选择或填写有效网站/)).toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });

  it('有效域名点击提交：用 sitemapUrl 调 run', () => {
    render(<SubmitPanel site={{ domain: 'example.com' }} onBack={() => {}} />);
    fireEvent.click(screen.getByText('一次提交'));
    expect(run).toHaveBeenCalledWith({ gsc: true, bing: true }, 'example.com', 'https://example.com/sitemap.xml');
  });

  it('手改 sitemapUrl 后用新值提交', () => {
    render(<SubmitPanel site={{ domain: 'example.com' }} onBack={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'https://example.com/sitemap-index.xml' } });
    fireEvent.click(screen.getByText('一次提交'));
    expect(run).toHaveBeenCalledWith({ gsc: true, bing: true }, 'example.com', 'https://example.com/sitemap-index.xml');
  });

  it('返回按钮触发 onBack', () => {
    const onBack = vi.fn();
    render(<SubmitPanel site={{ domain: 'example.com' }} onBack={onBack} />);
    fireEvent.click(screen.getByText('返回'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
