import { addDays, parseISO, toISO, type ISODate } from './dates';
import { detectKind, type Kind } from './journal';
import type { Priority, TaskArea } from '../data/types';

/**
 * Reads a plain sentence typed into the bar, without AI: where it belongs, when it's due, how urgent it is,
 * and whether to note it in today's journal. Everything it recognises is shown back before you press Enter.
 * "create a task for byou doing poster due date at 5th december and journal it"
 *   → task "Poster" · B-YOU · due 5 Dec · also in today's journal
 */
export interface Parsed {
  kind: Kind;
  title: string;
  area: TaskArea;
  list?: string;
  brand?: string;
  tags: string[];
  due?: ISODate;
  plan?: ISODate;
  priority?: Priority;
  journal: boolean;
  explicit: boolean;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)';
const TAG_RE = /#[\p{L}\p{N}_-]+/gu;

/** The next date on or after today for a day and month (this year, or next year if it has passed). */
function nextDayMonth(today: ISODate, day: number, month: number): ISODate | undefined {
  if (day < 1 || day > 31 || month < 0 || month > 11) return undefined;
  const y = Number(today.slice(0, 4));
  let d = toISO(new Date(y, month, day));
  if (d < today) d = toISO(new Date(y + 1, month, day));
  return d;
}

/** Finds one date phrase; returns the date and the exact text it came from. */
export function findDate(text: string, today: ISODate): { date: ISODate; match: string } | undefined {
  const t = text.toLowerCase();
  const tries: [RegExp, (m: RegExpMatchArray) => ISODate | undefined][] = [
    [/\b(\d{4}-\d{2}-\d{2})\b/, (m) => m[1]],
    [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+${MONTH_RE}\\b`), (m) => nextDayMonth(today, +m[1], MONTHS.indexOf(m[2].slice(0, 3)))],
    [new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`), (m) => nextDayMonth(today, +m[2], MONTHS.indexOf(m[1].slice(0, 3)))],
    // Day first, the way dates are written in Laos: 5/12 is 5 December.
    [/\b(\d{1,2})\/(\d{1,2})\b/, (m) => nextDayMonth(today, +m[1], +m[2] - 1)],
    [/\btoday\b|\btonight\b/, () => today],
    [/\btomorrow\b|\btmr\b/, () => addDays(today, 1)],
    [/\bday after tomorrow\b/, () => addDays(today, 2)],
    [/\bin (\d+) days?\b/, (m) => addDays(today, +m[1])],
    [/\bin (\d+) weeks?\b/, (m) => addDays(today, 7 * +m[1])],
    [/\bnext week\b/, () => { const dow = (parseISO(today).getDay() + 6) % 7; return addDays(today, 7 - dow); }],
    [/\bend of (?:the )?month\b/, () => { const d = parseISO(today); return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }],
    [new RegExp(`\\b(?:next\\s+|this\\s+)?${DAY_RE}\\b`), (m) => {
      // The coming one: "friday" on a Wednesday is in two days; on a Friday it's a week away.
      const want = DAYS.findIndex((d) => d.startsWith(m[1].slice(0, 3)));
      const n = (want - parseISO(today).getDay() + 7) % 7 || 7;
      return addDays(today, n);
    }],
  ];
  // Prefer the earliest-placed match in the sentence among the patterns that work.
  let best: { date: ISODate; match: string; at: number } | undefined;
  for (const [re, fn] of tries) {
    const m = t.match(re);
    if (!m || m.index === undefined) continue;
    const date = fn(m);
    if (date && (!best || m.index < best.at)) best = { date, match: text.slice(m.index, m.index + m[0].length), at: m.index };
  }
  return best && { date: best.date, match: best.match };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parseCommand(input: string, today: ISODate, brands: string[] = []): Parsed {
  const d = detectKind(input);
  let text = d.text;
  const kind = d.kind;
  const out: Parsed = { kind, title: '', area: 'general', tags: [], journal: false, explicit: d.explicit };
  const cut = (re: RegExp) => { const m = text.match(re); if (m) text = text.replace(re, ' '); return m; };

  // "#tags" become tags.
  out.tags = [...new Set((text.match(TAG_RE) ?? []).map((x) => x.slice(1).toLowerCase()))];
  text = text.replace(TAG_RE, ' ');

  if (kind === 'task') {
    // Filler that says "this is a task".
    cut(/^\s*(?:please\s+)?(?:can you\s+)?(?:create|add|make|new|set up|put)\s+(?:a\s+|an\s+|new\s+)?(?:task|to-?do|reminder)?\s*(?:to|for|:)?\s*/i);
    cut(/^\s*(?:remind me to|i need to|i have to|need to|gotta|todo:?)\s+/i);

    // "and journal it", "log it to the knowledge base": also write it in today's journal.
    if (cut(/\s*,?\s*(?:and\s+)?(?:journal|log|note)\s+(?:it|this)(?:\s+(?:to|in|into)\s+(?:the\s+|my\s+)?(?:journal|knowledge\s*base|book|notes?))?\b/i)
      || cut(/\s*,?\s*(?:and\s+)?(?:add|save|put)\s+(?:it\s+)?(?:to|in|into)\s+(?:the\s+|my\s+)?(?:journal|knowledge\s*base|book)\b/i)) out.journal = true;

    if (cut(/\b(?:urgent(?:ly)?|asap|high priority|important)\b/i)) out.priority = 'high';
    else if (cut(/\b(?:low priority|someday|whenever)\b/i)) out.priority = 'low';

    // Where it belongs. B-YOU has no panel of its own yet, so its tasks go to General in a "B-YOU" list.
    if (cut(/\b(?:for|at|in)?\s*(?:b[\s-]?you|byou)\b(?:\s+office)?/i)) { out.list = 'B-YOU'; out.tags.push('byou'); }
    else {
      const brand = brands.find((b) => new RegExp(`\\b${esc(b.split(/\s+/)[0])}\\b`, 'i').test(text));
      if (brand) { out.area = 'seround'; out.brand = brand; cut(new RegExp(`\\b(?:for|at)?\\s*${esc(brand.split(/\s+/)[0])}\\b(?:\\s+${brand.split(/\s+/).slice(1).map(esc).join('\\s+')})?`, 'i')); }
      else if (cut(/\b(?:for|at|in)?\s*(?:se'?round)\b/i)) { out.area = 'seround'; out.brand = brands[0]; }
      else if (cut(/\b(?:for|at|in|around)\s+(?:the\s+)?(?:house|home)\b/i)) out.area = 'house';
      else if (cut(/\b(?:for|at|in)\s+(?:the\s+)?(?:studio|surftape)\b/i)) out.tags.push('music');
    }

    // When: "due 5th december", "by friday", "deadline next week" is a deadline; "on friday", "tomorrow" is when to do it.
    const dt = findDate(text, today);
    if (dt) {
      const before = text.slice(0, text.toLowerCase().indexOf(dt.match.toLowerCase()));
      const dueWord = /\b(?:due(?:\s+date)?|by|deadline|before|until)\s*(?:is|at|on|of|:)?\s*$/i;
      if (dueWord.test(before)) { out.due = dt.date; text = before.replace(dueWord, ' ') + text.slice(before.length + dt.match.length); }
      else { out.plan = dt.date; text = text.replace(dt.match, ' ').replace(/\b(?:on|at|for)\s+$/i, ' '); }
    }
    text = text.replace(/\b(?:due(?:\s+date)?|deadline)\b\s*(?:is|at|on)?/gi, ' ');
    // Leading verbs that only introduce the work: "doing poster" → "Poster".
    text = text.replace(/^\s*(?:doing|do|to|working on|work on|the)\s+/i, '');
  }

  const title = text.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').trim();
  // Task names start with a capital; journal lines and ideas keep your words exactly as typed.
  out.title = !title ? d.text : kind === 'task' ? title[0].toUpperCase() + title.slice(1) : title;
  out.tags = [...new Set(out.tags)];
  return out;
}
