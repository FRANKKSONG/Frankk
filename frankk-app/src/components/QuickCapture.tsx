import { useRef, useState } from 'react';
import { Icon, type IconName } from './Icons';
import { useStore } from '../data/store';
import { useUi } from '../ui';

const LATER: { id: string; label: string; icon: IconName }[] = [
  { id: 'note', label: 'Note', icon: 'note' }, { id: 'idea', label: 'Idea', icon: 'idea' },
  { id: 'link', label: 'Link', icon: 'link' }, { id: 'meeting', label: 'Meeting', icon: 'calendar' },
];

export function QuickCapture() {
  const { dispatch, data } = useStore();
  const [area, setArea] = useState<'general' | 'seround' | 'house'>('general');
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
    // "#tag" words become tags: "Call bank #money" -> task "Call bank" tagged money.
    const tags = (t.match(/#[\p{L}\p{N}_-]+/gu) ?? []).map((x) => x.slice(1));
    const title = t.replace(/#[\p{L}\p{N}_-]+/gu, '').replace(/\s+/g, ' ').trim() || t;
    dispatch({ type: 'task/add', title, area, extra: { tags, mode: 'simple', ...(area === 'seround' ? { brand: data.brands[0] } : {}) } });
    setText('');
    say(`Added to ${area === 'general' ? 'General' : area === 'house' ? 'House' : `Seround · ${data.brands[0]}`}.`, true);
  };

  return (
    <section className="capture" aria-label="Quick capture">
      <h3><Icon name="bolt" size={15} /> Quick capture</h3>
      <div className="capture-row">
        <input value={text} placeholder="Write a task… add #tags to tag it" aria-label="Quick capture text" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        <select aria-label="Category" value={area} onChange={(e) => setArea(e.target.value as typeof area)}>
          <option value="general">General</option>
          <option value="seround">Seround</option>
          <option value="house">House</option>
          <option disabled>Music — use + in Music</option>
        </select>
        <button className="btn primary square" aria-label="Save capture" onClick={save} disabled={!text.trim()}><Icon name="plus" /></button>
      </div>
      <div className="capture-types">
        <button className="type on" aria-pressed="true"><Icon name="tasks" size={14} /> Task</button>
        {LATER.map((t) => (
          <button key={t.id} className="type" disabled title="Not available yet — planned for a later milestone"><Icon name={t.icon} size={14} /> {t.label}</button>
        ))}
      </div>
      <p className="hint">Tasks only for now. Notes, ideas, links and meetings are planned.</p>
    </section>
  );
}
