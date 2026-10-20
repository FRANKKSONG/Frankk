import { Icon } from './Icons';
import { Popover } from './Popover';

export interface Option<T extends string | number> { value: T; label: string; dot?: string }

/** A dropdown in Esther's own (Windows 11 style) menu, instead of the system's plain one. */
export function Select<T extends string | number>({ value, options, onChange, label, className = '', trigger }: {
  value: T; options: Option<T>[]; onChange: (v: T) => void; label: string; className?: string;
  /** Draw the button yourself (e.g. a list pill). */
  trigger?: (current: Option<T> | undefined) => React.ReactNode;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Popover trigger={({ toggle, ref, open }) => (
      <button ref={ref} type="button" className={`select-btn ${className}`} aria-label={`${label}: ${current?.label ?? ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={(e) => { e.stopPropagation(); toggle(); }}>
        {trigger ? trigger(current) : <>{current?.dot && <i className="dot" style={{ background: current.dot }} />}<span>{current?.label}</span><Icon name="chevron" size={14} /></>}
      </button>
    )}>
      {(close) => (
        <div className="menu-list" role="listbox" aria-label={label}>
          {options.map((o) => (
            <button key={String(o.value)} type="button" role="option" aria-selected={o.value === value} className="menu-item"
              onClick={() => { onChange(o.value); close(); }}>
              {o.dot ? <i className="dot" style={{ background: o.dot }} /> : <span className="menu-noicon" />}
              <span>{o.label}</span>
              {o.value === value && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

/** A Windows 11 style on/off switch. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <span className="knob" /><small>{on ? 'On' : 'Off'}</small>
    </button>
  );
}
