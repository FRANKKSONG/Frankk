import { useState } from 'react';
import { useStore } from '../data/store';
import { clearPrefs } from '../hooks/usePersistentState';
import { AppearancePanel } from './Appearance';
import { Editable } from './Editable';
import type { ThemePrefs } from '../lib/theme';

export function Placeholder({ title, milestone, children }: { title: string; milestone: string; children: React.ReactNode }) {
  return (
    <div className="page"><h1>{title}</h1>
      <div className="callout"><span className="pill sim">Not built yet</span> Planned for {milestone}.</div>
      <p>{children}</p>
    </div>
  );
}

const REAL = [
  'Tasks: simple to-dos or checklists with progress, click-to-edit, tags, notes, priority, lists, task date vs due date, filters, sorting, drag to reorder, resizable columns, undo',
  'Home: movable and resizable panels, show/hide secondary widgets, reset layout, focus mode, layouts and table widths remembered after restart',
  'Music: own releases with a step bar (Concept → … → Art (Design)), separate tracks for Marketing/MV, artist jobs counting only my stages',
  'Seround: brands with colours (add/rename), simple repost queue, workstreams',
  'House: recurring bills with per-month paid state, missed months stay visible, editable reminder offset',
  'Today strip, Coming up, mini calendar, quick capture (General tasks), Ctrl+K search',
];
const SIM = [
  'All data: sample records stored in this browser only. Nothing reads or writes your Obsidian vault.',
  '“Open in Obsidian” builds the official link and shows it; it does not launch Obsidian.',
  'Reminders: the offset is saved, but no notification is delivered.',
  'Office Google Calendar and iPhone sync: not connected (planned).',
  'Repeat / reminder on tasks, Note / Idea / Link / Meeting capture: shown as unavailable.',
];

export function SettingsPage({ theme, setTheme }: { theme: ThemePrefs; setTheme: (t: ThemePrefs) => void }) {
  const { resetSampleData, data, dispatch } = useStore();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="page">
      <h1>Settings</h1>
      <div className="callout"><span className="pill sim">Prototype · Milestone 1</span> Sample data only. Your real vault is untouched and not connected.</div>
      <h2>Appearance</h2>
      <AppearancePanel prefs={theme} setPrefs={setTheme} />
      <h2>Tags</h2>
      <p className="hint">Click a name to rename it everywhere. Click a swatch to change its colour.</p>
      <div className="tag-admin">
        {data.tags.map((t) => (
          <span key={t.name} className="tag-admin-row" style={{ '--tag': t.color } as React.CSSProperties}>
            <label className="brand-swatch"><input type="color" aria-label={`Colour for ${t.name}`} value={t.color} onChange={(e) => dispatch({ type: 'tag/update', name: t.name, patch: { color: e.target.value } })} /></label>
            <span className="hash">#</span><Editable label="Tag name" value={t.name} onSave={(v) => dispatch({ type: 'tag/update', name: t.name, patch: { name: v } })} />
            <span className="muted">{data.tasks.filter((x) => x.tags.includes(t.name)).length + data.projects.filter((x) => x.tags.includes(t.name)).length}</span>
          </span>
        ))}
      </div>
      <h2>Working today</h2><ul className="plain">{REAL.map((r) => <li key={r}>{r}</li>)}</ul>
      <h2>Simulated or unavailable</h2><ul className="plain">{SIM.map((r) => <li key={r}>{r}</li>)}</ul>
      <h2>Reset</h2>
      <div className="form-actions left">
        {confirming ? (
          <>
            <span>Replace your changes with the original sample set?</span>
            <button className="btn primary" onClick={() => { resetSampleData(); setConfirming(false); }}>Yes, reset</button>
            <button className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button>
          </>
        ) : <button className="btn" onClick={() => setConfirming(true)}>Reset sample data</button>}
        <button className="btn" onClick={() => { clearPrefs(); location.reload(); }}>Reset layout and table widths</button>
      </div>
    </div>
  );
}
