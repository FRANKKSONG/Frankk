import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
  /** Allow saving an empty value (clears the field). */
  allowEmpty?: boolean;
  type?: 'text' | 'number';
  lang?: string;
}

/** Click to edit. Enter or clicking away saves, Esc cancels. */
export function Editable({ value, onSave, placeholder = '—', label, className = '', allowEmpty, type = 'text', lang }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  if (editing) {
    return (
      <input autoFocus className={`edit-input ${className}`} aria-label={label} type={type} value={draft} lang={lang}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { e.stopPropagation(); cancelled.current = true; (e.target as HTMLInputElement).blur(); }
        }}
        onBlur={() => {
          if (!cancelled.current && draft !== value && (allowEmpty || draft.trim())) onSave(draft);
          cancelled.current = false;
          setEditing(false);
        }} />
    );
  }
  return (
    <button type="button" className={`editable ${value ? '' : 'empty'} ${className}`} aria-label={`${label}: ${value || 'empty'}. Click to edit`}
      title="Click to edit" lang={lang} onClick={() => setEditing(true)}>
      {value || placeholder}
    </button>
  );
}

export function MiniSelect<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <select className="mini-select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}
