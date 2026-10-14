import type { ISODate } from '../lib/dates';
import type { IconName } from '../components/Icons';

/**
 * Esther's object system. Every thing in your life is a record of a Type.
 * A Type has Fields; each Field has a Kind that decides how it is stored (as Obsidian
 * frontmatter), edited (the right control) and summarised (the right chart / number).
 */
export type FieldKind =
  | 'text' | 'longtext' | 'number' | 'currency' | 'percent' | 'date' | 'checkbox'
  | 'select' | 'multiselect' | 'url' | 'email' | 'phone' | 'rating' | 'duration' | 'relation';

export interface FieldOption { value: string; color: string }

export interface FieldDef {
  key: string;
  name: string;
  kind: FieldKind;
  options?: FieldOption[];
  /** For relation fields: the type this field points to. */
  relationType?: string;
  currency?: string;
  /** Built-in fields belong to Esther's own model; they can be hidden but not removed. */
  builtin?: boolean;
  /** Computed fields are read-only (e.g. progress). */
  computed?: boolean;
}

export interface TypeDef {
  id: string;
  name: string;
  plural: string;
  icon: IconName;
  color: string;
  /** Vault folder where records of this type live as Markdown files. */
  folder: string;
  fields: FieldDef[];
  builtin?: boolean;
}

/** A record of a user-defined type (People, Ideas, Clients…). One Markdown file each. */
export interface Entry {
  id: string;
  typeId: string;
  title: string;
  props: Record<string, unknown>;
  body?: string;
  tags: string[];
  archived?: boolean;
  created: string;
  updated: string;
  path: string;
}

export interface Note {
  id: string;
  title: string;
  folder: string;
  body: string;
  tags: string[];
  props: Record<string, unknown>;
  /** Who wrote it: me, or the AI librarian (AI notes live in the AI's own folder). */
  author: 'me' | 'ai';
  pinned?: boolean;
  created: string;
  updated: string;
  path: string;
}

export interface ViewFilter { field: string; op: 'is' | 'is-not' | 'contains' | 'empty' | 'not-empty' | 'before' | 'after'; value?: string }
export type ViewLayout = 'table' | 'board' | 'gallery' | 'calendar' | 'list';

export interface ViewDef {
  id: string;
  typeId: string;
  name: string;
  layout: ViewLayout;
  filters: ViewFilter[];
  sort?: { field: string; dir: 'asc' | 'desc' };
  groupBy?: string;
  dateField?: string;
  fields: string[];
  /** Column widths in px for table layout. */
  widths?: Record<string, number>;
}

export type WidgetKind = 'stat' | 'today' | 'week' | 'music' | 'money' | 'view' | 'note' | 'image' | 'capture' | 'notes-recent';
export type StatMetric = 'due-today' | 'overdue' | 'open-tasks' | 'bills-unpaid' | 'release-progress' | 'done-week' | 'notes-count' | 'records-count';

export interface WidgetDef {
  id: string;
  kind: WidgetKind;
  title: string;
  color?: string;
  config: { metric?: StatMetric; viewId?: string; noteId?: string; image?: string; typeId?: string; caption?: string };
}

export interface Dashboard {
  id: string;
  name: string;
  /** Background art: a built-in preset id or an uploaded image (data URL). */
  background?: string;
  dim: number;
  widgets: WidgetDef[];
  layout: { i: string; x: number; y: number; w: number; h: number }[];
}

/* ---------- smart field kinds ---------- */

export const KIND_LABEL: Record<FieldKind, string> = {
  text: 'Text', longtext: 'Long text', number: 'Number', currency: 'Money', percent: 'Percent', date: 'Date', checkbox: 'Checkbox',
  select: 'Choice', multiselect: 'Multiple choice', url: 'Link', email: 'Email', phone: 'Phone', rating: 'Rating', duration: 'Duration', relation: 'Relation',
};

export const KIND_ICON: Record<FieldKind, string> = {
  text: 'Aa', longtext: '¶', number: '#', currency: '₭', percent: '%', date: '▦', checkbox: '☑', select: '◉', multiselect: '◎',
  url: '↗', email: '@', phone: '☏', rating: '★', duration: '◷', relation: '⇄',
};

const NAME_RULES: [RegExp, FieldKind][] = [
  [/\b(date|due|deadline|birthday|born|start|end|release|when|day of)\b/i, 'date'],
  [/\b(price|cost|budget|amount|fee|rate|salary|income|expense|paid|payment|kip|lak|usd|money|value)\b/i, 'currency'],
  [/(percent|%|completion|ratio)/i, 'percent'],
  [/\b(rating|stars|score|quality)\b/i, 'rating'],
  [/\b(duration|length|minutes|hours|time spent|runtime)\b/i, 'duration'],
  [/\b(url|link|website|site|instagram|tiktok|facebook|youtube|spotify|soundcloud)\b/i, 'url'],
  [/\b(e-?mail)\b/i, 'email'],
  [/\b(phone|tel|mobile|whatsapp|line)\b/i, 'phone'],
  [/^(is|has|done|paid|signed|sent|approved|active)\b/i, 'checkbox'],
  [/\b(tags|genres|skills|platforms|moods|labels)\b/i, 'multiselect'],
  [/\b(status|stage|type|genre|category|kind|key|mood|role|priority|platform|level)\b/i, 'select'],
  [/\b(bpm|count|qty|quantity|number|age|year|tracks|streams|views|followers|size|weight|height)\b/i, 'number'],
  [/\b(artist|client|person|owner|contact|brand|project|label)\b/i, 'relation'],
  [/\b(notes|description|summary|lyrics|bio|details)\b/i, 'longtext'],
];

/** Guess a field's kind from its name and (optionally) an example value. */
export function inferKind(name: string, sample?: string): FieldKind {
  const v = (sample ?? '').trim();
  if (v) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(v)) return 'date';
    if (/^https?:\/\//i.test(v) || /^www\./i.test(v)) return 'url';
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)) return 'email';
    if (/^\+?[\d\s()-]{7,}$/.test(v)) return 'phone';
    if (/^[$€£₭฿]\s?\d|^\d[\d,.]*\s?(kip|lak|usd|thb|baht|\$)$/i.test(v)) return 'currency';
    if (/^\d+(\.\d+)?\s?%$/.test(v)) return 'percent';
    if (/^(yes|no|true|false|✓|x)$/i.test(v)) return 'checkbox';
    if (/^\d+:\d{2}$|^\d+\s?(min|m|h|hr|hours)$/i.test(v)) return 'duration';
    if (/^[★☆]{1,5}$/.test(v)) return 'rating';
    if (v.includes(',') && v.split(',').length > 1 && v.length < 80) return 'multiselect';
    if (/^-?\d+(\.\d+)?$/.test(v)) return 'number';
  }
  for (const [re, kind] of NAME_RULES) if (re.test(name)) return kind;
  return v.length > 80 ? 'longtext' : 'text';
}

export const fieldKey = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9຀-໿]+/g, '_').replace(/^_|_$/g, '') || 'field';

/* ---------- display ---------- */

export function formatValue(f: FieldDef, v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  switch (f.kind) {
    case 'currency': {
      const n = Number(v);
      return Number.isFinite(n) ? `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${f.currency ?? 'LAK'}` : String(v);
    }
    case 'percent': return `${Math.round(Number(v))}%`;
    case 'checkbox': return v ? '✓' : '';
    case 'rating': return '★'.repeat(Number(v) || 0);
    case 'duration': { const m = Number(v); return Number.isFinite(m) ? (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${m}m`) : String(v); }
    case 'multiselect': return Array.isArray(v) ? v.join(', ') : String(v);
    default: return String(v);
  }
}

/** Value as it is written to Obsidian frontmatter (YAML). */
export function yamlValue(v: unknown): string {
  if (Array.isArray(v)) return v.length ? `\n${v.map((x) => `  - ${JSON.stringify(String(x))}`).join('\n')}` : ' []';
  if (typeof v === 'boolean' || typeof v === 'number') return ` ${v}`;
  if (v === undefined || v === null || v === '') return '';
  const s = String(v);
  return /^[\w\-./ ]+$/.test(s) && !/^(yes|no|true|false|null)$/i.test(s) ? ` ${s}` : ` ${JSON.stringify(s)}`;
}

export function toMarkdown(props: Record<string, unknown>, body = ''): string {
  const lines = Object.entries(props).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)).map(([k, v]) => `${k}:${yamlValue(v)}`);
  return `---\n${lines.join('\n')}\n---\n${body ? `\n${body}\n` : ''}`;
}

export type DateLike = ISODate;
