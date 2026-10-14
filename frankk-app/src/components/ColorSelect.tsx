import { Icon } from './Icons';
import { Popover } from './Popover';
import { PIGMENTS } from '../data/types';

const nameOf = (c: string) => PIGMENTS.find((p) => p.color.toLowerCase() === c.toLowerCase())?.name ?? c.toUpperCase();

/** One colour picker everywhere: a dropdown of named pigments plus a custom colour. */
export function ColorSelect({ value, onChange, label, compact }: { value: string; onChange: (c: string) => void; label: string; compact?: boolean }) {
  return (
    <Popover trigger={({ toggle, ref, open }) => (
      <button ref={ref} type="button" className={`color-select${compact ? ' compact' : ''}`} aria-label={`${label}: ${nameOf(value)}`} aria-haspopup="listbox" aria-expanded={open} onClick={toggle}>
        <i className="cs-dot" style={{ background: value }} />
        {!compact && <span>{nameOf(value)}</span>}
        {!compact && <Icon name="chevron" size={12} />}
      </button>
    )}>
      {(close) => (
        <div className="cs-list" role="listbox" aria-label={label}>
          {PIGMENTS.map((p) => (
            <button key={p.color} type="button" role="option" aria-selected={p.color.toLowerCase() === value.toLowerCase()} className="cs-row"
              onClick={() => { onChange(p.color); close(); }}>
              <i className="cs-dot" style={{ background: p.color }} /><span>{p.name}</span>
              {p.color.toLowerCase() === value.toLowerCase() && <Icon name="check" size={12} />}
            </button>
          ))}
          <label className="cs-row cs-custom">
            <i className="cs-dot rainbow" /><span>Custom…</span>
            <input type="color" aria-label={`Custom ${label}`} value={value} onChange={(e) => onChange(e.target.value)} />
          </label>
        </div>
      )}
    </Popover>
  );
}
