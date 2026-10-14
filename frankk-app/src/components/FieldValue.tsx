import { useState } from 'react';
import { Editable } from './Editable';
import { DateCell } from './DateCell';
import { Popover } from './Popover';
import { Icon } from './Icons';
import { useStore } from '../data/store';
import { recordsOf } from '../lib/records';
import { PIGMENTS } from '../data/types';
import { formatValue, type FieldDef, type TypeDef } from '../data/schema';

interface Props { type: TypeDef; field: FieldDef; recId: string; value: unknown; compact?: boolean }

/** The right control for each kind of field: dates get a calendar, money a formatted number, choices coloured chips… */
export function FieldValue({ type, field, recId, value, compact }: Props) {
  const { dispatch } = useStore();
  const set = (v: unknown) => dispatch({ type: 'record/set', typeId: type.id, id: recId, key: field.key, value: v });
  const label = `${field.name}`;

  if (field.computed) {
    if (field.kind === 'percent') {
      const n = Number(value) || 0;
      return <span className="pbar slim" title={`${n}%`}><span className="pfill" style={{ width: `${n}%` }} /><span className="plabel">{n}%</span></span>;
    }
    return <span className="fv-static">{formatValue(field, value) || '—'}</span>;
  }

  switch (field.kind) {
    case 'checkbox':
      return <label className="check no-drag"><input type="checkbox" aria-label={label} checked={!!value} onChange={() => set(!value)} /><span className="box" /></label>;
    case 'date':
      return <DateCell label={label} value={(value as string) || undefined} onChange={(v) => set(v ?? '')} />;
    case 'rating':
      return (
        <span className="stars" role="radiogroup" aria-label={label}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={Number(value) === n} aria-label={`${n} stars`} className={n <= (Number(value) || 0) ? 'on' : ''}
              onClick={() => set(Number(value) === n ? 0 : n)}>★</button>
          ))}
        </span>
      );
    case 'select':
      return <ChoicePicker type={type} field={field} value={value ? [String(value)] : []} onChange={(v) => set(v[0] ?? '')} single />;
    case 'multiselect': {
      const arr = Array.isArray(value) ? value.map(String) : value ? String(value).split(',').map((x) => x.trim()) : [];
      return <ChoicePicker type={type} field={field} value={arr} onChange={set} />;
    }
    case 'relation':
      return <RelationPicker field={field} value={value ? String(value) : ''} onChange={set} />;
    case 'url':
      return (
        <span className="fv-link">
          {value ? <a href={String(value)} target="_blank" rel="noreferrer noopener" title={String(value)}><Icon name="external" size={11} /> {String(value).replace(/^https?:\/\/(www\.)?/, '').slice(0, compact ? 18 : 40)}</a> : null}
          <Editable label={label} value={String(value ?? '')} allowEmpty placeholder={value ? '✎' : '+ link'} onSave={(v) => set(v.trim())} className={value ? 'fv-edit-icon' : ''} />
        </span>
      );
    case 'number': case 'currency': case 'percent': case 'duration':
      return <NumberValue field={field} value={value} onSave={set} />;
    default:
      return <Editable label={label} value={String(value ?? '')} allowEmpty placeholder="—" onSave={(v) => set(v.trim())} />;
  }
}

function NumberValue({ field, value, onSave }: { field: FieldDef; value: unknown; onSave: (v: unknown) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return <input autoFocus className="edit-input num" type="number" aria-label={field.name} defaultValue={value === undefined || value === '' ? '' : Number(value)}
      onBlur={(e) => { onSave(e.target.value === '' ? '' : Number(e.target.value)); setEditing(false); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false); }} />;
  }
  return <button type="button" className={`editable num${value === undefined || value === '' ? ' empty' : ''}`} aria-label={`${field.name}: ${formatValue(field, value) || 'empty'}`}
    onClick={() => setEditing(true)}>{formatValue(field, value) || '—'}</button>;
}

export function ChoicePicker({ type, field, value, onChange, single }: { type: TypeDef; field: FieldDef; value: string[]; onChange: (v: string[]) => void; single?: boolean }) {
  const { dispatch } = useStore();
  const [q, setQ] = useState('');
  const color = (v: string) => field.options?.find((o) => o.value === v)?.color ?? 'var(--muted)';
  const add = () => {
    const v = q.trim();
    if (!v) return;
    if (!field.options?.some((o) => o.value === v)) {
      dispatch({ type: 'field/update', typeId: type.id, key: field.key, patch: { options: [...(field.options ?? []), { value: v, color: PIGMENTS[(field.options?.length ?? 0) % PIGMENTS.length].color }] } });
    }
    onChange(single ? [v] : [...new Set([...value, v])]);
    setQ('');
  };
  return (
    <Popover trigger={({ toggle, ref }) => (
      <button ref={ref} type="button" className="choice-btn" aria-label={`${field.name}: ${value.join(', ') || 'empty'}`} onClick={toggle}>
        {value.length ? value.map((v) => <span key={v} className="choice" style={{ '--c': color(v) } as React.CSSProperties}>{v}</span>) : <span className="fv-empty">—</span>}
      </button>
    )}>
      {(close) => (
        <div className="choice-pop">
          <input autoFocus placeholder="Find or add an option…" aria-label="Option" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { add(); if (single) close(); } }} />
          {(field.options ?? []).filter((o) => !q || o.value.toLowerCase().includes(q.toLowerCase())).map((o) => (
            <button key={o.value} type="button" role="menuitemcheckbox" aria-checked={value.includes(o.value)} className="choice-row"
              onClick={() => { if (single) { onChange(value[0] === o.value ? [] : [o.value]); close(); } else onChange(value.includes(o.value) ? value.filter((x) => x !== o.value) : [...value, o.value]); }}>
              <span className="choice" style={{ '--c': o.color } as React.CSSProperties}>{o.value}</span>{value.includes(o.value) && <Icon name="check" size={12} />}
            </button>
          ))}
          {q.trim() && !field.options?.some((o) => o.value === q.trim()) && <button type="button" className="tag-create" onClick={() => { add(); if (single) close(); }}><Icon name="plus" size={12} /> Add “{q.trim()}”</button>}
          {value.length > 0 && <button type="button" className="choice-clear" onClick={() => { onChange([]); close(); }}>Clear</button>}
        </div>
      )}
    </Popover>
  );
}

function RelationPicker({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const { data, today } = useStore();
  const target = field.relationType ?? 'person';
  const recs = recordsOf(data, target, today);
  return (
    <select className="mini-select" aria-label={field.name} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {recs.map((r) => <option key={r.id} value={`[[${r.title}]]`}>{r.title}</option>)}
      {value && !recs.some((r) => `[[${r.title}]]` === value) && <option value={value}>{value}</option>}
    </select>
  );
}
