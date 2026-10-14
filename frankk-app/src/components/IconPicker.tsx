import { useState } from 'react';
import { Icon, ICON_NAMES, type IconName } from './Icons';
import { Popover } from './Popover';

/** Click an icon to change it: opens a searchable grid of every icon. */
export function IconPicker({ value, onChange, label, size = 15, className = '' }: { value: IconName; onChange: (i: IconName) => void; label: string; size?: number; className?: string }) {
  const [q, setQ] = useState('');
  const list = ICON_NAMES.filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Popover trigger={({ toggle, ref, open }) => (
      <button ref={ref} type="button" className={`icon-trigger ${className}`} aria-label={`${label}: ${value}. Change icon`} title="Change icon" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
        <Icon name={value} size={size} />
      </button>
    )}>
      {(close) => (
        <div className="icon-grid-pop">
          <input autoFocus className="icon-search" placeholder="Search icons…" aria-label="Search icons" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) { onChange(list[0]); close(); } }} />
          <div className="icon-grid" role="listbox" aria-label={label}>
            {list.map((n) => (
              <button key={n} type="button" role="option" aria-selected={n === value} className={`icon-pick${n === value ? ' on' : ''}`} title={n} aria-label={`Icon ${n}`}
                onClick={() => { onChange(n); close(); }}><Icon name={n} size={16} /></button>
            ))}
            {list.length === 0 && <p className="menu-note">No icon matches “{q}”.</p>}
          </div>
        </div>
      )}
    </Popover>
  );
}
