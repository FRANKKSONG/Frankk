import { useState } from 'react';
import { Icon } from './Icons';
import { Check } from './Check';
import { DateChip } from './DateChip';
import { Editable } from './Editable';
import { SortableList } from './SortableList';
import { useContextMenu, type MenuItem } from './ContextMenu';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import type { Task } from '../data/model';

/** One task on its list: tick, rename, date, and its subtasks underneath. Right-click for move and delete. */
export function TaskRow({ task, grip, open, onOpen }: { task: Task; grip?: React.ReactNode; open: boolean; onOpen: (open: boolean) => void }) {
  const { data, dispatch, today } = useStore();
  const { say } = useUi();
  const menu = useContextMenu();
  const subsDone = task.subtasks.filter((s) => s.done).length;
  const items: MenuItem[] = [
    { label: open ? 'Hide subtasks' : 'Show subtasks', icon: 'steps', onClick: () => onOpen(!open) },
    ...data.lists.filter((l) => l.id !== task.listId).map((l, i) => ({ label: `Move to ${l.name}`, icon: 'folder' as const, sep: i === 0, onClick: () => { dispatch({ type: 'task/update', id: task.id, patch: { listId: l.id } }); say(`Moved to ${l.name}.`, true); } })),
    ...(task.date ? [{ label: 'Remove date', icon: 'calendar' as const, sep: true, onClick: () => dispatch({ type: 'task/update', id: task.id, patch: { date: undefined } }) }] : []),
    { label: 'Delete task', icon: 'trash', danger: true, sep: true, onClick: () => { dispatch({ type: 'task/remove', id: task.id }); say(`Deleted “${task.title}”.`, true); } },
  ];
  return (
    <div className={`task${task.done ? ' done' : ''}${open ? ' open' : ''}`} data-task={task.id} onContextMenu={(e) => menu(e, items)}>
      <div className="task-line">
        {grip}
        <Check checked={task.done} label={`${task.done ? 'Reopen' : 'Complete'} ${task.title}`} onChange={() => dispatch({ type: 'task/toggle', id: task.id })} />
        <Editable className="task-title" label="Task name" value={task.title} onSave={(v) => dispatch({ type: 'task/update', id: task.id, patch: { title: v } })} />
        <button className={`subs-btn${task.subtasks.length ? '' : ' none'}`} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} subtasks of ${task.title}`} onClick={() => onOpen(!open)}>
          {task.subtasks.length ? <><Icon name="list" size={12} />{subsDone}/{task.subtasks.length}</> : <><Icon name="plus" size={11} />Subtask</>}
        </button>
        <DateChip value={task.date} today={today} label={`Date of ${task.title}`} onChange={(date) => dispatch({ type: 'task/update', id: task.id, patch: { date } })} />
      </div>
      {open && <Subtasks task={task} />}
    </div>
  );
}

function Subtasks({ task }: { task: Task }) {
  const { dispatch } = useStore();
  const { say } = useUi();
  const menu = useContextMenu();
  const [text, setText] = useState('');
  return (
    <div className="subtasks">
      <SortableList items={task.subtasks} label={(s) => s.text} onMove={(_a, _b, order) => dispatch({ type: 'sub/order', taskId: task.id, ids: order })}>
        {(s, grip) => (
          <div className={`sub${s.done ? ' done' : ''}`} onContextMenu={(e) => menu(e, [
            { label: 'Delete subtask', icon: 'trash', danger: true, onClick: () => { dispatch({ type: 'sub/remove', taskId: task.id, subId: s.id }); say(`Deleted “${s.text}”.`, true); } },
          ])}>
            {grip}
            <Check checked={s.done} label={`${s.done ? 'Reopen' : 'Complete'} ${s.text}`} onChange={() => dispatch({ type: 'sub/toggle', taskId: task.id, subId: s.id })} />
            <Editable className="sub-text" label="Subtask" value={s.text} onSave={(v) => dispatch({ type: 'sub/update', taskId: task.id, subId: s.id, text: v })} />
          </div>
        )}
      </SortableList>
      <form className="sub add" onSubmit={(e) => { e.preventDefault(); dispatch({ type: 'sub/add', taskId: task.id, text }); setText(''); }}>
        <Icon name="plus" size={12} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a subtask, Enter" aria-label={`Add a subtask to ${task.title}`} />
      </form>
    </div>
  );
}
