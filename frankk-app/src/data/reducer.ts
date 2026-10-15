import type { ISODate } from '../lib/dates';
import { newId } from './fixtures';
import { uniqueNotePath } from '../lib/obsidian';
import { PIGMENTS, RELEASE_STEPS, type AppData, type MusicProject, type Stage, type StageItem, type Task } from './types';
import type { Dashboard, Entry, FieldDef, Note, TypeDef, ViewDef, WidgetDef } from './schema';

export type Action =
  | { type: 'task/add'; title: string; area?: Task['area']; extra?: Partial<Task> }
  | { type: 'task/update'; id: string; patch: Partial<Task> }
  | { type: 'task/toggle'; id: string }
  | { type: 'task/move'; id: string; overId: string }
  | { type: 'step/add'; taskId: string; text: string }
  | { type: 'step/toggle'; taskId: string; stepId: string }
  | { type: 'step/rename'; taskId: string; stepId: string; text: string }
  | { type: 'step/remove'; taskId: string; stepId: string }
  | { type: 'bill/patch'; billId: string; patch: { title?: string; dueDay?: number } }
  | { type: 'brand/add'; name: string }
  | { type: 'brand/rename'; from: string; to: string }
  | { type: 'brand/color'; name: string; color: string }
  | { type: 'tag/create'; name: string; color?: string }
  | { type: 'tag/update'; name: string; patch: { name?: string; color?: string } }
  | { type: 'task/tags'; id: string; tags: string[] }
  | { type: 'project/tags'; projectId: string; tags: string[] }
  | { type: 'project/patch'; projectId: string; patch: Partial<Pick<MusicProject, 'artist' | 'title' | 'client' | 'label' | 'roles' | 'targetRelease' | 'start' | 'color' | 'notes' | 'releaseType'>> }
  | { type: 'item/remove'; projectId: string; stageId: string; itemId: string }
  | { type: 'task/remove'; id: string }
  | { type: 'project/remove'; projectId: string }
  | { type: 'stage/remove'; projectId: string; stageId: string }
  | { type: 'stage/restore-steps'; projectId: string }
  | { type: 'stage/set-order'; projectId: string; ids: string[] }
  | { type: 'project/set-order'; ids: string[] }
  | { type: 'item/set-order'; projectId: string; stageId: string; ids: string[] }
  | { type: 'stage/reorder'; projectId: string; id: string; overId: string }
  | { type: 'item/reorder'; projectId: string; stageId: string; id: string; overId: string }
  | { type: 'step/reorder'; taskId: string; id: string; overId: string }
  | { type: 'bill/pay'; billId: string; month: string; paid: boolean }
  | { type: 'bill/update'; billId: string; patch: { reminderDays?: number; note?: { month: string; text: string } } }
  | { type: 'bill/add'; title: string; dueDay: number; reminderDays: number; start: string }
  | { type: 'project/add'; project: MusicProject }
  | { type: 'stage/patch'; projectId: string; stageId: string; patch: Partial<Stage> }
  | { type: 'stage/move'; projectId: string; stageId: string; dir: -1 | 1 }
  | { type: 'stage/add'; projectId: string; name: string; track?: 'main' | 'side' }
  | { type: 'item/add'; projectId: string; stageId: string; text: string; date?: ISODate }
  | { type: 'item/patch'; projectId: string; stageId: string; itemId: string; patch: Partial<StageItem> }
  | { type: 'type/add'; def: TypeDef }
  | { type: 'type/update'; id: string; patch: Partial<Pick<TypeDef, 'name' | 'plural' | 'icon' | 'color' | 'folder'>> }
  | { type: 'field/add'; typeId: string; field: FieldDef }
  | { type: 'field/update'; typeId: string; key: string; patch: Partial<FieldDef> }
  | { type: 'field/remove'; typeId: string; key: string }
  | { type: 'record/set'; typeId: string; id: string; key: string; value: unknown }
  | { type: 'entry/add'; entry: Entry }
  | { type: 'entry/archive'; id: string; archived: boolean }
  | { type: 'note/add'; note: Note }
  | { type: 'note/update'; id: string; patch: Partial<Pick<Note, 'title' | 'body' | 'tags' | 'folder' | 'pinned' | 'props'>> }
  | { type: 'view/save'; view: ViewDef }
  | { type: 'view/remove'; id: string }
  | { type: 'dash/update'; id: string; patch: Partial<Omit<Dashboard, 'id'>> }
  | { type: 'dash/widget'; dashId: string; widget: WidgetDef; at?: { x: number; y: number; w: number; h: number } }
  | { type: 'dash/remove-widget'; dashId: string; widgetId: string }
  | { type: 'replace'; data: AppData };

const mapTask = (s: AppData, id: string, fn: (t: Task) => Task): AppData => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)) });

const mapStage = (s: AppData, pid: string, sid: string, fn: (st: Stage) => Stage): AppData => ({
  ...s,
  projects: s.projects.map((p) => (p.id === pid ? { ...p, stages: p.stages.map((st) => (st.id === sid ? fn(st) : st)) } : p)),
});

/** Reorder the elements named in `ids` into that order, using the slots they already occupy. */
export function applyOrder<T extends { id: string }>(list: T[], ids: string[]): T[] {
  const byId = new Map(list.map((x) => [x.id, x]));
  const queue = ids.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  const set = new Set(ids);
  return list.map((x) => (set.has(x.id) ? queue.shift()! : x));
}

/** Move the element with id `id` to the position of `overId`. */
export function moveById<T extends { id: string }>(list: T[], id: string, overId: string): T[] {
  const from = list.findIndex((x) => x.id === id);
  const to = list.findIndex((x) => x.id === overId);
  if (from < 0 || to < 0 || from === to) return list;
  const out = [...list];
  const [it] = out.splice(from, 1);
  out.splice(to, 0, it);
  return out;
}

export const tagKey = (s: string) => s.trim().replace(/^#/, '').replace(/\s+/g, '-').toLowerCase();

/** Make sure every tag name exists in the registry, giving new ones the next pigment colour. */
export function ensureTags(state: AppData, names: string[]): AppData {
  const known = new Set(state.tags.map((t) => t.name));
  const add = [...new Set(names.map(tagKey).filter((n) => n && !known.has(n)))];
  if (!add.length) return state;
  return { ...state, tags: [...state.tags, ...add.map((name, i) => ({ name, color: PIGMENTS[(state.tags.length + i) % PIGMENTS.length].color }))] };
}

export function reducer(state: AppData, a: Action): AppData {
  switch (a.type) {
    case 'replace':
      return a.data;

    case 'task/add': {
      const title = a.title.trim();
      if (!title) return state;
      const task: Task = {
        id: newId('t'), title, area: a.area ?? 'general', done: false, steps: [], priority: 'normal', mode: 'progress', tags: [],
        notePath: uniqueNotePath(title, new Set(state.tasks.map((t) => t.notePath))),
        ...a.extra,
      };
      task.tags = [...new Set(task.tags.map(tagKey).filter(Boolean))];
      state = ensureTags(state, task.tags);
      // A new task with a date falls into place among its area's open dated tasks: just before the first one that's
      // later, or just after the last one. Undated tasks don't count. One without a date goes to the top, as before.
      const when = (t: Task) => t.due ?? t.plan;
      const mine = when(task);
      const firstOfArea = state.tasks.findIndex((t) => t.area === task.area);
      const dated = state.tasks.map((t, i) => ({ t, i })).filter(({ t }) => t.area === task.area && !t.done && when(t));
      const later = dated.find(({ t }) => when(t)! > mine!);
      const tasks = [...state.tasks];
      const at = !mine || !dated.length ? firstOfArea : later ? later.i : dated[dated.length - 1].i + 1;
      tasks.splice(at < 0 ? tasks.length : at, 0, task);
      return { ...state, tasks };
    }
    case 'task/update':
      return mapTask(state, a.id, (t) => ({ ...t, ...a.patch, title: (a.patch.title ?? t.title).trim() || t.title }));

    // Completing a task never ticks its steps, and ticking steps never completes the task.
    case 'task/toggle':
      return mapTask(state, a.id, (t) => ({ ...t, done: !t.done }));

    case 'task/move': {
      const from = state.tasks.findIndex((t) => t.id === a.id);
      const to = state.tasks.findIndex((t) => t.id === a.overId);
      if (from < 0 || to < 0 || from === to) return state;
      const tasks = [...state.tasks];
      const [item] = tasks.splice(from, 1);
      tasks.splice(to, 0, item);
      return { ...state, tasks };
    }

    case 'step/add': {
      const text = a.text.trim();
      if (!text) return state;
      return mapTask(state, a.taskId, (t) => ({ ...t, steps: [...t.steps, { id: newId('st'), text, done: false }] }));
    }
    case 'step/toggle':
      return mapTask(state, a.taskId, (t) => ({ ...t, steps: t.steps.map((s) => (s.id === a.stepId ? { ...s, done: !s.done } : s)) }));
    case 'step/rename':
      return mapTask(state, a.taskId, (t) => ({ ...t, steps: t.steps.map((s) => (s.id === a.stepId && a.text.trim() ? { ...s, text: a.text.trim() } : s)) }));

    case 'step/remove':
      return mapTask(state, a.taskId, (t) => ({ ...t, steps: t.steps.filter((s) => s.id !== a.stepId) }));

    case 'bill/patch':
      return {
        ...state,
        bills: state.bills.map((b) => (b.id === a.billId ? {
          ...b,
          title: a.patch.title?.trim() || b.title,
          dueDay: a.patch.dueDay ? Math.min(31, Math.max(1, Math.round(a.patch.dueDay))) : b.dueDay,
        } : b)),
      };

    case 'brand/add': {
      const name = a.name.trim();
      if (!name || state.brands.includes(name)) return state;
      return {
        ...state, brands: [...state.brands, name],
        brandColors: { ...state.brandColors, [name]: PIGMENTS[(state.brands.length + 3) % PIGMENTS.length].color },
      };
    }
    case 'brand/rename': {
      const to = a.to.trim();
      if (!to || to === a.from || state.brands.includes(to)) return state;
      return {
        ...state,
        brands: state.brands.map((b) => (b === a.from ? to : b)),
        brandColors: Object.fromEntries(Object.entries(state.brandColors).map(([k, v]) => [k === a.from ? to : k, v])),
        tasks: state.tasks.map((t) => (t.brand === a.from ? { ...t, brand: to } : t)),
      };
    }

    case 'brand/color':
      return { ...state, brandColors: { ...state.brandColors, [a.name]: a.color } };

    case 'tag/create': {
      const s2 = ensureTags(state, [a.name]);
      const name = tagKey(a.name);
      return a.color ? { ...s2, tags: s2.tags.map((t) => (t.name === name ? { ...t, color: a.color as string } : t)) } : s2;
    }
    case 'tag/update': {
      const to = a.patch.name !== undefined ? tagKey(a.patch.name) : a.name;
      if (!to || (to !== a.name && state.tags.some((t) => t.name === to))) return state;
      const swap = (list: string[]) => list.map((n) => (n === a.name ? to : n));
      return {
        ...state,
        tags: state.tags.map((t) => (t.name === a.name ? { name: to, color: a.patch.color ?? t.color } : t)),
        tasks: to === a.name ? state.tasks : state.tasks.map((t) => (t.tags.includes(a.name) ? { ...t, tags: swap(t.tags) } : t)),
        projects: to === a.name ? state.projects : state.projects.map((p) => (p.tags.includes(a.name) ? { ...p, tags: swap(p.tags) } : p)),
      };
    }
    case 'task/tags': {
      const tags = [...new Set(a.tags.map(tagKey).filter(Boolean))];
      return mapTask(ensureTags(state, tags), a.id, (t) => ({ ...t, tags }));
    }
    case 'project/tags': {
      const tags = [...new Set(a.tags.map(tagKey).filter(Boolean))];
      const s2 = ensureTags(state, tags);
      return { ...s2, projects: s2.projects.map((p) => (p.id === a.projectId ? { ...p, tags } : p)) };
    }

    case 'type/add':
      return state.types.some((t) => t.id === a.def.id) ? state : { ...state, types: [...state.types, a.def] };
    case 'type/update':
      return { ...state, types: state.types.map((t) => (t.id === a.id ? { ...t, ...a.patch } : t)) };
    case 'field/add':
      return {
        ...state,
        types: state.types.map((t) => (t.id === a.typeId && !t.fields.some((f) => f.key === a.field.key) ? { ...t, fields: [...t.fields, a.field] } : t)),
      };
    case 'field/update':
      return { ...state, types: state.types.map((t) => (t.id === a.typeId ? { ...t, fields: t.fields.map((f) => (f.key === a.key ? { ...f, ...a.patch, key: f.key } : f)) } : t)) };
    case 'field/remove':
      // Removes the column definition only; values already written to notes stay in their frontmatter.
      return { ...state, types: state.types.map((t) => (t.id === a.typeId ? { ...t, fields: t.fields.filter((f) => f.key !== a.key || f.builtin) } : t)) };

    case 'record/set': {
      const now = new Date().toISOString().slice(0, 19);
      const { key, value, id } = a;
      if (key === 'tags') {
        const tags = Array.isArray(value) ? value.map(String) : String(value ?? '').split(',').map((x) => x.trim()).filter(Boolean);
        if (a.typeId === 'task') return reducer(state, { type: 'task/tags', id, tags });
        if (a.typeId === 'project') return reducer(state, { type: 'project/tags', projectId: id, tags });
        const s2 = ensureTags(state, tags);
        if (a.typeId === 'note') return { ...s2, notes: s2.notes.map((n) => (n.id === id ? { ...n, tags: tags.map(tagKey), updated: now } : n)) };
        return { ...s2, entries: s2.entries.map((e) => (e.id === id ? { ...e, tags: tags.map(tagKey), updated: now } : e)) };
      }
      const def = state.types.find((t) => t.id === a.typeId)?.fields.find((f) => f.key === key);
      const builtin = key === 'title' || !!def?.builtin;
      if (def?.computed) return state;
      switch (a.typeId) {
        case 'task':
          return mapTask(state, id, (t) => (builtin ? { ...t, [key]: value === '' ? undefined : value } : { ...t, props: { ...t.props, [key]: value } }));
        case 'project':
          return { ...state, projects: state.projects.map((p) => (p.id !== id ? p : builtin ? { ...p, [key]: value } : { ...p, props: { ...p.props, [key]: value } })) };
        case 'bill':
          return { ...state, bills: state.bills.map((b) => (b.id !== id ? b : builtin ? { ...b, [key]: value } : { ...b, props: { ...b.props, [key]: value } })) };
        case 'note':
          return { ...state, notes: state.notes.map((n) => (n.id !== id ? n : key === 'title' ? { ...n, title: String(value), updated: now } : { ...n, props: { ...n.props, [key]: value }, updated: now })) };
        default:
          return { ...state, entries: state.entries.map((e) => (e.id !== id ? e : key === 'title' ? { ...e, title: String(value) || e.title, updated: now } : { ...e, props: { ...e.props, [key]: value }, updated: now })) };
      }
    }
    case 'entry/add': {
      const s2 = ensureTags(state, a.entry.tags);
      return { ...s2, entries: [a.entry, ...s2.entries] };
    }
    case 'entry/archive':
      return { ...state, entries: state.entries.map((e) => (e.id === a.id ? { ...e, archived: a.archived } : e)) };
    case 'note/add':
      return { ...ensureTags(state, a.note.tags), notes: [a.note, ...state.notes] };
    case 'note/update': {
      const now = new Date().toISOString().slice(0, 19);
      const s2 = a.patch.tags ? ensureTags(state, a.patch.tags) : state;
      return { ...s2, notes: s2.notes.map((n) => (n.id === a.id ? { ...n, ...a.patch, updated: now } : n)) };
    }
    case 'view/save':
      return { ...state, views: state.views.some((v) => v.id === a.view.id) ? state.views.map((v) => (v.id === a.view.id ? a.view : v)) : [...state.views, a.view] };
    case 'view/remove':
      return { ...state, views: state.views.filter((v) => v.id !== a.id) };
    case 'dash/update':
      return { ...state, dashboards: state.dashboards.map((d) => (d.id === a.id ? { ...d, ...a.patch } : d)) };
    case 'dash/widget':
      return {
        ...state,
        dashboards: state.dashboards.map((d) => {
          if (d.id !== a.dashId) return d;
          const exists = d.widgets.some((w) => w.id === a.widget.id);
          return {
            ...d,
            widgets: exists ? d.widgets.map((w) => (w.id === a.widget.id ? a.widget : w)) : [...d.widgets, a.widget],
            layout: exists ? d.layout : [...d.layout, { i: a.widget.id, ...(a.at ?? { x: 0, y: 999, w: 8, h: 6 }) }],
          };
        }),
      };
    case 'dash/remove-widget':
      return { ...state, dashboards: state.dashboards.map((d) => (d.id === a.dashId ? { ...d, widgets: d.widgets.filter((w) => w.id !== a.widgetId), layout: d.layout.filter((l) => l.i !== a.widgetId) } : d)) };

    case 'bill/pay':
      return {
        ...state,
        bills: state.bills.map((b) =>
          b.id === a.billId ? { ...b, payments: { ...b.payments, [a.month]: { ...b.payments[a.month], paid: a.paid } } } : b),
      };
    case 'bill/update':
      return {
        ...state,
        bills: state.bills.map((b) => {
          if (b.id !== a.billId) return b;
          const next = { ...b, reminderDays: a.patch.reminderDays ?? b.reminderDays };
          if (a.patch.note) {
            const { month, text } = a.patch.note;
            next.payments = { ...b.payments, [month]: { paid: b.payments[month]?.paid ?? false, note: text || undefined } };
          }
          return next;
        }),
      };

    case 'bill/add': {
      const title = a.title.trim();
      if (!title) return state;
      return {
        ...state,
        bills: [...state.bills, {
          id: newId('b'), title, recurrence: 'monthly', dueDay: Math.min(31, Math.max(1, a.dueDay)), reminderDays: a.reminderDays,
          start: a.start, payments: {}, notePath: `House/Bills/${title}.md`,
        }],
      };
    }
    case 'project/add': {
      const s2 = ensureTags(state, a.project.tags);
      return { ...s2, projects: [a.project, ...s2.projects] };
    }
    case 'project/patch': {
      const p = a.patch;
      return {
        ...state,
        projects: state.projects.map((x) => (x.id === a.projectId ? {
          ...x, ...p,
          artist: p.artist !== undefined ? p.artist.trim() || x.artist : x.artist,
          title: p.title !== undefined ? p.title.trim() || x.title : x.title,
        } : x)),
      };
    }
    case 'stage/reorder':
      return { ...state, projects: state.projects.map((p) => (p.id === a.projectId ? { ...p, stages: moveById(p.stages, a.id, a.overId) } : p)) };
    case 'item/reorder':
      return mapStage(state, a.projectId, a.stageId, (st) => ({ ...st, items: moveById(st.items, a.id, a.overId) }));
    case 'step/reorder':
      return mapTask(state, a.taskId, (t) => ({ ...t, steps: moveById(t.steps, a.id, a.overId) }));
    case 'task/remove':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== a.id) };
    case 'project/remove':
      return { ...state, projects: state.projects.filter((p) => p.id !== a.projectId) };
    case 'stage/remove':
      return { ...state, projects: state.projects.map((p) => (p.id === a.projectId ? { ...p, stages: p.stages.filter((st) => st.id !== a.stageId) } : p)) };
    case 'item/remove':
      return mapStage(state, a.projectId, a.stageId, (st) => ({ ...st, items: st.items.filter((i) => i.id !== a.itemId) }));
    case 'stage/patch':
      return mapStage(state, a.projectId, a.stageId, (st) => ({ ...st, ...a.patch, name: a.patch.name?.trim() || st.name }));
    case 'stage/move': {
      return {
        ...state,
        projects: state.projects.map((p) => {
          if (p.id !== a.projectId) return p;
          const i = p.stages.findIndex((s) => s.id === a.stageId);
          const j = i + a.dir;
          if (i < 0 || j < 0 || j >= p.stages.length) return p;
          const stages = [...p.stages];
          [stages[i], stages[j]] = [stages[j], stages[i]];
          return { ...p, stages };
        }),
      };
    }
    case 'project/set-order':
      return { ...state, projects: applyOrder(state.projects, a.ids) };
    case 'stage/set-order':
      // Put the listed stages in this order, keeping every other stage where it was.
      return { ...state, projects: state.projects.map((p) => (p.id === a.projectId ? { ...p, stages: applyOrder(p.stages, a.ids) } : p)) };
    case 'item/set-order':
      return mapStage(state, a.projectId, a.stageId, (st) => ({ ...st, items: applyOrder(st.items, a.ids) }));
    case 'stage/restore-steps':
      // Bring back the standard release steps (Concept … Art) that were skipped, moved to other tracks or deleted,
      // keeping their checklists, and put them first in the usual order.
      return {
        ...state,
        projects: state.projects.map((p) => {
          if (p.id !== a.projectId) return p;
          const std = RELEASE_STEPS.map((name) => {
            const have = p.stages.find((s) => s.name === name);
            return have ? { ...have, inScope: true, track: 'main' as const } : { id: newId('stage'), name, inScope: true, done: false, items: [], track: 'main' as const };
          });
          return { ...p, stages: [...std, ...p.stages.filter((s) => !RELEASE_STEPS.includes(s.name))] };
        }),
      };
    case 'stage/add':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === a.projectId && !p.stages.some((s) => s.name === a.name)
            ? { ...p, stages: [...p.stages, { id: newId('stage'), name: a.name, inScope: true, done: false, items: [], track: a.track }] }
            : p),
      };
    case 'item/add': {
      const text = a.text.trim();
      if (!text) return state;
      return mapStage(state, a.projectId, a.stageId, (st) => ({ ...st, done: false, items: [...st.items, { id: newId('it'), text, done: false, ...(a.date ? { date: a.date } : {}) }] }));
    }
    case 'item/patch':
      return mapStage(state, a.projectId, a.stageId, (st) => ({ ...st, items: st.items.map((i) => (i.id === a.itemId ? { ...i, ...a.patch } : i)) }));
  }
}
