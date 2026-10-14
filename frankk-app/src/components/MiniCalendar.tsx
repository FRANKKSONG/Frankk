import { useMemo, useState } from 'react';
import { Icon } from './Icons';
import { useStore } from '../data/store';
import { datedMarkers } from '../lib/agenda';
import { addDays, addMonths, daysInMonth, monthKey, monthTitle, parseISO } from '../lib/dates';

export function MiniCalendar({ day, onDay }: { day: string | null; onDay: (d: string | null) => void }) {
  const { data, today } = useStore();
  const [month, setMonth] = useState(monthKey(today));
  const markers = useMemo(() => datedMarkers(data, today), [data, today]);

  const first = parseISO(`${month}-01`).getDay(); // 0 = Sunday
  const lead = (first + 6) % 7; // Monday-first
  // Leading and trailing days from the neighbouring months fill the grid, greyed out.
  const start = addDays(`${month}-01`, -lead);
  const total = Math.ceil((lead + daysInMonth(month)) / 7) * 7;
  const cells = Array.from({ length: total }, (_, i) => addDays(start, i));

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
        {cells.map((c) => (
          <button key={c} role="gridcell" className={`day${c === today ? ' today' : ''}${c === day ? ' picked' : ''}${monthKey(c) !== month ? ' other' : ''}`} aria-label={`${c}${markers.get(c) ? `, has ${[...markers.get(c)!].join(', ')} items` : ''}`}
            aria-pressed={c === day} onClick={() => onDay(c === day ? null : c)}>
            {Number(c.slice(8))}{markers.has(c) && <span className="marks">{[...markers.get(c)!].map((a) => <i key={a} className={`area-${a}`} />)}</span>}
          </button>
        ))}
      </div>
      
    </section>
  );
}
