import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { Icon } from '../components/Icons';
import { ColorSelect } from '../components/ColorSelect';
import { DateCell } from '../components/DateCell';
import { ProgressCell } from '../components/ProgressBar';
import { Modal } from '../components/Modal';
import { ColumnsMenu } from '../components/ColumnsMenu';
import { Table, ResizeHandle, nextSort, type SortState } from '../components/TaskTable';
import { Editable, MiniSelect } from '../components/Editable';
import { ReleaseStepper, StageBadge, mainSteps, stageTone } from '../components/Stepper';
import { SortableList } from '../components/SortableList';
import { useContextMenu } from '../components/ContextMenu';
import { TagChips, TagPicker } from '../components/Tags';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { useColumns, type ColDef } from '../hooks/useColumns';
import { usePersistentState } from '../hooks/usePersistentState';
import { nextProjectDate, projectProgress, stageComplete, stageUnits } from '../lib/progress';
import { diffDays, relLabel, shortDate } from '../lib/dates';
import { PIGMENTS, RELEASE_STEPS, SIDE_STAGES, STAGE_LIBRARY, type MusicProject, type Stage } from '../data/types';
import { newId } from '../data/fixtures';

export const MUSIC_COLS: ColDef[] = [
  { id: 'title', label: 'Artist / Project', width: 106, min: 70 },
  { id: 'type', label: 'Role / Type', width: 78, min: 50 },
  { id: 'progress', label: 'Progress', width: 84, min: 50 },
  { id: 'next', label: 'Next', width: 54, min: 40 },
];

type Tab = 'own-release' | 'artist-job' | 'all';

const REL_COLS: ColDef[] = [
  { id: 'title', label: 'Release', width: 150, min: 80 },
  { id: 'type', label: 'Format', width: 70, min: 50 },
  { id: 'progress', label: 'Release steps', width: 150, min: 80 },
  { id: 'next', label: 'Next date', width: 70, min: 46 },
];
const JOB_COLS: ColDef[] = [
  { id: 'title', label: 'Artist / client', width: 150, min: 80 },
  { id: 'type', label: 'My roles', width: 90, min: 50 },
  { id: 'progress', label: 'My progress', width: 110, min: 60 },
  { id: 'next', label: 'Next date', width: 70, min: 46 },
];
const RELEASE_TYPES = [{ id: 'single', label: 'Single' }, { id: 'ep', label: 'EP' }, { id: 'album', label: 'Album' }, { id: 'other', label: 'Other' }] as const;
type PatchP = Partial<Pick<MusicProject, 'artist' | 'title' | 'client' | 'label' | 'roles' | 'targetRelease' | 'start' | 'color' | 'notes' | 'releaseType'>>;

export function MusicPanel({ focused }: { focused: boolean }) {
  const { data } = useStore();
  const { setProjectDialog, reveal, tagFilter } = useUi();
  const relCols = useColumns('music.rel', REL_COLS);
  const jobCols = useColumns('music.job', JOB_COLS);
  const allCols = useColumns('music', MUSIC_COLS);
  const [prefs, setPrefs] = usePersistentState<{ tab: Tab; sort: SortState | null }>('prefs.music.v2', { tab: 'own-release', sort: null });
  const [open, setOpen] = useState<Set<string>>(new Set(['p-single']));
  const tab = prefs.tab;
  const cols = tab === 'own-release' ? relCols : tab === 'artist-job' ? jobCols : allCols;
  const defs = tab === 'own-release' ? REL_COLS : tab === 'artist-job' ? JOB_COLS : MUSIC_COLS;

  useEffect(() => {
    if (reveal?.kind === 'project') {
      const p = data.projects.find((x) => x.id === reveal.id);
      if (p && tab !== 'all' && p.kind !== tab) setPrefs((s) => ({ ...s, tab: p.kind }));
      setOpen((s) => new Set(s).add(reveal.id));
      requestAnimationFrame(() => document.querySelector(`[data-project="${reveal.id}"]`)?.scrollIntoView({ block: 'nearest' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  const visible = useMemo(() => data.projects.filter((p) => !tagFilter || p.tags.includes(tagFilter)), [data.projects, tagFilter]);
  const count = (k: MusicProject['kind']) => visible.filter((p) => p.kind === k).length;

  const groups = useMemo(() => {
    const list = visible.filter((p) => tab === 'all' || p.kind === tab);
    const map = new Map<string, MusicProject[]>();
    for (const p of list) {
      // Releases group by label; jobs by client. "All" groups by kind.
      const g = tab === 'all' ? (p.kind === 'artist-job' ? 'Artist jobs' : 'My releases')
        : p.kind === 'own-release' ? (p.label || 'No label') : (p.client || p.artist);
      map.set(g, [...(map.get(g) ?? []), p]);
    }
    const s = prefs.sort;
    const val = (p: MusicProject): string | number => !s ? 0 : s.key === 'title' ? `${p.artist} ${p.title}`.toLowerCase() : s.key === 'type' ? (p.kind === 'own-release' ? p.releaseType ?? '' : p.roles.join(','))
      : s.key === 'progress' ? projectProgress(p).pct ?? -1 : nextProjectDate(p) ?? '9999';
    const sortList = (l: MusicProject[]) => (!s ? l : [...l].sort((a, b) => { const x = val(a), y = val(b); const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return s.dir === 'asc' ? c : -c; }));
    return [...map.entries()].map(([k, l]) => [k, sortList(l)] as [string, MusicProject[]]);
  }, [visible, tab, prefs.sort]);

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const newKind = tab === 'artist-job' ? 'artist-job' : 'own-release';
  const newLabel = tab === 'artist-job' ? 'New artist job' : tab === 'own-release' ? 'New release' : 'New project or artist job';
  const TABS: { id: Tab; label: string; icon: 'music' | 'person' | 'list'; n: number; hint: string }[] = [
    { id: 'own-release', label: 'My releases', icon: 'music', n: count('own-release'), hint: 'Your own singles, EPs and albums: every release step counts.' },
    { id: 'artist-job', label: 'Artist jobs', icon: 'person', n: count('artist-job'), hint: 'Work for other artists: only the stages you were hired for count.' },
    { id: 'all', label: 'All', icon: 'list', n: visible.length, hint: 'Everything together.' },
  ];

  return (
    <Panel area="music" title="Music" icon="music" focused={focused} onAdd={() => setProjectDialog(newKind)} addLabel={newLabel}
      menu={(close) => <ColumnsMenu defs={defs} cols={cols} close={close} />}
      toolbar={
        <div className="music-tabs" role="tablist" aria-label="Kind of music work">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} title={t.hint} className="music-tab" onClick={() => setPrefs((p) => ({ ...p, tab: t.id }))}>
              <Icon name={t.icon} size={13} /> {t.label} <em>{t.n}</em>
            </button>
          ))}
        </div>
      }
      footer={<button className="foot-add" onClick={() => setProjectDialog(newKind)}><Icon name="plus" size={13} /> {tab === 'artist-job' ? 'Artist job' : tab === 'own-release' ? 'Release' : 'Project or artist job'}</button>}>
      {tab === 'own-release' ? (
        <ReleaseBoard list={visible.filter((p) => p.kind === 'own-release')} open={open} onToggle={toggle} />
      ) : (<>
      <div className="music-bar">
        <p className="music-hint">{TABS.find((t) => t.id === tab)!.hint}</p>
        <button className="btn primary small" onClick={() => setProjectDialog(newKind)}><Icon name="plus" size={13} /> {newLabel}</button>
      </div>
      <Table cols={cols} label="Music projects" sort={prefs.sort} onSort={(col) => setPrefs((p) => ({ ...p, sort: nextSort(p.sort, col) }))}>
        {groups.length === 0 && (
          <div className="empty">
            {tab === 'artist-job' ? 'No artist jobs yet.' : 'Nothing here yet.'}{' '}
            <button className="link-btn" onClick={() => setProjectDialog(newKind)}>{newLabel}</button>
          </div>
        )}
        {groups.map(([name, list]) => (
          <div className="group" key={name}>
            <div className="group-label">{name} <span className="muted">· {list.length}</span></div>
            {list.map((p) => <ProjectRow key={p.id} p={p} cols={cols} open={open.has(p.id)} onToggle={() => toggle(p.id)} />)}
          </div>
        ))}
      </Table>
      </>)}
    </Panel>
  );
}

/* ---------- My releases: a dashboard of what's coming out and where each one stands ---------- */

function ReleaseBoard({ list, open, onToggle }: { list: MusicProject[]; open: Set<string>; onToggle: (id: string) => void }) {
  const { today } = useStore();
  const { setProjectDialog } = useUi();
  const finished = (p: MusicProject) => mainSteps(p).length > 0 && mainSteps(p).every(stageComplete);
  const byDate = (a: MusicProject, b: MusicProject) => (a.targetRelease ?? '9999').localeCompare(b.targetRelease ?? '9999');
  const upcoming = list.filter((p) => !finished(p)).sort(byDate);
  const done = list.filter(finished).sort(byDate);
  return (
    <div className="rel-board">
      <div className="rel-top">
        <div>
          <h4>Upcoming releases</h4>
          <p className="muted">{upcoming.length ? `${upcoming.length} in progress${done.length ? ` · ${done.length} finished` : ''}` : 'Nothing in progress.'}</p>
        </div>
        <button className="btn primary" onClick={() => setProjectDialog('own-release')}><Icon name="plus" size={14} /> New release</button>
      </div>
      {list.length === 0 && (
        <button className="rel-empty" onClick={() => setProjectDialog('own-release')}><Icon name="music" size={22} /><b>Start your first release</b><span>Single, EP or album: it gets a step bar from Concept to Art.</span></button>
      )}
      <div className="rel-grid">
        {[...upcoming, ...done].map((p) => <ReleaseCard key={p.id} p={p} today={today} open={open.has(p.id)} onToggle={() => onToggle(p.id)} finished={finished(p)} />)}
      </div>
    </div>
  );
}

function ReleaseCard({ p, today, open, onToggle, finished }: { p: MusicProject; today: string; open: boolean; onToggle: () => void; finished: boolean }) {
  const { dispatch } = useStore();
  const { openNote, say } = useUi();
  const menu = useContextMenu();
  const steps = mainSteps(p);
  const doneN = steps.filter(stageComplete).length;
  const idx = steps.findIndex((s) => !stageComplete(s));
  const now = idx >= 0 ? steps[idx] : undefined;
  const then = idx >= 0 ? steps[idx + 1] : undefined;
  const days = p.targetRelease ? diffDays(p.targetRelease, today) : undefined;
  const fmt = RELEASE_TYPES.find((r) => r.id === p.releaseType)?.label ?? 'Release';
  const late = now?.end && now.end < today;
  return (
    <div className="rel-wrap" data-project={p.id}>
      <article className={`rel-card${open ? ' open' : ''}${finished ? ' finished' : ''}`} style={{ '--row': p.color ?? 'var(--music)' } as React.CSSProperties}
        onContextMenu={(e) => menu(e, [
          { label: open ? 'Close' : 'Open', icon: 'chevronR', onClick: onToggle },
          { label: 'Open in Obsidian', icon: 'external', onClick: () => openNote(p.notePath) },
          { label: 'Delete release', icon: 'trash', danger: true, sep: true, onClick: () => { dispatch({ type: 'project/remove', projectId: p.id }); say(`Deleted “${p.title}”.`, true); } },
        ])}>
        <button className="rel-hit" aria-expanded={open} aria-label={`${open ? 'Close' : 'Open'} ${p.artist} ${p.title}`} onClick={onToggle} />
        <header className="rel-head">
          <span className="rel-dot" />
          <div className="rel-name">
            <h5>{p.title}</h5>
            <span>{p.artist} · {fmt}{p.label ? ` · ${p.label}` : ''}</span>
          </div>
          <div className="rel-count">
            {finished ? <b>Done</b> : days === undefined ? <small>No release date</small>
              : days < 0 ? <><b className="late">{-days}d</b><small>past {shortDate(p.targetRelease!, today)}</small></>
              : <><b>{days === 0 ? 'Today' : `${days}d`}</b><small>out {shortDate(p.targetRelease!, today)}</small></>}
          </div>
        </header>
        <div className="rel-steps" role="img" aria-label={`Step ${Math.min(doneN + 1, steps.length)} of ${steps.length}`}>
          {steps.map((s, i) => {
            const u = stageUnits(s);
            const fill = stageComplete(s) ? 1 : u.total ? u.done / u.total : 0;
            return (
              <span key={s.id} className={`rel-seg${stageComplete(s) ? ' done' : i === idx ? ' now' : ''}`} title={s.name} style={{ '--tone': stageTone(i) } as React.CSSProperties}>
                <i><b style={{ width: `${fill * 100}%` }} /></i>
                <em><StageBadge index={i} state={stageComplete(s) ? 'done' : i === idx ? 'current' : 'todo'} size={18} /> {s.name}</em>
                {s.end && <small>{relLabel(s.end, today)}</small>}
              </span>
            );
          })}
        </div>
        <div className="rel-now">
          {now ? (
            <>
              <span className="rel-label">Now</span><StageBadge index={idx} state="current" size={26} /><strong>{now.name}</strong>
              {now.end && <span className={late ? 'late' : 'muted'}>{late ? 'was due' : 'due'} {relLabel(now.end, today)}</span>}
              <span className="rel-of">{doneN}/{steps.length}</span>
            </>
          ) : <span className="muted">All release steps done.</span>}
        </div>
        {then && <div className="rel-then"><span className="rel-label">Then</span><StageBadge index={idx + 1} size={18} />{then.name}{then.end && <span className="muted"> · {relLabel(then.end, today)}</span>}</div>}
        {(p.notes || p.roles.length > 0 || p.tags.length > 0) && (
          <div className="rel-extra">
            {p.notes && <p className="rel-notes">{p.notes}</p>}
            <div className="rel-meta">
              {p.roles.length > 0 && <span><span className="rel-label">Roles</span>{p.roles.join(', ')}</span>}
              {p.tags.length > 0 && <TagChips names={p.tags} small />}
            </div>
          </div>
        )}
      </article>
      {open && <div className="rel-detail"><ProjectDetail p={p} /></div>}
    </div>
  );
}

function ProjectRow({ p, cols, open, onToggle }: { p: MusicProject; cols: ReturnType<typeof useColumns>; open: boolean; onToggle: () => void }) {
  const { today, dispatch } = useStore();
  const { openNote, say } = useUi();
  const menu = useContextMenu();
  const prog = projectProgress(p);
  const next = nextProjectDate(p);
  const job = p.kind === 'artist-job';
  const scoped = p.stages.filter((s) => s.inScope && s.track !== 'side');
  return (
    <div className={`task project ${job ? 'job' : 'release'}`} data-project={p.id} style={{ '--row': p.color ?? 'var(--music)' } as React.CSSProperties}>
      <div className="trow" style={{ gridTemplateColumns: cols.template }} role="row" onContextMenu={(e) => menu(e, [
        { label: open ? 'Collapse' : 'Expand', icon: 'chevronR', onClick: onToggle },
        { label: 'Open in Obsidian', icon: 'external', onClick: () => openNote(p.notePath) },
        { label: job ? 'Delete artist job' : 'Delete release', icon: 'trash', danger: true, sep: true, onClick: () => { dispatch({ type: 'project/remove', projectId: p.id }); say(`Deleted “${p.title}”.`, true); } },
      ])}>
        <span />
        <button className={`chev${open ? ' open' : ''}`} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${p.artist} ${p.title}`} onClick={onToggle}><Icon name="chevronR" size={12} /></button>
        {cols.visible.map((c) => {
          switch (c.id) {
            case 'title': return (
              <div key={c.id} className="cell title-cell col" data-col={c.id} onClick={onToggle} style={{ cursor: 'pointer' }}>
                <span className="proj-name"><strong>{p.artist}</strong> <span className="muted">· {p.title}</span></span>
                <span className="sub">{job ? `${scoped.map((s) => s.name).join(' / ') || 'No stages assigned'} only` : `${RELEASE_TYPES.find((r) => r.id === p.releaseType)?.label ?? 'Release'}${p.targetRelease ? ` · out ${relLabel(p.targetRelease, today)}` : ''}`}</span>
                {p.tags.length > 0 && <TagChips names={p.tags} small />}
              </div>
            );
            case 'type': return (
              <div key={c.id} className="cell col" data-col={c.id}>
                {job
                  ? <><span className="pill job">Job</span><span className="sub">{p.roles.join(' / ') || 'No roles yet'}</span></>
                  : <><span className="pill own">{RELEASE_TYPES.find((r) => r.id === p.releaseType)?.label ?? 'Release'}</span><span className="sub">{p.roles.join(' / ')}</span></>}
              </div>
            );
            case 'progress': return (
              <div key={c.id} className="cell" data-col={c.id}>{job ? <ProgressCell p={prog} none="Not broken down yet" /> : <ReleaseStepper project={p} compact />}</div>
            );
            case 'next': return (
              <div key={c.id} className="cell" data-col={c.id}><span className={`date-static${next && next <= today ? ' today' : ''}`}>{next ? relLabel(next, today) : '—'}</span></div>
            );
            default: return <div key={c.id} className="cell" data-col={c.id} />;
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
  const [stageSort, setStageSort] = usePersistentState<SortState | null>('prefs.stageSort', null);
  const [widths, setWidths] = usePersistentState<StageWidths>('stage.widths', STAGE_WIDTHS);
  const setWidth = (id: string, w: number) => setWidths((cur) => ({ ...cur, [id]: Math.max(STAGE_MIN[id] ?? 50, Math.min(640, Math.round(w))) }));

  const [section, setSection] = usePersistentState<'steps' | 'tracks' | 'details'>(`proj.section.${p.id}`, 'steps');
  const sec = job && section === 'tracks' ? 'steps' : section;
  const SECTIONS = [
    { id: 'steps' as const, label: job ? 'My stages' : 'Release steps', n: main.length },
    ...(!job ? [{ id: 'tracks' as const, label: 'Other tracks', n: side.length }] : []),
    { id: 'details' as const, label: 'Details & notes', n: undefined },
  ];

  return (
    <div className="project-detail" style={{ '--st-name': `${widths.name}px`, '--st-desc': `${widths.desc}px`, '--st-progress': `${widths.progress}px`, '--st-date': `${widths.date}px` } as React.CSSProperties}>
      {!job && <ReleaseStepper project={p} />}

      <div className="pd-tabs" role="tablist" aria-label={`${p.title} sections`}>
        {SECTIONS.map((t) => (
          <button key={t.id} role="tab" aria-selected={sec === t.id} onClick={() => setSection(t.id)}>{t.label}{t.n !== undefined && <em>{t.n}</em>}</button>
        ))}
        <span className="dv-spacer" />
        <button className="link-btn" onClick={() => openNote(p.notePath)}><Icon name="external" size={12} /> Open in Obsidian</button>
      </div>

      {sec === 'details' && (
        <div className="pd-details">
          <div className="fields">
            <label>Artist<Editable label="Artist" value={p.artist} onSave={(v) => patchP({ artist: v })} /></label>
            <label>Project<Editable label="Project" value={p.title} onSave={(v) => patchP({ title: v })} /></label>
            {job
              ? <label>Client<Editable label="Client" value={p.client ?? ''} allowEmpty placeholder="+ client" onSave={(v) => patchP({ client: v.trim() || undefined })} /></label>
              : <label>Label<Editable label="Label" value={p.label ?? ''} allowEmpty placeholder="+ label" onSave={(v) => patchP({ label: v.trim() || undefined })} /></label>}
            <label>{job ? 'My roles' : 'Roles'}<Editable label="Roles" value={p.roles.join(', ')} allowEmpty placeholder="+ roles" onSave={(v) => patchP({ roles: v.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
            {!job && <label>Format<MiniSelect label="Release type" value={p.releaseType ?? 'single'} options={[...RELEASE_TYPES]} onChange={(v) => patchP({ releaseType: v })} /></label>}
            <label>{job ? 'Deadline' : 'Release date'}<DateCell label="Target release" value={p.targetRelease} onChange={(v) => patchP({ targetRelease: v })} /></label>
            <div className="field">Colour<ColorSelect label="Project colour" value={p.color ?? PIGMENTS[0].color} onChange={(color) => patchP({ color })} /></div>
            <div className="field-tags">Tags<span className="tag-line"><TagChips names={p.tags} small /><TagPicker compact value={p.tags} onChange={(tags) => dispatch({ type: 'project/tags', projectId: p.id, tags })} label="Edit project tags" /></span></div>
          </div>
          <label className="notes-line">Notes & links<Editable label="Notes" value={p.notes ?? ''} allowEmpty placeholder="+ add notes or reference links" onSave={(v) => patchP({ notes: v.trim() || undefined })} /></label>
        </div>
      )}

      {sec === 'steps' && (
        <>
          <p className="scope-line">{job ? 'Only the stages you were hired for count toward your progress.' : 'Every step here makes the step bar above. Drag to reorder, right-click for more.'}</p>
          {main.length === 0 && <p className="steps-empty">No stages yet. Add one below.</p>}
          {main.length > 0 && <StageHeader sort={stageSort} onSort={(k) => setStageSort((cur) => nextSort(cur, k))} widths={widths} setWidth={setWidth} />}
          <SortableList items={sortStages(main, stageSort)} disabled={!!stageSort} label={(s) => s.name} onMove={(id, overId) => dispatch({ type: 'stage/reorder', projectId: p.id, id, overId })}>
            {(st, grip) => <StageRow p={p} st={st} grip={grip} sort={stageSort} />}
          </SortableList>
          <div className="stage-add">
            <Icon name="plus" size={12} />
            <select aria-label={`Add stage to ${p.artist}`} value="" onChange={(e) => { if (e.target.value) dispatch({ type: 'stage/add', projectId: p.id, name: e.target.value, track: job ? undefined : 'main' }); }}>
              <option value="">{job ? 'Add assigned stage' : 'Add release step'}</option>
              {available.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
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
        </>
      )}

      {sec === 'tracks' && (
        <div className="side-track">
          <p className="scope-line">Marketing, MV and other work that runs alongside the release. Tracked here, but never counted in release progress.</p>
          {side.length > 0 && <StageHeader sort={stageSort} onSort={(k) => setStageSort((cur) => nextSort(cur, k))} widths={widths} setWidth={setWidth} />}
          <SortableList items={sortStages(side, stageSort)} disabled={!!stageSort} label={(s) => s.name} onMove={(id, overId) => dispatch({ type: 'stage/reorder', projectId: p.id, id, overId })}>
            {(st, grip) => <StageRow p={p} st={st} grip={grip} sort={stageSort} />}
          </SortableList>
          <div className="stage-add">
            <Icon name="plus" size={12} />
            <select aria-label="Add separate track" value="" onChange={(e) => { if (e.target.value) dispatch({ type: 'stage/add', projectId: p.id, name: e.target.value, track: 'side' }); }}>
              <option value="">Add track (Marketing, MV…)</option>
              {available.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- stage list: Explorer-style columns (Name · Progress · Date), sortable, right-click for actions ---------- */

type StageWidths = Record<'name' | 'desc' | 'progress' | 'date', number>;
const STAGE_WIDTHS: StageWidths = { name: 170, desc: 260, progress: 90, date: 112 };
const STAGE_MIN: Record<string, number> = { name: 80, desc: 60, progress: 60, date: 90 };
const STAGE_COLS: { id: keyof StageWidths; label: string }[] = [{ id: 'name', label: 'Name' }, { id: 'desc', label: 'Description' }, { id: 'progress', label: 'Progress' }, { id: 'date', label: 'Date' }];

/** Sort by one column. Empty values always go last, like Explorer and Finder. */
function sortBy<T>(list: T[], get: (x: T) => string | number | undefined, sort: SortState | null): T[] {
  if (!sort) return list;
  return [...list].sort((x, y) => {
    const a = get(x), b = get(y);
    if (a === undefined || a === '') return b === undefined || b === '' ? 0 : 1;
    if (b === undefined || b === '') return -1;
    const c = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    return sort.dir === 'asc' ? c : -c;
  });
}

const stageValue = (st: Stage, key: string) => {
  if (key === 'name') return st.name;
  if (key === 'date') return st.end;
  if (key === 'desc') return st.description;
  const u = stageUnits(st);
  return stageComplete(st) ? 1 : u.total ? u.done / u.total : 0;
};
const sortStages = (list: Stage[], sort: SortState | null) => sortBy(list, (st) => stageValue(st, sort?.key ?? ''), sort);

function StageHeader({ sort, onSort, widths, setWidth }: { sort: SortState | null; onSort: (key: string) => void; widths: StageWidths; setWidth: (id: string, w: number) => void }) {
  return (
    <div className="st-grid st-head" role="row">
      <span /><span />
      {STAGE_COLS.map((c) => {
        const active = sort?.key === c.id;
        return (
          <span key={c.id} className={`th st-${c.id}${active ? ' sorted' : ''}`} role="columnheader" aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <button type="button" className="th-btn" onClick={() => onSort(c.id)}
              title={!active ? `Sort by ${c.label}` : sort!.dir === 'asc' ? `Sorted by ${c.label}, ascending. Click for descending.` : 'Click to go back to manual (drag) order.'}>
              <span className="th-label">{c.label}</span>
              <span className="sort-ind" aria-hidden="true">{active ? (sort!.dir === 'asc' ? '▲' : '▼') : ''}</span>
            </button>
            <ResizeHandle label={c.label} value={widths[c.id]} onChange={(w) => setWidth(c.id, w)}
              onFit={(el) => {
                const sel = c.id === 'name' ? '.stage-name, .step-text' : c.id === 'desc' ? '.st-desc' : c.id === 'progress' ? '.st-progress' : '.st-date > *';
                const cells = [...(el.closest('.project-detail')?.querySelectorAll<HTMLElement>(sel) ?? [])];
                setWidth(c.id, Math.max(c.label.length * 8 + 30, ...cells.map((x) => x.scrollWidth + 12)));
              }} />
          </span>
        );
      })}
    </div>
  );
}

function StageRow({ p, st, grip, sort }: { p: MusicProject; st: Stage; grip: React.ReactNode; sort: SortState | null }) {
  const { dispatch, today } = useStore();
  const { say } = useUi();
  const menu = useContextMenu();
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const u = stageUnits(st);
  const hasItems = st.items.length > 0;
  const patch = (pt: Partial<Stage>) => dispatch({ type: 'stage/patch', projectId: p.id, stageId: st.id, patch: pt });
  const addItem = () => { if (text.trim()) { dispatch({ type: 'item/add', projectId: p.id, stageId: st.id, text }); setText(''); } };
  const own = p.kind === 'own-release';
  const complete = stageComplete(st);
  // Position in the project's own order (release steps, or my stages for a job); separate tracks get no numeral.
  const ordered = mainSteps(p);
  const pos = st.track === 'side' ? -1 : ordered.findIndex((x) => x.id === st.id);
  const isNow = pos >= 0 && ordered.findIndex((x) => !stageComplete(x)) === pos;
  const items = sortBy(st.items, (i) => (sort?.key === 'name' ? i.text : sort?.key === 'date' ? i.date : sort?.key === 'desc' ? i.description : i.done ? 1 : 0), sort);

  const stageMenu = (e: React.MouseEvent) => menu(e, [
    ...(!hasItems ? [{ label: st.done ? 'Mark not done' : 'Mark done', icon: 'check' as const, onClick: () => patch({ done: !st.done }) }] : []),
    { label: 'Break down into items', icon: 'plus', onClick: () => setAdding(true) },
    ...(own ? [{ label: st.track === 'side' ? 'Move into release steps' : 'Move to separate tracks', icon: 'steps' as const, onClick: () => patch({ track: st.track === 'side' ? 'main' : 'side' }) }] : []),
    { label: own ? 'Skip this stage' : 'Move outside my scope', icon: 'close', onClick: () => { patch({ inScope: false }); say(`“${st.name}” ${own ? 'skipped' : 'moved outside your scope'}.`, true); } },
    { label: 'Delete stage', icon: 'trash', danger: true, sep: true, onClick: () => { dispatch({ type: 'stage/remove', projectId: p.id, stageId: st.id }); say(`Deleted “${st.name}”.`, true); } },
  ]);

  return (
    <div className={`stage${complete ? ' done' : ''}`}>
      <div className="st-grid stage-head" onContextMenu={stageMenu}>
        {grip}
        {hasItems
          ? <span />
          : (
            <label className="check no-drag">
              <input type="checkbox" checked={st.done} aria-label={`${st.name} done`} onChange={() => patch({ done: !st.done })} />
              <span className="box" />
            </label>
          )}
        <span className="stage-name-wrap">
          {pos >= 0 && <StageBadge index={pos} state={complete ? 'done' : isNow ? 'current' : 'todo'} size={20} />}
          <Editable className="stage-name" label="Stage name" value={st.name} onSave={(v) => patch({ name: v })} />
        </span>
        <Editable className="st-desc" label={`${st.name} description`} value={st.description ?? ''} allowEmpty placeholder="+ description" onSave={(v) => patch({ description: v.trim() || undefined })} />
        <span className="st-progress">
          {hasItems
            ? <><span className="st-bar" aria-hidden="true"><i style={{ width: `${(u.done / u.total) * 100}%` }} /></span><span className="stage-frac" title="Checked items in this stage">{u.done}/{u.total}</span></>
            : complete ? <span className="muted">Done</span> : null}
        </span>
        <span className="st-date"><DateCell label={`${st.name} end date`} value={st.end} onChange={(v) => patch({ end: v })} done={complete} /></span>
      </div>
      <SortableList items={items} disabled={!!sort} label={(i) => i.text} onMove={(id, overId) => dispatch({ type: 'item/reorder', projectId: p.id, stageId: st.id, id, overId })}>
        {(i, itemGrip) => (
        <div className={`st-grid step st-item${i.done ? ' done' : ''}`} onContextMenu={(e) => menu(e, [
          { label: i.done ? 'Mark not done' : 'Mark done', icon: 'check', onClick: () => dispatch({ type: 'item/patch', projectId: p.id, stageId: st.id, itemId: i.id, patch: { done: !i.done } }) },
          { label: 'Delete item', icon: 'trash', danger: true, sep: true, onClick: () => { dispatch({ type: 'item/remove', projectId: p.id, stageId: st.id, itemId: i.id }); say(`Deleted “${i.text}”.`, true); } },
        ])}>
          {itemGrip}
          <span />
          <label className="check no-drag">
            <input type="checkbox" checked={i.done} aria-label={i.text}
              onChange={() => dispatch({ type: 'item/patch', projectId: p.id, stageId: st.id, itemId: i.id, patch: { done: !i.done } })} />
            <span className="box" />
          </label>
          <Editable className="step-text" label="Item" value={i.text} onSave={(v) => dispatch({ type: 'item/patch', projectId: p.id, stageId: st.id, itemId: i.id, patch: { text: v } })} />
          <Editable className="st-desc" label={`${i.text} description`} value={i.description ?? ''} allowEmpty placeholder="+ description" onSave={(v) => dispatch({ type: 'item/patch', projectId: p.id, stageId: st.id, itemId: i.id, patch: { description: v.trim() || undefined } })} />
          <span />
          <span className="st-date"><DateCell label={`${i.text} date`} value={i.date} done={i.done} onChange={(v) => dispatch({ type: 'item/patch', projectId: p.id, stageId: st.id, itemId: i.id, patch: { date: v } })} /></span>
        </div>
        )}
      </SortableList>
      {adding ? (
        <div className="step add indent2">
          <Icon name="plus" size={12} />
          <input autoFocus className="step-input" placeholder={`Add item to ${st.name}`} aria-label={`Add item to ${st.name}`} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') setAdding(false); }} onBlur={() => { if (!text.trim()) setAdding(false); }} />
        </div>
      ) : (
        <button className="link-btn indent" onClick={() => setAdding(true)}>+ Break down</button>
      )}
      {st.end && !complete && st.end < today && <span className="late">Stage date passed</span>}
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
  const { setProjectDialog, say, revealRow, projectDialog } = useUi();
  const startKind: MusicProject['kind'] = projectDialog === 'artist-job' ? 'artist-job' : 'own-release';
  const [kind, setKind] = useState<MusicProject['kind']>(startKind);
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
  const [stages, setStages] = useState<StageDraft[]>(draftsFor(startKind));

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
          <div className="field">Colour<ColorSelect label="Project colour" value={color} onChange={setColor} /></div>
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
