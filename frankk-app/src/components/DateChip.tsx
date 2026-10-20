import { useRef } from 'react';
import { Icon } from './Icons';
import { relLabel, type ISODate } from '../lib/dates';

/** The day a task is for: a small chip that opens the date picker. Late days show in red. */
export function DateChip({ value, today, onChange, label }: { value?: ISODate; today: ISODate; onChange: (d: ISODate | undefined) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const late = !!value && value < today;
  return (
    <span className={`date-chip${value ? '' : ' empty'}${late ? ' late' : ''}${value === today ? ' today' : ''}`}>
      <button type="button" aria-label={`${label}: ${value ? relLabel(value, today) : 'no date'}. Change`}
        onClick={(e) => { e.stopPropagation(); const el = ref.current; if (!el) return; try { el.showPicker(); } catch { el.focus(); } }}>
        <Icon name="calendar" size={12} />{value ? relLabel(value, today) : 'Date'}
      </button>
      <input ref={ref} type="date" tabIndex={-1} aria-hidden="true" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
    </span>
  );
}
