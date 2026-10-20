import { useEffect, useState } from 'react';
import { desktop, type UpdateStatus } from '../lib/desktop';


/** Bottom-right corner: drag to resize the card (Esther resizes it itself, on the grid). Shows on hover. */
export function ResizeGrip() {
  if (!desktop) return null;
  return (
    <div className="resize-grip" title="Drag to resize" aria-hidden="true"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        desktop!.track('resize', 'start');
        const end = () => { desktop!.track('resize', 'end'); el.removeEventListener('pointerup', end); el.removeEventListener('lostpointercapture', end); };
        el.addEventListener('pointerup', end);
        el.addEventListener('lostpointercapture', end);
      }} />
  );
}

/** The update status, live. */
export function useUpdates(): UpdateStatus | null {
  const [st, setSt] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    if (!desktop?.updates) return;
    desktop.updates.status().then(setSt);
    return desktop.updates.on(setSt);
  }, []);
  return st;
}

/** Top bar: appears only when a new version has downloaded (or is downloading). */
export function UpdatePill() {
  const st = useUpdates();
  if (!st || (st.state !== 'ready' && st.state !== 'downloading')) return null;
  if (st.state === 'downloading') return <span className="update-pill quiet" title={`Downloading Esther ${st.next ?? ''}`}>Updating… {st.percent ?? 0}%</span>;
  return <button className="update-pill" onClick={() => desktop!.updates.install()} title="Esther closes, installs the new version and opens again (a few seconds)">Restart to update to {st.next}</button>;
}
