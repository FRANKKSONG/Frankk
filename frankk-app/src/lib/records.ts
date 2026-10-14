import { checklistProgress, projectProgress } from './progress';
import { monthKey } from './dates';
import type { AppData } from '../data/types';
import type { FieldDef, TypeDef, ViewDef, ViewFilter } from '../data/schema';

/** One row in any view, whatever its type. `get` reads built-in and custom fields alike. */
export interface Rec {
  id: string;
  typeId: string;
  title: string;
  tags: string[];
  get: (key: string) => unknown;
  path: string;
}

export function recordsOf(data: AppData, typeId: string, today: string): Rec[] {
  switch (typeId) {
    case 'task':
      return data.tasks.map((t) => ({
        id: t.id, typeId, title: t.title, tags: t.tags, path: t.notePath,
        get: (k) => (k === 'title' ? t.title : k === 'progress' ? (t.mode === 'simple' ? (t.done ? 100 : 0) : checklistProgress(t.steps).pct ?? (t.done ? 100 : 0))
          : k in t && k !== 'props' ? (t as unknown as Record<string, unknown>)[k] : t.props?.[k]),
      }));
    case 'project':
      return data.projects.map((p) => ({
        id: p.id, typeId, title: `${p.artist} · ${p.title}`, tags: p.tags, path: p.notePath,
        get: (k) => (k === 'title' ? `${p.artist} · ${p.title}` : k === 'progress' ? projectProgress(p).pct ?? 0
          : k in p && k !== 'props' ? (p as unknown as Record<string, unknown>)[k] : p.props?.[k]),
      }));
    case 'bill':
      return data.bills.map((b) => ({
        id: b.id, typeId, title: b.title, tags: [], path: b.notePath,
        get: (k) => (k === 'title' ? b.title : k === 'paid' ? !!b.payments[monthKey(today)]?.paid
          : k in b && k !== 'props' ? (b as unknown as Record<string, unknown>)[k] : b.props?.[k]),
      }));
    case 'note':
      return data.notes.map((n) => ({
        id: n.id, typeId, title: n.title, tags: n.tags, path: n.path,
        get: (k) => (k === 'title' ? n.title : k === 'updated' ? n.updated.slice(0, 10) : k === 'folder' ? n.folder : k === 'author' ? n.author : k === 'tags' ? n.tags : n.props[k]),
      }));
    default:
      return data.entries.filter((e) => e.typeId === typeId && !e.archived).map((e) => ({
        id: e.id, typeId, title: e.title, tags: e.tags, path: e.path,
        get: (k) => (k === 'title' ? e.title : k === 'tags' ? e.tags : k === 'created' ? e.created.slice(0, 10) : e.props[k]),
      }));
  }
}

const str = (v: unknown) => (Array.isArray(v) ? v.join(' ') : v === undefined || v === null ? '' : String(v)).toLowerCase();

function passes(r: Rec, f: ViewFilter): boolean {
  const v = r.get(f.field);
  switch (f.op) {
    case 'empty': return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
    case 'not-empty': return !passes(r, { ...f, op: 'empty' });
    case 'is': return str(v) === str(f.value) || (Array.isArray(v) && v.map(String).includes(String(f.value)));
    case 'is-not': return !passes(r, { ...f, op: 'is' });
    case 'contains': return str(v).includes(str(f.value));
    case 'before': return !!v && String(v) < String(f.value);
    case 'after': return !!v && String(v) > String(f.value);
  }
}

export function applyView(recs: Rec[], view: Pick<ViewDef, 'filters' | 'sort'>, tagFilter?: string | null): Rec[] {
  let out = recs.filter((r) => view.filters.every((f) => passes(r, f)) && (!tagFilter || r.tags.includes(tagFilter)));
  if (view.sort) {
    const { field, dir } = view.sort;
    out = [...out].sort((a, b) => {
      const x = a.get(field), y = b.get(field);
      if (x === undefined || x === '' || x === null) return 1;
      if (y === undefined || y === '' || y === null) return -1;
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return dir === 'asc' ? c : -c;
    });
  }
  return out;
}

export const fieldOf = (t: TypeDef, key: string): FieldDef =>
  key === 'title' ? { key: 'title', name: 'Name', kind: 'text', builtin: true } : t.fields.find((f) => f.key === key) ?? { key, name: key, kind: 'text' };

/** Summary for numeric fields — used by stat widgets and view footers. */
export function summarise(recs: Rec[], f: FieldDef): string {
  const nums = recs.map((r) => Number(r.get(f.key))).filter((n) => Number.isFinite(n));
  if (!nums.length) return '';
  const sum = nums.reduce((a, b) => a + b, 0);
  if (f.kind === 'currency') return `Σ ${sum.toLocaleString()} ${f.currency ?? 'LAK'}`;
  if (f.kind === 'percent' || f.kind === 'rating') return `avg ${Math.round((sum / nums.length) * 10) / 10}${f.kind === 'percent' ? '%' : '★'}`;
  return `Σ ${sum.toLocaleString()}`;
}
