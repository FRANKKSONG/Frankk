import { Check } from './Check';
import { Icon } from './Icons';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { relLabel } from '../lib/dates';
import type { Task } from '../data/model';

/** A task in a short list on Home: tick it, or click it to open it in its list. */
export function TaskLine({ task, showDate }: { task: Task; showDate?: boolean }) {
  const { data, dispatch, today } = useStore();
  const { go } = useUi();
  const list = data.lists.find((l) => l.id === task.listId);
  const subsDone = task.subtasks.filter((s) => s.done).length;
  return (
    <li className={`tline${task.done ? ' done' : ''}`}>
      <Check checked={task.done} label={`${task.done ? 'Reopen' : 'Complete'} ${task.title}`} onChange={() => dispatch({ type: 'task/toggle', id: task.id })} />
      <button className="tline-title" title={`Open in ${list?.name ?? 'its list'}`} onClick={() => go('tasks', { listId: task.listId, taskId: task.id })}>{task.title}</button>
      {task.subtasks.length > 0 && <span className="tline-subs"><Icon name="list" size={11} />{subsDone}/{task.subtasks.length}</span>}
      {showDate && task.date && <span className={`tline-date${task.date < today ? ' late' : ''}`}>{relLabel(task.date, today)}</span>}
      {list && <i className="dot" style={{ background: list.color }} title={list.name} />}
    </li>
  );
}
