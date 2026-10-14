import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icons';
import { Popover } from './Popover';
import { useUi } from '../ui';
import { Editable } from './Editable';
import { usePersistentState } from '../hooks/usePersistentState';
import type { Area } from '../data/types';

interface Props {
  area: Area;
  title: string;
  icon: IconName;
  focused: boolean;
  onAdd?: () => void;
  addLabel: string;
  toolbar?: ReactNode;
  menu?: (close: () => void) => ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Shared chrome for the four work areas: grip, title, +, menu, focus/maximize. */
export function Panel({ area, title, icon, focused, onAdd, addLabel, toolbar, menu, footer, children }: Props) {
  const { setFocusArea } = useUi();
  const [name, setName] = usePersistentState<{ t: string }>(`title.${area}`, { t: title });
  return (
    <section className={`panel area-${area}`} aria-label={title} data-area={area}>
      <header className="panel-head">
        {!focused && <span className="panel-grip" title="Drag to move panel" aria-label={`Move ${title} panel`}><Icon name="grip" size={14} /></span>}
        <span className="panel-title"><Icon name={icon} size={15} /><Editable label={`${title} panel name`} value={name.t} onSave={(v) => setName({ t: v.trim() })} /></span>
        <span className="panel-actions">
          {onAdd && <button className="icon-btn" aria-label={addLabel} title={addLabel} onClick={onAdd}><Icon name="plus" /></button>}
          <button className="icon-btn" aria-label={focused ? 'Back to Home' : `Focus ${title}`} title={focused ? 'Back to Home (Esc)' : 'Focus this panel'}
            onClick={() => setFocusArea(focused ? null : area)}><Icon name={focused ? 'restore' : 'maximize'} size={15} /></button>
          {menu && (
            <Popover align="right" trigger={({ toggle, ref }) => (
              <button ref={ref} className="icon-btn" aria-label={`${title} options`} aria-haspopup="menu" onClick={toggle}><Icon name="more" /></button>
            )}>{menu}</Popover>
          )}
        </span>
      </header>
      {toolbar && <div className="panel-toolbar">{toolbar}</div>}
      <div className="panel-body">{children}</div>
      {footer && <footer className="panel-foot">{footer}</footer>}
    </section>
  );
}
