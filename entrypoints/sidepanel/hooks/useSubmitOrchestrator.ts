import { useCallback, useState } from 'react';
import { useGscRunner } from './useGscRunner';
import { useBingRunner } from './useBingRunner';

export interface Platforms { gsc: boolean; bing: boolean; }

export function useSubmitOrchestrator() {
  const gsc = useGscRunner();
  const bing = useBingRunner();
  const [active, setActive] = useState<'gsc' | 'bing' | null>(null);

  const run = useCallback(async (platforms: Platforms, domain: string, urls: string[]) => {
    if (platforms.gsc) {
      setActive('gsc');
      try { await gsc.start(domain, urls); } catch { /* 某平台失败不中断后续 */ }
    }
    if (platforms.bing) {
      setActive('bing');
      try { await bing.start(domain, urls); } catch { /* 同上 */ }
    }
    setActive(null);
  }, [gsc, bing]);

  const cancel = useCallback(() => { gsc.cancel(); bing.cancel(); }, [gsc, bing]);

  return { gsc, bing, active, run, cancel };
}
