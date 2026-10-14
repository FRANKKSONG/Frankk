import { useCallback, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';

export interface ColDef { id: string; label: string; width: number; min: number; fixedLabel?: boolean; defaultHidden?: boolean }

interface Saved { widths: Record<string, number>; hidden: string[] }

/** Resizable, hideable table columns; the first column is flexible (its width is a minimum). */
export function useColumns(tableId: string, defs: ColDef[]) {
  const [saved, setSaved] = usePersistentState<Saved>(`cols.${tableId}`, {
    widths: {},
    hidden: defs.filter((d) => d.defaultHidden).map((d) => d.id),
  });

  const visible = useMemo(() => defs.filter((d) => !saved.hidden.includes(d.id)), [defs, saved.hidden]);
  const width = useCallback((id: string) => saved.widths[id] ?? defs.find((d) => d.id === id)!.width, [saved.widths, defs]);

  const setWidth = useCallback((id: string, w: number) => {
    const def = defs.find((d) => d.id === id)!;
    setSaved((s) => ({ ...s, widths: { ...s.widths, [id]: Math.max(def.min, Math.round(w)) } }));
  }, [defs, setSaved]);

  const toggle = useCallback((id: string) => {
    setSaved((s) => ({ ...s, hidden: s.hidden.includes(id) ? s.hidden.filter((h) => h !== id) : [...s.hidden, id] }));
  }, [setSaved]);

  const reset = useCallback(() => setSaved({ widths: {}, hidden: defs.filter((d) => d.defaultHidden).map((d) => d.id) }), [defs, setSaved]);

  const template = useMemo(
    () => ['12px', '20px', ...visible.map((d, i) => (i === 0 ? `minmax(${width(d.id)}px, 1fr)` : `${width(d.id)}px`)), '22px'].join(' '),
    [visible, width],
  );

  return { visible, hidden: saved.hidden, width, setWidth, toggle, reset, template };
}

export type Columns = ReturnType<typeof useColumns>;
