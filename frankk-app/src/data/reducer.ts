import { newId, type Data, type List, type Subtask, type Task } from './model';
import type { ISODate } from '../lib/dates';

export type Action =
  | { type: 'list/add'; list: List }
  | { type: 'list/update'; id: string; patch: Partial<Omit<List, 'id'>> }
  /** Removes a list. Its tasks move to `moveTo`, or are deleted when it's left out. */
  | { type: 'list/remove'; id: string; moveTo?: string }
  | { type: 'list/order'; ids: string[] }
  | { type: 'task/add'; task: Omit<Task, 'subtasks' | 'done'> & Partial<Pick<Task, 'subtasks' | 'done'>> }
  | { type: 'task/update'; id: string; patch: Partial<Pick<Task, 'title' | 'date' | 'listId'>> }
  | { type: 'task/toggle'; id: string; at?: string }
  /** Removes finished tasks ticked before this time (the automatic clear-out). */
  | { type: 'task/clear-done'; before: string }
  | { type: 'task/remove'; id: string }
  /** The list's tasks in their new order (ids of that list only). */
  | { type: 'task/order'; ids: string[] }
  | { type: 'sub/add'; taskId: string; text: string }
  | { type: 'sub/update'; taskId: string; subId: string; text: string }
  | { type: 'sub/toggle'; taskId: string; subId: string }
  | { type: 'sub/remove'; taskId: string; subId: string }
  | { type: 'sub/order'; taskId: string; ids: string[] }
  | { type: 'replace'; data: Data };

const mapTask = (d: Data, id: string, fn: (t: Task) => Task): Data => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? fn(t) : t)) });
const mapSubs = (d: Data, id: string, fn: (s: Subtask[]) => Subtask[]) => mapTask(d, id, (t) => ({ ...t, subtasks: fn(t.subtasks) }));
const reorder = <T extends { id: string }>(all: T[], ids: string[]): T[] => {
  const moved = ids.map((id) => all.find((x) => x.id === id)).filter(Boolean) as T[];
  const slots = all.map((x) => ids.includes(x.id));
  let i = 0;
  return all.map((x, n) => (slots[n] ? moved[i++] : x));
};

export function reducer(d: Data, a: Action): Data {
  switch (a.type) {
    case 'list/add': return { ...d, lists: [...d.lists, a.list] };
    case 'list/update': return { ...d, lists: d.lists.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)) };
    case 'list/remove':
      if (d.lists.length <= 1) return d;
      return {
        ...d,
        lists: d.lists.filter((l) => l.id !== a.id),
        tasks: a.moveTo ? d.tasks.map((t) => (t.listId === a.id ? { ...t, listId: a.moveTo! } : t)) : d.tasks.filter((t) => t.listId !== a.id),
      };
    case 'list/order': return { ...d, lists: reorder(d.lists, a.ids) };
    // New tasks go to the top of their list.
    case 'task/add': return { ...d, tasks: [{ done: false, subtasks: [], ...a.task, title: a.task.title.trim() }, ...d.tasks] };
    case 'task/update': return mapTask(d, a.id, (t) => ({ ...t, ...a.patch, ...(a.patch.title !== undefined ? { title: a.patch.title.trim() || t.title } : {}) }));
    case 'task/toggle': return mapTask(d, a.id, (t) => (t.done ? { ...t, done: false, doneAt: undefined } : { ...t, done: true, doneAt: a.at ?? new Date().toISOString() }));
    case 'task/clear-done': {
      const keep = d.tasks.filter((t) => !(t.done && (t.doneAt ?? '') < a.before));
      return keep.length === d.tasks.length ? d : { ...d, tasks: keep };
    }
    case 'task/remove': return { ...d, tasks: d.tasks.filter((t) => t.id !== a.id) };
    case 'task/order': return { ...d, tasks: reorder(d.tasks, a.ids) };
    case 'sub/add': return a.text.trim() ? mapSubs(d, a.taskId, (s) => [...s, { id: newId('s'), text: a.text.trim(), done: false }]) : d;
    case 'sub/update': return mapSubs(d, a.taskId, (s) => s.map((x) => (x.id === a.subId && a.text.trim() ? { ...x, text: a.text.trim() } : x)));
    case 'sub/toggle': return mapSubs(d, a.taskId, (s) => s.map((x) => (x.id === a.subId ? { ...x, done: !x.done } : x)));
    case 'sub/remove': return mapSubs(d, a.taskId, (s) => s.filter((x) => x.id !== a.subId));
    case 'sub/order': return mapSubs(d, a.taskId, (s) => reorder(s, a.ids));
    case 'replace': return a.data;
  }
}

/** Open tasks first in your order, then done ones. */
export const tasksOf = (d: Data, listId: string) => d.tasks.filter((t) => t.listId === listId);

/** Tasks on a given day. */
export const tasksOn = (d: Data, day: ISODate) => d.tasks.filter((t) => t.date === day);
