import { describe, expect, it } from 'vitest';
import { buildFixtures } from './data/fixtures';
import { beginOrder, canOpenHere } from './lib/begin';
import { detectKind, journalLine, parseJournal } from './lib/journal';

const TODAY = '2026-10-14';

describe('begin here', () => {
  it('puts late work first, oldest first, then today', () => {
    const p = beginOrder(buildFixtures(TODAY), TODAY);
    const firstNotLate = p.findIndex((x) => !x.item.overdue);
    expect(p.slice(0, firstNotLate).every((x) => x.item.overdue)).toBe(true);
    expect(p.slice(firstNotLate).every((x) => !x.item.overdue)).toBe(true);
    const late = p.filter((x) => x.item.overdue).map((x) => x.item.date);
    expect([...late].sort()).toEqual(late);
    expect(p[0].why).toMatch(/^Late since/);
  });
  it('a task\u2019s shortcut comes along with it', () => {
    const d = buildFixtures(TODAY);
    const t = d.tasks.find((x) => !x.done && x.due && x.due < TODAY)!;
    t.props = { launch: 'https://example.com' };
    expect(beginOrder(d, TODAY).find((x) => x.item.key === `task:${t.id}`)?.launch).toBe('https://example.com');
  });
  it('only web and Obsidian links open from the preview', () => {
    expect(canOpenHere('obsidian://open?vault=x')).toBe(true);
    expect(canOpenHere('D:\\Work\\Byou\\poster.ai')).toBe(false);
  });
});

describe('the bar and the journal', () => {
  it('a plain line is a task; prefixes choose the kind', () => {
    expect(detectKind('buy dog medicine')).toEqual({ kind: 'task', text: 'buy dog medicine', explicit: false });
    expect(detectKind('idea: neon chant').kind).toBe('idea');
    expect(detectKind('P: mixed verse two')).toMatchObject({ kind: 'progress', text: 'mixed verse two' });
    expect(detectKind('journal: quiet morning').kind).toBe('journal');
  });
  it('journal lines are timestamped and read back', () => {
    const body = ['# Wed', '', journalLine('09:12', 'progress', 'mixed verse two'), journalLine('21:40', 'journal', 'long day')].join('\n');
    expect(parseJournal(body)).toEqual([
      { time: '09:12', kind: 'progress', text: 'mixed verse two' },
      { time: '21:40', kind: 'journal', text: 'long day' },
    ]);
  });
});

import { pickSparks, ideaAge } from './lib/sparks';

describe('sparks', () => {
  it('brings back the idea left alone longest (at least a week old), and lists the newest sparks', () => {
    const d = buildFixtures(TODAY);
    const { revisit, fresh } = pickSparks(d, TODAY);
    expect(revisit?.id).toBe('e-audit'); // caught 30 days ago, never revisited
    expect(fresh.map((e) => e.id)).not.toContain('e-audit');
    expect(fresh[0].id).toBe('e-merch'); // the newest spark first
  });
  it('a kept idea rests three weeks; shelved and in-progress ideas leave', () => {
    const d = buildFixtures(TODAY);
    d.entries = d.entries.map((e) => (e.id === 'e-audit' ? { ...e, props: { ...e.props, revisited: TODAY } } : e.id === 'e-chant' ? { ...e, props: { ...e.props, status: 'Shelved' } } : e));
    const { revisit, fresh } = pickSparks(d, TODAY);
    expect(revisit?.id).not.toBe('e-audit');
    expect([revisit?.id, ...fresh.map((e) => e.id)]).not.toContain('e-chant');
    expect(d.entries.find((e) => e.id === 'e-studio')).toBeTruthy();
    expect([revisit?.id, ...fresh.map((e) => e.id)]).not.toContain('e-studio'); // already Doing
  });
  it('says how old an idea is in short words', () => {
    const d = buildFixtures(TODAY);
    expect(ideaAge(d.entries.find((e) => e.id === 'e-merch')!, TODAY)).toBe('2d');
    expect(ideaAge(d.entries.find((e) => e.id === 'e-chant')!, TODAY)).toBe('3w');
  });
});
