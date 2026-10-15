import { useEffect, useRef } from 'react';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { cloud, cloudCfg, contextOf } from '../lib/cloud';
import { useApplyCapture } from '../lib/capture';

/**
 * When Esther cloud is set up: brings in what you sent from your phone (every 20 seconds while Esther is open and
 * visible, and right after you connect), and keeps the cloud's copy of your brands and projects current.
 */
export function useCloudSync() {
  const { data } = useStore();
  const { say } = useUi();
  const apply = useApplyCapture();
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const sayRef = useRef(say);
  sayRef.current = say;
  const ctx = JSON.stringify(contextOf(data));

  useEffect(() => {
    if (!cloudCfg()) return;
    const t = window.setTimeout(() => { cloud.pushContext(data).catch(() => { /* offline: try on the next change */ }); }, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  useEffect(() => {
    let busy = false;
    const tick = async () => {
      if (busy || !cloudCfg() || document.hidden) return;
      busy = true;
      try {
        const { rows } = await cloud.pull();
        for (const r of rows) applyRef.current(r.parsed, r.source === 'telegram' ? 'from your phone' : r.source);
        if (rows.length) sayRef.current(`${rows.length} capture${rows.length === 1 ? '' : 's'} from your phone came in.`, true);
      } catch { /* offline or not set up: try again later */ }
      busy = false;
    };
    void tick();
    const id = window.setInterval(tick, 20_000);
    const now = () => void tick();
    window.addEventListener('esther-cloud', now);
    document.addEventListener('visibilitychange', now);
    return () => { window.clearInterval(id); window.removeEventListener('esther-cloud', now); document.removeEventListener('visibilitychange', now); };
  }, []);
}
