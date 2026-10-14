import { relLabel } from '../lib/dates';
import { stageComplete, stageUnits } from '../lib/progress';
import type { MusicProject, Stage } from '../data/types';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** The stages that make up a project's progress, in order: a release's step bar, or the stages I was hired for on a job. */
export const mainSteps = (p: MusicProject) => p.stages.filter((s) => s.inScope && (p.kind === 'artist-job' || s.track !== 'side'));

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
    // One segment per stage (equal width, in order), filled by that stage's checklist; below it, the stage you're on.
    const done = steps.filter(stageComplete).length;
    const cur = current ? stageUnits(current) : null;
    const idx = current ? steps.indexOf(current) : -1;
    return (
      <span className="stage-track" role="img"
        aria-label={current ? `Stage ${idx + 1} of ${steps.length}: ${current.name}${cur && current.items.length ? `, ${cur.done} of ${cur.total} items` : ''}` : 'All stages done'}
        title={steps.map((s) => `${stageComplete(s) ? '✓' : s === current ? '▸' : '·'} ${s.name}`).join('\n')}>
        <span className="st-segs">
          {steps.map((s, i) => { const st = state(s); return <i key={s.id} className={`${st.cls}${s === current ? ' now' : ''}`} style={{ '--tone': stageTone(i) } as React.CSSProperties}><b style={{ width: `${st.fill * 100}%` }} /></i>; })}
        </span>
        <span className="st-now">
          {current ? <StageBadge index={idx} state="current" size={16} /> : <span className="st-done-mark">✓</span>}
          <em>{current ? current.name : 'All stages done'}</em>
          {current && cur && current.items.length > 0 && <small title="Checklist items done in this stage">☑ {cur.done}/{cur.total}</small>}
          <small className="st-of" title="Stages finished">{done}/{steps.length}</small>
        </span>
      </span>
    );
  }
  return (
    <ol className="stepper" aria-label="Release steps">
      {steps.map((s, i) => {
        const st = state(s);
        return (
          <li key={s.id} className={`${st.cls}${s === current ? ' current' : ''}`} style={{ '--tone': stageTone(i), '--tone-next': stageTone(i + 1) } as React.CSSProperties}>
            <span className="node"><StageBadge index={i} state={st.cls === 'done' ? 'done' : s === current ? 'current' : 'todo'} size={24} /></span>
            <span className="bar"><b style={{ width: `${st.fill * 100}%`, '--bar-span': `${st.fill > 0 ? 100 / st.fill : 100}%` } as React.CSSProperties} /></span>
            <span className="name">{s.name}</span>
            {s.end && <span className="step-when">{relLabel(s.end)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
