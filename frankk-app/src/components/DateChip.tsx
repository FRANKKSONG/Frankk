import { useState } from 'react';
import { Icon } from './Icons';
import { Popover } from './Popover';
import { addDays, addMonths, daysInMonth, longToday, monthKey, monthTitle, parseISO, relLabel, type ISODate } from '../lib/dates';

/** The day a task is for: a small chip that opens Esther's own date picker. Late days show in red. */
export function DateChip({ value, today, onChange, label }: { value?: ISODate; today: ISODate; onChange: (d: ISODate | undefined) => void; label: string }) {
  const late = !!value && value < today;
  return (
    <span className={`date-chip${value ? '' : ' empty'}${late ? ' late' : ''}${value === today ? ' today' : ''}`}>
      <Popover className="date-pop" trigger={({ toggle, ref, open }) => (
        <button ref={ref} type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${value ? relLabel(value, today) : 'no date'}. Change`}
          onClick={(e) => { e.stopPropagation(); toggle(); }}>
          <Icon name="calendar" size={12} />{value ? relLabel(value, today) : 'Date'}
        </button>
      )}>
        {(close) => <DatePicker value={value} today={today} onPick={(d) => { onChange(d); close(); }} />}
      </Popover>
    </span>
  );
}

/** A month to pick a day from, with Today, Tomorrow, Next week and No date. Monday first, like the calendar. */
export function DatePicker({ value, today, onPick }: { value?: ISODate; today: ISODate; onPick: (d: ISODate | undefined) => void }) {
  const [month, setMonth] = useState(monthKey(value ?? today));
  const lead = (parseISO(`${month}-01`).getDay() + 6) % 7;
  const start = addDays(`${month}-01`, -lead);
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth(month)) / 7) * 7 }, (_, i) => addDays(start, i));
  const nextMonday = addDays(today, 7 - ((parseISO(today).getDay() + 6) % 7));
  return (
    <div className="date-picker" role="dialog" aria-label="Pick a date">
      <div className="dp-head">
        <b>{monthTitle(month)}</b>
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><Icon name="chevronR" size={14} style={{ transform: 'rotate(180deg)' }} /></button>
        <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><Icon name="chevronR" size={14} /></button>
      </div>
      <div className="dp-grid" role="grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="dow">{d}</span>)}
        {cells.map((c) => (
          <button key={c} type="button" role="gridcell" data-date={c} aria-label={longToday(c)} aria-selected={c === value}
            className={`dp-day${c === today ? ' today' : ''}${c === value ? ' on' : ''}${monthKey(c) !== month ? ' other' : ''}`} onClick={() => onPick(c)}>
            {Number(c.slice(8))}
          </button>
        ))}
      </div>
      <div className="dp-quick">
        <button type="button" className="dp-today" onClick={() => onPick(today)}>Today</button>
        <button type="button" onClick={() => onPick(addDays(today, 1))}>Tomorrow</button>
        <button type="button" onClick={() => onPick(nextMonday)}>Next week</button>
        {value && <button type="button" className="dp-clear" onClick={() => onPick(undefined)}>No date</button>}
      </div>
    </div>
  );
}
