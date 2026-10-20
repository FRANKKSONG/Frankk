import { describe, expect, it } from 'vitest';
import { reducer } from './data/reducer';
import { fromOld, starter } from './data/storage';
import { weekStart } from './lib/dates';
import { lineFor } from './lib/greeting';
import type { Data } from './data/model';

const base = (): Data => starter('2026-10-20');

describe('lists', () => {
  it('adds, renames and recolours a list', () => {
    let d = reducer(base(), { type: 'list/add', list: { id: 'l-x', name: 'Seround', color: '#000' } });
    d = reducer(d, { type: 'list/update', id: 'l-x', patch: { name: 'Seround work', color: '#111' } });
    expect(d.lists.at(-1)).toEqual({ id: 'l-x', name: 'Seround work', color: '#111' });
  });
  it('deleting a list can move its tasks to another list', () => {
    const d = reducer(base(), { type: 'list/remove', id: 'l-home', moveTo: 'l-general' });
    expect(d.lists.map((l) => l.id)).toEqual(['l-general']);
    expect(d.tasks.find((t) => t.id === 't-3')?.listId).toBe('l-general');
  });
  it('deleting a list without a target deletes its tasks', () => {
    const d = reducer(base(), { type: 'list/remove', id: 'l-home' });
    expect(d.tasks.some((t) => t.id === 't-3')).toBe(false);
  });
  it('never deletes the last list', () => {
    const one = reducer(base(), { type: 'list/remove', id: 'l-home', moveTo: 'l-general' });
    expect(reducer(one, { type: 'list/remove', id: 'l-general' })).toBe(one);
  });
});

describe('tasks and subtasks', () => {
  it('a new task goes to the top, trimmed', () => {
    const d = reducer(base(), { type: 'task/add', task: { id: 't-new', listId: 'l-general', title: '  Call mom ', date: '2026-10-21' } });
    expect(d.tasks[0]).toMatchObject({ id: 't-new', title: 'Call mom', done: false, subtasks: [], date: '2026-10-21' });
  });
  it('an empty rename keeps the old name', () => {
    const d = reducer(base(), { type: 'task/update', id: 't-1', patch: { title: '   ' } });
    expect(d.tasks.find((t) => t.id === 't-1')?.title).toBe('Plan the week');
  });
  it('subtasks add, tick, rename and delete; ticking them all leaves the task open', () => {
    let d = reducer(base(), { type: 'sub/add', taskId: 't-1', text: 'Write it down' });
    const t = () => d.tasks.find((x) => x.id === 't-1')!;
    expect(t().subtasks.map((s) => s.text)).toEqual(['Check the calendar', 'Pick three things', 'Write it down']);
    for (const s of t().subtasks.filter((x) => !x.done)) d = reducer(d, { type: 'sub/toggle', taskId: 't-1', subId: s.id });
    expect(t().subtasks.every((s) => s.done)).toBe(true);
    expect(t().done).toBe(false);
    d = reducer(d, { type: 'sub/update', taskId: 't-1', subId: 's-1', text: 'Check calendar' });
    d = reducer(d, { type: 'sub/remove', taskId: 't-1', subId: 's-2' });
    expect(t().subtasks.map((s) => s.text)).toEqual(['Check calendar', 'Write it down']);
  });
  it('reordering one list leaves other lists in place', () => {
    const d = reducer(base(), { type: 'task/order', ids: ['t-2', 't-1'] });
    expect(d.tasks.map((t) => t.id)).toEqual(['t-2', 't-1', 't-3']);
  });
});

describe('bringing over the earlier Esther', () => {
  it('areas and the B-YOU list become lists; steps become subtasks; plan or due becomes the date', () => {
    const d = fromOld({ tasks: [
      { id: 'a', title: 'Poster', area: 'general', list: 'B-YOU', done: false, due: '2026-12-05', steps: [] },
      { id: 'b', title: 'Clean food box', area: 'general', done: false, plan: '2026-10-21', steps: [{ id: 's', text: 'Wash', done: true }] },
      { id: 'c', title: 'Fix tap', area: 'house', done: true },
      { id: 'd', title: 'Repost', area: 'seround', done: false },
    ] })!;
    expect(d.lists.map((l) => l.name)).toEqual(['General', 'B-YOU', 'House', 'Seround']);
    const by = (id: string) => d.tasks.find((t) => t.id === id)!;
    expect(d.lists.find((l) => l.id === by('a').listId)?.name).toBe('B-YOU');
    expect(by('a').date).toBe('2026-12-05');
    expect(by('b')).toMatchObject({ date: '2026-10-21', subtasks: [{ id: 's', text: 'Wash', done: true }] });
    expect(by('c').done).toBe(true);
  });
  it('nothing to bring over gives nothing', () => { expect(fromOld({ tasks: [] })).toBeNull(); });
});

describe('dates and greeting', () => {
  it('the week starts on Monday', () => {
    expect(weekStart('2026-10-20')).toBe('2026-10-19');
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
  });
  it('the greeting line is the same all day', () => { expect(lineFor('2026-10-20')).toBe(lineFor('2026-10-20')); });
});
