import { useState } from 'react';
import { AppearancePanel } from '../components/Appearance';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import type { ThemePrefs } from '../lib/theme';

export function SettingsPage({ theme, setTheme }: { theme: ThemePrefs; setTheme: (t: ThemePrefs) => void }) {
  const { data, startFresh } = useStore();
  const { say } = useUi();
  const [sure, setSure] = useState(false);
  const exportCopy = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `esther-tasks-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="page settings">
      <h1>Settings</h1>
      <section className="card">
        <h2>Appearance</h2>
        <AppearancePanel prefs={theme} setPrefs={setTheme} />
      </section>
      <section className="card">
        <h2>Your tasks</h2>
        <p>{data.lists.length} list{data.lists.length === 1 ? '' : 's'} and {data.tasks.length} task{data.tasks.length === 1 ? '' : 's'}, saved in this browser on this PC. Another browser or device starts its own copy.</p>
        <div className="row">
          <button className="btn" onClick={exportCopy}>Save a copy (.json)</button>
          {!sure
            ? <button className="btn ghost" onClick={() => setSure(true)}>Start fresh…</button>
            : <span className="confirm-inline">Delete every list and task and start with the sample? <button className="btn danger" onClick={() => { startFresh(); setSure(false); say('Started fresh.', true); }}>Yes, start fresh</button><button className="btn ghost" onClick={() => setSure(false)}>Cancel</button></span>}
        </div>
      </section>
    </div>
  );
}
