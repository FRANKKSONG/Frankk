import { Check } from './Check';
import { Icon } from './Icons';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { relLabel } from '../lib/dates';
import type { Task } from '../data/model';

/** A task in This week: tick it, or click it to show it in the table. */
export function TaskLine({ task, showDate }: { task: Task; showDate?: boolean }) {
  const { data, dispatch, today } = useStore();
  const { reveal } = useUi();
  const list = data.lists.find((l) => l.id === task.listId);
  const subsDone = task.subtasks.filter((s) => s.done).length;
  return (
    <li className={`tline${task.done ? ' done' : ''}`}>
      <Check checked={task.done} label={`${task.done ? 'Reopen' : 'Complete'} ${task.title}`} onChange={() => dispatch({ type: 'task/toggle', id: task.id })} />
      <button className="tline-title" title="Show in the table" onClick={() => reveal(task.id, task.listId)}>{task.title}</button>
      {task.subtasks.length > 0 && <span className="tline-subs"><Icon name="list" size={11} />{subsDone}/{task.subtasks.length}</span>}
      {showDate && task.date && <span className={`tline-date${task.date < today ? ' late' : ''}`}>{relLabel(task.date, today)}</span>}
      {list && <i className="dot" style={{ background: list.color }} title={list.name} />}
    </li>
  );
}
