import type { Progress } from '../lib/progress';

/** Thick bar with the percentage printed on it; the step count is in the tooltip. */
export function ProgressCell({ p, done, none = 'No steps' }: { p: Progress; done?: boolean; none?: string }) {
  if (p.pct === null) return <span className="progress-none">{done ? 'Done' : none}</span>;
  return (
    <span className="pbar" title={`${p.done} of ${p.total} done`} role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100}
      aria-label={`${p.pct}% complete, ${p.done} of ${p.total}`}>
      <span className="pfill" style={{ width: `${p.pct}%` }} />
      <span className="plabel">{p.pct}%</span>
    </span>
  );
}
