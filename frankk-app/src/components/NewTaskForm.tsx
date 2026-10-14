import { useState } from 'react';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { BRANDS, type Task, type TaskArea } from '../data/types';

/** Inline "new task" form: name, optional steps (one per line), task date, due date. */
export function NewTaskForm({ area, brand, onDone }: { area: TaskArea; brand?: string; onDone: () => void }) {
  const { dispatch } = useStore();
  const { say } = useUi();
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState('');
  const [plan, setPlan] = useState('');
  const [due, setDue] = useState('');
  const [b, setB] = useState(brand ?? BRANDS[0]);
  const [ws, setWs] = useState<NonNullable<Task['workstream']>>('content');

  const submit = () => {
    if (!title.trim()) return;
    const extra: Partial<Task> = {
      plan: plan || undefined, due: due || undefined,
      steps: steps.split('\n').map((s) => s.trim()).filter(Boolean).map((text, i) => ({ id: `n${Date.now().toString(36)}${i}`, text, done: false })),
    };
    if (area === 'seround') {
      extra.brand = b;
      if (b === BRANDS[0]) extra.workstream = ws;
    }
    dispatch({ type: 'task/add', title, area, extra });
    say('Task added (sample data — nothing was written to your vault).');
    onDone();
  };

  return (
    <form className="new-form" onSubmit={(e) => { e.preventDefault(); submit(); }} onKeyDown={(e) => { if (e.key === 'Escape') onDone(); }}>
      <input autoFocus placeholder="Task name" aria-label="Task name" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea placeholder="Steps, one per line (optional)" aria-label="Steps" rows={2} value={steps} onChange={(e) => setSteps(e.target.value)} />
      <div className="form-row">
        <label>Task date<input type="date" value={plan} onChange={(e) => setPlan(e.target.value)} /></label>
        <label>Due date<input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
      </div>
      {area === 'seround' && (
        <div className="form-row">
          <label>Brand<select value={b} onChange={(e) => setB(e.target.value)}>{BRANDS.map((x) => <option key={x}>{x}</option>)}</select></label>
          {b === BRANDS[0] && (
            <label>Workstream<select value={ws} onChange={(e) => setWs(e.target.value as typeof ws)}>
              <option value="content">Content queue</option><option value="backend">Backend development</option>
            </select></label>
          )}
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn primary" disabled={!title.trim()}>Save task</button>
      </div>
    </form>
  );
}
