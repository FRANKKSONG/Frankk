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
export function projectProgress(project: Pick<MusicProject, 'stages'>): Progress {
  let done = 0;
  let total = 0;
  for (const st of project.stages) {
    if (!st.inScope) continue;
    const u = stageUnits(st);
    done += u.done;
    total += u.total;
  }
  return { done, total, pct: total === 0 ? null : Math.round((done / total) * 100) };
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
