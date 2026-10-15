import { buildAgenda } from './agenda';
import { addDays, parseISO, type ISODate } from './dates';
import { checklistProgress } from './progress';
import { ARAMAIC, SAYINGS, VERSES, type Mood, type Verse } from '../data/verses';
import type { AppData } from '../data/types';

export const MOODS: { id: Mood; label: string; hint: string }[] = [
  { id: 'chill', label: 'Chill', hint: 'Light day: rest, tidy, think.' },
  { id: 'steady', label: 'Steady', hint: 'A normal day: keep a calm pace.' },
  { id: 'focused', label: 'Focused', hint: 'Busy: one thing at a time, finish before starting.' },
  { id: 'locked', label: 'Locked in', hint: 'Heavy: close the distractions and push.' },
];

export interface Load { score: number; mood: Mood; reasons: string[]; overdue: number; dueToday: number; officeDay: boolean }

/** Top of the dial; scores past this read as fully locked in. */
export const LOAD_MAX = 16;

/**
 * How heavy today is, from what's already in Esther: late items count most, then today's, then tomorrow's,
 * plus a B-YOU office day on weekdays. A rough guide to the mood the day needs, not a measure of hours.
 */
export function dayLoad(data: AppData, today: ISODate): Load {
  const agenda = buildAgenda(data, today);
  const overdue = agenda.filter((i) => i.overdue).length;
  const dueToday = agenda.filter((i) => !i.overdue && i.date === today).length;
  const tomorrow = agenda.filter((i) => i.date === addDays(today, 1)).length;
  const dow = parseISO(today).getDay();
  const officeDay = dow >= 1 && dow <= 5;
  // Unfinished steps of today's checklist tasks add weight: a task with eight steps left is not one small thing.
  const stepsLeft = data.tasks
    .filter((t) => !t.done && t.mode === 'progress' && ((t.plan ?? t.due ?? '9999') <= today))
    .reduce((n, t) => { const p = checklistProgress(t.steps); return n + (p.total - p.done); }, 0);
  const score = overdue * 2 + dueToday * 1.5 + tomorrow * 0.5 + (officeDay ? 3 : 0) + Math.min(3, stepsLeft * 0.25);
  const mood: Mood = score < 4 ? 'chill' : score < 8 ? 'steady' : score < 12 ? 'focused' : 'locked';
  const reasons = [
    overdue ? `${overdue} late` : '',
    dueToday ? `${dueToday} due today` : '',
    tomorrow ? `${tomorrow} tomorrow` : '',
    officeDay ? 'B-YOU office day' : 'no office today',
    stepsLeft ? `${stepsLeft} step${stepsLeft === 1 ? '' : 's'} left` : '',
  ].filter(Boolean);
  return { score, mood, reasons, overdue, dueToday, officeDay };
}

/**
 * The line before the verse: short, old-sounding sayings that never name anyone, so they read like an inscription.
 * Your own saved sayings join every mood's list.
 */
const LINES: Record<Mood, string[]> = {
  locked: [
    'The furnace is lit. What is gold in thee will stay.',
    'Heavy days are the forge where the strong are made.',
    'Close the gates. Let the work be the prayer.',
    'What is carried today need not be carried tomorrow.',
  ],
  focused: [
    'The arrow does not look at the other targets.',
    'One road, walked to its end.',
    'Finish, and only then begin.',
    'A single flame, held still, burns through the night.',
  ],
  steady: [
    'The lamp burns longest at a low flame.',
    'Slow rivers cut the deepest stone.',
    'Neither haste nor sloth; the middle way is strong.',
    'Tend the day as a monk tends his garden.',
  ],
  chill: [
    'The field that rests bears the fuller grain.',
    'Even the bells keep silence between the hours.',
    'Stillness, too, is a labour.',
    'The vine does not hurry, and yet the wine is made.',
  ],
};

/** A small, stable number from text, so a day keeps its blessing until you ask for another. */
function seed(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export interface Blessing { word: (typeof ARAMAIC)[number]; line: string; yours: boolean; verse: Verse }

/** The morning blessing for a day and mood. `turn` steps to another verse and line; the same inputs always give the same words. */
export function blessing(today: ISODate, mood: Mood, turn = 0, hard = false): Blessing {
  const s = seed(today);
  const pool = VERSES.filter((v) => v.moods.includes(mood) && (!hard || v.hard));
  const verses = pool.length ? pool : VERSES.filter((v) => v.moods.includes(mood));
  const words = ARAMAIC.filter((w) => w.moods.includes(mood));
  const lines = [...LINES[mood].map((t) => ({ t, yours: false })), ...SAYINGS.map((t) => ({ t, yours: true }))];
  return {
    // each turn moves every part one step on, so "another" never repeats until the list comes round again
    word: words[((s >>> 5) + turn) % words.length],
    line: lines[((s >>> 3) + turn) % lines.length].t,
    yours: lines[((s >>> 3) + turn) % lines.length].yours,
    verse: verses[(s + turn) % verses.length],
  };
}
