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

import { findDate, parseCommand } from './lib/parse';

describe('reading a sentence in the bar', () => {
  const BR = ['sundey ສະບາຍດີຈຸເຈົ້າ', 'Eli Lao Origin', 'Reva Gem Cosmentics'];
  it('understands the B-YOU poster example', () => {
    const p = parseCommand('create a task for byou doing poster due date at 5th december and journal it to knowledge base', TODAY, BR);
    expect(p).toMatchObject({ kind: 'task', title: 'Poster', list: 'B-YOU', due: '2026-12-05', journal: true, area: 'general' });
    expect(p.tags).toContain('byou');
  });
  it('reads dates in many shapes', () => {
    expect(findDate('by dec 5', TODAY)?.date).toBe('2026-12-05');
    expect(findDate('on 5/12', TODAY)?.date).toBe('2026-12-05');
    expect(findDate('tomorrow', TODAY)?.date).toBe('2026-10-15');
    expect(findDate('friday', TODAY)?.date).toBe('2026-10-16');
    expect(findDate('in 3 days', TODAY)?.date).toBe('2026-10-17');
    expect(findDate('next week', TODAY)?.date).toBe('2026-10-19');
    expect(findDate('2 march', TODAY)?.date).toBe('2027-03-02');
  });
  it('a date with due/by is a deadline; on its own it is when to do it', () => {
    expect(parseCommand('call bank by friday', TODAY)).toMatchObject({ title: 'Call bank', due: '2026-10-16' });
    expect(parseCommand('call bank tomorrow', TODAY)).toMatchObject({ title: 'Call bank', plan: '2026-10-15' });
  });
  it('finds the brand, the house and urgency', () => {
    expect(parseCommand('sundey reel recap urgent', TODAY, BR)).toMatchObject({ area: 'seround', brand: BR[0], priority: 'high', title: 'Reel recap' });
    expect(parseCommand('fix the tap at home', TODAY, BR)).toMatchObject({ area: 'house', title: 'Fix the tap' });
  });
  it('leaves prefixed kinds alone', () => {
    expect(parseCommand('j: quiet morning', TODAY)).toMatchObject({ kind: 'journal', title: 'quiet morning' });
  });
});

describe('music in the bar, and placing new tasks', () => {
  const projects = () => buildFixtures(TODAY).projects;
  it('"record just vocal" is an item on Just’s Record stage, dated Friday, with no "this week" left over', () => {
    const p = parseCommand('In music to record just vocal on friday this week', TODAY, [], projects());
    const just = projects().find((x) => x.artist === 'Just')!;
    expect(p.music?.projectId).toBe(just.id);
    expect(p.music?.stage.toLowerCase()).toContain('record');
    expect(p.music?.addsScope).toBe(true); // Record was outside your producer scope on Just's job
    expect(p.plan).toBe('2026-10-16');
    expect(p.title).toBe('Record vocal');
  });
  it('"just" as an ordinary word does not pick the artist', () => {
    expect(parseCommand('just call the bank tomorrow', TODAY, [], projects()).music).toBeUndefined();
  });
  it('music with no project becomes a task tagged #music', () => {
    const p = parseCommand('in music to sort sample folders', TODAY, [], projects());
    expect(p.music).toBeUndefined();
    expect(p.tags).toContain('music');
    expect(p.title).toBe('Sort sample folders');
  });
  it('"this week" alone means by Sunday', () => {
    expect(parseCommand('renew passport this week', TODAY).plan ?? parseCommand('renew passport this week', TODAY).due).toBe('2026-10-18');
  });
});
