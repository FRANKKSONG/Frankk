import { diffDays, type ISODate } from './dates';
import type { Task } from '../data/types';

export type Filter = 'all' | 'open' | 'today' | 'overdue' | 'done';
export type SortKey = 'manual' | 'due' | 'plan' | 'title' | 'priority';

export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All tasks' }, { id: 'open', label: 'Open' }, { id: 'today', label: 'Today' },
  { id: 'overdue', label: 'Overdue' }, { id: 'done', label: 'Completed' },
];
export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'manual', label: 'Manual order' }, { id: 'due', label: 'Due date' }, { id: 'plan', label: 'Task date' },
  { id: 'title', label: 'Title A–Z' }, { id: 'priority', label: 'Priority' },
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
const cmpDate = (a?: string, b?: string) => (a && b ? a.localeCompare(b) : a ? -1 : b ? 1 : 0);

export function applySort(tasks: Task[], key: SortKey): Task[] {
  if (key === 'manual') return tasks;
  const out = [...tasks];
  out.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    switch (key) {
      case 'due': return cmpDate(a.due, b.due);
      case 'plan': return cmpDate(a.plan, b.plan);
      case 'title': return a.title.localeCompare(b.title);
      case 'priority': return PRIO[a.priority] - PRIO[b.priority];
    }
  });
  return out;
}
