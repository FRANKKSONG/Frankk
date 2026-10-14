import { useMemo } from 'react';
import { Icon } from './Icons';
import { DataView } from './DataView';
import { ReleaseStepper } from './Stepper';
import { ProgressCell } from './ProgressBar';
import { QuickCapture } from './QuickCapture';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { buildAgenda, todayItems, type AgendaItem } from '../lib/agenda';
import { visibleOccurrences } from '../lib/bills';
import { addDays, monthKey, monthName, parseISO, relLabel, weekdayShort } from '../lib/dates';
import { projectProgress, stageComplete } from '../lib/progress';
import { recordsOf } from '../lib/records';
import { renderMarkdown } from '../lib/markdown';
import { artCss } from '../lib/art';
import { AREA_ICON, useToggleAgenda } from './TodayStrip';
import { mainSteps } from './Stepper';
import type { StatMetric, WidgetDef } from '../data/schema';
import type { AppData } from '../data/types';

export const WIDGET_CATALOG: { kind: WidgetDef['kind']; name: string; blurb: string; icon: Parameters<typeof Icon>[0]['name']; size: { w: number; h: number }; config?: WidgetDef['config'] }[] = [
  { kind: 'stat', name: 'Number', blurb: 'One big number: due today, overdue, bills, release progress…', icon: 'bolt', size: { w: 6, h: 4 }, config: { metric: 'open-tasks' } },
  { kind: 'today', name: 'Today', blurb: 'What to do today and what is late, across every space', icon: 'tasks', size: { w: 8, h: 10 } },
  { kind: 'week', name: 'This week', blurb: 'Seven days at a glance', icon: 'calendar', size: { w: 16, h: 5 } },
  { kind: 'music', name: 'Music', blurb: 'Release step bars and artist jobs', icon: 'music', size: { w: 9, h: 6 } },
  { kind: 'money', name: 'Money & bills', blurb: 'This month’s bills, paid and unpaid', icon: 'house', size: { w: 7, h: 6 } },
  { kind: 'view', name: 'Saved view', blurb: 'Any table, board, gallery or calendar from the Library', icon: 'table', size: { w: 10, h: 7 }, config: { viewId: 'v-ideas' } },
  { kind: 'notes-recent', name: 'From the library', blurb: 'Recently written notes and AI knowledge pages', icon: 'note', size: { w: 8, h: 6 } },
  { kind: 'note', name: 'Pinned note', blurb: 'Show one note on the dashboard', icon: 'note', size: { w: 8, h: 7 }, config: { noteId: 'n-index' } },
  { kind: 'image', name: 'Image', blurb: 'Artwork, a moodboard image or a photo', icon: 'image', size: { w: 6, h: 6 }, config: { image: 'lion' } },
  { kind: 'capture', name: 'Quick capture', blurb: 'Type a task, add #tags', icon: 'bolt', size: { w: 8, h: 5 } },
];

export const METRICS: { id: StatMetric; label: string }[] = [
  { id: 'due-today', label: 'Due or planned today' }, { id: 'overdue', label: 'Overdue' }, { id: 'open-tasks', label: 'Open tasks' },
  { id: 'bills-unpaid', label: 'Bills unpaid this month' }, { id: 'release-progress', label: 'Next release progress' },
  { id: 'notes-count', label: 'Notes in library' }, { id: 'records-count', label: 'Records of a type' },
];

export function metricValue(data: AppData, today: string, m: StatMetric, typeId?: string): { value: string; sub: string } {
  const agenda = buildAgenda(data, today);
  switch (m) {
    case 'due-today': { const n = todayItems(data, today).filter((i) => !i.overdue).length; return { value: String(n), sub: n === 1 ? 'item for today' : 'items for today' }; }
    case 'overdue': { const n = agenda.filter((i) => i.overdue).length; return { value: String(n), sub: n ? 'need attention' : 'nothing late' }; }
    case 'open-tasks': return { value: String(data.tasks.filter((t) => !t.done).length), sub: 'open tasks' };
    case 'bills-unpaid': {
      const occ = data.bills.flatMap((b) => visibleOccurrences(b, today));
      const unpaid = occ.filter((o) => !o.paid);
      return { value: String(unpaid.length), sub: `of ${occ.length} · ${unpaid.filter((o) => o.missed).length} missed` };
    }
    case 'release-progress': {
      const p = data.projects.find((x) => x.kind === 'own-release');
      if (!p) return { value: '—', sub: 'no release' };
      const cur = mainSteps(p).find((s) => !stageComplete(s));
      return { value: `${projectProgress(p).pct ?? 0}%`, sub: `${p.title} · ${cur?.name ?? 'done'}` };
    }
    case 'notes-count': return { value: String(data.notes.length), sub: `${data.notes.filter((n) => n.author === 'ai').length} by the librarian` };
    case 'records-count': { const t = data.types.find((x) => x.id === typeId); return { value: String(t ? recordsOf(data, t.id, today).length : 0), sub: t?.plural ?? 'records' }; }
    default: return { value: '—', sub: '' };
  }
}

export function WidgetBody({ w }: { w: WidgetDef }) {
  switch (w.kind) {
    case 'stat': return <StatWidget w={w} />;
    case 'today': return <TodayWidget />;
    case 'week': return <WeekWidget />;
    case 'music': return <MusicWidget />;
    case 'money': return <MoneyWidget />;
    case 'view': return <ViewWidget w={w} />;
    case 'notes-recent': return <RecentNotes />;
    case 'note': return <NoteWidget w={w} />;
    case 'image': return <ImageWidget w={w} />;
    case 'capture': return <div className="w-capture"><QuickCapture bare /></div>;
  }
}

function StatWidget({ w }: { w: WidgetDef }) {
  const { data, today } = useStore();
  const { value, sub } = metricValue(data, today, w.config.metric ?? 'open-tasks', w.config.typeId);
  return <div className="w-stat"><span className="w-stat-num">{value}</span><span className="w-stat-sub">{sub}</span></div>;
}

function useOpenAgenda() {
  const { openTask, revealRow, go, setFocusArea } = useUi();
  return (i: AgendaItem) => {
    if (i.ref.type === 'task') openTask(i.ref.id);
    else { go('tasks'); if (i.ref.type === 'stage') revealRow('project', i.ref.projectId); else setFocusArea('house'); }
  };
}

function TodayWidget() {
  const { data, today } = useStore();
  const toggle = useToggleAgenda();
  const open = useOpenAgenda();
  const items = useMemo(() => todayItems(data, today), [data, today]);
  if (!items.length) return <p className="w-empty">Nothing due or planned today.</p>;
  return (
    <ul className="w-list">
      {items.map((i) => (
        <li key={i.key} className={`area-${i.area}`}>
          <label className="check no-drag"><input type="checkbox" checked={false} aria-label={`Complete ${i.title}`} onChange={() => toggle(i)} /><span className="box" /></label>
          <span className="w-dot"><Icon name={AREA_ICON[i.area]} size={11} /></span>
          <button className="w-item" onClick={() => open(i)}>{i.title}{i.context && <span className="muted"> · {i.context}</span>}</button>
          <span className={`w-when${i.overdue ? ' overdue' : i.date === today ? ' today' : ''}`}>{i.overdue ? `late · ${relLabel(i.date, today)}` : relLabel(i.date, today)}</span>
        </li>
      ))}
    </ul>
  );
}

function WeekWidget() {
  const { data, today } = useStore();
  const open = useOpenAgenda();
  const start = addDays(today, -((parseISO(today).getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const agenda = useMemo(() => buildAgenda(data, today), [data, today]);
  return (
    <div className="w-week">
      {days.map((d) => (
        <div key={d} className={`w-day${d === today ? ' today' : ''}${d < today ? ' past' : ''}`}>
          <span className="w-day-h">{weekdayShort(d)} <b>{Number(d.slice(8))}</b></span>
          {agenda.filter((i) => i.date === d && !i.overdue).slice(0, 5).map((i) => (
            <button key={i.key} className={`w-chip area-${i.area}`} onClick={() => open(i)} title={i.title}>{i.title}</button>
          ))}
        </div>
      ))}
    </div>
  );
}

function MusicWidget() {
  const { data } = useStore();
  const { go, revealRow } = useUi();
  return (
    <ul className="w-list music">
      {data.projects.map((p) => (
        <li key={p.id} style={{ '--row': p.color ?? 'var(--music)' } as React.CSSProperties}>
          <button className="w-item" onClick={() => { go('tasks'); revealRow('project', p.id); }}><b>{p.artist}</b> <span className="muted">· {p.title}</span></button>
          <span className="w-prog area-music">{p.kind === 'own-release' ? <ReleaseStepper project={p} compact /> : <ProgressCell p={projectProgress(p)} none="Not broken down" />}</span>
        </li>
      ))}
    </ul>
  );
}

function MoneyWidget() {
  const { data, today, dispatch } = useStore();
  const occ = data.bills.flatMap((b) => visibleOccurrences(b, today)).sort((a, b) => a.due.localeCompare(b.due));
  const paid = occ.filter((o) => o.paid).length;
  return (
    <div className="w-money">
      <div className="w-money-sum"><b>{paid}/{occ.length}</b> paid in {monthName(monthKey(today))}<span className="w-bar"><i style={{ width: `${occ.length ? (paid / occ.length) * 100 : 0}%` }} /></span></div>
      <ul className="w-list">
        {occ.map((o) => (
          <li key={o.bill.id + o.month}>
            <label className="check no-drag"><input type="checkbox" checked={o.paid} aria-label={`${o.paid ? 'Mark unpaid' : 'Mark paid'}: ${o.bill.title}`}
              onChange={() => dispatch({ type: 'bill/pay', billId: o.bill.id, month: o.month, paid: !o.paid })} /><span className="box" /></label>
            <span className="w-item">{o.bill.title}{o.month !== monthKey(today) && <span className="muted"> · {monthName(o.month)}</span>}</span>
            <span className={`pill ${o.paid ? 'paid' : o.missed ? 'missed' : 'unpaid'}`}>{o.paid ? 'Paid' : o.missed ? 'Missed' : relLabel(o.due, today)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ViewWidget({ w }: { w: WidgetDef }) {
  const { data } = useStore();
  const { go, openTask } = useUi();
  const view = data.views.find((v) => v.id === w.config.viewId);
  const type = data.types.find((t) => t.id === view?.typeId);
  if (!view || !type) return <p className="w-empty">Choose a saved view in this widget’s settings.</p>;
  return <DataView type={type} view={view} compact onOpen={(r) => (r.typeId === 'task' ? openTask(r.id) : go('library'))} />;
}

function RecentNotes() {
  const { data } = useStore();
  const { go } = useUi();
  const notes = [...data.notes].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 6);
  return (
    <ul className="w-list w-notes-list">
      {notes.map((n) => (
        <li key={n.id}>
          <Icon name={n.author === 'ai' ? 'bot' : 'note'} size={13} />
          <button className="w-item" onClick={() => go('notes', { noteId: n.id })}>{n.title}</button>
          <span className="muted w-folder">{n.folder || '/'}</span>
        </li>
      ))}
    </ul>
  );
}

function NoteWidget({ w }: { w: WidgetDef }) {
  const { data } = useStore();
  const { go } = useUi();
  const note = data.notes.find((n) => n.id === w.config.noteId);
  if (!note) return <p className="w-empty">Choose a note in this widget’s settings.</p>;
  return (
    <div className="w-note md" onClick={(e) => {
      const t = (e.target as HTMLElement).closest('[data-wikilink]') as HTMLElement | null;
      if (t) { e.preventDefault(); const target = data.notes.find((n) => n.title.toLowerCase() === t.dataset.wikilink!.toLowerCase()); go('notes', { noteId: target?.id ?? note.id }); }
    }} dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body, data.notes.map((n) => n.title)) }} />
  );
}

function ImageWidget({ w }: { w: WidgetDef }) {
  const { image } = artCss(w.config.image ?? 'lion');
  return (
    <figure className="w-image" style={{ backgroundImage: image }}>
      {w.config.caption && <figcaption>{w.config.caption}</figcaption>}
    </figure>
  );
}
