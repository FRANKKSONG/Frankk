import { newId } from './fixtures';
import { uniqueNotePath } from '../lib/obsidian';
import type { AppData, MusicProject, Stage, StageItem, Task } from './types';

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
  | { type: 'project/patch'; projectId: string; patch: Partial<Pick<MusicProject, 'artist' | 'title' | 'client' | 'label' | 'roles' | 'targetRelease'>> }
  | { type: 'item/remove'; projectId: string; stageId: string; itemId: string }
  | { type: 'bill/pay'; billId: string; month: string; paid: boolean }
  | { type: 'bill/update'; billId: string; patch: { reminderDays?: number; note?: { month: string; text: string } } }
  | { type: 'bill/add'; title: string; dueDay: number; reminderDays: number; start: string }
  | { type: 'project/add'; project: MusicProject }
  | { type: 'stage/patch'; projectId: string; stageId: string; patch: Partial<Stage> }
  | { type: 'stage/move'; projectId: string; stageId: string; dir: -1 | 1 }
  | { type: 'stage/add'; projectId: string; name: string }
  | { type: 'item/add'; projectId: string; stageId: string; text: string }
  | { type: 'item/patch'; projectId: string; stageId: string; itemId: string; patch: Partial<StageItem> }
  | { type: 'replace'; data: AppData };

const mapTask = (s: AppData, id: string, fn: (t: Task) => Task): AppData => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)) });

const mapStage = (s: AppData, pid: string, sid: string, fn: (st: Stage) => Stage): AppData => ({
  ...s,
  projects: s.projects.map((p) => (p.id === pid ? { ...p, stages: p.stages.map((st) => (st.id === sid ? fn(st) : st)) } : p)),
});

export function reducer(state: AppData, a: Action): AppData {
  switch (a.type) {
    case 'replace':
      return a.data;

    case 'task/add': {
      const title = a.title.trim();
      if (!title) return state;
      const task: Task = {
        id: newId('t'), title, area: a.area ?? 'general', done: false, steps: [], priority: 'normal',
        notePath: uniqueNotePath(title, new Set(state.tasks.map((t) => t.notePath))),
        ...a.extra,
      };
      // New tasks go to the top of their area's manual order.
      const firstOfArea = state.tasks.findIndex((t) => t.area === task.area);
      const tasks = [...state.tasks];
      tasks.splice(firstOfArea < 0 ? tasks.length : firstOfArea, 0, task);
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
      return { ...state, brands: [...state.brands, name] };
    }
    case 'brand/rename': {
      const to = a.to.trim();
      if (!to || to === a.from || state.brands.includes(to)) return state;
      return {
        ...state,
        brands: state.brands.map((b) => (b === a.from ? to : b)),
        tasks: state.tasks.map((t) => (t.brand === a.from ? { ...t, brand: to } : t)),
      };
    }

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
    case 'project/add':
      return { ...state, projects: [a.project, ...state.projects] };
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
    case 'stage/add':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === a.projectId && !p.stages.some((s) => s.name === a.name)
            ? { ...p, stages: [...p.stages, { id: newId('stage'), name: a.name, inScope: true, done: false, items: [] }] }
            : p),
      };
    case 'item/add': {
      const text = a.text.trim();
      if (!text) return state;
      return mapStage(state, a.projectId, a.stageId, (st) => ({ ...st, done: false, items: [...st.items, { id: newId('it'), text, done: false }] }));
    }
    case 'item/patch':
      return mapStage(state, a.projectId, a.stageId, (st) => ({ ...st, items: st.items.map((i) => (i.id === a.itemId ? { ...i, ...a.patch } : i)) }));
  }
}
