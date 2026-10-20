import { useState } from 'react';
import type { Data } from '../data/model';
import { Icon } from './Icons';
import { Popover } from './Popover';
import { AppearancePanel } from './Appearance';
import { DesktopSettings } from './DesktopBits';
import { useRef } from 'react';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import type { ThemePrefs } from '../lib/theme';

/** Settings in one menu: the look, and your saved tasks. */
export function SettingsMenu({ theme, setTheme }: { theme: ThemePrefs; setTheme: (t: ThemePrefs) => void }) {
  const { data, dispatch, startFresh } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const { say } = useUi();
  const [sure, setSure] = useState(false);
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
    <Popover align="right" className="wide-pop settings-pop" trigger={({ toggle, ref, open }) => (
      <button ref={ref} className="icon-btn" aria-label="Settings" title="Settings" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}><Icon name="settings" size={18} /></button>
    )}>
      {() => (
        <div className="settings">
          <DesktopSettings />
          <AppearancePanel prefs={theme} setPrefs={setTheme} />
          <h4 className="ap-h">Your tasks</h4>
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
      )}
    </Popover>
  );
}
