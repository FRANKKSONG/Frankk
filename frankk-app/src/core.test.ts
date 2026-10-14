import { describe, expect, it } from 'vitest';
import { buildFixtures } from './data/fixtures';
import { reducer } from './data/reducer';
import { buildAgenda, todayItems } from './lib/agenda';
import { visibleOccurrences } from './lib/bills';
import { addDays, relLabel } from './lib/dates';
import { obsidianUri, uniqueNotePath } from './lib/obsidian';
import { checklistProgress, nextProjectDate, projectProgress } from './lib/progress';

const TODAY = '2026-10-14';
const fresh = () => buildFixtures(TODAY);

describe('checklist progress', () => {
  it('shows no percentage when there are no steps (never 100%)', () => {
    expect(checklistProgress([]).pct).toBeNull();
  });
  it('is checked / total', () => {
    expect(checklistProgress([{ done: true }, { done: true }, { done: false }]).pct).toBe(67);
  });
});

describe('task rules', () => {
  it('finishing every step does not complete the parent, and completing the parent does not tick steps', () => {
    let s = fresh();
    const food = s.tasks.find((t) => t.id === 't-food')!;
    s = reducer(s, { type: 'step/toggle', taskId: food.id, stepId: food.steps[2].id });
    let t = s.tasks.find((x) => x.id === 't-food')!;
    expect(t.steps.every((x) => x.done)).toBe(true);
    expect(t.done).toBe(false);

    const review = s.tasks.find((x) => x.id === 't-budget')!;
    s = reducer(s, { type: 'task/toggle', id: review.id });
    t = s.tasks.find((x) => x.id === 't-budget')!;
    expect(t.done).toBe(true);
    expect(t.steps.filter((x) => x.done)).toHaveLength(1);
    s = reducer(s, { type: 'task/toggle', id: review.id });
    expect(s.tasks.find((x) => x.id === 't-budget')!.done).toBe(false); // reopenable
  });
  it('editing a title keeps the note path stable (no rename)', () => {
    const s = reducer(fresh(), { type: 'task/update', id: 't-food', patch: { title: 'Clean the food box' } });
    expect(s.tasks.find((t) => t.id === 't-food')!.notePath).toBe('Planning/Tasks/Clean food box.md');
  });
  it('new notes never collide with existing paths', () => {
    let s = fresh();
    s = reducer(s, { type: 'task/add', title: 'Clean food box' });
    const paths = s.tasks.map((t) => t.notePath);
    expect(new Set(paths).size).toBe(paths.length);
    expect(uniqueNotePath('a/b:c', new Set())).toBe('Planning/Tasks/abc.md');
  });
  it('ignores blank captures', () => {
    const s = fresh();
    expect(reducer(s, { type: 'task/add', title: '   ' })).toBe(s);
  });
  it('moves a task in manual order', () => {
    const s = reducer(fresh(), { type: 'task/move', id: 't-budget', overId: 't-food' });
    expect(s.tasks.map((t) => t.id).slice(0, 2)).toEqual(['t-budget', 't-food']);
  });
});

describe('music scope', () => {
  it('JZero (Mix + Master only) counts only assigned stages and can reach 2/2', () => {
    let s = fresh();
    const p = s.projects.find((x) => x.id === 'p-jzero')!;
    expect(projectProgress(p)).toMatchObject({ done: 1, total: 2, pct: 50 }); // Mix done, Master open; 6 other stages ignored
    s = reducer(s, { type: 'stage/patch', projectId: p.id, stageId: p.stages.find((x) => x.name === 'Master')!.id, patch: { done: true } });
    expect(projectProgress(s.projects.find((x) => x.id === 'p-jzero')!)).toMatchObject({ done: 2, total: 2, pct: 100 });
  });
  it('outside-scope stages never create overdue work or lower progress', () => {
    const s = fresh();
    const p = s.projects.find((x) => x.id === 'p-jzero')!;
    const before = projectProgress(p).pct;
    const out = { ...p, stages: [...p.stages, { id: 'x', name: 'Streaming', inScope: false, done: false, end: '2020-01-01', items: [] }] };
    expect(projectProgress(out).pct).toBe(before);
    expect(buildAgenda({ ...s, projects: [out] }, TODAY).some((i) => i.title === 'Streaming')).toBe(false);
  });
  it('a project with no in-scope units is "not broken down", not 100%', () => {
    expect(projectProgress({ stages: [] }).pct).toBeNull();
  });
  it('next date is the earliest unfinished dated item', () => {
    const p = fresh().projects.find((x) => x.id === 'p-jing')!;
    expect(nextProjectDate(p)).toBe(TODAY);
    expect(nextProjectDate(fresh().projects.find((x) => x.id === 'p-jzero')!)).toBe(addDays(TODAY, 6)); // Mix done -> Master end
  });
});

describe('bills', () => {
  it('paying one month does not pay other months', () => {
    let s = fresh();
    const before = visibleOccurrences(s.bills.find((b) => b.id === 'b-elec')!, TODAY);
    expect(before.find((o) => o.month === '2026-10')!.paid).toBe(false);
    s = reducer(s, { type: 'bill/pay', billId: 'b-elec', month: '2026-10', paid: true });
    const bill = s.bills.find((b) => b.id === 'b-elec')!;
    expect(bill.payments['2026-10'].paid).toBe(true);
    expect(bill.payments['2026-11']).toBeUndefined();
  });
  it('keeps a missed month visible alongside the current one', () => {
    const occ = visibleOccurrences(fresh().bills.find((b) => b.id === 'b-water')!, TODAY);
    expect(occ.map((o) => [o.month, o.missed])).toEqual([['2026-09', true], ['2026-10', false]]);
  });
  it('opens the reminder window using the editable offset', () => {
    let s = fresh();
    expect(visibleOccurrences(s.bills[0], TODAY)[0].reminding).toBe(false); // 4 days out, offset 2
    s = reducer(s, { type: 'bill/update', billId: 'b-elec', patch: { reminderDays: 5 } });
    expect(visibleOccurrences(s.bills[0], TODAY).find((o) => o.month === '2026-10')!.reminding).toBe(true);
  });
});

describe('agenda', () => {
  it('lists each task once, overdue by deadline', () => {
    const items = buildAgenda(fresh(), TODAY).filter((i) => i.ref.type === 'task');
    const ids = items.map((i) => (i.ref as { id: string }).id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(items.find((i) => i.title.startsWith('Call landlord'))!.overdue).toBe(true);
  });
  it('Today strip has today and overdue items, not future ones', () => {
    const titles = todayItems(fresh(), TODAY).map((i) => i.title);
    expect(titles).toContain('Clean food box');
    expect(titles).toContain('Record vocals');
    expect(titles).not.toContain('Review budget');
  });
});

describe('misc', () => {
  it('formats relative dates', () => {
    expect(relLabel(TODAY, TODAY)).toBe('Today');
    expect(relLabel(addDays(TODAY, 1), TODAY)).toBe('Tomorrow');
    expect(relLabel('2026-10-18', TODAY)).toBe('18 Oct');
  });
  it('builds an encoded obsidian:// link without launching anything', () => {
    expect(obsidianUri('Planning/Tasks/Clean food box.md')).toBe(
      'obsidian://open?vault=FRANKK%20VAULT%20-%20AI%20Hub&file=Planning%2FTasks%2FClean%20food%20box',
    );
  });
});

describe('iteration 3 rules', () => {
  it('own release progress counts only the main step bar, never Marketing/MV/Streaming', () => {
    const p = fresh().projects.find((x) => x.id === 'p-single')!;
    const main = projectProgress(p);
    const withSideDone = { ...p, stages: p.stages.map((s) => (s.track === 'side' ? { ...s, done: true } : s)) };
    expect(projectProgress(withSideDone)).toEqual(main);
    expect(p.stages.filter((s) => s.track === 'main').map((s) => s.name)).toEqual(['Concept', 'Lyrics', 'Produce', 'Record', 'Mix & Master', 'Art (Design)']);
  });
  it('new tags are registered with a colour; renaming a tag renames it everywhere', () => {
    let s = reducer(fresh(), { type: 'task/add', title: 'Call bank', extra: { tags: ['#Bank Stuff'] } });
    expect(s.tags.find((t) => t.name === 'bank-stuff')?.color).toMatch(/^#/);
    s = reducer(s, { type: 'tag/update', name: 'home', patch: { name: 'house' } });
    expect(s.tasks.find((t) => t.id === 't-food')!.tags).toContain('house');
    expect(s.tags.some((t) => t.name === 'home')).toBe(false);
  });
  it('repost queue items are simple to-dos', () => {
    expect(fresh().tasks.filter((t) => t.workstream === 'content').every((t) => t.mode === 'simple' && t.steps.length === 0)).toBe(true);
  });
  it('renaming a brand keeps its colour', () => {
    const s = reducer(fresh(), { type: 'brand/rename', from: 'Eli Lao Origin', to: 'Eli Lao' });
    expect(s.brandColors['Eli Lao']).toBe('#3f9a80');
  });
});

import { inferKind, toMarkdown } from './data/schema';
import { applyView, recordsOf } from './lib/records';

describe('object system', () => {
  it('detects field kinds from names and sample values', () => {
    expect(inferKind('Budget')).toBe('currency');
    expect(inferKind('Release date')).toBe('date');
    expect(inferKind('BPM')).toBe('number');
    expect(inferKind('Status')).toBe('select');
    expect(inferKind('Website')).toBe('url');
    expect(inferKind('Anything', 'https://x.com')).toBe('url');
    expect(inferKind('Anything', '2026-10-30')).toBe('date');
    expect(inferKind('Anything', 'a@b.co')).toBe('email');
    expect(inferKind('Anything', '75%')).toBe('percent');
    expect(inferKind('Anything', '120')).toBe('number');
    expect(inferKind('Is signed')).toBe('checkbox');
  });
  it('custom fields on built-in types are stored in props and readable by views', () => {
    let s = fresh();
    s = reducer(s, { type: 'record/set', typeId: 'task', id: 't-dentist', key: 'energy', value: 'Errand' });
    const recs = recordsOf(s, 'task', TODAY);
    expect(recs.find((r) => r.id === 't-dentist')!.get('energy')).toBe('Errand');
    const errands = applyView(recs, { filters: [{ field: 'energy', op: 'is', value: 'Errand' }] });
    expect(errands.map((r) => r.id).sort()).toEqual(['t-dentist', 't-food']);
  });
  it('computed fields cannot be overwritten', () => {
    const s = fresh();
    expect(reducer(s, { type: 'record/set', typeId: 'task', id: 't-food', key: 'progress', value: 5 })).toBe(s);
  });
  it('user types hold entries; views sort them', () => {
    const recs = applyView(recordsOf(fresh(), 'person', TODAY), { filters: [], sort: { field: 'title', dir: 'asc' } });
    expect(recs.map((r) => r.title)).toEqual(['Jing', 'Just', 'JZero', 'Mum']);
  });
  it('writes Obsidian-compatible frontmatter', () => {
    expect(toMarkdown({ type: 'person', role: 'Artist', tags: ['client'], rate: 1500000 }, 'Hi')).toBe(
      '---\ntype: person\nrole: Artist\ntags:\n  - "client"\nrate: 1500000\n---\n\nHi\n');
  });
});

import { renderMarkdown, wikilinksIn } from './lib/markdown';
describe('markdown', () => {
  it('escapes HTML and renders wikilinks', () => {
    const html = renderMarkdown('<script>x</script> see [[Jing]] and [[Nope]]', ['Jing']);
    expect(html).not.toContain('<script>');
    expect(html).toContain('data-wikilink="Jing"');
    expect(html).toContain('wikilink unresolved');
    expect(wikilinksIn('a [[B]] c [[D|alias]]')).toEqual(['B', 'D']);
  });
});
