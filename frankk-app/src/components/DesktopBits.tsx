import { useEffect, useRef, useState } from 'react';
import { desktop, type UpdateStatus } from '../lib/desktop';


/** Bottom-right grip: drag to resize the desktop window (transparent windows can't be resized from their edges). */
export function ResizeGrip() {
  const start = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  if (!desktop) return null;
  return (
    <div className="resize-grip" title="Drag to resize" aria-hidden="true"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.screenX, y: e.screenY, w: window.innerWidth, h: window.innerHeight }; }}
      onPointerMove={(e) => { const s = start.current; if (s) desktop!.size(s.w + e.screenX - s.x, s.h + e.screenY - s.y); }}
      onPointerUp={() => { start.current = null; }} />
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
