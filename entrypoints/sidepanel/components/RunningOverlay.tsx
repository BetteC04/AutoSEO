import Button from './Button';
import UnifiedLogPanel from './UnifiedLogPanel';
import { mergeLogs } from '@lib/submit/logs';
import type { useSubmitOrchestrator } from '../hooks/useSubmitOrchestrator';

type Orch = ReturnType<typeof useSubmitOrchestrator>;

export interface RunningOverlayProps {
  orch: Orch;
  gscSelected: boolean;
  bingSelected: boolean;
  onCancel: () => void;
}

interface Step { label: string; status: 'done' | 'current' | 'pending'; detail?: string; }

export default function RunningOverlay({ orch, gscSelected, bingSelected, onCancel }: RunningOverlayProps) {
  const active = orch.active;
  const activeLabel = active === 'sitemap' ? '抓取 sitemap' : active === 'gsc' ? 'GSC' : active === 'bing' ? 'Bing' : '';
  const activeRunner = active === 'gsc' ? orch.gsc : active === 'bing' ? orch.bing : null;
  const done = activeRunner?.state.done ?? 0;
  const total = activeRunner?.state.total ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const waiting = total === 0;

  const steps: Step[] = [];
  steps.push({ label: '抓取', status: active === 'sitemap' ? 'current' : 'done' });
  if (gscSelected) {
    steps.push({
      label: 'GSC',
      status: active === 'gsc' ? 'current' : active === 'sitemap' ? 'pending' : 'done',
      detail: active === 'gsc' ? `${orch.gsc.state.done}/${orch.gsc.state.total}` : undefined,
    });
  }
  if (bingSelected) {
    steps.push({
      label: 'Bing',
      status: active === 'bing' ? 'current' : 'pending',
      detail: active === 'bing' ? `${orch.bing.state.done}/${orch.bing.state.total}` : undefined,
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>
          提交中 {activeLabel}{total > 0 ? ` ${done}/${total}` : ''}
        </div>
        <Button variant="secondary" onClick={onCancel}>取消</Button>
      </div>

      <div style={{ height: 6, background: 'var(--color-canvas)', borderRadius: 3, overflow: 'hidden', marginBottom: 'var(--space-xs)' }}>
        <div data-testid="progress-fill" style={{ width: waiting ? '100%' : `${pct}%`, height: '100%', background: 'var(--color-primary)', opacity: waiting ? 0.35 : 1, transition: 'width 0.2s' }} />
      </div>

      <div style={{ display: 'flex', gap: 6, fontSize: 12, marginBottom: 'var(--space-sm)' }}>
        {steps.map((s, i) => (
          <span key={s.label} style={{ color: s.status === 'current' ? 'var(--color-primary)' : s.status === 'done' ? 'var(--color-success)' : 'var(--color-muted-soft)' }}>
            {s.label} {s.status === 'done' ? '✓' : s.status === 'current' ? `›${s.detail ? ` (${s.detail})` : ''}` : '·'}{i < steps.length - 1 ? ' →' : ''}
          </span>
        ))}
      </div>

      <UnifiedLogPanel logs={mergeLogs(orch.logs, orch.gsc.logs, orch.bing.logs)} />
    </div>
  );
}
