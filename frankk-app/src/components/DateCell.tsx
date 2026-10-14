import { useEffect, useRef, useState } from 'react';
import { relLabel, diffDays, type ISODate } from '../lib/dates';
import { useStore } from '../data/store';
import { Icon } from './Icons';

interface Props {
  value?: ISODate;
  onChange: (v: ISODate | undefined) => void;
  label: string;
  kind?: 'plan' | 'due';
  done?: boolean;
  placeholder?: string;
  /** Table cells: tighter chip, the icon only shows when the date is empty. */
  compact?: boolean;
}

/** Click to edit. Choosing a date commits; the × clears it. Esc/blur cancels. */
export function DateCell({ value, onChange, label, kind, done, placeholder = 'Add date', compact }: Props) {
  const { today } = useStore();
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      try { input.current?.showPicker?.(); } catch { /* picker needs a user gesture in some browsers */ }
    }
  }, [editing]);

  const diff = value ? diffDays(value, today) : null;
  const overdue = kind === 'due' && !done && diff !== null && diff < 0;
  const isToday = value === today;
  const soon = !done && diff !== null && diff > 0 && diff <= 2;

  if (editing) {
    return (
      <span className="date-edit">
        <input ref={input} type="date" value={value ?? ''} aria-label={label}
          onChange={(e) => { onChange(e.target.value || undefined); setEditing(false); }}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); } }} />
        {value && <button className="icon-btn tiny" aria-label={`Clear ${label}`} onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onChange(undefined); setEditing(false); }}>×</button>}
      </span>
    );
  }
  return (
    <button className={`date-btn${compact ? ' compact' : ''}${overdue ? ' overdue' : ''}${isToday && !done ? ' today' : ''}${soon ? ' soon' : ''}${value ? '' : ' empty'}`}
      aria-label={`${label}: ${value ? relLabel(value, today) : 'not set'}. Click to change`} title={`${label}. Click to pick a date`} onClick={() => setEditing(true)}>
      <Icon name="calendar" size={11} className="date-ico" />
      {(value || !compact) && <span>{value ? relLabel(value, today) : placeholder}</span>}
    </button>
  );
}
