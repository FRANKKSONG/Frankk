import { useMemo, useState } from 'react';
import { Icon } from './Icons';
import { useStore } from '../data/store';
import { datedMarkers } from '../lib/agenda';
import { addMonths, dateInMonth, daysInMonth, monthKey, monthTitle, parseISO } from '../lib/dates';

export function MiniCalendar({ day, onDay }: { day: string | null; onDay: (d: string | null) => void }) {
  const { data, today } = useStore();
  const [month, setMonth] = useState(monthKey(today));
  const markers = useMemo(() => datedMarkers(data, today), [data, today]);

  const first = parseISO(`${month}-01`).getDay(); // 0 = Sunday
  const lead = (first + 6) % 7; // Monday-first
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(month) }, (_, i) => dateInMonth(month, i + 1))];
  while (cells.length % 7) cells.push(null);

  return (
    <section className="minical" aria-label="Calendar" title="Date overview only. Not connected to Google Calendar.">
      <header>
        <h3>{monthTitle(month)}</h3>
        <span>
          <button className="icon-btn tiny" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><Icon name="chevronR" size={14} style={{ transform: 'rotate(180deg)' }} /></button>
          <button className="icon-btn tiny" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><Icon name="chevronR" size={14} /></button>
          <button className="btn small" onClick={() => setMonth(monthKey(today))}>Today</button>
        </span>
      </header>
      <div className="cal-grid" role="grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="dow" role="columnheader">{d}</span>)}
        {cells.map((c, i) => c ? (
          <button key={c} role="gridcell" className={`day${c === today ? ' today' : ''}${c === day ? ' picked' : ''}`} aria-label={`${c}${markers.get(c) ? `, ${markers.get(c)} items` : ''}`}
            aria-pressed={c === day} onClick={() => onDay(c === day ? null : c)}>
            {Number(c.slice(8))}{markers.has(c) && <i />}
          </button>
        ) : <span key={`e${i}`} />)}
      </div>
      
    </section>
  );
}
