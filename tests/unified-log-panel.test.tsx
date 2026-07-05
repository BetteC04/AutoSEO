import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UnifiedLogPanel from '../entrypoints/sidepanel/components/UnifiedLogPanel';
import type { UnifiedLogEntry } from '../lib/submit/logs';

const E = (over: Partial<UnifiedLogEntry>): UnifiedLogEntry => ({
  ts: 0, level: 'info', phase: 'p', message: '', platform: 'sys', ...over,
});

describe('UnifiedLogPanel', () => {
  it('渲染每条日志的消息与平台标签', () => {
    render(<UnifiedLogPanel logs={[E({ message: '抓取完成', platform: 'sys' }), E({ message: '已提交', platform: 'gsc' })]} />);
    expect(screen.getByText('抓取完成')).toBeInTheDocument();
    expect(screen.getByText('已提交')).toBeInTheDocument();
    expect(screen.getByText('[GSC]')).toBeInTheDocument();
  });

  it('空日志显示「暂无日志」', () => {
    render(<UnifiedLogPanel logs={[]} />);
    expect(screen.getByText('暂无日志')).toBeInTheDocument();
  });

  it('filter 切换只显示对应级别', () => {
    render(<UnifiedLogPanel logs={[E({ message: '正常', level: 'info' }), E({ message: '出错了', level: 'error' })]} />);
    expect(screen.getByText('正常')).toBeInTheDocument();
    fireEvent.click(screen.getByText('error'));
    expect(screen.queryByText('正常')).not.toBeInTheDocument();
    expect(screen.getByText('出错了')).toBeInTheDocument();
  });

  it('warn 日志默认折叠为两行，点击展开', () => {
    const long = 'X'.repeat(200);
    render(<UnifiedLogPanel logs={[E({ message: long, level: 'warn' })]} />);
    const row = screen.getByText(long);
    expect(row.style.display).toBe('-webkit-box');
    fireEvent.click(row);
    expect(row.style.display).toBe('');
  });
});
