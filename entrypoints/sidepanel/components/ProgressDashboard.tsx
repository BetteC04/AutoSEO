import { useState } from 'react';
import Button from './Button';
import { useProgressQuery } from '../hooks/useProgressQuery';
import type { ProgressItem } from '@lib/submit/progress';

const PAGE = 100;

type Filter = 'all' | 'gsc-pending' | 'bing-pending' | 'stale';

export interface ProgressDashboardProps {
  domain: string;
  sitemapUrl: string;
}

interface Row { key: string; left: string; right: string; stale?: boolean; }

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3_600_000);
  if (h >= 1) return `${h}h前`;
  const m = Math.floor(diff / 60_000);
  if (m >= 1) return `${m}m前`;
  return '刚刚';
}

export default function ProgressDashboard({ domain, sitemapUrl }: ProgressDashboardProps) {
  const { state, refresh } = useProgressQuery(domain);
  const [filter, setFilter] = useState<Filter>('all');
  const [visible, setVisible] = useState(PAGE);

  const report = state.report;
  const canRefresh = sitemapUrl.trim().length > 0 && domain.trim().length > 0 && !state.loading;

  let rows: Row[] = [];
  if (report) {
    if (filter === 'stale') {
      rows = report.stale.map((s) => ({ key: `${s.platform}|${s.url}`, left: s.url, right: s.platform, stale: true }));
    } else {
      let items: ProgressItem[] = report.items;
      if (filter === 'gsc-pending') items = items.filter((i) => i.gsc === 'pending');
      else if (filter === 'bing-pending') items = items.filter((i) => i.bing === 'pending');
      rows = items.map((i) => ({ key: i.url, left: i.url, right: `GSC${i.gsc === 'done' ? '✓' : '✗'} Bing${i.bing === 'done' ? '✓' : '✗'}` }));
    }
  }

  const filters: Array<[Filter, string]> = [
    ['all', '全部'],
    ['gsc-pending', 'GSC未提交'],
    ['bing-pending', 'Bing未提交'],
    ['stale', `已不在sitemap(${report?.stale.length ?? 0})`],
  ];

  return (
    <div>
      {/* 进度卡 */}
      <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink)' }}>提交进度</span>
          <Button variant="secondary" onClick={() => void refresh(sitemapUrl.trim())} disabled={!canRefresh}>
            {state.loading ? '抓取中…' : '刷新'}
          </Button>
        </div>
        {state.error && <div style={{ color: 'var(--color-error)', fontSize: 12, marginBottom: 6 }}>{state.error}</div>}
        {state.diff && (
          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
            本次新增 {state.diff.added.length} · 清理 {state.diff.removed.length} · 未变 {state.diff.unchanged.length}{state.updatedAt ? ` · ${relTime(state.updatedAt)}` : ''}
          </div>
        )}
      </div>

      {report && report.total > 0 && (
        <>
          <div style={{ marginTop: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.platforms.map((p) => {
              const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <div key={p.platform}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span>{p.platform.toUpperCase()}</span>
                    <span>{p.done}/{p.total}（{pct}%）</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--color-canvas)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)' }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'var(--space-sm)' }}>
            {filters.map(([key, label]) => (
              <button key={key} type="button" onClick={() => { setFilter(key); setVisible(PAGE); }} className={`platform-chip${filter === key ? ' is-active' : ''}`}>{label}</button>
            ))}
          </div>

          <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6 }}>
            {rows.slice(0, visible).map((r) => (
              <div key={r.key} style={{ color: r.stale ? 'var(--color-muted)' : 'var(--color-ink)', opacity: r.stale ? 0.6 : 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                · {r.left} <span style={{ color: 'var(--color-muted)' }}>{r.right}</span>
              </div>
            ))}
            {rows.length === 0 && <div style={{ color: 'var(--color-muted)' }}>无符合条件的链接</div>}
            {visible < rows.length && (
              <button type="button" onClick={() => setVisible((v) => v + PAGE)} style={{ marginTop: 8, border: 'none', background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                加载更多（剩余 {rows.length - visible}）
              </button>
            )}
          </div>
        </>
      )}

      {(!report || report.total === 0) && !state.error && (
        <div style={{ marginTop: 'var(--space-sm)', fontSize: 12, color: 'var(--color-muted)' }}>
          还没有进度数据，点「刷新」抓取最新 sitemap 并对账。
        </div>
      )}
    </div>
  );
}
