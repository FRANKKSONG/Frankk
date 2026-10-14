import { useRef, useState } from 'react';
import { Icon, type IconName } from './Icons';
import { useStore } from '../data/store';
import { useUi } from '../ui';

const LATER: { id: string; label: string; icon: IconName }[] = [
  { id: 'note', label: 'Note', icon: 'note' }, { id: 'idea', label: 'Idea', icon: 'idea' },
  { id: 'link', label: 'Link', icon: 'link' }, { id: 'meeting', label: 'Meeting', icon: 'calendar' },
];

export function QuickCapture() {
  const { dispatch } = useStore();
  const { say } = useUi();
  const [text, setText] = useState('');
  const last = useRef({ text: '', at: 0 });

  const save = () => {
    const t = text.trim();
    if (!t) return;
    const now = Date.now();
    // A rapid double-click / double-Enter must not create the same task twice.
    if (last.current.text === t && now - last.current.at < 800) return;
    last.current = { text: t, at: now };
    dispatch({ type: 'task/add', title: t, area: 'general' });
    setText('');
    say('Added to General (sample data — nothing was written to your vault).');
  };

  return (
    <section className="capture" aria-label="Quick capture">
      <h3><Icon name="bolt" size={15} /> Quick capture</h3>
      <div className="capture-row">
        <input value={text} placeholder="Write a task…" aria-label="Quick capture text" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        <select aria-label="Category" defaultValue="general">
          <option value="general">General</option>
          <option disabled>Music — later</option><option disabled>Seround — later</option><option disabled>House — later</option>
        </select>
        <button className="btn primary square" aria-label="Save capture" onClick={save} disabled={!text.trim()}><Icon name="plus" /></button>
      </div>
      <div className="capture-types">
        <button className="type on" aria-pressed="true"><Icon name="tasks" size={14} /> Task</button>
        {LATER.map((t) => (
          <button key={t.id} className="type" disabled title="Not available yet — planned for a later milestone"><Icon name={t.icon} size={14} /> {t.label}</button>
        ))}
      </div>
      <p className="hint">Only General tasks can be captured for now. Other types are planned.</p>
    </section>
  );
}
