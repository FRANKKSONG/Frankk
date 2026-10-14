import { useCallback, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';

export interface ColDef {
  id: string; label: string; width: number; min: number;
  defaultHidden?: boolean;
  /** Shown by default when the panel is opened full-width (overrides defaultHidden there). */
  focusHidden?: boolean;
  /** Default width when the panel is opened full-width. */
  focusWidth?: number;
  /** This column stretches to fill spare width (else the name column does). */
  flex?: boolean;
}

interface Saved { widths: Record<string, number>; hidden: string[] }

const GRIP = 14, CHECK = 20, MENU = 24, GAP = 2;

/**
 * Every column (including the name) has its own fixed pixel width that stays exactly where you drag it.
 * A flexible spacer before the row menu absorbs spare room; if the columns are wider than the panel,
 * the table scrolls sideways inside the panel.
 */
export function useColumns(tableId: string, defs: ColDef[], focused = false) {
  const hiddenByDefault = (d: ColDef) => (focused ? d.focusHidden ?? false : !!d.defaultHidden);
  const [saved, setSaved] = usePersistentState<Saved>(`cols.${tableId}${focused ? '.focus' : ''}`, {
    widths: {},
    hidden: defs.filter(hiddenByDefault).map((d) => d.id),
  });

  const visible = useMemo(() => defs.filter((d) => !saved.hidden.includes(d.id)), [defs, saved.hidden]);
  const width = useCallback((id: string) => { const d = defs.find((x) => x.id === id)!; return saved.widths[id] ?? (focused ? d.focusWidth ?? d.width : d.width); }, [saved.widths, defs, focused]);

  const setWidth = useCallback((id: string, w: number) => {
    const def = defs.find((d) => d.id === id)!;
    setSaved((s) => ({ ...s, widths: { ...s.widths, [id]: Math.min(900, Math.max(def.min, Math.round(w))) } }));
  }, [defs, setSaved]);

  const resetWidth = useCallback((id: string) => {
    setSaved((s) => { const widths = { ...s.widths }; delete widths[id]; return { ...s, widths }; });
  }, [setSaved]);

  const toggle = useCallback((id: string) => {
    setSaved((s) => ({ ...s, hidden: s.hidden.includes(id) ? s.hidden.filter((h) => h !== id) : [...s.hidden, id] }));
  }, [setSaved]);

  const reset = useCallback(() => setSaved({ widths: {}, hidden: defs.filter(hiddenByDefault).map((d) => d.id) }), [defs, setSaved, focused]);

  const template = useMemo(
    // The name column grows to use spare room (never narrower than its set width); the rest stay where you drag them.
    () => {
      const grow = visible.find((d) => d.flex)?.id ?? 'title';
      return [`${GRIP}px`, `${CHECK}px`, ...visible.map((d) => (d.id === grow ? `minmax(${width(d.id)}px, 1fr)` : `${width(d.id)}px`)), '0px', `${MENU}px`].join(' ');
    },
    [visible, width],
  );
  const minWidth = useMemo(
    () => GRIP + CHECK + MENU + visible.reduce((n, d) => n + width(d.id), 0) + GAP * (visible.length + 3) + 8,
    [visible, width],
  );

  return { visible, hidden: saved.hidden, width, setWidth, resetWidth, toggle, reset, template, minWidth };
}

export type Columns = ReturnType<typeof useColumns>;
