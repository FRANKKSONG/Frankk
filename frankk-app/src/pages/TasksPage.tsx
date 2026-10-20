import { useEffect, useState } from 'react';
import { Icon } from '../components/Icons';
import { Editable } from '../components/Editable';
import { ColorSelect } from '../components/ColorSelect';
import { Popover } from '../components/Popover';
import { SortableList } from '../components/SortableList';
import { TaskRow } from '../components/TaskRow';
import { AddTask } from '../components/AddTask';
import { useStore } from '../data/store';
import { useUi } from '../ui';

/** One list: add tasks, tick them, open them for subtasks. Finished tasks fold away at the bottom. */
export function TasksPage() {
  const { data, dispatch } = useStore();
  const { listId, openTaskId, setOpenTask, go, say } = useUi();
  const list = data.lists.find((l) => l.id === listId) ?? data.lists[0];
  const [showDone, setShowDone] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setConfirm(false); }, [list?.id]);
  useEffect(() => {
    if (openTaskId) requestAnimationFrame(() => document.querySelector(`[data-task="${openTaskId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }, [openTaskId]);
  if (!list) return null;
  const all = data.tasks.filter((t) => t.listId === list.id);
  const open = all.filter((t) => !t.done);
  const done = all.filter((t) => t.done);
  const others = data.lists.filter((l) => l.id !== list.id);
  const moveTo = others[0]?.id;
  const remove = (keep: boolean) => {
    dispatch({ type: 'list/remove', id: list.id, moveTo: keep ? moveTo : undefined });
    say(keep && all.length ? `Deleted “${list.name}”. Its ${all.length} task${all.length === 1 ? '' : 's'} moved to ${others[0].name}.` : `Deleted “${list.name}”.`, true);
    go('tasks', { listId: others[0].id });
  };
  return (
    <div className="page tasks-page">
      <header className="list-head">
        <ColorSelect compact label="List colour" value={list.color} onChange={(color) => dispatch({ type: 'list/update', id: list.id, patch: { color } })} />
        <h1><Editable className="list-name" label="List name" value={list.name} onSave={(name) => dispatch({ type: 'list/update', id: list.id, patch: { name: name.trim() } })} /></h1>
        <span className="quiet">{open.length} open</span>
        {others.length > 0 && (
          <Popover align="right" trigger={({ toggle, ref }) => <button ref={ref} className="icon-btn" aria-label="List options" onClick={toggle}><Icon name="more" size={16} /></button>}>
            {(close) => <button className="danger" onClick={() => { setConfirm(true); close(); }}><Icon name="trash" size={13} /> Delete this list…</button>}
          </Popover>
        )}
      </header>
      {confirm && (
        <div className="confirm" role="alertdialog" aria-label={`Delete ${list.name}`}>
          <p>Delete the list “{list.name}”?{all.length ? ` It has ${all.length} task${all.length === 1 ? '' : 's'}.` : ''}</p>
          <div className="row">
            {all.length > 0 && <button className="btn" onClick={() => remove(true)}>Delete list, move tasks to {others[0].name}</button>}
            <button className="btn danger" onClick={() => remove(false)}>{all.length ? 'Delete list and its tasks' : 'Delete list'}</button>
            <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}
      <section className="card list-card">
        <AddTask key={list.id} listId={list.id} placeholder={`Add a task to ${list.name}, Enter`} />
        {open.length ? (
          <SortableList items={open} label={(t) => t.title} onMove={(_a, _b, order) => dispatch({ type: 'task/order', ids: order })}>
            {(t, grip) => <TaskRow task={t} grip={grip} open={openTaskId === t.id} onOpen={(o) => setOpenTask(o ? t.id : null)} />}
          </SortableList>
        ) : <p className="quiet empty-note">Nothing to do here. Add a task above.</p>}
        {done.length > 0 && (
          <div className="done-group">
            <button className="link-btn" aria-expanded={showDone} onClick={() => setShowDone((s) => !s)}>
              <Icon name="chevronR" size={13} style={{ transform: showDone ? 'rotate(90deg)' : undefined }} /> Done · {done.length}
            </button>
            {showDone && done.map((t) => <TaskRow key={t.id} task={t} open={openTaskId === t.id} onOpen={(o) => setOpenTask(o ? t.id : null)} />)}
          </div>
        )}
      </section>
      <p className="hint">Drag the grip to reorder. Right-click a task to move it to another list or delete it. Ctrl+Z undoes.</p>
    </div>
  );
}
