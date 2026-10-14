import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icons';

export interface MenuItem {
  label: string;
  icon?: IconName;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Draw a divider above this item. */
  sep?: boolean;
}

type Open = (e: React.MouseEvent, items: MenuItem[]) => void;
const Ctx = createContext<Open>(() => {});

/** Right-click menus. Destructive actions (delete, skip) live here instead of on-row buttons. */
export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const open = useCallback<Open>((e, items) => {
    // Inner rows win over outer rows: the first handler claims the event.
    if (e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    setPos(null);
    setMenu({ x: e.clientX, y: e.clientY, items });
  }, []);

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const w = ref.current.offsetWidth, h = ref.current.offsetHeight;
    setPos({ left: Math.max(8, Math.min(menu.x, window.innerWidth - w - 8)), top: Math.max(8, Math.min(menu.y, window.innerHeight - h - 8)) });
    ref.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const opened = performance.now();
    const close = (e: Event) => { if (!(e.target instanceof Node && ref.current?.contains(e.target))) setMenu(null); };
    // A scroll that was already under way when the menu opened shouldn't close it.
    const onScroll = (e: Event) => { if (performance.now() - opened > 250) close(e); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]?.focus();
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('contextmenu', close, true);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKey);
    const onBlur = () => setMenu(null);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('contextmenu', close, true);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, [menu]);

  return (
    <Ctx.Provider value={open}>
      {children}
      {menu && createPortal(
        <div ref={ref} className="popover context-menu" role="menu" style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          onContextMenu={(e) => e.preventDefault()}>
          {menu.items.map((it, i) => (
            <div key={i} className="cm-item-wrap">
              {it.sep && <hr className="cm-sep" />}
              <button type="button" role="menuitem" className={it.danger ? 'danger' : ''} disabled={it.disabled}
                onClick={() => { setMenu(null); it.onClick(); }}>
                {it.icon ? <Icon name={it.icon} size={13} /> : <span className="cm-noicon" />}{it.label}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export const useContextMenu = () => useContext(Ctx);
