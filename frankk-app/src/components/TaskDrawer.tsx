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
    const t = ref.current?.querySelector<HTMLTextAreaElement>('.dp-title');
    if (t) { t.style.height = `${t.scrollHeight}px`; t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
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

  const AREA_NAME: Record<string, string> = { general: 'General', seround: 'Seround', house: 'House', music: 'Music' };
  const prop = (label: string, icon: Parameters<typeof Icon>[0]['name'], control: React.ReactNode, hint?: string) => (
    <div className="dp-row"><span className="dp-label" title={hint}><Icon name={icon} size={13} />{label}</span><div className="dp-value">{control}</div></div>
  );

  return (
    <aside ref={ref} className={`drawer task-sheet area-${task.area}`} role="dialog" aria-label={`Details: ${task.title}`}>
      <header>
        <span className="dp-area"><i />{AREA_NAME[task.area] ?? task.area}{task.brand ? ` · ${task.brand.split(' ')[0]}` : ''}</span>
        <button className="icon-btn" aria-label="Close details" onClick={onClose}><Icon name="close" /></button>
      </header>
      <div className="drawer-body">
        <textarea className="dp-title" rows={1} aria-label="Title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value.replace(/\n/g, ' ') })}
          onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; }} />
        <label className={`check dp-done${task.done ? ' on' : ''}`}><input type="checkbox" checked={task.done} onChange={() => dispatch({ type: 'task/toggle', id: task.id })} /><span className="box" />
          {task.done ? 'Completed · untick to reopen' : 'Mark complete'}</label>

        <section className="dp-props" aria-label="Properties">
          {prop('Task date', 'calendar', <input type="date" value={d.plan} aria-label="Task date" onChange={(e) => setD({ ...d, plan: e.target.value })} />, 'When you’ll work on it')}
          {prop('Due', 'bell', <input type="date" value={d.due} aria-label="Due date" onChange={(e) => setD({ ...d, due: e.target.value })} />, 'Deadline')}
          {prop('Priority', 'up', (
            <span className="dp-pills" role="radiogroup" aria-label="Priority">
              {(['high', 'normal', 'low'] as const).map((p) => <button key={p} type="button" role="radio" aria-checked={d.priority === p} className={`pri-${p}`} onClick={() => setD({ ...d, priority: p })}>{p[0].toUpperCase() + p.slice(1)}</button>)}
            </span>
          ))}
          {prop('Type', 'steps', (
            <span className="dp-pills" role="radiogroup" aria-label="Task type">
              <button type="button" role="radio" aria-checked={task.mode === 'simple'} onClick={() => dispatch({ type: 'task/update', id: task.id, patch: { mode: 'simple' } })}>Simple to-do</button>
              <button type="button" role="radio" aria-checked={task.mode === 'progress'} onClick={() => dispatch({ type: 'task/update', id: task.id, patch: { mode: 'progress' } })}>With steps</button>
            </span>
          ))}
          {prop('List', 'list', <input value={d.list} placeholder="Empty" aria-label="List / group" onChange={(e) => setD({ ...d, list: e.target.value })} />)}
          {prop('Tags', 'tag', <span className="tag-line"><TagChips names={task.tags} /><TagPicker value={task.tags} onChange={(tags) => dispatch({ type: 'task/tags', id: task.id, tags })} label="Edit tags" /></span>)}
          {task.area === 'seround' && prop('Brand', 'seround', <select value={d.brand} aria-label="Brand" onChange={(e) => setD({ ...d, brand: e.target.value })}>{data.brands.map((b) => <option key={b}>{b}</option>)}</select>)}
          {task.area === 'seround' && prop('Workstream', 'layout', (
            <select value={d.workstream} aria-label="Workstream" onChange={(e) => setD({ ...d, workstream: e.target.value })}>
              <option value="">Empty</option><option value="content">Repost queue</option><option value="backend">Backend development</option><option value="brand">Brand work</option>
            </select>
          ))}
          {prop('Repeat', 'history', <span className="dp-off">Not available yet</span>)}
          {prop('Reminder', 'bell', <span className="dp-off">Not available yet</span>)}
        </section>

        {isContent && (
          <section className="dp-props dp-group" aria-label="Content queue">
            <h4>Content queue</h4>
            {prop('Clip', 'image', <input value={c.clip ?? ''} placeholder="Empty" aria-label="Clip reference" onChange={(e) => setC({ ...c, clip: e.target.value })} />)}
            {prop('Source', 'link', <input value={c.source ?? ''} placeholder="Empty" aria-label="Source link" onChange={(e) => setC({ ...c, source: e.target.value })} />)}
            {prop('Post to', 'external', <input value={c.destination ?? ''} placeholder="Empty" aria-label="Destination" onChange={(e) => setC({ ...c, destination: e.target.value })} />)}
            {prop('Status', 'check', (
              <span className="dp-pills" role="radiogroup" aria-label="Repost status">
                {([['queued', 'Queued'], ['ready', 'Ready'], ['posted', 'Posted']] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={(c.repostStatus ?? 'queued') === v} onClick={() => setC({ ...c, repostStatus: v })}>{l}</button>)}
              </span>
            ))}
            {prop('Publish on', 'calendar', <input type="date" value={c.publishOn ?? ''} aria-label="Planned publication" onChange={(e) => setC({ ...c, publishOn: e.target.value || undefined })} />)}
            <textarea className="dp-text" rows={2} value={c.caption ?? ''} placeholder="Caption…" aria-label="Caption" onChange={(e) => setC({ ...c, caption: e.target.value })} lang="lo" />
            <p className="hint">Tracking only. Esther never downloads clips or posts to social accounts.</p>
          </section>
        )}

        <section className="dp-group">
          <h4>Notes</h4>
          <textarea className="dp-text" rows={3} value={d.notes} placeholder="Anything to remember…" aria-label="Notes" onChange={(e) => setD({ ...d, notes: e.target.value })} />
        </section>

        {task.mode === 'progress' && <section className="dp-group drawer-steps">
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
        </section>}
      </div>
      <footer>
        <button className="link-btn dp-note" onClick={() => openNote(task.notePath)} title={task.notePath}><Icon name="external" size={13} /> Open in Obsidian</button>
        <button className="btn ghost" onClick={onClose}>{dirty ? 'Cancel' : 'Close'}</button>
        <button className="btn primary" disabled={!dirty || !d.title.trim()} onClick={save}>Save changes</button>
      </footer>
    </aside>
  );
}
