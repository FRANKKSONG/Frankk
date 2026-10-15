import { useStore } from '../data/store';
import { newId } from '../data/fixtures';
import type { Parsed } from './parse';
import { describe } from './sortRules';
export { describe, needsSort } from './sortRules';
import { useJournal } from '../components/CommandBar';

/** What a capture created, so a later re-file can move it. */
export type CaptureRef = { type: 'task'; id: string } | { type: 'entry'; id: string } | { type: 'item'; projectId: string; stageId: string; id: string } | { type: 'journal' };

/** Applies a read capture to Esther: a task, a stage item, an idea or a journal line. Returns a one-line summary. */
export function useApplyCapture() {
  const { dispatch, today, data } = useStore();
  const journal = useJournal();
  return (p: Parsed, via = ''): { summary: string; ref: CaptureRef } => {
    const body = p.title.trim();
    if (!body) return { summary: '', ref: { type: 'journal' } };
    const m = p.kind === 'task' ? p.music : undefined;
    const tail = via ? ` (${via})` : '';
    if (m) {
      if (m.addsScope) dispatch({ type: 'stage/patch', projectId: m.projectId, stageId: m.stageId, patch: { inScope: true } });
      const id = newId('it');
      dispatch({ type: 'item/add', projectId: m.projectId, stageId: m.stageId, text: body, date: p.due ?? p.plan, id });
      journal('task', `${body} (${m.artist} · ${m.stage})${p.due ?? p.plan ? `, ${p.due ?? p.plan}` : ''}${tail}`);
      return { summary: `Added to ${m.artist}’s ${m.stage} stage: ${describe(p, today).join(' · ')}.`, ref: { type: 'item', projectId: m.projectId, stageId: m.stageId, id } };
    }
    if (p.kind === 'task') {
      const id = newId('t');
      dispatch({ type: 'task/add', title: body, area: p.area, extra: { id, tags: p.tags, mode: 'simple', due: p.due, plan: p.plan, priority: p.priority ?? 'normal', list: p.list, ...(p.area === 'seround' ? { brand: p.brand ?? data.brands[0] } : {}) } });
      journal('task', `${body}${p.list ? ` (${p.list})` : ''}${p.due ? `, due ${p.due}` : ''}${tail}`);
      return { summary: `Task added: ${describe(p, today).join(' · ')}.`, ref: { type: 'task', id } };
    }
    if (p.kind === 'idea') {
      const now = `${today}T09:00:00`;
      const id = newId('e');
      dispatch({ type: 'entry/add', entry: { id, typeId: 'idea', title: body, props: { status: 'Spark', captured: today }, tags: p.tags, created: now, updated: now, path: `Ideas/${body}.md` } });
      journal('idea', `${body}${tail}`);
      return { summary: 'Kept on your Ideas board.', ref: { type: 'entry', id } };
    }
    journal(p.kind, `${body}${tail}`);
    return { summary: 'Kept in today’s journal.', ref: { type: 'journal' } };
  };
}

/** Takes back what a capture created (used when you re-file it as something else from Telegram). */
export function useUndoCapture() {
  const { dispatch } = useStore();
  return (ref: CaptureRef) => {
    if (ref.type === 'task') dispatch({ type: 'task/remove', id: ref.id });
    else if (ref.type === 'entry') dispatch({ type: 'entry/archive', id: ref.id, archived: true });
    else if (ref.type === 'item') dispatch({ type: 'item/remove', projectId: ref.projectId, stageId: ref.stageId, itemId: ref.id });
  };
}
