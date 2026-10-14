import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { Dropdown } from '../components/Dropdown';
import { Icon } from '../components/Icons';
import { DateCell } from '../components/DateCell';
import { ProgressCell } from '../components/ProgressBar';
import { Modal } from '../components/Modal';
import { ColumnsMenu } from '../components/ColumnsMenu';
import { Table } from '../components/TaskTable';
import { Editable } from '../components/Editable';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { useColumns, type ColDef } from '../hooks/useColumns';
import { usePersistentState } from '../hooks/usePersistentState';
import { nextProjectDate, projectProgress, stageComplete, stageUnits } from '../lib/progress';
import { relLabel } from '../lib/dates';
import { STAGE_LIBRARY, type MusicProject, type Stage } from '../data/types';
import { newId } from '../data/fixtures';

export const MUSIC_COLS: ColDef[] = [
  { id: 'title', label: 'Artist / Project', width: 114, min: 70 },
  { id: 'type', label: 'Role / Type', width: 82, min: 50 },
  { id: 'progress', label: 'Progress', width: 62, min: 44 },
  { id: 'next', label: 'Next', width: 48, min: 40 },
];

type Kind = 'all' | 'artist-job' | 'own-release';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'Projects & artist work' }, { id: 'artist-job', label: 'Artist jobs only' }, { id: 'own-release', label: 'Full releases only' },
];

export function MusicPanel({ focused }: { focused: boolean }) {
  const { data } = useStore();
  const { setProjectDialog, reveal } = useUi();
  const cols = useColumns('music', MUSIC_COLS);
  const [prefs, setPrefs] = usePersistentState<{ kind: Kind }>('prefs.music', { kind: 'all' });
  const [open, setOpen] = useState<Set<string>>(new Set(['p-jzero']));

  useEffect(() => {
    if (reveal?.kind === 'project') {
      setOpen((s) => new Set(s).add(reveal.id));
      requestAnimationFrame(() => document.querySelector(`[data-project="${reveal.id}"]`)?.scrollIntoView({ block: 'nearest' }));
    }
  }, [reveal]);

  const groups = useMemo(() => {
    const list = data.projects.filter((p) => prefs.kind === 'all' || p.kind === prefs.kind);
    const map = new Map<string, MusicProject[]>();
    for (const p of list) {
      const g = p.kind === 'artist-job' ? 'Artist jobs' : p.label ? `${p.label} / Artists` : 'Own releases';
      map.set(g, [...(map.get(g) ?? []), p]);
    }
    return [...map.entries()];
  }, [data.projects, prefs.kind]);

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });

  return (
    <Panel area="music" title="Music" icon="music" focused={focused} onAdd={() => setProjectDialog(true)} addLabel="New project or artist job"
      menu={(close) => <ColumnsMenu defs={MUSIC_COLS} cols={cols} close={close} />}
      toolbar={<Dropdown ariaLabel="Show" value={prefs.kind} options={KINDS} onChange={(kind) => setPrefs({ kind })} />}
      footer={<button className="foot-add" onClick={() => setProjectDialog(true)}><Icon name="plus" size={14} /> Project or artist job</button>}>
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
  const scoped = p.stages.filter((s) => s.inScope);
  const roleText = job ? p.roles.join(' / ') : (p.releaseType ?? 'release');
  return (
    <div className={`task project ${job ? 'job' : 'release'}`} data-project={p.id}>
      <div className="trow" style={{ gridTemplateColumns: cols.template }} role="row">
        <span />
        <button className={`chev${open ? ' open' : ''}`} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${p.artist} ${p.title}`} onClick={onToggle}><Icon name="chevronR" size={13} /></button>
        {cols.visible.map((c) => {
          switch (c.id) {
            case 'title': return (
              <div key={c.id} className="cell title-cell col" onClick={onToggle} style={{ cursor: 'pointer' }}>
                <span className="task-title"><strong>{p.artist}</strong> <span className="muted">· {p.title}</span></span>
                <span className="sub">{job ? `${scoped.map((s) => s.name).join(' / ') || 'No stages assigned'} only` : scoped.slice(0, 4).map((s) => s.name).join(' → ') + (scoped.length > 4 ? ' …' : '')}</span>
              </div>
            );
            case 'type': return (
              <div key={c.id} className="cell col">
                <span className={`pill ${job ? 'job' : 'own'}`}>{job ? 'Artist job' : 'Own release'}</span>
                <span className="sub">{roleText}</span>
              </div>
            );
            case 'progress': return (
              <div key={c.id} className="cell"><ProgressCell p={prog} none="Not broken down yet" /></div>
            );
            case 'next': return (
              <div key={c.id} className="cell"><span className="date-static">{next ? relLabel(next, today) : '—'}</span></div>
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
  const inScope = p.stages.filter((s) => s.inScope);
  const outside = p.stages.filter((s) => !s.inScope);
  const [showOutside, setShowOutside] = useState(false);
  const available = STAGE_LIBRARY.filter((n) => !p.stages.some((s) => s.name === n));
  const patchP = (patch: Partial<Pick<MusicProject, 'artist' | 'title' | 'client' | 'label' | 'roles' | 'targetRelease'>>) =>
    dispatch({ type: 'project/patch', projectId: p.id, patch });

  return (
    <div className="project-detail">
      <div className="scope-line">
        {job
          ? <>Only the stages assigned to me count here. <em>The rest of the release isn’t tracked.</em></>
          : <>Full release. Stages can overlap, be reordered or skipped.</>}
        <button className="link-btn" onClick={() => openNote(p.notePath)}><Icon name="external" size={12} /> Open in Obsidian</button>
      </div>

      <div className="fields">
        <label>Artist<Editable label="Artist" value={p.artist} onSave={(v) => patchP({ artist: v })} /></label>
        <label>Project<Editable label="Project" value={p.title} onSave={(v) => patchP({ title: v })} /></label>
        {job
          ? <label>Client<Editable label="Client" value={p.client ?? ''} allowEmpty placeholder="+ client" onSave={(v) => patchP({ client: v.trim() || undefined })} /></label>
          : <label>Label<Editable label="Label" value={p.label ?? ''} allowEmpty placeholder="+ label" onSave={(v) => patchP({ label: v.trim() || undefined })} /></label>}
        <label>{job ? 'My roles' : 'Roles'}<Editable label="Roles" value={p.roles.join(', ')} allowEmpty placeholder="+ roles" onSave={(v) => patchP({ roles: v.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
        {!job && <label>Target release<DateCell label="Target release" value={p.targetRelease} onChange={(v) => patchP({ targetRelease: v })} /></label>}
      </div>

      {!job && <Timeline stages={inScope} />}

      {inScope.length === 0 && <p className="steps-empty">No stages assigned yet. Add one below.</p>}
      {inScope.map((st, i) => (
        <StageRow key={st.id} p={p} st={st} index={i} count={inScope.length} />
      ))}

      <div className="stage-add">
        <Icon name="plus" size={13} />
        <select aria-label={`Add assigned stage to ${p.artist}`} value="" onChange={(e) => { if (e.target.value) dispatch({ type: 'stage/add', projectId: p.id, name: e.target.value }); }}>
          <option value="">{job ? 'Add assigned stage' : 'Add stage'}</option>
          {available.map((n) => <option key={n}>{n}</option>)}
        </select>
      </div>

      {outside.length > 0 && (
        <div className="outside">
          <button className="link-btn" aria-expanded={showOutside} onClick={() => setShowOutside((v) => !v)}>
            <Icon name="info" size={12} /> {job ? 'Other stages outside my scope' : 'Skipped stages'} ({outside.length})
          </button>
          {showOutside && (
            <div className="outside-list">
              <p>{job ? 'These belong to someone else. They don’t reduce my progress and never count as overdue.' : 'Skipped for this release; they don’t reduce progress.'}</p>
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

function Timeline({ stages }: { stages: Stage[] }) {
  return (
    <ol className="timeline" aria-label="Stage timeline">
      {stages.map((s) => {
        const u = stageUnits(s);
        const state = stageComplete(s) ? 'done' : u.done > 0 ? 'active' : 'todo';
        return <li key={s.id} className={state}><span>{s.name}</span></li>;
      })}
    </ol>
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
          <DateCell label={`${st.name} end date`} value={st.end} onChange={(v) => patch({ end: v })} done={stageComplete(st)} />
          <button className="icon-btn tiny hover-only" aria-label={`Move ${st.name} earlier`} disabled={index === 0} onClick={() => dispatch({ type: 'stage/move', projectId: p.id, stageId: st.id, dir: -1 })}><Icon name="up" size={12} /></button>
          <button className="icon-btn tiny hover-only" aria-label={`Move ${st.name} later`} disabled={index === count - 1} onClick={() => dispatch({ type: 'stage/move', projectId: p.id, stageId: st.id, dir: 1 })}><Icon name="down" size={12} /></button>
          <button className="icon-btn tiny hover-only" aria-label={`Mark ${st.name} outside my scope`} title="Move outside my scope" onClick={() => patch({ inScope: false })}><Icon name="close" size={11} /></button>
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
          <Icon name="plus" size={13} />
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

/* ---------- new project / job dialog ---------- */

export function ProjectDialog() {
  const { dispatch } = useStore();
  const { setProjectDialog, say, revealRow } = useUi();
  const [kind, setKind] = useState<MusicProject['kind']>('artist-job');
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState('');
  const defaults = ['Concept', 'Produce', 'Record', 'Lyrics', 'Art', 'Marketing', 'Streaming'];
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const pickKind = (k: MusicProject['kind']) => { setKind(k); setChosen(new Set(k === 'own-release' ? defaults : [])); };
  const toggle = (n: string) => setChosen((s) => { const x = new Set(s); if (!x.delete(n)) x.add(n); return x; });
  const valid = artist.trim() && title.trim();

  const submit = () => {
    if (!valid) return;
    const id = newId('p');
    // Every library stage exists; unchosen ones are outside scope (never counted, never overdue).
    const stages: Stage[] = STAGE_LIBRARY.filter((n) => chosen.has(n) || kind === 'artist-job' || n !== 'MV')
      .map((n) => ({ id: `${id}-${n.toLowerCase()}`, name: n, inScope: chosen.has(n), done: false, items: [] }));
    dispatch({
      type: 'project/add',
      project: {
        id, kind, artist: artist.trim(), title: title.trim(), label: kind === 'own-release' && label.trim() ? label.trim() : undefined,
        client: kind === 'artist-job' ? artist.trim() : undefined, roles: [...chosen], releaseType: kind === 'own-release' ? 'single' : undefined,
        targetRelease: target || undefined, stages, notePath: `Music/${kind === 'own-release' ? 'Releases' : 'Jobs'}/${artist.trim()} – ${title.trim()}.md`,
      },
    });
    setProjectDialog(false);
    revealRow('project', id);
    say(`${kind === 'artist-job' ? 'Artist job' : 'Release'} added (sample data).`);
  };

  return (
    <Modal title="New project or artist job" onClose={() => setProjectDialog(false)}>
      <form className="new-form modal-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="seg" role="radiogroup" aria-label="Work type">
          <button type="button" role="radio" aria-checked={kind === 'artist-job'} onClick={() => pickKind('artist-job')}>Artist job<small>I do selected stages</small></button>
          <button type="button" role="radio" aria-checked={kind === 'own-release'} onClick={() => pickKind('own-release')}>Full release<small>Whole single / album</small></button>
        </div>
        <div className="form-row">
          <label>{kind === 'artist-job' ? 'Artist / client' : 'Artist'}<input value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
          <label>Project / release<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        </div>
        {kind === 'own-release' && (
          <div className="form-row">
            <label>Label (optional)<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Surftape" /></label>
            <label>Target release<input type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
          </div>
        )}
        <fieldset>
          <legend>{kind === 'artist-job' ? 'Stages I am responsible for' : 'Stages'}</legend>
          <div className="chips">
            {STAGE_LIBRARY.map((n) => (
              <label key={n} className={`chip-check${chosen.has(n) ? ' on' : ''}`}><input type="checkbox" checked={chosen.has(n)} onChange={() => toggle(n)} />{n}</label>
            ))}
          </div>
          {kind === 'artist-job' && <p className="hint">Unticked stages stay outside your scope and never count against your progress.</p>}
        </fieldset>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={() => setProjectDialog(false)}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!valid}>Add</button>
        </div>
      </form>
    </Modal>
  );
}
