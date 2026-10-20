import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import { accelerator, desktop, prettyKeys, type DesktopState } from '../lib/desktop';

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

/** Desktop-only settings: the show/hide shortcut, always on top, start with Windows, quit. */
export function DesktopSettings() {
  const [st, setSt] = useState<DesktopState | null>(null);
  const [recording, setRecording] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { desktop?.state().then(setSt); }, []);
  if (!desktop || !st) return null;
  return (
    <>
      <h4 className="ap-h">On the desktop</h4>
      <div className="desk-row">
        <span>Show / hide</span>
        <button className={`btn small keys${recording ? ' recording' : ''}`}
          onClick={() => { setRecording(true); setNote('Press the new keys (with Ctrl or Alt)…'); }}
          onBlur={() => { setRecording(false); setNote(''); }}
          onKeyDown={async (e) => {
            if (!recording) return;
            e.preventDefault(); e.stopPropagation();
            if (e.key === 'Escape') { setRecording(false); setNote(''); return; }
            const a = accelerator(e);
            if (!a) return;
            const next = await desktop!.set({ shortcut: a });
            setSt(next); setRecording(false);
            setNote(next.shortcut === a ? '' : `${prettyKeys(a)} is taken by another app. Kept ${prettyKeys(next.shortcut)}.`);
          }}>
          {recording ? 'Press keys…' : prettyKeys(st.shortcut)}
        </button>
        {!st.shortcutOk && !recording && <span className="warn-text">Another app already uses this. Pick other keys.</span>}
      </div>
      {note && <p className="quiet">{note}</p>}
      <label className="desk-row"><input type="checkbox" checked={st.alwaysOnTop} onChange={async (e) => setSt(await desktop!.set({ alwaysOnTop: e.target.checked }))} /> Always on top of other windows</label>
      <label className="desk-row"><input type="checkbox" checked={st.startWithWindows} onChange={async (e) => setSt(await desktop!.set({ startWithWindows: e.target.checked }))} /> Start with Windows (hidden until you press the keys)</label>
      <div className="row">
        <button className="btn small" onClick={() => desktop!.hide()}><Icon name="close" size={12} /> Hide now</button>
        <button className="btn small ghost" onClick={() => desktop!.quit()}>Quit Esther</button>
      </div>
      <p className="quiet">Esther has no taskbar button. Its icon in the tray (by the clock) has these too.</p>
    </>
  );
}
