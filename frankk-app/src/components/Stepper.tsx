import { relLabel } from '../lib/dates';
import { stageComplete, stageUnits } from '../lib/progress';
import type { MusicProject, Stage } from '../data/types';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export const mainSteps = (p: MusicProject) => p.stages.filter((s) => s.inScope && s.track !== 'side');

/**
 * Stage colours climb as a project moves on: I green, II blue, III violet, IV amber, V red, VI and beyond gold.
 * Later stages also get more ornate (an extra ring, then a gilded rim) so progress feels earned.
 */
export const STAGE_TONES = ['#3f9a80', '#4c7fc0', '#8a5ab8', '#d9862c', '#c94a3a', '#d4a03c'];
export const stageTone = (i: number) => STAGE_TONES[Math.min(i, STAGE_TONES.length - 1)];
export const roman = (i: number) => ROMAN[i] ?? String(i + 1);

export function StageBadge({ index, state = 'todo', size = 22, title }: { index: number; state?: 'done' | 'current' | 'todo'; size?: number; title?: string }) {
  const tier = Math.min(index, 5);
  return (
    <span className={`stage-badge tier-${tier} ${state}`} title={title} aria-hidden={title ? undefined : true}
      style={{ '--tone': stageTone(index), width: size, height: size, fontSize: Math.round(size * (roman(index).length > 2 ? 0.36 : 0.45)) } as React.CSSProperties}>
      {roman(index)}
    </span>
  );
}

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
        {steps.map((s, i) => { const st = state(s); return <i key={s.id} className={st.cls} style={{ '--tone': stageTone(i) } as React.CSSProperties}><b style={{ width: `${st.fill * 100}%` }} /></i>; })}
        {current && <StageBadge index={steps.indexOf(current)} state="current" size={16} />}
        <em>{current ? current.name.replace(' (Design)', '') : 'Done'}</em>
      </span>
    );
  }
  return (
    <ol className="stepper" aria-label="Release steps">
      {steps.map((s, i) => {
        const st = state(s);
        return (
          <li key={s.id} className={`${st.cls}${s === current ? ' current' : ''}`} style={{ '--tone': stageTone(i) } as React.CSSProperties}>
            <span className="node"><StageBadge index={i} state={st.cls === 'done' ? 'done' : s === current ? 'current' : 'todo'} size={24} /></span>
            <span className="bar"><b style={{ width: `${st.fill * 100}%` }} /></span>
            <span className="name">{s.name}</span>
            {s.end && <span className="step-when">{relLabel(s.end)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
