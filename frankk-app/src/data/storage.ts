import { PIGMENTS, newId, type Data, type List, type Task } from './model';
import { addDays, type ISODate } from '../lib/dates';

/**
 * Your lists and tasks are saved in this browser. The first time this version runs, tasks from the earlier,
 * bigger Esther (saved under its own key, which is left untouched) are brought over.
 */
export const KEY = 'esther.todo.v1';
const OLD_KEY = 'esther.proto.data.v4';

interface OldTask { id: string; title: string; area: string; done: boolean; plan?: string; due?: string; list?: string; steps?: { id: string; text: string; done: boolean }[] }

/** Tasks from the earlier Esther: General, Seround and House become lists (B-YOU too, when you used it). Subtasks were its steps. */
export function fromOld(old: { tasks?: OldTask[] }): Data | null {
  if (!old?.tasks?.length) return null;
  const lists: List[] = [];
  const listFor = (name: string) => {
    let l = lists.find((x) => x.name === name);
    if (!l) { l = { id: newId('l'), name, color: PIGMENTS[lists.length % PIGMENTS.length].color }; lists.push(l); }
    return l.id;
  };
  listFor('General');
  const tasks: Task[] = old.tasks.map((t) => ({
    id: t.id,
    listId: listFor(t.list ? t.list : t.area === 'seround' ? 'Seround' : t.area === 'house' ? 'House' : 'General'),
    title: t.title,
    done: !!t.done,
    date: t.plan ?? t.due,
    subtasks: (t.steps ?? []).map((s) => ({ id: s.id, text: s.text, done: !!s.done })),
  }));
  return { version: 1, lists, tasks };
}

/** A first look when there's nothing to bring over. */
export function starter(today: ISODate): Data {
  const general: List = { id: 'l-general', name: 'General', color: PIGMENTS[0].color };
  const home: List = { id: 'l-home', name: 'Home', color: PIGMENTS[2].color };
  return {
    version: 1,
    lists: [general, home],
    tasks: [
      { id: 't-1', listId: general.id, title: 'Plan the week', done: false, date: today, subtasks: [{ id: 's-1', text: 'Check the calendar', done: true }, { id: 's-2', text: 'Pick three things', done: false }] },
      { id: 't-2', listId: general.id, title: 'Reply to emails', done: false, date: addDays(today, 2), subtasks: [] },
      { id: 't-3', listId: home.id, title: 'Buy dog food', done: false, date: addDays(today, 1), subtasks: [] },
    ],
  };
}

export function load(today: ISODate): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw) as Data; if (d?.lists?.length) return d; }
    const old = localStorage.getItem(OLD_KEY);
    const moved = old ? fromOld(JSON.parse(old)) : null;
    if (moved) return moved;
  } catch { /* unreadable: start fresh */ }
  return starter(today);
}

export function save(d: Data) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage full or blocked */ }
}
