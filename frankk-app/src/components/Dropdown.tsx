import { Icon, type IconName } from './Icons';
import { Popover } from './Popover';

interface Props<T extends string> {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
  icon?: IconName;
  prefix?: string;
}

export function Dropdown<T extends string>({ value, options, onChange, ariaLabel, icon, prefix }: Props<T>) {
  const current = options.find((o) => o.id === value);
  return (
    <Popover trigger={({ toggle, ref, open }) => (
      <button ref={ref} className="chip-btn" aria-label={`${ariaLabel}: ${current?.label}`} aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
        {icon && <Icon name={icon} size={14} />}
        {prefix}{current?.label}<Icon name="chevron" size={13} />
      </button>
    )}>
      {(close) => options.map((o) => (
        <button key={o.id} role="menuitemradio" aria-checked={o.id === value} className={o.id === value ? 'sel' : ''}
          onClick={() => { onChange(o.id); close(); }}>{o.label}</button>
      ))}
    </Popover>
  );
}
