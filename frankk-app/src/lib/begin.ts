import { buildAgenda, type AgendaItem } from './agenda';
import { checklistProgress } from './progress';
import { relLabel, type ISODate } from './dates';
import type { AppData } from '../data/types';

export interface Pick { item: AgendaItem; why: string; launch?: string }

const PRI = { high: 0, normal: 1, low: 2 } as const;

/**
 * What to start first, in a fixed order you can predict: anything late (oldest first), then deadlines today,
 * then what you planned for today. Within each, high priority first, then the one closest to finished (a quick win).
 */
export function beginOrder(data: AppData, today: ISODate): Pick[] {
  const task = (i: AgendaItem) => (i.ref.type === 'task' ? data.tasks.find((t) => t.id === (i.ref as { id: string }).id) : undefined);
  const stepsLeft = (i: AgendaItem) => { const t = task(i); if (!t || t.mode !== 'progress') return 99; const p = checklistProgress(t.steps); return p.total ? p.total - p.done : 99; };
  const rank = (i: AgendaItem) => (i.overdue ? 0 : i.kind === 'due' || i.kind === 'bill' || i.kind === 'stage' ? 1 : 2);
  const pri = (i: AgendaItem) => PRI[task(i)?.priority ?? 'normal'];
  return buildAgenda(data, today)
    .filter((i) => i.date <= today)
    .sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? a.date.localeCompare(b.date) : 0) || pri(a) - pri(b) || stepsLeft(a) - stepsLeft(b) || a.title.localeCompare(b.title))
    .map((i) => {
      const t = task(i);
      const left = stepsLeft(i);
      const why = [
        i.overdue ? `Late since ${relLabel(i.date, today)}` : i.kind === 'bill' ? 'Bill due today' : i.kind === 'stage' ? 'Stage date today' : i.kind === 'due' ? 'Due today' : 'Planned for today',
        t?.priority === 'high' ? 'high priority' : '',
        left < 99 ? `${left} step${left === 1 ? '' : 's'} left` : '',
      ].filter(Boolean).join(' · ');
      const launch = typeof t?.props?.launch === 'string' && t.props.launch ? t.props.launch : undefined;
      return { item: i, why, launch };
    });
}

/** Only web and Obsidian links can be opened from this preview; files and apps need the desktop app. */
export const canOpenHere = (l: string) => /^(https?:|obsidian:)/i.test(l.trim());
