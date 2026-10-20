import type { ISODate } from '../lib/dates';

/** Esther is a to-do list: your own lists, tasks with an optional date, and subtasks. */
export interface List { id: string; name: string; color: string }
export interface Subtask { id: string; text: string; done: boolean }
export interface Task {
  id: string;
  listId: string;
  title: string;
  done: boolean;
  /** The day it's for (shown on the calendar and in This week). */
  date?: ISODate;
  subtasks: Subtask[];
}
export interface Data { version: 1; lists: List[]; tasks: Task[] }

/** Colours drawn from medieval manuscript pigments, for lists. */
export const PIGMENTS: { name: string; color: string }[] = [
  { name: 'Vermilion', color: '#c8553a' }, { name: 'Lapis', color: '#4c6fb8' }, { name: 'Verdigris', color: '#3f9a80' },
  { name: 'Orpiment', color: '#d4a03c' }, { name: 'Madder', color: '#b44a6e' }, { name: 'Tyrian', color: '#8a4f8f' },
  { name: 'Azurite', color: '#5a93c4' }, { name: 'Malachite', color: '#6aa452' }, { name: 'Red lead', color: '#dd7a45' },
  { name: 'Ochre', color: '#b98a3e' }, { name: 'Umber', color: '#8c6a4a' }, { name: 'Slate', color: '#7f8a96' },
];

let seq = 0;
export const newId = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** The colour a new list gets: the first pigment no list uses yet. */
export const nextColor = (lists: List[]) => (PIGMENTS.find((p) => !lists.some((l) => l.color === p.color)) ?? PIGMENTS[lists.length % PIGMENTS.length]).color;
