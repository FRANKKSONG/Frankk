import { useMemo, useState } from 'react';
import { Icon } from './Icons';
import { TaskLine } from './TaskLine';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { addDays, addMonths, dayShort, daysInMonth, longToday, monthKey, monthTitle, parseISO, shortDate, weekStart } from '../lib/dates';

/** The month. Click a day to show only that day in the table; click it again to show every day. */
export function MonthCalendar() {
  const { data, today } = useStore();
  const { day, setDay } = useUi();
  const [month, setMonth] = useState(monthKey(today));
  const lead = (parseISO(`${month}-01`).getDay() + 6) % 7; // Monday first
  const start = addDays(`${month}-01`, -lead);
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth(month)) / 7) * 7 }, (_, i) => addDays(start, i));
  const marks = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of data.tasks) if (t.date && !t.done) m.set(t.date, [...(m.get(t.date) ?? []), data.lists.find((l) => l.id === t.listId)?.color ?? 'var(--accent)']);
    return m;
  }, [data]);
  return (
    <section className="card cal" aria-label="Calendar">
      <header className="card-head">
        <h2>{monthTitle(month)}</h2>
        <span className="cal-nav">
          <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><Icon name="chevronR" size={14} style={{ transform: 'rotate(180deg)' }} /></button>
          <button className="btn small" onClick={() => setMonth(monthKey(today))}>Today</button>
          <button className="icon-btn" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><Icon name="chevronR" size={14} /></button>
        </span>
      </header>
      <div className="cal-grid" role="grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="dow" role="columnheader">{d}</span>)}
        {cells.map((c) => {
          const dots = marks.get(c) ?? [];
          return (
            <button key={c} role="gridcell" aria-pressed={c === day} aria-label={`${longToday(c)}${dots.length ? `, ${dots.length} open task${dots.length === 1 ? '' : 's'}` : ''}`}
              className={`day${c === today ? ' today' : ''}${c === day ? ' picked' : ''}${monthKey(c) !== month ? ' other' : ''}`}
              onClick={() => setDay(c === day ? null : c)}>
              <span className="num">{Number(c.slice(8))}</span>
              <span className="marks">{dots.slice(0, 3).map((col, i) => <i key={i} style={{ background: col }} />)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Monday to Sunday at a glance, with anything still open from before. */
export function ThisWeek() {
  const { data, today } = useStore();
  const mon = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const late = data.tasks.filter((t) => !t.done && t.date && t.date < mon);
  return (
    <section className="card week" aria-label="This week">
      <header className="card-head">
        <h2>This week</h2>
        <span className="quiet">{shortDate(mon, today)} – {shortDate(days[6], today)}</span>
      </header>
      {late.length > 0 && (
        <div className="wday late">
          <h3>Still open from before</h3>
          <ul className="tlines">{late.map((t) => <TaskLine key={t.id} task={t} showDate />)}</ul>
        </div>
      )}
      {days.map((d) => {
        const list = data.tasks.filter((t) => t.date === d);
        return (
          <div key={d} className={`wday${d === today ? ' today' : ''}${d < today ? ' past' : ''}${list.length ? '' : ' empty'}`}>
            <h3><span>{d === today ? 'Today' : dayShort(d)}</span>{d === today && <small>{dayShort(d)}</small>}</h3>
            {list.length > 0 && <ul className="tlines">{list.map((t) => <TaskLine key={t.id} task={t} />)}</ul>}
          </div>
        );
      })}
    </section>
  );
}
