import { useState } from 'react';
import { useStore } from '../data/store';
import { clearPrefs } from '../hooks/usePersistentState';

export function Placeholder({ title, milestone, children }: { title: string; milestone: string; children: React.ReactNode }) {
  return (
    <div className="page"><h1>{title}</h1>
      <div className="callout"><span className="pill sim">Not built yet</span> Planned for {milestone}.</div>
      <p>{children}</p>
    </div>
  );
}

const REAL = [
  'General: add, rename, check/reopen, expandable steps, task date vs due date, filters, sorting, manual row order (drag or keyboard), column resizing',
  'Home: movable and resizable panels, show/hide secondary widgets, reset layout, focus mode, layouts and table widths remembered after restart',
  'Music: full releases vs selected-stage artist jobs, scope toggle, stage checklists, progress counted only for stages in scope',
  'Seround: brand grouping, brand filter, sundey content queue vs backend workstream, detail fields',
  'House: recurring bills with per-month paid state, missed months stay visible, editable reminder offset',
  'Today strip, Coming up, mini calendar, quick capture (General tasks), Ctrl+K search',
];
const SIM = [
  'All data: sample records stored in this browser only. Nothing reads or writes your Obsidian vault.',
  '“Open in Obsidian” builds the official link and shows it; it does not launch Obsidian.',
  'Reminders: the offset is saved, but no notification is delivered.',
  'Office Google Calendar and iPhone sync: not connected (planned).',
  'Repeat / reminder for General tasks, Note / Idea / Link / Meeting capture: shown as unavailable.',
];

export function SettingsPage() {
  const { resetSampleData } = useStore();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="page">
      <h1>Settings</h1>
      <div className="callout"><span className="pill sim">Prototype · Milestone 1</span> Sample data only. Your real vault is untouched and not connected.</div>
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
