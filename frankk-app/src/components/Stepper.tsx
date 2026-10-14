import { relLabel } from '../lib/dates';
import { stageComplete, stageUnits } from '../lib/progress';
import type { MusicProject, Stage } from '../data/types';

export const mainSteps = (p: MusicProject) => p.stages.filter((s) => s.inScope && s.track !== 'side');

function state(s: Stage): { cls: 'done' | 'active' | 'todo'; fill: number } {
  const u = stageUnits(s);
  if (stageComplete(s)) return { cls: 'done', fill: 1 };
  return { cls: u.done > 0 ? 'active' : 'todo', fill: u.total ? u.done / u.total : 0 };
}

/** Release step bar: Concept → … → Art (Design). Each step fills as its checklist is ticked. */
export function ReleaseStepper({ project, compact }: { project: MusicProject; compact?: boolean }) {
  const steps = mainSteps(project);
  if (!steps.length) return <span className="progress-none">No steps</span>;
  const current = steps.find((s) => !stageComplete(s));
  if (compact) {
    const done = steps.filter(stageComplete).length;
    return (
      <span className="mini-steps" role="img" aria-label={`Release step ${Math.min(done + 1, steps.length)} of ${steps.length}: ${current?.name ?? 'all done'}`}
        title={steps.map((s) => `${stageComplete(s) ? '✓' : s === current ? '▸' : '·'} ${s.name}`).join('\n')}>
        {steps.map((s) => { const st = state(s); return <i key={s.id} className={st.cls}><b style={{ width: `${st.fill * 100}%` }} /></i>; })}
        <em>{current ? current.name.replace(' (Design)', '') : 'Done'}</em>
      </span>
    );
  }
  return (
    <ol className="stepper" aria-label="Release steps">
      {steps.map((s, i) => {
        const st = state(s);
        return (
          <li key={s.id} className={`${st.cls}${s === current ? ' current' : ''}`}>
            <span className="node">{st.cls === 'done' ? '✓' : i + 1}</span>
            <span className="bar"><b style={{ width: `${st.fill * 100}%` }} /></span>
            <span className="name">{s.name}</span>
            {s.end && <span className="step-when">{relLabel(s.end)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
