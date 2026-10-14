import { useRef, useState } from 'react';
import { Icon, type IconName } from './Icons';
import { useStore } from '../data/store';
import { Drollery } from './Ornaments';
import { DateCell } from './DateCell';
import { TagChips } from './Tags';
import { useUi } from '../ui';
import type { TaskArea } from '../data/types';

const AREAS: { id: TaskArea; label: string; icon: IconName }[] = [
  { id: 'general', label: 'General', icon: 'check' },
  { id: 'seround', label: 'Seround', icon: 'seround' },
  { id: 'house', label: 'House', icon: 'house' },
];

const LATER: { id: string; label: string; icon: IconName }[] = [
  { id: 'note', label: 'Note', icon: 'note' }, { id: 'idea', label: 'Idea', icon: 'idea' },
  { id: 'link', label: 'Link', icon: 'link' }, { id: 'meeting', label: 'Meeting', icon: 'calendar' },
];

const TAG_RE = /#[\p{L}\p{N}_-]+/gu;

export function QuickCapture({ bare }: { bare?: boolean }) {
  const { dispatch, data } = useStore();
  const { say, setProjectDialog } = useUi();
  const [area, setArea] = useState<TaskArea>('general');
  const [brand, setBrand] = useState(data.brands[0] ?? '');
  const [due, setDue] = useState<string | undefined>();
  const [checklist, setChecklist] = useState(false);
  const [text, setText] = useState('');
  const last = useRef({ text: '', at: 0 });

  // One task per line, so a pasted list becomes a list of tasks.
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const tagsIn = [...new Set((text.match(TAG_RE) ?? []).map((x) => x.slice(1)))];

  const save = () => {
    const t = text.trim();
    if (!t) return;
    const now = Date.now();
    // A rapid double-click / double-Enter must not create the same tasks twice.
    if (last.current.text === t && now - last.current.at < 800) return;
    last.current = { text: t, at: now };
    for (const line of lines) {
      // "#tag" words become tags: "Call bank #money" -> task "Call bank" tagged money.
      const tags = (line.match(TAG_RE) ?? []).map((x) => x.slice(1));
      const title = line.replace(TAG_RE, '').replace(/\s+/g, ' ').trim() || line;
      dispatch({ type: 'task/add', title, area, extra: { tags, mode: checklist ? 'progress' : 'simple', due, ...(area === 'seround' ? { brand } : {}) } });
    }
    setText('');
    const where = area === 'general' ? 'General' : area === 'house' ? 'House' : `Seround · ${brand}`;
    say(`${lines.length > 1 ? `${lines.length} tasks` : 'Task'} added to ${where}.`, true);
  };

  return (
    <section className={`capture${bare ? ' bare' : ''}`} aria-label="Quick capture">
      {!bare && <h3><Icon name="bolt" size={15} /> Quick capture</h3>}

      <div className="qc-areas" role="radiogroup" aria-label="Category">
        {AREAS.map((a) => (
          <button key={a.id} type="button" role="radio" aria-checked={area === a.id} className={`qc-area area-${a.id}`} onClick={() => setArea(a.id)}>
            <Icon name={a.icon} size={15} /> {a.label}
          </button>
        ))}
        <button type="button" className="qc-area area-music" title="Music work is a project with stages: opens New project" onClick={() => setProjectDialog(true)}>
          <Icon name="music" size={15} /> Music…
        </button>
      </div>

      <div className="qc-write">
        <textarea value={text} aria-label="Quick capture text" spellCheck
          placeholder={'Write a task… add #tags to tag it\nShift+Enter for a new line: one task per line'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } }} />
        {tagsIn.length > 0 && <div className="qc-tags"><TagChips names={tagsIn} small /></div>}
      </div>

      <div className="qc-bar">
        {area === 'seround' && (
          <select className="qc-brand" aria-label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
            {data.brands.map((b) => <option key={b}>{b}</option>)}
          </select>
        )}
        <DateCell kind="due" label="Due date for captured task" placeholder="Due date" value={due} onChange={setDue} />
        <label className="qc-toggle" title="Off: a simple to-do. On: a checklist with a progress bar.">
          <input type="checkbox" checked={checklist} onChange={(e) => setChecklist(e.target.checked)} /> Checklist
        </label>
        <span className="qc-later" title="Notes, ideas, links and meetings are planned for a later milestone">
          {LATER.map((t) => <Icon key={t.id} name={t.icon} size={13} aria-label={`${t.label} (planned)`} />)}
        </span>
        <button className="btn primary qc-save" aria-label="Save capture" onClick={save} disabled={!lines.length}>
          <Icon name="plus" size={14} /> {lines.length > 1 ? `Add ${lines.length}` : 'Add'}
        </button>
      </div>
      {!bare && <Drollery className="capture-drollery" />}
    </section>
  );
}
