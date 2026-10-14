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

interface Saved { widths: Record<string, number>; hidden: string[]; order?: string[] }

// The trailing column used to hold a ⋯ menu; row actions now live on right-click, so it's just a hairline gutter.
const GRIP = 14, CHECK = 20, MENU = 4, GAP = 2;

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

  // Your column order (the name column always stays first); columns you haven't placed keep their default spot.
  const ordered = useMemo(() => {
    const rank = (id: string) => (id === 'title' ? -1 : saved.order?.includes(id) ? saved.order.indexOf(id) : 1000 + defs.findIndex((d) => d.id === id));
    return [...defs].sort((a, b) => rank(a.id) - rank(b.id));
  }, [defs, saved.order]);
  const visible = useMemo(() => ordered.filter((d) => !saved.hidden.includes(d.id)), [ordered, saved.hidden]);
  /** Move column `id` to where `overId` is (never before or onto the name column). */
  const move = useCallback((id: string, overId: string) => {
    if (id === 'title' || id === overId) return;
    const ids = ordered.map((d) => d.id).filter((x) => x !== 'title');
    const from = ids.indexOf(id);
    let to = overId === 'title' ? 0 : ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    if (overId !== 'title' && from < to) to = ids.indexOf(overId) + 1; else if (overId !== 'title') to = ids.indexOf(overId);
    ids.splice(to, 0, id);
    setSaved((s) => ({ ...s, order: ids }));
  }, [ordered, setSaved]);
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

  const reset = useCallback(() => setSaved({ widths: {}, hidden: defs.filter(hiddenByDefault).map((d) => d.id), order: undefined }), [defs, setSaved, focused]);

  const template = useMemo(
    // The name column grows to use spare room (never narrower than its set width); the rest stay where you drag them.
    () => {
      // One column stretches to fill spare room (and gives it back first when you widen others) until you size it yourself;
      // then it keeps your width and any gap goes to the end.
      const flexId = visible.find((d) => d.flex)?.id ?? 'title';
      const grow = saved.widths[flexId] === undefined ? flexId : null;
      return [`${GRIP}px`, `${CHECK}px`, ...visible.map((d) => (d.id === grow ? `minmax(${d.min}px, 1fr)` : `${width(d.id)}px`)), grow ? '0px' : 'minmax(0, 1fr)', `${MENU}px`].join(' ');
    },
    [visible, width, saved.widths],
  );
  const minWidth = useMemo(
    () => GRIP + CHECK + MENU + visible.reduce((n, d) => n + width(d.id), 0) + GAP * (visible.length + 3) + 8,
    [visible, width],
  );

  return { visible, hidden: saved.hidden, width, setWidth, resetWidth, toggle, reset, template, minWidth, move };
}

export type Columns = ReturnType<typeof useColumns>;
