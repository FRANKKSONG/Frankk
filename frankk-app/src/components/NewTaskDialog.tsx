import { useState } from 'react';
import { Modal } from './Modal';
import { TagChips, TagPicker } from './Tags';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { monthKey } from '../lib/dates';
import type { Priority, Task, TaskArea } from '../data/types';

const AREAS: { id: TaskArea; label: string }[] = [{ id: 'general', label: 'General' }, { id: 'seround', label: 'Seround' }, { id: 'house', label: 'House' }];

/** The full "new" window: asks for everything up front. */
export function NewTaskDialog() {
  const { newTask, setNewTask } = useUi();
  if (!newTask) return null;
  return <Dialog key={`${newTask.area}${newTask.brand}`} initial={newTask} onClose={() => setNewTask(null)} />;
}

function Dialog({ initial, onClose }: { initial: { area: TaskArea; brand?: string }; onClose: () => void }) {
  const { dispatch, data, today } = useStore();
  const { say } = useUi();
  const [kind, setKind] = useState<'task' | 'bill'>('task');
  const [area, setArea] = useState<TaskArea>(initial.area);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<Task['mode']>('progress');
  const [steps, setSteps] = useState('');
  const [plan, setPlan] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [list, setList] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [brand, setBrand] = useState(initial.brand ?? data.brands[0] ?? '');
  const [ws, setWs] = useState<Task['workstream'] | ''>('');
  const [dueDay, setDueDay] = useState(1);
  const [remind, setRemind] = useState(2);

  const submit = () => {
    if (!title.trim()) return;
    if (kind === 'bill') {
      dispatch({ type: 'bill/add', title, dueDay, reminderDays: remind, start: monthKey(today) });
      say(`Recurring bill “${title.trim()}” added.`, true);
      onClose();
      return;
    }
    const extra: Partial<Task> = {
      mode, plan: plan || undefined, due: due || undefined, priority, list: list.trim() || undefined, tags, notes: notes.trim() || undefined,
      steps: mode === 'progress' ? steps.split('\n').map((s) => s.trim()).filter(Boolean).map((text, i) => ({ id: `n${Date.now().toString(36)}${i}`, text, done: false })) : [],
    };
    if (area === 'seround') { extra.brand = brand; if (ws) extra.workstream = ws; }
    dispatch({ type: 'task/add', title, area, extra });
    say(`“${title.trim()}” added to ${AREAS.find((a) => a.id === area)!.label}.`, true);
    onClose();
  };

  return (
    <Modal title={kind === 'bill' ? 'New recurring bill' : 'New task'} onClose={onClose} wide>
      <form className="dialog-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {area === 'house' && (
          <div className="seg" role="radiogroup" aria-label="What to add">
            <button type="button" role="radio" aria-checked={kind === 'task'} onClick={() => setKind('task')}>Task<small>Something to do</small></button>
            <button type="button" role="radio" aria-checked={kind === 'bill'} onClick={() => setKind('bill')}>Recurring bill<small>Monthly, paid per month</small></button>
          </div>
        )}
        <label className="field big">{kind === 'bill' ? 'Bill name' : 'Name'}
          <input id="nt-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'bill' ? 'e.g. Gas bill' : 'What needs doing?'} />
        </label>

        {kind === 'bill' ? (
          <div className="form-row">
            <label className="field">Due day each month<input id="nt-dueday" type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))} /></label>
            <label className="field">Remind me
              <select id="nt-remind" value={remind} onChange={(e) => setRemind(Number(e.target.value))}>{[0, 1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n === 0 ? 'On the day' : `${n} days before`}</option>)}</select>
            </label>
          </div>
        ) : (
          <>
            <div className="form-row three">
              <label className="field">Area
                <select id="nt-area" value={area} onChange={(e) => setArea(e.target.value as TaskArea)}>{AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
              </label>
              {area === 'seround' && (
                <>
                  <label className="field">Brand<select id="nt-brand" value={brand} onChange={(e) => setBrand(e.target.value)}>{data.brands.map((b) => <option key={b}>{b}</option>)}</select></label>
                  <label className="field">Workstream
                    <select id="nt-ws" value={ws} onChange={(e) => { const v = e.target.value as typeof ws; setWs(v); if (v === 'content') setMode('simple'); }}>
                      <option value="">—</option><option value="content">Repost queue</option><option value="backend">Backend</option><option value="brand">Brand work</option>
                    </select>
                  </label>
                </>
              )}
            </div>
            <div className="seg" role="radiogroup" aria-label="Type">
              <button type="button" role="radio" aria-checked={mode === 'simple'} onClick={() => setMode('simple')}>Simple to-do<small>Just tick it off</small></button>
              <button type="button" role="radio" aria-checked={mode === 'progress'} onClick={() => setMode('progress')}>With steps<small>Checklist and progress bar</small></button>
            </div>
            {mode === 'progress' && (
              <label className="field">Steps <small>one per line</small>
                <textarea id="nt-steps" rows={3} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={'Empty box\nWash & dry\nPut away'} />
              </label>
            )}
            <div className="form-row four">
              <label className="field">Task date <small>when I’ll do it</small><input id="nt-plan" type="date" value={plan} onChange={(e) => setPlan(e.target.value)} /></label>
              <label className="field">Due date <small>deadline</small><input id="nt-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
              <label className="field">Priority
                <select id="nt-prio" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select>
              </label>
              <label className="field">List<input id="nt-list" value={list} onChange={(e) => setList(e.target.value)} placeholder="Optional" /></label>
            </div>
            <div className="field">Tags
              <span className="tag-line"><TagChips names={tags} /><TagPicker value={tags} onChange={setTags} label="Add tags" /></span>
            </div>
            <label className="field">Notes<textarea id="nt-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember (optional)" /></label>
          </>
        )}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!title.trim()}>{kind === 'bill' ? 'Add bill' : 'Add task'}</button>
        </div>
      </form>
    </Modal>
  );
}
