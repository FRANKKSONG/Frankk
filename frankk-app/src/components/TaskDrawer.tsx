import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { checklistProgress } from '../lib/progress';
import { TagChips, TagPicker } from './Tags';
import type { ContentInfo, Task } from '../data/types';

/** Detail drawer. Field edits are a draft with Save/Cancel; ticking steps or completing applies immediately. */
export function TaskDrawer() {
  const { data } = useStore();
  const { drawerTaskId, openTask } = useUi();
  const task = data.tasks.find((t) => t.id === drawerTaskId);
  if (!task) return null;
  return createPortal(<DrawerBody key={task.id} task={task} onClose={() => openTask(null)} />, document.body);
}

function DrawerBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const { dispatch, data } = useStore();
  const { openNote, say } = useUi();
  const [d, setD] = useState({ title: task.title, plan: task.plan ?? '', due: task.due ?? '', priority: task.priority, list: task.list ?? '', brand: task.brand ?? '', workstream: task.workstream ?? '', notes: task.notes ?? '' });
  const [c, setC] = useState<ContentInfo>(task.content ?? {});
  const [step, setStep] = useState('');
  const ref = useRef<HTMLElement>(null);
  const prog = checklistProgress(task.steps);
  const dirty = d.title !== task.title || d.plan !== (task.plan ?? '') || d.due !== (task.due ?? '') || d.priority !== task.priority
    || d.list !== (task.list ?? '') || d.notes !== (task.notes ?? '') || d.brand !== (task.brand ?? '') || d.workstream !== (task.workstream ?? '') || JSON.stringify(c) !== JSON.stringify(task.content ?? {});

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLInputElement>('input')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);

  const save = () => {
    dispatch({
      type: 'task/update', id: task.id,
      patch: {
        title: d.title, plan: d.plan || undefined, due: d.due || undefined, priority: d.priority, list: d.list || undefined, notes: d.notes.trim() || undefined,
        ...(task.area === 'seround' ? { brand: d.brand || undefined, workstream: (d.workstream || undefined) as Task['workstream'], content: task.workstream === 'content' || d.workstream === 'content' ? c : task.content } : {}),
      },
    });
    say('Saved. In the real app this would update the note’s properties; the note’s file name stays the same.');
    onClose();
  };
  const isContent = task.area === 'seround' && d.workstream === 'content';

  return (
    <aside ref={ref} className="drawer" role="dialog" aria-label={`Details: ${task.title}`}>
      <header>
        <span className={`area-tag area-${task.area}`}>{task.area}</span>
        <button className="icon-btn" aria-label="Close details" onClick={onClose}><Icon name="close" /></button>
      </header>
      <div className="drawer-body">
        <label className="field">Title<input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>
        <p className="hint">Renaming changes the title only, never the note’s file name or location.</p>

        <label className="check status-line"><input type="checkbox" checked={task.done} onChange={() => dispatch({ type: 'task/toggle', id: task.id })} /><span className="box" />
          {task.done ? 'Completed — untick to reopen' : 'Mark task complete'}</label>

        <div className="form-row">
          <label className="field">Task date <small>when I’ll work on it</small><input type="date" value={d.plan} onChange={(e) => setD({ ...d, plan: e.target.value })} /></label>
          <label className="field">Due date <small>deadline</small><input type="date" value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} /></label>
        </div>
        <div className="form-row">
          <label className="field">Priority
            <select value={d.priority} onChange={(e) => setD({ ...d, priority: e.target.value as Task['priority'] })}>
              <option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
            </select>
          </label>
          <label className="field">List / group<input value={d.list} placeholder="Optional" onChange={(e) => setD({ ...d, list: e.target.value })} /></label>
        </div>
        <div className="field">Type
          <div className="seg slim" role="radiogroup" aria-label="Task type">
            <button type="button" role="radio" aria-checked={task.mode === 'simple'} onClick={() => dispatch({ type: 'task/update', id: task.id, patch: { mode: 'simple' } })}>Simple to-do</button>
            <button type="button" role="radio" aria-checked={task.mode === 'progress'} onClick={() => dispatch({ type: 'task/update', id: task.id, patch: { mode: 'progress' } })}>With steps</button>
          </div>
        </div>
        <div className="field">Tags
          <span className="tag-line"><TagChips names={task.tags} /><TagPicker value={task.tags} onChange={(tags) => dispatch({ type: 'task/tags', id: task.id, tags })} label="Edit tags" /></span>
        </div>
        <label className="field">Notes<textarea rows={3} value={d.notes} placeholder="Anything to remember" onChange={(e) => setD({ ...d, notes: e.target.value })} /></label>
        <div className="form-row">
          <label className="field">Repeat<select disabled><option>Not available yet</option></select></label>
          <label className="field">Reminder<select disabled><option>Not available yet</option></select></label>
        </div>

        {task.area === 'seround' && (
          <div className="form-row">
            <label className="field">Brand<select value={d.brand} onChange={(e) => setD({ ...d, brand: e.target.value })}>{data.brands.map((b) => <option key={b}>{b}</option>)}</select></label>
            <label className="field">Workstream
              <select value={d.workstream} onChange={(e) => setD({ ...d, workstream: e.target.value })}>
                <option value="">—</option><option value="content">Repost queue</option><option value="backend">Backend development</option><option value="brand">Brand work</option>
              </select>
            </label>
          </div>
        )}
        {isContent && (
          <fieldset className="content-fields">
            <legend>Content queue</legend>
            <label className="field">Clip reference<input value={c.clip ?? ''} onChange={(e) => setC({ ...c, clip: e.target.value })} /></label>
            <label className="field">Source link<input value={c.source ?? ''} onChange={(e) => setC({ ...c, source: e.target.value })} /></label>
            <div className="form-row">
              <label className="field">Destination<input value={c.destination ?? ''} onChange={(e) => setC({ ...c, destination: e.target.value })} /></label>
              <label className="field">Repost status
                <select value={c.repostStatus ?? 'queued'} onChange={(e) => setC({ ...c, repostStatus: e.target.value as ContentInfo['repostStatus'] })}>
                  <option value="queued">Queued</option><option value="ready">Ready to post</option><option value="posted">Posted</option>
                </select>
              </label>
            </div>
            <label className="field">Caption<textarea rows={2} value={c.caption ?? ''} onChange={(e) => setC({ ...c, caption: e.target.value })} lang="lo" /></label>
            <label className="field">Planned publication<input type="date" value={c.publishOn ?? ''} onChange={(e) => setC({ ...c, publishOn: e.target.value || undefined })} /></label>
            <p className="hint">Tracking only. This app never downloads clips or posts to social accounts.</p>
          </fieldset>
        )}

        {task.mode === 'progress' && <div className="drawer-steps">
          <h4>Steps {prog.pct !== null && <span className="muted">{prog.done}/{prog.total}</span>}</h4>
          {task.steps.length === 0 && <p className="steps-empty">No steps yet.</p>}
          {task.steps.map((s) => (
            <label key={s.id} className={`check step-check${s.done ? ' done' : ''}`}>
              <input type="checkbox" checked={s.done} onChange={() => dispatch({ type: 'step/toggle', taskId: task.id, stepId: s.id })} /><span className="box" />{s.text}
            </label>
          ))}
          <div className="step add"><Icon name="plus" size={13} />
            <input className="step-input" placeholder="Add step" aria-label="Add step" value={step} onChange={(e) => setStep(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && step.trim()) { dispatch({ type: 'step/add', taskId: task.id, text: step }); setStep(''); } }} />
          </div>
          <p className="hint">Steps save as you tick them. Finishing every step never completes the task by itself.</p>
        </div>}

        <div className="note-link">
          <code>{task.notePath}</code>
          <button className="btn small" onClick={() => openNote(task.notePath)}><Icon name="external" size={13} /> Open in Obsidian</button>
        </div>
      </div>
      <footer>
        <button className="btn ghost" onClick={onClose}>{dirty ? 'Cancel' : 'Close'}</button>
        <button className="btn primary" disabled={!dirty || !d.title.trim()} onClick={save}>Save changes</button>
      </footer>
    </aside>
  );
}
