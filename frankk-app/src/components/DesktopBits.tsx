import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import { accelerator, desktop, prettyKeys, type DesktopState, type Layer } from '../lib/desktop';

const LAYERS: { id: Layer; label: string; hint: string }[] = [
  { id: 'desktop', label: 'On the desktop', hint: 'Under all your windows, like a Rainmeter skin. The shortcut brings it to the front until you click elsewhere.' },
  { id: 'normal', label: 'Like a window', hint: 'Comes to the front when you click it, like any app.' },
  { id: 'top', label: 'Always on top', hint: 'Stays above every other window.' },
];

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

/** Desktop-only settings: the show/hide shortcut, where the window sits, start with Windows, quit. */
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
      <div className="desk-row">
        <span>Sits</span>
        <span className="seg" role="radiogroup" aria-label="Where Esther sits">
          {LAYERS.map((l) => <button key={l.id} role="radio" aria-checked={st.layer === l.id} title={l.hint} onClick={async () => setSt(await desktop!.set({ layer: l.id }))}>{l.label}</button>)}
        </span>
      </div>
      <p className="quiet">{LAYERS.find((l) => l.id === st.layer)!.hint}{st.layer === 'desktop' && !st.pinsToDesktop ? ' (Pinning under other windows works on Windows only.)' : ''}</p>
      <label className="desk-row"><input type="checkbox" checked={st.startWithWindows} onChange={async (e) => setSt(await desktop!.set({ startWithWindows: e.target.checked }))} /> Start with Windows (hidden until you press the keys)</label>
      <div className="row">
        <button className="btn small" onClick={() => desktop!.hide()}><Icon name="close" size={12} /> Hide now</button>
        <button className="btn small ghost" onClick={() => desktop!.quit()}>Quit Esther</button>
      </div>
      <p className="quiet">Esther has no taskbar button. Its icon in the tray (by the clock) has these too.</p>
    </>
  );
}
