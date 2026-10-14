// Date-only values are ISO strings (YYYY-MM-DD) in the user's local calendar.
// `?today=YYYY-MM-DD` overrides the clock so screenshots and tests are repeatable.

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): ISODate {
  if (typeof window !== 'undefined') {
    const override = new URLSearchParams(window.location.search).get('today');
    if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  }
  return toISO(new Date());
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86_400_000);
}

export const monthKey = (s: ISODate) => s.slice(0, 7);

export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function dateInMonth(key: string, day: number): ISODate {
  return `${key}-${pad(Math.min(day, daysInMonth(key)))}`;
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1];
export const monthTitle = (key: string) => `${MONTHS_LONG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

/** "16 Oct" (adds the year when it isn't the current one). */
export function shortDate(s: ISODate, today = todayISO()): string {
  const d = parseISO(s);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === Number(today.slice(0, 4)) ? base : `${base} ${d.getFullYear()}`;
}

/** Friendly label: Today / Tomorrow / Yesterday / "16 Oct". */
export function relLabel(s: ISODate, today = todayISO()): string {
  const diff = diffDays(s, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return shortDate(s, today);
}

export function longToday(today = todayISO()): string {
  const d = parseISO(today);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function weekdayShort(s: ISODate): string {
  return DAYS[parseISO(s).getDay()];
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
