import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { Dropdown } from '../components/Dropdown';
import { Icon } from '../components/Icons';
import { DateCell } from '../components/DateCell';
import { ProgressCell } from '../components/ProgressBar';
import { Modal } from '../components/Modal';
import { ColumnsMenu } from '../components/ColumnsMenu';
import { Table } from '../components/TaskTable';
import { Editable, MiniSelect } from '../components/Editable';
import { ReleaseStepper } from '../components/Stepper';
import { TagChips, TagPicker } from '../components/Tags';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { useColumns, type ColDef } from '../hooks/useColumns';
import { usePersistentState } from '../hooks/usePersistentState';
import { nextProjectDate, projectProgress, stageComplete, stageUnits } from '../lib/progress';
import { relLabel } from '../lib/dates';
import { PIGMENTS, RELEASE_STEPS, SIDE_STAGES, STAGE_LIBRARY, type MusicProject, type Stage } from '../data/types';
import { newId } from '../data/fixtures';

export const MUSIC_COLS: ColDef[] = [
  { id: 'title', label: 'Artist / Project', width: 114, min: 70 },
  { id: 'type', label: 'Role / Type', width: 78, min: 50 },
  { id: 'progress', label: 'Progress', width: 84, min: 50 },
  { id: 'next', label: 'Next', width: 48, min: 40 },
];

type Kind = 'all' | 'artist-job' | 'own-release';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'Projects & artist work' }, { id: 'artist-job', label: 'Artist jobs only' }, { id: 'own-release', label: 'Own releases only' },
];
const RELEASE_TYPES = [{ id: 'single', label: 'Single' }, { id: 'ep', label: 'EP' }, { id: 'album', label: 'Album' }, { id: 'other', label: 'Other' }] as const;
type PatchP = Partial<Pick<MusicProject, 'artist' | 'title' | 'client' | 'label' | 'roles' | 'targetRelease' | 'start' | 'color' | 'notes' | 'releaseType'>>;

export function MusicPanel({ focused }: { focused: boolean }) {
  const { data } = useStore();
  const { setProjectDialog, reveal, tagFilter } = useUi();
  const cols = useColumns('music', MUSIC_COLS);
  const [prefs, setPrefs] = usePersistentState<{ kind: Kind }>('prefs.music', { kind: 'all' });
  const [open, setOpen] = useState<Set<string>>(new Set(['p-single']));

  useEffect(() => {
    if (reveal?.kind === 'project') {
      setOpen((s) => new Set(s).add(reveal.id));
      requestAnimationFrame(() => document.querySelector(`[data-project="${reveal.id}"]`)?.scrollIntoView({ block: 'nearest' }));
    }
  }, [reveal]);

  const groups = useMemo(() => {
    const list = data.projects.filter((p) => (prefs.kind === 'all' || p.kind === prefs.kind) && (!tagFilter || p.tags.includes(tagFilter)));
    const map = new Map<string, MusicProject[]>();
    for (const p of list) {
      const g = p.kind === 'artist-job' ? 'Artist jobs' : p.label ? `${p.label} · own releases` : 'Own releases';
      map.set(g, [...(map.get(g) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === 'Artist jobs' ? 1 : 0) - (b === 'Artist jobs' ? 1 : 0));
  }, [data.projects, prefs.kind, tagFilter]);

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });

  return (
    <Panel area="music" title="Music" icon="music" focused={focused} onAdd={() => setProjectDialog(true)} addLabel="New project or artist job"
      menu={(close) => <ColumnsMenu defs={MUSIC_COLS} cols={cols} close={close} />}
      toolbar={<Dropdown ariaLabel="Show" value={prefs.kind} options={KINDS} onChange={(kind) => setPrefs({ kind })} />}
      footer={<button className="foot-add" onClick={() => setProjectDialog(true)}><Icon name="plus" size={13} /> Project or artist job</button>}>
      <Table cols={cols} label="Music projects">
        {groups.length === 0 && <div className="empty">Nothing here yet.</div>}
        {groups.map(([name, list]) => (
          <div className="group" key={name}>
            <div className="group-label">{name}</div>
            {list.map((p) => <ProjectRow key={p.id} p={p} cols={cols} open={open.has(p.id)} onToggle={() => toggle(p.id)} />)}
          </div>
        ))}
      </Table>
    </Panel>
  );
}

function ProjectRow({ p, cols, open, onToggle }: { p: MusicProject; cols: ReturnType<typeof useColumns>; open: boolean; onToggle: () => void }) {
  const { today } = useStore();
  const prog = projectProgress(p);
  const next = nextProjectDate(p);
  const job = p.kind === 'artist-job';
  const scoped = p.stages.filter((s) => s.inScope && s.track !== 'side');
  return (
    <div className={`task project ${job ? 'job' : 'release'}`} data-project={p.id} style={{ '--row': p.color ?? 'var(--music)' } as React.CSSProperties}>
      <div className="trow" style={{ gridTemplateColumns: cols.template }} role="row">
        <span />
        <button className={`chev${open ? ' open' : ''}`} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${p.artist} ${p.title}`} onClick={onToggle}><Icon name="chevronR" size={12} /></button>
        {cols.visible.map((c) => {
          switch (c.id) {
            case 'title': return (
              <div key={c.id} className="cell title-cell col" onClick={onToggle} style={{ cursor: 'pointer' }}>
                <span className="proj-name"><strong>{p.artist}</strong> <span className="muted">· {p.title}</span></span>
                <span className="sub">{job ? `${scoped.map((s) => s.name).join(' / ') || 'No stages assigned'} only` : `${RELEASE_TYPES.find((r) => r.id === p.releaseType)?.label ?? 'Release'}${p.targetRelease ? ` · out ${relLabel(p.targetRelease, today)}` : ''}`}</span>
                {p.tags.length > 0 && <TagChips names={p.tags} small />}
              </div>
            );
            case 'type': return (
              <div key={c.id} className="cell col">
                <span className={`pill ${job ? 'job' : 'own'}`}>{job ? 'Artist job' : 'Own release'}</span>
                <span className="sub">{p.roles.join(' / ')}</span>
              </div>
            );
            case 'progress': return (
              <div key={c.id} className="cell">{job ? <ProgressCell p={prog} none="Not broken down yet" /> : <ReleaseStepper project={p} compact />}</div>
            );
            case 'next': return (
              <div key={c.id} className="cell"><span className={`date-static${next && next <= today ? ' today' : ''}`}>{next ? relLabel(next, today) : '—'}</span></div>
            );
            default: return <div key={c.id} className="cell" />;
          }
        })}
        <span /><span />
      </div>
      {open && <ProjectDetail p={p} />}
    </div>
  );
}

function ProjectDetail({ p }: { p: MusicProject }) {
  const { dispatch } = useStore();
  const { openNote } = useUi();
  const job = p.kind === 'artist-job';
  const main = p.stages.filter((s) => s.inScope && s.track !== 'side');
  const side = job ? [] : p.stages.filter((s) => s.inScope && s.track === 'side');
  const outside = p.stages.filter((s) => !s.inScope);
  const [showOutside, setShowOutside] = useState(false);
  const available = STAGE_LIBRARY.filter((n) => !p.stages.some((s) => s.name === n));
  const patchP = (patch: PatchP) => dispatch({ type: 'project/patch', projectId: p.id, patch });

  return (
    <div className="project-detail">
      {!job && <ReleaseStepper project={p} />}

      <div className="fields">
        <label>Artist<Editable label="Artist" value={p.artist} onSave={(v) => patchP({ artist: v })} /></label>
        <label>Project<Editable label="Project" value={p.title} onSave={(v) => patchP({ title: v })} /></label>
        {job
          ? <label>Client<Editable label="Client" value={p.client ?? ''} allowEmpty placeholder="+ client" onSave={(v) => patchP({ client: v.trim() || undefined })} /></label>
          : <label>Label<Editable label="Label" value={p.label ?? ''} allowEmpty placeholder="+ label" onSave={(v) => patchP({ label: v.trim() || undefined })} /></label>}
        <label>{job ? 'My roles' : 'Roles'}<Editable label="Roles" value={p.roles.join(', ')} allowEmpty placeholder="+ roles" onSave={(v) => patchP({ roles: v.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
        {!job && <label>Type<MiniSelect label="Release type" value={p.releaseType ?? 'single'} options={[...RELEASE_TYPES]} onChange={(v) => patchP({ releaseType: v })} /></label>}
        {!job && <label>Release date<DateCell label="Target release" value={p.targetRelease} onChange={(v) => patchP({ targetRelease: v })} /></label>}
        <label>Colour<span className="swatch-row">{PIGMENTS.slice(0, 8).map((c) => (
          <button key={c.color} type="button" className={`sw${p.color === c.color ? ' on' : ''}`} style={{ background: c.color }} aria-label={`Colour ${c.name}`} title={c.name} onClick={() => patchP({ color: c.color })} />
        ))}</span></label>
        <div className="field-tags">Tags<span className="tag-line"><TagChips names={p.tags} small /><TagPicker compact value={p.tags} onChange={(tags) => dispatch({ type: 'project/tags', projectId: p.id, tags })} label="Edit project tags" /></span></div>
      </div>
      <label className="notes-line">Notes & links<Editable label="Notes" value={p.notes ?? ''} allowEmpty placeholder="+ add notes or reference links" onSave={(v) => patchP({ notes: v.trim() || undefined })} /></label>

      <div className="scope-line">
        {job ? <>Only the stages assigned to me count. The rest of the release isn’t tracked.</> : <>Release steps. Stages can overlap, be reordered or skipped.</>}
        <button className="link-btn" onClick={() => openNote(p.notePath)}><Icon name="external" size={12} /> Open in Obsidian</button>
      </div>

      {main.length === 0 && <p className="steps-empty">No stages yet. Add one below.</p>}
      {main.map((st, i) => <StageRow key={st.id} p={p} st={st} index={i} count={main.length} />)}

      <div className="stage-add">
        <Icon name="plus" size={12} />
        <select aria-label={`Add stage to ${p.artist}`} value="" onChange={(e) => { if (e.target.value) dispatch({ type: 'stage/add', projectId: p.id, name: e.target.value, track: job ? undefined : 'main' }); }}>
          <option value="">{job ? 'Add assigned stage' : 'Add release step'}</option>
          {available.map((n) => <option key={n}>{n}</option>)}
        </select>
      </div>

      {!job && (
        <div className="side-track">
          <div className="sub-label"><Icon name="sparkle" size={11} /> Separate tracks <span className="muted">· not part of release progress</span></div>
          {side.map((st, i) => <StageRow key={st.id} p={p} st={st} index={i} count={side.length} />)}
          <div className="stage-add">
            <Icon name="plus" size={12} />
            <select aria-label="Add separate track" value="" onChange={(e) => { if (e.target.value) dispatch({ type: 'stage/add', projectId: p.id, name: e.target.value, track: 'side' }); }}>
              <option value="">Add separate track (Marketing, MV…)</option>
              {available.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}

      {outside.length > 0 && (
        <div className="outside">
          <button className="link-btn" aria-expanded={showOutside} onClick={() => setShowOutside((v) => !v)}>
            <Icon name="info" size={12} /> {job ? 'Other stages outside my scope' : 'Skipped'} ({outside.length})
          </button>
          {showOutside && (
            <div className="outside-list">
              <p>{job ? 'These belong to someone else. They don’t reduce my progress and never count as overdue.' : 'Skipped for this release.'}</p>
              {outside.map((s) => (
                <span key={s.id} className="tag">{s.name}
                  <button aria-label={`Include ${s.name} in my scope`} onClick={() => dispatch({ type: 'stage/patch', projectId: p.id, stageId: s.id, patch: { inScope: true } })}>Include</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StageRow({ p, st, index, count }: { p: MusicProject; st: Stage; index: number; count: number }) {
  const { dispatch, today } = useStore();
  const { say } = useUi();
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const u = stageUnits(st);
  const hasItems = st.items.length > 0;
  const patch = (pt: Partial<Stage>) => dispatch({ type: 'stage/patch', projectId: p.id, stageId: st.id, patch: pt });
  const addItem = () => { if (text.trim()) { dispatch({ type: 'item/add', projectId: p.id, stageId: st.id, text }); setText(''); } };
  const own = p.kind === 'own-release';

  return (
    <div className={`stage${stageComplete(st) ? ' done' : ''}`}>
      <div className="stage-head">
        {hasItems
          ? <span className="stage-frac" title="Checked items in this stage">{u.done}/{u.total}</span>
          : (
            <label className="check no-drag">
              <input type="checkbox" checked={st.done} aria-label={`${st.name} done`} onChange={() => patch({ done: !st.done })} />
              <span className="box" />
            </label>
          )}
        <Editable className="stage-name" label="Stage name" value={st.name} onSave={(v) => patch({ name: v })} />
        <span className="stage-actions">
          <DateCell label={`${st.name} end date`} value={st.end} onChange={(v) => patch({ end: v })} done={stageComplete(st)} placeholder="+ date" />
          {own && (
            <button className="icon-btn tiny hover-only" title={st.track === 'side' ? 'Move into release steps' : 'Move to separate tracks'} aria-label={`Move ${st.name} ${st.track === 'side' ? 'into release steps' : 'to separate tracks'}`}
              onClick={() => patch({ track: st.track === 'side' ? 'main' : 'side' })}><Icon name={st.track === 'side' ? 'up' : 'down'} size={11} /></button>
          )}
          <button className="icon-btn tiny hover-only" aria-label={`Move ${st.name} earlier`} title="Earlier" disabled={index === 0} onClick={() => dispatch({ type: 'stage/move', projectId: p.id, stageId: st.id, dir: -1 })}><Icon name="chevronR" size={11} style={{ transform: 'rotate(-90deg)' }} /></button>
          <button className="icon-btn tiny hover-only" aria-label={`Move ${st.name} later`} title="Later" disabled={index === count - 1} onClick={() => dispatch({ type: 'stage/move', projectId: p.id, stageId: st.id, dir: 1 })}><Icon name="chevronR" size={11} style={{ transform: 'rotate(90deg)' }} /></button>
          <button className="icon-btn tiny hover-only" aria-label={`Mark ${st.name} ${own ? 'skipped' : 'outside my scope'}`} title={own ? 'Skip this stage' : 'Move outside my scope'} onClick={() => patch({ inScope: false })}><Icon name="close" size={11} /></button>
        </span>
      </div>
      {st.items.map((i) => (
        <div key={i.id} className={`step${i.done ? ' done' : ''}`}>
          <label className="check no-drag">
            <input type="checkbox" checked={i.done} aria-label={i.text}
              onChange={() => dispatch({ type: 'item/patch', projectId: p.id, stageId: st.id, itemId: i.id, patch: { done: !i.done } })} />
            <span className="box" />
          </label>
          <Editable className="step-text" label="Item" value={i.text} onSave={(v) => dispatch({ type: 'item/patch', projectId: p.id, stageId: st.id, itemId: i.id, patch: { text: v } })} />
          <button className="icon-btn tiny hover-only" aria-label={`Remove ${i.text}`} title="Remove item"
            onClick={() => { dispatch({ type: 'item/remove', projectId: p.id, stageId: st.id, itemId: i.id }); say(`Removed “${i.text}”.`, true); }}><Icon name="close" size={11} /></button>
          <DateCell label={`${i.text} date`} value={i.date} done={i.done} placeholder="+ date" onChange={(v) => dispatch({ type: 'item/patch', projectId: p.id, stageId: st.id, itemId: i.id, patch: { date: v } })} />
        </div>
      ))}
      {adding ? (
        <div className="step add">
          <Icon name="plus" size={12} />
          <input autoFocus className="step-input" placeholder={`Add item to ${st.name}`} aria-label={`Add item to ${st.name}`} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') setAdding(false); }} onBlur={() => { if (!text.trim()) setAdding(false); }} />
        </div>
      ) : (
        <button className="link-btn indent" onClick={() => setAdding(true)}>+ Break down</button>
      )}
      {st.end && !stageComplete(st) && st.end < today && <span className="late">Stage date passed</span>}
    </div>
  );
}

/* ---------- New project / job window: asks for everything ---------- */

interface StageDraft { name: string; on: boolean; track: 'main' | 'side'; end: string }

const draftsFor = (kind: MusicProject['kind']): StageDraft[] => STAGE_LIBRARY.map((n) => ({
  name: n,
  on: kind === 'own-release' && (RELEASE_STEPS.includes(n) || n === 'Marketing'),
  track: SIDE_STAGES.includes(n) ? 'side' : 'main',
  end: '',
}));

export function ProjectDialog() {
  const { dispatch } = useStore();
  const { setProjectDialog, say, revealRow } = useUi();
  const [kind, setKind] = useState<MusicProject['kind']>('own-release');
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [releaseType, setReleaseType] = useState<NonNullable<MusicProject['releaseType']>>('single');
  const [label, setLabel] = useState('');
  const [client, setClient] = useState('');
  const [roles, setRoles] = useState('');
  const [start, setStart] = useState('');
  const [target, setTarget] = useState('');
  const [color, setColor] = useState(PIGMENTS[1].color);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [stages, setStages] = useState<StageDraft[]>(draftsFor('own-release'));

  const pickKind = (k: MusicProject['kind']) => { setKind(k); setStages(draftsFor(k)); };
  const setStage = (name: string, patch: Partial<StageDraft>) => setStages((s) => s.map((x) => (x.name === name ? { ...x, ...patch } : x)));
  const valid = artist.trim() && title.trim();
  const own = kind === 'own-release';

  const submit = () => {
    if (!valid) return;
    const id = newId('p');
    const list: Stage[] = stages
      .filter((s) => s.on || kind === 'artist-job' || s.name !== 'MV')
      .map((s) => ({ id: `${id}-${s.name.toLowerCase().replace(/[^a-z]+/g, '-')}`, name: s.name, inScope: s.on, done: false, items: [], end: s.end || undefined, track: own ? s.track : undefined }));
    dispatch({
      type: 'project/add',
      project: {
        id, kind, artist: artist.trim(), title: title.trim(), label: own && label.trim() ? label.trim() : undefined,
        client: !own ? (client.trim() || artist.trim()) : undefined, roles: roles.split(',').map((r) => r.trim()).filter(Boolean),
        releaseType: own ? releaseType : undefined, targetRelease: target || undefined, start: start || undefined, color, tags, notes: notes.trim() || undefined,
        stages: list, notePath: `Music/${own ? 'Releases' : 'Jobs'}/${artist.trim()} – ${title.trim()}.md`,
      },
    });
    setProjectDialog(false);
    revealRow('project', id);
    say(`${own ? 'Release' : 'Artist job'} “${title.trim()}” added.`, true);
  };

  return (
    <Modal title="New project or artist job" onClose={() => setProjectDialog(false)} wide>
      <form className="dialog-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="seg" role="radiogroup" aria-label="Work type">
          <button type="button" role="radio" aria-checked={own} onClick={() => pickKind('own-release')}>Own release<small>My single, EP or album</small></button>
          <button type="button" role="radio" aria-checked={!own} onClick={() => pickKind('artist-job')}>Artist job<small>I do selected stages for someone</small></button>
        </div>
        <div className="form-row">
          <label className="field">{own ? 'Artist' : 'Artist'}<input id="np-artist" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder={own ? 'FRANKK' : 'e.g. JZero'} /></label>
          <label className="field">Project / release title<input id="np-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Night Drive" /></label>
        </div>
        <div className="form-row four">
          {own
            ? <label className="field">Type<select id="np-type" value={releaseType} onChange={(e) => setReleaseType(e.target.value as typeof releaseType)}>{RELEASE_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
            : <label className="field">Client<input id="np-client" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Same as artist" /></label>}
          {own && <label className="field">Label<input id="np-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Surftape" /></label>}
          <label className="field">Start<input id="np-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="field">{own ? 'Release date' : 'Deadline'}<input id="np-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
        </div>
        <label className="field">{own ? 'Roles' : 'My roles'} <small>comma separated</small><input id="np-roles" value={roles} onChange={(e) => setRoles(e.target.value)} placeholder={own ? 'Artist, Producer' : 'Mixing, Mastering'} /></label>

        <fieldset>
          <legend>{own ? 'Stages · release steps and separate tracks' : 'Stages I am responsible for'}</legend>
          <div className="stage-picks">
            {stages.map((s) => (
              <div key={s.name} className={`stage-pick${s.on ? ' on' : ''}`}>
                <label className="check"><input type="checkbox" checked={s.on} onChange={() => setStage(s.name, { on: !s.on })} /><span className="box" />{s.name}</label>
                {s.on && own && (
                  <select aria-label={`${s.name} track`} value={s.track} onChange={(e) => setStage(s.name, { track: e.target.value as StageDraft['track'] })}>
                    <option value="main">Step</option><option value="side">Separate</option>
                  </select>
                )}
                {s.on && <input type="date" aria-label={`${s.name} end date`} value={s.end} onChange={(e) => setStage(s.name, { end: e.target.value })} />}
              </div>
            ))}
          </div>
          <p className="hint">{own ? 'Release steps make the step bar. Separate tracks (Marketing, MV…) are tracked but never count toward release progress.' : 'Unticked stages stay outside your scope and never count against your progress.'}</p>
        </fieldset>

        <div className="form-row">
          <div className="field">Colour<span className="swatch-row">{PIGMENTS.map((c) => (
            <button key={c.color} type="button" className={`sw${color === c.color ? ' on' : ''}`} style={{ background: c.color }} aria-label={`Colour ${c.name}`} title={c.name} onClick={() => setColor(c.color)} />
          ))}</span></div>
          <div className="field">Tags<span className="tag-line"><TagChips names={tags} /><TagPicker value={tags} onChange={setTags} label="Add tags" /></span></div>
        </div>
        <label className="field">Notes & reference links<textarea id="np-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Session files, references, contacts…" /></label>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={() => setProjectDialog(false)}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!valid}>Create</button>
        </div>
      </form>
    </Modal>
  );
}
