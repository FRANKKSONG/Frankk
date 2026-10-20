import { useMemo, useState } from 'react';
import { Icon } from '../components/Icons';
import { Initial } from '../components/Ornaments';
import { TaskLine } from '../components/TaskLine';
import { AddTask } from '../components/AddTask';
import { useStore } from '../data/store';
import { addDays, addMonths, dayShort, daysInMonth, greeting, longToday, monthKey, monthTitle, parseISO, shortDate, weekStart, type ISODate } from '../lib/dates';
import { lineFor } from '../lib/greeting';

/** Home: a greeting, the month, and this week. */
export function HomePage() {
  const { today } = useStore();
  const [day, setDay] = useState<ISODate>(today);
  const hello = greeting();
  return (
    <div className="page home">
      <header className="greet">
        <h1><Initial letter={hello[0]} /><span className="greet-rest">{hello}</span></h1>
        <p className="greet-date">{longToday(today)}</p>
        <p className="greet-line">{lineFor(today)}</p>
      </header>
      <div className="home-grid">
        <MonthCalendar day={day} onDay={setDay} />
        <ThisWeek />
      </div>
    </div>
  );
}

function MonthCalendar({ day, onDay }: { day: ISODate; onDay: (d: ISODate) => void }) {
  const { data, today } = useStore();
  const [month, setMonth] = useState(monthKey(today));
  const lead = (parseISO(`${month}-01`).getDay() + 6) % 7; // Monday first
  const start = addDays(`${month}-01`, -lead);
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth(month)) / 7) * 7 }, (_, i) => addDays(start, i));
  // Each day's open tasks, as dots in their list's colour.
  const marks = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of data.tasks) if (t.date && !t.done) m.set(t.date, [...(m.get(t.date) ?? []), data.lists.find((l) => l.id === t.listId)?.color ?? 'var(--accent)']);
    return m;
  }, [data]);
  const onDayTasks = data.tasks.filter((t) => t.date === day);
  return (
    <section className="card cal" aria-label="Calendar">
      <header className="card-head">
        <h2>{monthTitle(month)}</h2>
        <span className="cal-nav">
          <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><Icon name="chevronR" size={15} style={{ transform: 'rotate(180deg)' }} /></button>
          <button className="btn small" onClick={() => { setMonth(monthKey(today)); onDay(today); }}>Today</button>
          <button className="icon-btn" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><Icon name="chevronR" size={15} /></button>
        </span>
      </header>
      <div className="cal-grid" role="grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="dow" role="columnheader">{d}</span>)}
        {cells.map((c) => {
          const dots = marks.get(c) ?? [];
          return (
            <button key={c} role="gridcell" aria-pressed={c === day} aria-label={`${longToday(c)}${dots.length ? `, ${dots.length} task${dots.length === 1 ? '' : 's'}` : ''}`}
              className={`day${c === today ? ' today' : ''}${c === day ? ' picked' : ''}${monthKey(c) !== month ? ' other' : ''}${c < today ? ' past' : ''}`}
              onClick={() => { onDay(c); if (monthKey(c) !== month) setMonth(monthKey(c)); }}>
              <span className="num">{Number(c.slice(8))}</span>
              <span className="marks">{dots.slice(0, 4).map((col, i) => <i key={i} style={{ background: col }} />)}</span>
            </button>
          );
        })}
      </div>
      <div className="cal-day">
        <h3>{day === today ? 'Today' : longToday(day)}</h3>
        {onDayTasks.length ? <ul className="tlines">{onDayTasks.map((t) => <TaskLine key={t.id} task={t} />)}</ul> : <p className="quiet">Nothing on this day.</p>}
        <AddTask key={day} date={day} pickList placeholder={`Add a task for ${day === today ? 'today' : shortDate(day, today)}, Enter`} />
      </div>
    </section>
  );
}

function ThisWeek() {
  const { data, today } = useStore();
  const mon = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const late = data.tasks.filter((t) => !t.done && t.date && t.date < today && t.date < mon);
  const [adding, setAdding] = useState<ISODate | null>(null);
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
          <div key={d} className={`wday${d === today ? ' today' : ''}${d < today ? ' past' : ''}`}>
            <h3>
              <span>{d === today ? 'Today' : dayShort(d)}</span>
              {d === today && <small>{dayShort(d)}</small>}
              <button className="icon-btn tiny wday-add" aria-label={`Add a task on ${dayShort(d)}`} onClick={() => setAdding(adding === d ? null : d)}><Icon name="plus" size={12} /></button>
            </h3>
            {list.length > 0 && <ul className="tlines">{list.map((t) => <TaskLine key={t.id} task={t} />)}</ul>}
            {adding === d && <AddTask date={d} pickList autoFocus placeholder={`Add for ${dayShort(d)}, Enter`} />}
          </div>
        );
      })}
    </section>
  );
}
