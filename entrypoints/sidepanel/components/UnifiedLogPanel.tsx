import { useEffect, useRef, useState } from 'react';
import type { UnifiedLogEntry, LogPlatform } from '@lib/submit/logs';

const LEVEL_COLOR: Record<UnifiedLogEntry['level'], string> = {
  info: 'var(--color-on-dark-soft)',
  warn: 'var(--color-warning)',
  error: 'var(--color-error)',
};

const PLATFORM_COLOR: Record<LogPlatform, string> = {
  sys: 'var(--color-on-dark-soft)',
  gsc: 'var(--color-primary)',
  bing: 'var(--color-success)',
};

const PLATFORM_LABEL: Record<LogPlatform, string> = { sys: 'SYS', gsc: 'GSC', bing: 'BING' };

const LEVELS = ['all', 'info', 'warn', 'error'] as const;
type Filter = (typeof LEVELS)[number];
const LABEL: Record<Filter, string> = { all: '全部', info: 'info', warn: 'warn', error: 'error' };

function tsLabel(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function UnifiedLogPanel({ logs }: { logs: UnifiedLogEntry[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [logs.length]);

  const visible = filter === 'all' ? logs : logs.filter((l) => l.level === filter);

  return (
    <div style={{
      background: 'var(--color-surface-dark)', borderRadius: 'var(--radius-md)',
      padding: 'var(--space-xs)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-on-dark)',
    }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {LEVELS.map((lv) => (
          <button key={lv} onClick={() => { setFilter(lv); setExpanded({}); }} style={{
            padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-on-dark-soft)',
            background: filter === lv ? 'var(--color-primary)' : 'transparent',
            color: filter === lv ? 'var(--color-on-primary)' : 'var(--color-on-dark-soft)',
            cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)',
          }}>{LABEL[lv]}</button>
        ))}
      </div>
      <div style={{ maxHeight: 260, overflow: 'auto' }}>
        {visible.length === 0 && <div style={{ color: 'var(--color-on-dark-soft)' }}>暂无日志</div>}
        {visible.map((l, i) => {
          const detail = l.level === 'warn' || l.level === 'error';
          const open = !!expanded[i];
          return (
            <div key={i} style={{ color: LEVEL_COLOR[l.level], lineHeight: 1.6, cursor: detail ? 'pointer' : 'default' }}
              onClick={() => detail && setExpanded((p) => ({ ...p, [i]: !p[i] }))}>
              <span style={{ color: 'var(--color-on-dark-soft)' }}>[{tsLabel(l.ts)}]</span>{' '}
              <span style={{ color: PLATFORM_COLOR[l.platform] }}>[{PLATFORM_LABEL[l.platform]}]</span>{' '}
              <span style={detail && !open ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}>
                {l.message}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
