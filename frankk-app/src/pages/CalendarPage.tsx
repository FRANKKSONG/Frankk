import { useMemo, useState } from 'react';
import { Icon } from '../components/Icons';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { buildAgenda } from '../lib/agenda';
import { addDays, addMonths, daysInMonth, monthKey, monthTitle, parseISO } from '../lib/dates';
import { recordsOf } from '../lib/records';

/** Everything with a date, across every space and type, on one month. */
export function CalendarPage() {
  const { data, today } = useStore();
  const { openTask, go, revealRow } = useUi();
  const [month, setMonth] = useState(monthKey(today));
  const agenda = useMemo(() => buildAgenda(data, today), [data, today]);
  const extra = useMemo(() => data.types.filter((t) => !t.builtin).flatMap((t) => {
    const dateFields = t.fields.filter((f) => f.kind === 'date');
    return recordsOf(data, t.id, today).flatMap((r) => dateFields.map((f) => ({ key: `${r.id}${f.key}`, date: String(r.get(f.key) ?? ''), title: `${r.title} · ${f.name}`, color: t.color })));
  }).filter((x) => x.date), [data, today]);
  const lead = (parseISO(`${month}-01`).getDay() + 6) % 7;
  const start = addDays(`${month}-01`, -lead);
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth(month)) / 7) * 7 }, (_, i) => addDays(start, i));
  return (
    <div className="page-wide calendar-page">
      <header className="cal-head">
        <h1>{monthTitle(month)}</h1>
        <span>
          <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><Icon name="chevronR" size={15} style={{ transform: 'rotate(180deg)' }} /></button>
          <button className="btn small" onClick={() => setMonth(monthKey(today))}>Today</button>
          <button className="icon-btn" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><Icon name="chevronR" size={15} /></button>
        </span>
        <span className="hint">Office Google Calendar: not connected</span>
      </header>
      <div className="big-cal">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="dow">{d}</span>)}
        {cells.map((c) => (
          <div key={c} className={`big-day${c === today ? ' is-today' : ''}${monthKey(c) !== month ? ' other' : ''}`}>
            <span className="n">{Number(c.slice(8))}</span>
            {agenda.filter((a) => a.date === c).map((a) => (
              <button key={a.key} className={`big-chip area-${a.area}${a.overdue ? ' overdue' : ''}`} title={a.title}
                onClick={() => (a.ref.type === 'task' ? openTask(a.ref.id) : (go('tasks'), a.ref.type === 'stage' && revealRow('project', a.ref.projectId)))}>{a.title}</button>
            ))}
            {extra.filter((x) => x.date === c).map((x) => <span key={x.key} className="big-chip" style={{ '--area': x.color } as React.CSSProperties}>{x.title}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}
