import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  trigger: (p: { open: boolean; toggle: () => void; ref: React.RefObject<HTMLButtonElement | null> }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

/** Portal popover: never clipped by scrolling panels. Esc and outside-click close it. */
export function Popover({ trigger, children, align = 'left', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  const pop = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const w = pop.current?.offsetWidth ?? 220;
    const left = align === 'right' ? Math.max(8, r.right - w) : Math.min(r.left, window.innerWidth - w - 8);
    const h = pop.current?.offsetHeight ?? 200;
    const top = r.bottom + 6 + h > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6;
    setPos({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // Clicks inside a nested popover (e.g. a colour dropdown in this one) keep this one open.
      if (pop.current?.contains(t) || ref.current?.contains(t) || (t as Element).closest?.('.popover')) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); ref.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <>
      {trigger({ open, toggle: () => setOpen((o) => !o), ref })}
      {open && createPortal(
        <div ref={pop} className={`popover ${className}`} style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }} role="menu">
          {children(() => setOpen(false))}
        </div>,
        document.body,
      )}
    </>
  );
}
