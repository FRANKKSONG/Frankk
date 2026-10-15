import { useEffect, useRef } from 'react';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { cloud, cloudCfg, contextOf } from '../lib/cloud';
import { useApplyCapture, useUndoCapture, type CaptureRef } from '../lib/capture';

const REFS = 'esther.captureRefs';
const loadRefs = (): Record<string, CaptureRef> => { try { return JSON.parse(localStorage.getItem(REFS) ?? '{}'); } catch { return {}; } };
const saveRefs = (r: Record<string, CaptureRef>) => { try { const keys = Object.keys(r).slice(-300); localStorage.setItem(REFS, JSON.stringify(Object.fromEntries(keys.map((k) => [k, r[k]])))); } catch { /* storage blocked */ } };

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
  const undo = useUndoCapture();
  const undoRef = useRef(undo);
  undoRef.current = undo;
  const sayRef = useRef(say);
  sayRef.current = say;
  const ctx = JSON.stringify(contextOf(data));

  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => {
    if (!cloudCfg()) return;
    const t = window.setTimeout(() => { cloud.pushContext(dataRef.current).catch(() => { /* offline: try on the next change */ }); }, 1500);
    return () => window.clearTimeout(t);
  }, [ctx]);
  // Right after you connect, share your brands and projects straight away (not only when they next change).
  useEffect(() => {
    const share = () => { if (cloudCfg()) cloud.pushContext(dataRef.current).catch(() => {}); };
    window.addEventListener('esther-cloud', share);
    return () => window.removeEventListener('esther-cloud', share);
  }, []);

  useEffect(() => {
    let busy = false;
    const tick = async () => {
      if (busy || !cloudCfg() || document.hidden) return;
      busy = true;
      try {
        const { rows } = await cloud.pull();
        const refs = loadRefs();
        let moved = 0;
        for (const r of rows) {
          // A re-file from Telegram: take back what the earlier capture made, then file it the new way.
          if (r.parsed.replaces) { const old = refs[r.parsed.replaces]; if (old) undoRef.current(old); moved++; }
          const { ref } = applyRef.current(r.parsed, r.parsed.replaces ? 'moved from your phone' : 'from your phone');
          refs[r.parsed.replaces ?? r.id] = ref;
          if (r.parsed.replaces) refs[r.id] = ref;
        }
        saveRefs(refs);
        const fresh = rows.length - moved;
        if (fresh) sayRef.current(`${fresh} capture${fresh === 1 ? '' : 's'} from your phone came in.`, true);
        if (moved) sayRef.current(`${moved} capture${moved === 1 ? '' : 's'} re-filed from your phone.`, true);
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
