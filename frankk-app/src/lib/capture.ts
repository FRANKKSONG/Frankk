import { useStore } from '../data/store';
import { newId } from '../data/fixtures';
import type { Parsed } from './parse';
import { describe } from './sortRules';
export { describe, needsSort } from './sortRules';
import { useJournal } from '../components/CommandBar';

/** Applies a read capture to Esther: a task, a stage item, an idea or a journal line. Returns a one-line summary. */
export function useApplyCapture() {
  const { dispatch, today, data } = useStore();
  const journal = useJournal();
  return (p: Parsed, via = ''): string => {
    const body = p.title.trim();
    if (!body) return '';
    const m = p.kind === 'task' ? p.music : undefined;
    const tail = via ? ` (${via})` : '';
    if (m) {
      if (m.addsScope) dispatch({ type: 'stage/patch', projectId: m.projectId, stageId: m.stageId, patch: { inScope: true } });
      dispatch({ type: 'item/add', projectId: m.projectId, stageId: m.stageId, text: body, date: p.due ?? p.plan });
      journal('task', `${body} (${m.artist} · ${m.stage})${p.due ?? p.plan ? `, ${p.due ?? p.plan}` : ''}${tail}`);
      return `Added to ${m.artist}’s ${m.stage} stage: ${describe(p, today).join(' · ')}.`;
    }
    if (p.kind === 'task') {
      dispatch({ type: 'task/add', title: body, area: p.area, extra: { tags: p.tags, mode: 'simple', due: p.due, plan: p.plan, priority: p.priority ?? 'normal', list: p.list, ...(p.area === 'seround' ? { brand: p.brand ?? data.brands[0] } : {}) } });
      journal('task', `${body}${p.list ? ` (${p.list})` : ''}${p.due ? `, due ${p.due}` : ''}${tail}`);
      return `Task added: ${describe(p, today).join(' · ')}.`;
    }
    if (p.kind === 'idea') {
      const now = `${today}T09:00:00`;
      dispatch({ type: 'entry/add', entry: { id: newId('e'), typeId: 'idea', title: body, props: { status: 'Spark', captured: today }, tags: p.tags, created: now, updated: now, path: `Ideas/${body}.md` } });
      journal('idea', `${body}${tail}`);
      return 'Kept on your Ideas board.';
    }
    journal(p.kind, `${body}${tail}`);
    return 'Kept in today’s journal.';
  };
}
