import { useState } from 'react';
import type { Data } from '../data/model';
import { CLEAR_CHOICES } from '../data/storage';
import { usePersistentState } from '../hooks/usePersistentState';
import { Icon } from './Icons';
import { Popover } from './Popover';
import { AppearancePanel } from './Appearance';
import { DesktopSettings } from './DesktopBits';
import { useRef } from 'react';
import { desktop } from '../lib/desktop';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import type { ThemePrefs } from '../lib/theme';

/** The gear: on the website a menu; in the desktop app it opens the Settings card. */
export function SettingsMenu({ theme, setTheme }: { theme: ThemePrefs; setTheme: (t: ThemePrefs) => void }) {
  const gear = (p: { onClick: () => void; open?: boolean; ref?: React.Ref<HTMLButtonElement> }) => (
    <button ref={p.ref} className="icon-btn" aria-label="Settings" title="Settings" aria-haspopup="dialog" aria-expanded={!!p.open} onClick={p.onClick}><Icon name="settings" size={18} /></button>
  );
  if (desktop) return gear({ onClick: () => desktop!.openSettings() });
  return (
    <Popover align="right" className="wide-pop settings-pop" trigger={({ toggle, ref, open }) => gear({ onClick: toggle, open, ref })}>
      {() => <SettingsPanel theme={theme} setTheme={setTheme} />}
    </Popover>
  );
}

/** Settings: the look, the desktop, and your saved tasks. */
export function SettingsPanel({ theme, setTheme }: { theme: ThemePrefs; setTheme: (t: ThemePrefs) => void }) {
  const { data, dispatch, startFresh } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const { say } = useUi();
  const [sure, setSure] = useState(false);
  const [clearAfter, setClearAfter] = usePersistentState<number>('clearAfter', 7);
  const exportCopy = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `esther-tasks-${new Date().toISOString().slice(0, 10)}.json` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importCopy = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as Data;
      if (!Array.isArray(d?.lists) || !d.lists.length || !Array.isArray(d.tasks)) throw new Error('not Esther');
      dispatch({ type: 'replace', data: { version: 1, lists: d.lists, tasks: d.tasks.map((t) => ({ ...t, subtasks: t.subtasks ?? [] })) } });
      say(`Loaded ${d.tasks.length} task${d.tasks.length === 1 ? '' : 's'} in ${d.lists.length} list${d.lists.length === 1 ? '' : 's'}.`, true);
    } catch { say('That file isn’t a copy saved from Esther.'); }
  };
  return (
        <div className="settings">
          <DesktopSettings />
          <AppearancePanel prefs={theme} setPrefs={setTheme} />
          <h4 className="ap-h">Your tasks</h4>
          <label className="desk-row">Finished tasks stay crossed out, then clear
            <select value={clearAfter} aria-label="When finished tasks clear" onChange={(e) => setClearAfter(Number(e.target.value))}>
              {CLEAR_CHOICES.map((c) => <option key={c.days} value={c.days}>{c.label.toLowerCase()}</option>)}
            </select>
          </label>
          <p className="quiet">{data.lists.length} list{data.lists.length === 1 ? '' : 's'}, {data.tasks.length} task{data.tasks.length === 1 ? '' : 's'}, saved on this PC. “Load a copy” replaces them with a saved copy (Ctrl+Z undoes). Esther {__ESTHER_BUILD__}.</p>
          <div className="row">
            <button className="btn small" onClick={exportCopy}>Save a copy (.json)</button>
            <button className="btn small" onClick={() => fileRef.current?.click()}>Load a copy…</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importCopy(f); e.target.value = ''; }} />
            {!sure
              ? <button className="btn small ghost" onClick={() => setSure(true)}>Start fresh…</button>
              : <><button className="btn small danger" onClick={() => { startFresh(); setSure(false); say('Started fresh.', true); }}>Yes, delete everything</button><button className="btn small ghost" onClick={() => setSure(false)}>Cancel</button></>}
          </div>
        </div>
  );
}
