import { longToday, type ISODate } from './dates';
import type { Note } from '../data/schema';

/** What a line typed into the bar becomes. */
export type Kind = 'task' | 'idea' | 'progress' | 'context' | 'journal';

export const KINDS: { id: Kind; label: string; prefix: string; hint: string }[] = [
  { id: 'task', label: 'Task', prefix: 't:', hint: 'A to-do in General' },
  { id: 'idea', label: 'Idea', prefix: 'i:', hint: 'A spark for your Ideas board' },
  { id: 'progress', label: 'Progress', prefix: 'p:', hint: 'What moved forward, written in today’s journal' },
  { id: 'context', label: 'Context', prefix: 'c:', hint: 'Something to remember about what’s going on' },
  { id: 'journal', label: 'Journal', prefix: 'j:', hint: 'A line for today’s page in the Book' },
];

const PREFIX = /^(t|task|i|idea|p|progress|c|context|j|journal)\s*:\s*/i;
const FULL: Record<string, Kind> = { t: 'task', i: 'idea', p: 'progress', c: 'context', j: 'journal' };

/** "idea: lao folk pack" → an idea; no prefix → a task. */
export function detectKind(input: string): { kind: Kind; text: string; explicit: boolean } {
  const m = input.match(PREFIX);
  if (!m) return { kind: 'task', text: input.trim(), explicit: false };
  return { kind: FULL[m[1][0].toLowerCase()], text: input.slice(m[0].length).trim(), explicit: true };
}

/** Each day's journal is one note in Esther's own folder, named by its date. */
export const JOURNAL_FOLDER = 'Esther/Journal';
export const journalId = (day: ISODate) => `journal-${day}`;
/** Folders whose notes are journal days (Journal is where older notes and Obsidian daily notes may live). */
export const isJournal = (folder: string) => folder === JOURNAL_FOLDER || folder === 'Journal';
export const findJournal = (notes: Note[], day: ISODate) => notes.find((n) => n.id === journalId(day));

const LABEL: Partial<Record<Kind, string>> = { progress: 'Progress', context: 'Context', idea: 'Idea', task: 'Task' };

/** One timestamped line: "- 09:12 · Progress: mixed the second verse". */
export function journalLine(time: string, kind: Kind, text: string) {
  return `- ${time} · ${LABEL[kind] ? `${LABEL[kind]}: ` : ''}${text.replace(/\s*\n\s*/g, ' ')}`;
}

export function newJournal(day: ISODate, firstLine: string, now: string): Note {
  return {
    id: journalId(day), title: day, folder: JOURNAL_FOLDER, author: 'me', tags: ['journal'], props: {},
    body: `# ${longToday(day)}\n\n${firstLine}`, created: now, updated: now, path: `${JOURNAL_FOLDER}/${day}.md`,
  };
}

export interface JournalEntry { time: string; kind: Kind; text: string }

export function parseJournal(body: string): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^- (\d\d:\d\d) · (?:(Progress|Context|Idea|Task): )?(.*)$/);
    if (m) { out.push({ time: m[1], kind: (m[2]?.toLowerCase() as Kind) ?? 'journal', text: m[3] }); continue; }
    // Lines you wrote yourself on the page (no time) are part of the day too.
    const plain = line.match(/^\s*[-*] (?:\[[ x]\] )?(.+)$/i);
    if (plain) out.push({ time: '', kind: 'journal', text: plain[1] });
  }
  return out;
}
