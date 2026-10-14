import { diffDays, type ISODate } from './dates';
import { visibleOccurrences } from './bills';
import { stageComplete } from './progress';
import type { Area, AppData } from '../data/types';

export type AgendaRef =
  | { type: 'task'; id: string }
  | { type: 'bill'; billId: string; month: string }
  | { type: 'stage'; projectId: string; stageId: string; itemId?: string };

export interface AgendaItem {
  key: string;
  ref: AgendaRef;
  area: Area;
  title: string;
  context?: string;
  date: ISODate;
  /** Which date `date` is: the day to work on it, its deadline, a bill due date, or a stage date. */
  kind: 'plan' | 'due' | 'bill' | 'stage';
  overdue: boolean;
  done: boolean;
}

/** Open work that has a date, across all areas. Each task appears exactly once. */
export function buildAgenda(data: AppData, today: ISODate): AgendaItem[] {
  const out: AgendaItem[] = [];

  for (const t of data.tasks) {
    if (t.done) continue;
    const dueOverdue = !!t.due && diffDays(t.due, today) < 0;
    let date: ISODate | undefined;
    let kind: AgendaItem['kind'] = 'plan';
    if (dueOverdue) { date = t.due; kind = 'due'; }
    else if (t.plan) { date = t.plan; kind = 'plan'; }
    else if (t.due) { date = t.due; kind = 'due'; }
    if (!date) continue;
    out.push({
      key: `task:${t.id}`, ref: { type: 'task', id: t.id }, area: t.area, title: t.title, context: t.brand?.split(' ')[0],
      date, kind, overdue: dueOverdue, done: false,
    });
  }

  for (const b of data.bills) {
    for (const o of visibleOccurrences(b, today)) {
      if (o.paid) continue;
      out.push({
        key: `bill:${b.id}:${o.month}`, ref: { type: 'bill', billId: b.id, month: o.month }, area: 'house', title: b.title,
        date: o.due, kind: 'bill', overdue: o.missed, done: false,
      });
    }
  }

  for (const p of data.projects) {
    for (const st of p.stages) {
      if (!st.inScope || stageComplete(st)) continue;
      const dated = st.items.filter((i) => !i.done && i.date);
      if (dated.length) {
        for (const i of dated) {
          out.push({
            key: `stage:${p.id}:${i.id}`, ref: { type: 'stage', projectId: p.id, stageId: st.id, itemId: i.id }, area: 'music',
            title: i.text, context: p.artist, date: i.date as string, kind: 'stage', overdue: diffDays(i.date as string, today) < 0, done: false,
          });
        }
      } else if (st.end) {
        out.push({
          key: `stage:${p.id}:${st.id}`, ref: { type: 'stage', projectId: p.id, stageId: st.id }, area: 'music',
          title: st.name, context: p.artist, date: st.end, kind: 'stage', overdue: diffDays(st.end, today) < 0, done: false,
        });
      }
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/** Items that belong in the pinned Today strip: dated today or earlier, or a bill whose reminder window is open. */
export function todayItems(data: AppData, today: ISODate): AgendaItem[] {
  const reminding = new Set<string>();
  for (const b of data.bills) for (const o of visibleOccurrences(b, today)) if (o.reminding) reminding.add(`bill:${b.id}:${o.month}`);
  return buildAgenda(data, today).filter((i) => i.date <= today || reminding.has(i.key));
}

/** Every date a task/bill/stage touches, for the mini calendar markers (plan and due both count). */
export function datedMarkers(data: AppData, today: ISODate): Map<ISODate, Set<Area>> {
  const m = new Map<ISODate, Set<Area>>();
  const add = (area: Area, d?: ISODate) => { if (d) m.set(d, (m.get(d) ?? new Set<Area>()).add(area)); };
  for (const t of data.tasks) if (!t.done) { add(t.area, t.plan); add(t.area, t.due); }
  for (const i of buildAgenda(data, today)) if (i.kind === 'bill' || i.kind === 'stage') add(i.area, i.date);
  return m;
}
