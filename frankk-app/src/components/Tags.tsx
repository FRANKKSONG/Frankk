import { useMemo, useState } from 'react';
import { Icon } from './Icons';
import { Popover } from './Popover';
import { useStore } from '../data/store';
import { tagKey } from '../data/reducer';
import { useUi } from '../ui';

export function useTagColor() {
  const { data } = useStore();
  const map = useMemo(() => new Map(data.tags.map((t) => [t.name, t.color])), [data.tags]);
  return (name: string) => map.get(name) ?? 'var(--muted)';
}

/** Coloured tag chips. Clicking a chip filters the whole board by that tag. */
export function TagChips({ names, small }: { names: string[]; small?: boolean }) {
  const color = useTagColor();
  const { tagFilter, setTagFilter } = useUi();
  if (!names.length) return null;
  return (
    <span className={`tag-chips${small ? ' small' : ''}`}>
      {names.map((n) => (
        <button key={n} type="button" className={`tag-chip${tagFilter === n ? ' on' : ''}`} style={{ '--tag': color(n) } as React.CSSProperties}
          title={tagFilter === n ? 'Showing only this tag. Click to show all' : `Show only #${n}`}
          onClick={(e) => { e.stopPropagation(); setTagFilter(tagFilter === n ? null : n); }}>
          #{n}
        </button>
      ))}
    </span>
  );
}

/** Popover to tick tags on/off or create a new one by typing and pressing Enter. */
export function TagPicker({ value, onChange, label = 'Edit tags', compact }: { value: string[]; onChange: (v: string[]) => void; label?: string; compact?: boolean }) {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const key = tagKey(q);
  const list = data.tags.filter((t) => !key || t.name.includes(key));
  const toggle = (n: string) => onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n]);
  return (
    <Popover trigger={({ toggle: t, ref, open }) => (
      <button ref={ref} type="button" className={`tag-add${compact ? ' compact' : ''}`} aria-label={label} aria-expanded={open} title={label} onClick={t}>
        <Icon name="tag" size={11} />{compact ? '' : ' Tag'}
      </button>
    )}>
      {() => (
        <div className="tag-picker">
          <input autoFocus placeholder="Find or create a tag…" aria-label="Tag name" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && key) { if (!value.includes(key)) onChange([...value, key]); setQ(''); } }} />
          <div className="tag-list">
            {list.map((t) => (
              <label key={t.name} className="menu-check">
                <input type="checkbox" checked={value.includes(t.name)} onChange={() => toggle(t.name)} />
                <i className="dot-sw" style={{ background: t.color }} />#{t.name}
              </label>
            ))}
            {key && !data.tags.some((t) => t.name === key) && (
              <button type="button" className="tag-create" onClick={() => { onChange([...value, key]); setQ(''); }}>
                <Icon name="plus" size={12} /> Create #{key}
              </button>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}
