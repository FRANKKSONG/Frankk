import { useMemo, useState } from 'react';
import { Popover } from './Popover';
import { MiniCalendar } from './MiniCalendar';
import { Icon } from './Icons';
import { DataView } from './DataView';
import { ReleaseStepper } from './Stepper';
import { QuickCapture } from './QuickCapture';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { buildAgenda, todayItems, type AgendaItem } from '../lib/agenda';
import { visibleOccurrences } from '../lib/bills';
import { addDays, longToday, monthKey, monthName, parseISO, relLabel, weekdayShort } from '../lib/dates';
import { beginOrder, canOpenHere } from '../lib/begin';
import { detectKind, findJournal, parseJournal, KINDS } from '../lib/journal';
import { useJournal } from './CommandBar';
import { projectProgress, stageComplete } from '../lib/progress';
import { recordsOf } from '../lib/records';
import { renderMarkdown } from '../lib/markdown';
import { artCss } from '../lib/art';
import { AREA_ICON, useToggleAgenda } from './TodayStrip';
import { mainSteps } from './Stepper';
import type { StatMetric, WidgetDef } from '../data/schema';
import type { AppData } from '../data/types';

export const WIDGET_CATALOG: { kind: WidgetDef['kind']; name: string; blurb: string; icon: Parameters<typeof Icon>[0]['name']; size: { w: number; h: number }; config?: WidgetDef['config'] }[] = [
  { kind: 'begin', name: 'Begin here', blurb: 'What to start first, why, and a shortcut that opens it', icon: 'bolt', size: { w: 8, h: 7 } },
  { kind: 'calendar', name: 'Calendar', blurb: 'The month, and what falls on the day you pick', icon: 'calendar', size: { w: 8, h: 12 } },
  { kind: 'journal', name: 'Today’s journal', blurb: 'What you wrote today: progress, context, ideas and journal lines', icon: 'note', size: { w: 8, h: 8 } },
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
    case 'begin': return <BeginWidget />;
    case 'calendar': return <CalendarWidget />;
    case 'journal': return <JournalWidget />;
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
          <span className="w-prog area-music"><ReleaseStepper project={p} compact /></span>
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

/* ---------- the morning check: begin here, calendar, today's journal ---------- */

function BeginWidget() {
  const { data, today, dispatch } = useStore();
  const { say } = useUi();
  const open = useOpenAgenda();
  const toggle = useToggleAgenda();
  const picks = useMemo(() => beginOrder(data, today), [data, today]);
  if (!picks.length) return <p className="w-empty">Nothing waiting today. Rest, or pick something from the week.</p>;
  const [top, ...rest] = picks;
  const task = top.item.ref.type === 'task' ? data.tasks.find((t) => t.id === (top.item.ref as { id: string }).id) : undefined;
  const begin = () => {
    if (!top.launch) return open(top.item);
    if (canOpenHere(top.launch)) window.open(top.launch, '_blank', 'noopener');
    else say(`Opening “${top.launch}” needs the Esther desktop app. In this preview only web and Obsidian links open.`);
  };
  return (
    <div className={`w-begin area-${top.item.area}`}>
      <span className="wb-why">{top.why}</span>
      <h4 className="wb-title"><span className="w-dot"><Icon name={AREA_ICON[top.item.area]} size={12} /></span>{top.item.title}{top.item.context && <span className="muted"> · {top.item.context}</span>}</h4>
      <div className="wb-actions">
        <button className="btn primary" onClick={begin}><Icon name="bolt" size={14} /> Begin</button>
        {task && (
          <Popover trigger={({ toggle: t, ref }) => <button ref={ref} className="btn" onClick={t} title="What opens when you press Begin"><Icon name="link" size={13} /> {top.launch ? 'Shortcut' : 'Add shortcut'}</button>}>
            {(close) => (
              <form className="pop-form" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get('l') ?? '').trim(); dispatch({ type: 'task/update', id: task.id, patch: { props: { ...task.props, launch: v } } }); close(); }}>
                <strong>When you begin “{task.title}”, open:</strong>
                <input name="l" defaultValue={top.launch ?? ''} placeholder="https://…, obsidian://…, a file or an app" aria-label="Shortcut to open" autoFocus />
                <small className="muted">Web and Obsidian links open from here. Files, folders and apps (Illustrator, a project folder) will open once Esther runs as a desktop app.</small>
                <button className="btn primary small" type="submit">Save</button>
              </form>
            )}
          </Popover>
        )}
        <button className="btn" aria-label={`Mark “${top.item.title}” done`} onClick={() => toggle(top.item)}><Icon name="check" size={13} /> Done</button>
      </div>
      {rest.length > 0 && (
        <ol className="wb-next" aria-label="After that">
          {rest.slice(0, 3).map((p) => <li key={p.item.key}><button className="w-item" onClick={() => open(p.item)}>{p.item.title}</button><span>{p.why}</span></li>)}
        </ol>
      )}
    </div>
  );
}

function CalendarWidget() {
  const { data, today } = useStore();
  const open = useOpenAgenda();
  const [day, setDay] = useState<string | null>(null);
  const d = day ?? today;
  const agenda = useMemo(() => buildAgenda(data, today), [data, today]);
  const items = agenda.filter((i) => (i.date === d && !i.overdue) || (d === today && i.overdue));
  return (
    <div className="w-cal">
      <MiniCalendar day={day} onDay={setDay} />
      <div className="w-cal-day">
        <h4>{d === today ? 'Today' : longToday(d)}</h4>
        {items.length ? (
          <ul className="w-list">
            {items.map((i) => (
              <li key={i.key} className={`area-${i.area}`}>
                <span className="w-dot"><Icon name={AREA_ICON[i.area]} size={11} /></span>
                <button className="w-item" onClick={() => open(i)}>{i.title}{i.context && <span className="muted"> · {i.context}</span>}</button>
                <span className={`w-when${i.overdue ? ' overdue' : ''}`}>{i.overdue ? 'late' : i.kind === 'plan' ? 'planned' : i.kind}</span>
              </li>
            ))}
          </ul>
        ) : <p className="w-empty">Nothing on this day.</p>}
        <p className="w-cal-note">Google Calendar: not connected yet</p>
      </div>
    </div>
  );
}

function JournalWidget() {
  const { data, today } = useStore();
  const { go } = useUi();
  const write = useJournal();
  const [text, setText] = useState('');
  const page = findJournal(data.notes, today);
  const lines = page ? parseJournal(page.body) : [];
  // Write straight into today's page. p: and c: still mark progress and context; anything else is a journal line.
  const add = () => {
    const d = detectKind(text);
    if (!d.text) return;
    write(d.explicit && (d.kind === 'progress' || d.kind === 'context') ? d.kind : 'journal', d.text);
    setText('');
  };
  return (
    <div className="w-journal">
      {lines.length > 0 && (
        <ol className="wj-lines">
          {lines.map((l, i) => (
            <li key={i} className={`k-${l.kind}`}><time>{l.time}</time>{l.kind !== 'journal' && <b>{KINDS.find((k) => k.id === l.kind)?.label}</b>}<span>{l.text}</span></li>
          ))}
        </ol>
      )}
      <input className="wj-add no-drag" value={text} aria-label="Write in today’s journal" placeholder={lines.length ? 'Write another line…' : 'Write the first line of today…'}
        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } else if (e.key === 'Escape') setText(''); }} />
      <span className="wj-hint">Enter writes it with the time · start with p: for progress, c: for context</span>
      {page && <button className="link-btn wj-open" onClick={() => go('notes', { noteId: page.id })}>Open today’s page</button>}
    </div>
  );
}
