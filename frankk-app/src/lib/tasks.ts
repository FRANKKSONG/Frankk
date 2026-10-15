import { diffDays, type ISODate } from './dates';
import type { Task } from '../data/types';

export type Filter = 'all' | 'open' | 'today' | 'overdue' | 'done';
export type SortKey = 'manual' | 'smart' | 'due' | 'plan' | 'title' | 'priority' | 'progress' | 'list' | 'workstream';

export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All tasks' }, { id: 'open', label: 'Open' }, { id: 'today', label: 'Today' },
  { id: 'overdue', label: 'Overdue' }, { id: 'done', label: 'Completed' },
];
export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'manual', label: 'Manual order' }, { id: 'smart', label: 'Smart: late, then soonest' }, { id: 'due', label: 'Due date' }, { id: 'plan', label: 'Task date' },
  { id: 'title', label: 'Title' }, { id: 'priority', label: 'Priority' }, { id: 'progress', label: 'Progress' },
];

export const isOverdue = (t: Task, today: ISODate) => !t.done && !!t.due && diffDays(t.due, today) < 0;

export function applyFilter(tasks: Task[], f: Filter, today: ISODate): Task[] {
  switch (f) {
    case 'all': return tasks;
    case 'open': return tasks.filter((t) => !t.done);
    case 'today': return tasks.filter((t) => !t.done && (t.plan === today || t.due === today || isOverdue(t, today)));
    case 'overdue': return tasks.filter((t) => isOverdue(t, today));
    case 'done': return tasks.filter((t) => t.done);
  }
}

const PRIO = { high: 0, normal: 1, low: 2 } as const;
export type SortDir = 'asc' | 'desc';

/** Column id → sort key. Columns not listed here can't be sorted. */
export const SORTABLE: Record<string, SortKey> = { title: 'title', progress: 'progress', plan: 'plan', due: 'due', priority: 'priority', list: 'list', workstream: 'workstream' };

const progressOf = (t: Task) => (t.mode === 'simple' || !t.steps.length ? (t.done ? 1 : 0) : t.steps.filter((s) => s.done).length / t.steps.length);

/** Sort tasks. Completed tasks always stay at the bottom; empty values sort last in either direction. */
export function applySort(tasks: Task[], key: SortKey, dir: SortDir = 'asc'): Task[] {
  if (key === 'manual') return tasks;
  // Smart: late first, then by the nearest date (deadline, else task date), high priority first; undated last.
  if (key === 'smart') {
    const when = (t: Task) => t.due ?? t.plan ?? '9999-99-99';
    return [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || when(a).localeCompare(when(b)) || PRIO[a.priority] - PRIO[b.priority]);
  }
  const val = (t: Task): string | number | undefined => {
    switch (key) {
      case 'due': return t.due; case 'plan': return t.plan; case 'title': return t.title.toLowerCase();
      case 'priority': return PRIO[t.priority]; case 'progress': return progressOf(t);
      case 'list': return t.list?.toLowerCase(); case 'workstream': return t.workstream;
    }
  };
  const out = [...tasks];
  out.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const x = val(a), y = val(b);
    if (x === undefined || x === '') return y === undefined || y === '' ? 0 : 1;
    if (y === undefined || y === '') return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return dir === 'asc' ? c : -c;
  });
  return out;
}
