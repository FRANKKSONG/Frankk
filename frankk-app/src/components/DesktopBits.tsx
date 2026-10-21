import { useEffect, useState } from 'react';
import { desktop, type Edge, type UpdateStatus } from '../lib/desktop';


const EDGES: Edge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/**
 * Resize a card from any edge or corner (Esther resizes it itself, with the grid and guides showing).
 * Alt resizes from the centre, Shift keeps the proportions, Shift+Alt does both, like Illustrator.
 * A small corner line at the bottom right shows on hover, as a hint.
 */
export function ResizeGrip() {
  if (!desktop) return null;
  return (
    <>
      {EDGES.map((edge) => (
        <div key={edge} className={`edge edge-${edge}`} aria-hidden="true"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation(); e.preventDefault();
            const el = e.currentTarget;
            el.setPointerCapture(e.pointerId);
            desktop!.trackMods(e.shiftKey, e.altKey);
            desktop!.track('resize', 'start', edge);
            const keys = (k: KeyboardEvent | PointerEvent) => desktop!.trackMods(k.shiftKey, k.altKey);
            const end = () => {
              desktop!.track('resize', 'end');
              el.removeEventListener('pointerup', end); el.removeEventListener('lostpointercapture', end); el.removeEventListener('pointermove', keys);
              window.removeEventListener('keydown', keys); window.removeEventListener('keyup', keys);
            };
            el.addEventListener('pointerup', end);
            el.addEventListener('lostpointercapture', end);
            el.addEventListener('pointermove', keys);
            window.addEventListener('keydown', keys); window.addEventListener('keyup', keys);
          }} />
      ))}
      <div className="resize-grip" aria-hidden="true" />
    </>
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
