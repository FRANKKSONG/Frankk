import type { Progress } from '../lib/progress';

export function ProgressCell({ p, done, none = 'No steps' }: { p: Progress; done?: boolean; none?: string }) {
  if (p.pct === null) return <span className="progress-none">{done ? 'Done' : none}</span>;
  return (
    <span className="progress" title={`${p.done} of ${p.total}`}>
      <span className="progress-num">{p.done}/{p.total}</span>
      <span className="bar" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.pct}% complete`}>
        <span style={{ width: `${p.pct}%` }} />
      </span>
    </span>
  );
}
