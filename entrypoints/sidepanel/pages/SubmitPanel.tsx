import { useEffect, useRef, useState } from 'react';
import Button from '../components/Button';
import TextInput from '../components/TextInput';
import LogPanel from '../components/LogPanel';
import PlatformChip from '../components/PlatformChip';
import { IconBack, GscMark, BingMark } from '../components/icons';
import { useSubmitOrchestrator } from '../hooks/useSubmitOrchestrator';
import { isValidDomain } from '@lib/storage/projects';
import { normalizeOrigin } from '@lib/seo-files/url';
import { classifyResult } from '@lib/submit/reasons';
import type { Site } from '../hooks/useSite';

function defaultSitemapUrl(domain: string): string {
  try { return `${normalizeOrigin(domain)}/sitemap.xml`; } catch { return ''; }
}

export default function SubmitPanel({ site, onBack }: { site: Site; onBack: () => void }) {
  const orch = useSubmitOrchestrator();
  const [sitemapUrl, setSitemapUrl] = useState(() => defaultSitemapUrl(site.domain));
  const [gsc, setGsc] = useState(true);
  const [bing, setBing] = useState(true);
  const [error, setError] = useState('');
  const dirtyRef = useRef(false);

  // domain 变化时重置默认值（除非用户手改过）
  useEffect(() => {
    if (!dirtyRef.current) setSitemapUrl(defaultSitemapUrl(site.domain));
  }, [site.domain]);

  const busy = orch.gsc.state.running || orch.bing.state.running || orch.active === 'sitemap';
  const ready = (gsc || bing) && !busy;

  function submit() {
    if (!isValidDomain(site.domain)) { setError('请先选择或填写有效网站（如 example.com）'); return; }
    if (!sitemapUrl.trim()) { setError('请填写站点地图 URL（如 https://example.com/sitemap.xml）'); return; }
    setError('');
    void orch.run({ gsc, bing }, site.domain.trim(), sitemapUrl.trim());
  }

  const successes = orch.report.filter((r) => classifyResult(r) === 'ok');
  const failures = orch.report.filter((r) => classifyResult(r) === 'failed');
  const skips = orch.report.filter((r) => classifyResult(r) === 'skipped');

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <button type="button" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: 0 }}>
        <IconBack size={14} /> 返回
      </button>
      <h2 style={{ fontSize: 17, marginBottom: 'var(--space-md)' }}>网站提交</h2>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>目标平台</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-md)' }}>
        <PlatformChip label="GSC" icon={<GscMark />} checked={gsc} onToggle={() => setGsc((v) => !v)} />
        <PlatformChip label="Bing" icon={<BingMark />} checked={bing} onToggle={() => setBing((v) => !v)} />
      </div>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>站点地图（sitemap.xml）</label>
      <TextInput value={sitemapUrl} placeholder="https://example.com/sitemap.xml" onChange={(e) => { dirtyRef.current = true; setSitemapUrl(e.target.value); }} />

      {error && <div style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 6 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-md)' }}>
        <Button onClick={submit} disabled={!ready} style={{ flex: 1 }}>{busy ? '提交中…' : '一次提交'}</Button>
        {busy && <Button variant="secondary" onClick={orch.cancel}>取消</Button>}
      </div>

      <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {orch.logs.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>▍系统</div>
            <LogPanel logs={orch.logs} />
          </div>
        )}
        {(gsc || orch.gsc.logs.length > 0) && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>▍GSC{orch.gsc.state.total > 0 ? `  ${orch.gsc.state.done}/${orch.gsc.state.total}` : ''}</div>
            <LogPanel logs={orch.gsc.logs} />
          </div>
        )}
        {(bing || orch.bing.logs.length > 0) && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>▍Bing{orch.bing.state.total > 0 ? `  ${orch.bing.state.done}/${orch.bing.state.total}` : ''}</div>
            <LogPanel logs={orch.bing.logs} />
          </div>
        )}
      </div>

      {orch.report.length > 0 && (
        <div style={{ marginTop: 'var(--space-md)', fontSize: 12, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            本批 {orch.report.length} 个 · 成功 {successes.length} · 失败 {failures.length} · 跳过 {skips.length}
          </div>
          {failures.length > 0 && (
            <div style={{ color: 'var(--color-error)', marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>失败：</div>
              {failures.map((r) => (<div key={`${r.platform}-${r.url}`}>· {r.url}（{r.platform}{r.reason ? `：${r.reason}` : ''}）</div>))}
            </div>
          )}
          {successes.length > 0 && (
            <div style={{ color: 'var(--color-muted)' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>成功：</div>
              {successes.map((r) => (<div key={`${r.platform}-${r.url}`}>· {r.url}（{r.platform}）</div>))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
