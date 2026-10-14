import type { ColDef } from '../hooks/useColumns';
import type { Columns } from '../hooks/useColumns';

export function ColumnsMenu({ defs, cols, close }: { defs: ColDef[]; cols: Columns; close: () => void }) {
  return (
    <>
      <p className="menu-label">Columns</p>
      {defs.map((d, i) => (
        <label key={d.id} className="menu-check">
          <input type="checkbox" checked={!cols.hidden.includes(d.id)} disabled={i === 0} onChange={() => cols.toggle(d.id)} />
          {d.label}
        </label>
      ))}
      <button role="menuitem" onClick={() => { cols.reset(); close(); }}>Reset columns (widths, order, shown)</button>
    </>
  );
}
