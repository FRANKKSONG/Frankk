import type { ISODate } from './dates';

/** Your motto and your own sayings, kept exactly as you wrote them. */
export const MOTTO = 'An ancient dreams in a modern land';
export const SAYINGS = ['The moment you’re disturbed by insult or pleased by praise, you’re still slave'];

/** Short, old-sounding lines that never name anyone, like an inscription. */
const LINES = [
  'The lamp burns longest at a low flame.',
  'Slow rivers cut the deepest stone.',
  'One road, walked to its end.',
  'Finish, and only then begin.',
  'The arrow does not look at the other targets.',
  'What is carried today need not be carried tomorrow.',
  'The field that rests bears the fuller grain.',
  'Stillness, too, is a labour.',
  'The vine does not hurry, and yet the wine is made.',
  'Tend the day as a monk tends his garden.',
];

function seed(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** One line for the day: the same all day, a different one tomorrow. */
export function lineFor(day: ISODate): string {
  const all = [...LINES, ...SAYINGS, MOTTO];
  return all[seed(day) % all.length];
}
