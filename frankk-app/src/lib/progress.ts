import type { MusicProject, Stage, Step } from '../data/types';

export interface Progress {
  done: number;
  total: number;
  /** 0-100, or null when nothing has been broken down yet (never shown as 100%). */
  pct: number | null;
}

export function checklistProgress(steps: Pick<Step, 'done'>[]): Progress {
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  return { done, total, pct: total === 0 ? null : Math.round((done / total) * 100) };
}

/** A stage with checklist items counts its items; a stage without items counts as one unit. */
export function stageUnits(stage: Stage): { done: number; total: number } {
  if (stage.items.length === 0) return { done: stage.done ? 1 : 0, total: 1 };
  return { done: stage.items.filter((i) => i.done).length, total: stage.items.length };
}

export function stageComplete(stage: Stage): boolean {
  const u = stageUnits(stage);
  return u.done === u.total;
}

/**
 * Progress counts ONLY stages that are in scope. Stages outside the user's scope
 * never reduce progress and never count as overdue work.
 */
/** For my own release, only the main step bar counts; side tracks (Marketing, MV...) are tracked separately. */
export const countsTowardProgress = (project: Pick<MusicProject, 'kind'>, st: Stage) =>
  st.inScope && !(project.kind === 'own-release' && st.track === 'side');

/**
 * Music progress is counted in stages, the way a production actually moves: every stage you're responsible
 * for weighs the same, and a stage with a checklist counts as partly done (2 of 4 items = half a stage).
 * done/total = finished stages / stages; pct = overall share, e.g. Produce half done of 4 stages = 13%.
 */
export function projectProgress(project: Pick<MusicProject, 'stages'> & Partial<Pick<MusicProject, 'kind'>>): Progress {
  const stages = project.stages.filter((st) => countsTowardProgress({ kind: project.kind ?? 'artist-job' }, st));
  if (!stages.length) return { done: 0, total: 0, pct: null };
  const frac = stages.reduce((n, st) => { const u = stageUnits(st); return n + u.done / u.total; }, 0);
  return { done: stages.filter(stageComplete).length, total: stages.length, pct: Math.round((frac / stages.length) * 100) };
}

/** Earliest unfinished dated thing in scope: item date, else stage end date. */
export function nextProjectDate(project: MusicProject): string | undefined {
  const dates: string[] = [];
  for (const st of project.stages) {
    if (!st.inScope || stageComplete(st)) continue;
    const itemDates = st.items.filter((i) => !i.done && i.date).map((i) => i.date as string);
    if (itemDates.length) dates.push(...itemDates);
    else if (st.end) dates.push(st.end);
  }
  if (dates.length) return dates.sort()[0];
  return project.kind === 'own-release' ? project.targetRelease : undefined;
}
