import { describe, expect, it } from 'vitest';
import { buildFixtures } from './data/fixtures';
import { ARAMAIC, VERSES } from './data/verses';
import { MOODS, blessing, dayLoad } from './lib/mood';

const TODAY = '2026-10-14'; // a Wednesday

describe('verses', () => {
  it('every verse carries its words, reference and translation', () => {
    for (const v of VERSES) {
      expect(v.text.length).toBeGreaterThan(10);
      expect(v.ref).toBeTruthy();
      expect(v.tr).toBeTruthy();
      expect(v.moods.length).toBeGreaterThan(0);
    }
    expect(new Set(VERSES.map((v) => v.id)).size).toBe(VERSES.length);
  });
  it('every mood has several verses and an Aramaic greeting', () => {
    for (const m of MOODS) {
      expect(VERSES.filter((v) => v.moods.includes(m.id)).length).toBeGreaterThanOrEqual(3);
      expect(ARAMAIC.some((a) => a.moods.includes(m.id))).toBe(true);
    }
  });
});

describe('blessing', () => {
  it('keeps the same words for the same day and mood', () => {
    expect(blessing(TODAY, 'focused')).toEqual(blessing(TODAY, 'focused'));
  });
  it('"another" gives a different verse, drawn from that mood', () => {
    const a = blessing(TODAY, 'chill', 0), b = blessing(TODAY, 'chill', 1);
    expect(b.verse.id).not.toBe(a.verse.id);
    expect(b.verse.moods).toContain('chill');
  });
  it('a day with a lot already late picks a verse for hard days', () => {
    expect(blessing(TODAY, 'locked', 0, 'Frankk', true).verse.hard).toBe(true);
  });
  it('speaks to you by name', () => {
    expect(blessing(TODAY, 'steady').line).toContain('Frankk');
  });
});

describe('day load', () => {
  it('an empty weekend is chill', () => {
    const data = { ...buildFixtures(TODAY), tasks: [], bills: [], projects: [] };
    const l = dayLoad(data, '2026-10-18'); // Sunday
    expect(l.mood).toBe('chill');
    expect(l.officeDay).toBe(false);
  });
  it('a weekday counts the B-YOU office day', () => {
    const data = { ...buildFixtures(TODAY), tasks: [], bills: [], projects: [] };
    const l = dayLoad(data, TODAY);
    expect(l.officeDay).toBe(true);
    expect(l.reasons).toContain('B-YOU office day');
    expect(l.score).toBe(3);
  });
  it('late and due work make the day heavier', () => {
    const l = dayLoad(buildFixtures(TODAY), TODAY);
    expect(l.overdue).toBeGreaterThan(0);
    expect(l.dueToday).toBeGreaterThan(0);
    expect(['focused', 'locked']).toContain(l.mood);
  });
});
