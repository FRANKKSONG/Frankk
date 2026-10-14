import { useMemo, useRef, useState } from 'react';
import { nextSort } from './TaskTable';
import { Icon, type IconName } from './Icons';
import { Popover } from './Popover';
import { FieldValue } from './FieldValue';
import { TagChips } from './Tags';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { applyView, fieldOf, recordsOf, summarise, type Rec } from '../lib/records';
import { addMonths, dateInMonth, daysInMonth, monthKey, monthTitle, parseISO, relLabel } from '../lib/dates';
import { newId } from '../data/fixtures';
import { KIND_ICON, type FieldDef, type TypeDef, type ViewDef, type ViewFilter, type ViewLayout } from '../data/schema';

const LAYOUTS: { id: ViewLayout; label: string; icon: IconName }[] = [
  { id: 'table', label: 'Table', icon: 'table' }, { id: 'board', label: 'Board', icon: 'board' }, { id: 'gallery', label: 'Gallery', icon: 'gallery' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' }, { id: 'list', label: 'List', icon: 'list' },
];
const OPS: { id: ViewFilter['op']; label: string }[] = [
  { id: 'is', label: 'is' }, { id: 'is-not', label: 'is not' }, { id: 'contains', label: 'contains' }, { id: 'empty', label: 'is empty' },
  { id: 'not-empty', label: 'is not empty' }, { id: 'before', label: 'before' }, { id: 'after', label: 'after' },
];

interface Props {
  type: TypeDef;
  view: ViewDef;
  /** Compact mode inside dashboard widgets: no toolbar. */
  compact?: boolean;
  onOpen?: (rec: Rec) => void;
}

export function DataView({ type, view: saved, compact, onOpen }: Props) {
  const { data, today, dispatch } = useStore();
  const { tagFilter, say } = useUi();
  const [view, setView] = useState<ViewDef>(saved);
  const recs = useMemo(() => applyView(recordsOf(data, type.id, today), view, tagFilter), [data, type.id, today, view, tagFilter]);
  const allFields = [{ key: 'title', name: 'Name', kind: 'text' } as FieldDef, ...type.fields];
  const shown = view.fields.map((k) => fieldOf(type, k));
  const groupField = view.groupBy ? fieldOf(type, view.groupBy) : type.fields.find((f) => f.kind === 'select');
  const dateField = view.dateField ? fieldOf(type, view.dateField) : type.fields.find((f) => f.kind === 'date');
  // Like Notion: every change to a view is kept straight away. "Save as new" makes a copy.
  const patch = (p: Partial<ViewDef>) => { const next = { ...view, ...p }; setView(next); dispatch({ type: 'view/save', view: next }); };

  const body = (() => {
    switch (view.layout) {
      case 'table': return <TableLayout type={type} recs={recs} fields={shown} onOpen={onOpen} view={view} patch={patch} />;
      case 'board': return groupField ? <BoardLayout type={type} recs={recs} group={groupField} fields={shown} onOpen={onOpen} /> : <p className="hint">Add a Choice field to group a board.</p>;
      case 'gallery': return <GalleryLayout type={type} recs={recs} fields={shown} onOpen={onOpen} />;
      case 'calendar': return dateField ? <CalendarLayout recs={recs} field={dateField} onOpen={onOpen} /> : <p className="hint">Add a Date field to use a calendar.</p>;
      case 'list': return <ListLayout type={type} recs={recs} fields={shown} onOpen={onOpen} />;
    }
  })();

  if (compact) return <div className="dataview compact">{body}</div>;

  return (
    <div className="dataview">
      <div className="dv-toolbar">
        <div className="seg-icons" role="radiogroup" aria-label="Layout">
          {LAYOUTS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={view.layout === l.id} title={l.label} aria-label={l.label} onClick={() => patch({ layout: l.id })}><Icon name={l.icon} size={14} /><span>{l.label}</span></button>
          ))}
        </div>
        <Popover trigger={({ toggle, ref }) => <button ref={ref} className="chip-btn" onClick={toggle}><Icon name="filter" size={13} /> Filter{view.filters.length ? ` · ${view.filters.length}` : ''}</button>}>
          {() => (
            <div className="pop-form filters">
              {view.filters.map((f, i) => (
                <div key={i} className="filter-row">
                  <select aria-label="Field" value={f.field} onChange={(e) => patch({ filters: view.filters.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)) })}>{allFields.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</select>
                  <select aria-label="Condition" value={f.op} onChange={(e) => patch({ filters: view.filters.map((x, j) => (j === i ? { ...x, op: e.target.value as ViewFilter['op'] } : x)) })}>{OPS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
                  {!['empty', 'not-empty'].includes(f.op) && <input aria-label="Value" value={f.value ?? ''} onChange={(e) => patch({ filters: view.filters.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />}
                  <button className="icon-btn tiny" aria-label="Remove filter" onClick={() => patch({ filters: view.filters.filter((_, j) => j !== i) })}><Icon name="close" size={11} /></button>
                </div>
              ))}
              <button onClick={() => patch({ filters: [...view.filters, { field: type.fields[0]?.key ?? 'title', op: 'is', value: '' }] })}><Icon name="plus" size={12} /> Add filter</button>
            </div>
          )}
        </Popover>
        <Popover trigger={({ toggle, ref }) => <button ref={ref} className="chip-btn" onClick={toggle}><Icon name="sort" size={13} /> Sort</button>}>
          {() => (
            <div className="pop-form">
              <label>Sort by<select value={view.sort?.field ?? ''} onChange={(e) => patch({ sort: e.target.value ? { field: e.target.value, dir: view.sort?.dir ?? 'asc' } : undefined })}>
                <option value="">Manual</option>{allFields.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}</select></label>
              {view.sort && <label>Direction<select value={view.sort.dir} onChange={(e) => patch({ sort: { ...view.sort!, dir: e.target.value as 'asc' | 'desc' } })}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>}
            </div>
          )}
        </Popover>
        {(view.layout === 'board') && (
          <select className="chip-select" aria-label="Group by" value={groupField?.key ?? ''} onChange={(e) => patch({ groupBy: e.target.value })}>
            {type.fields.filter((f) => f.kind === 'select' || f.kind === 'checkbox').map((f) => <option key={f.key} value={f.key}>Group: {f.name}</option>)}
          </select>
        )}
        {(view.layout === 'calendar') && (
          <select className="chip-select" aria-label="Date field" value={dateField?.key ?? ''} onChange={(e) => patch({ dateField: e.target.value })}>
            {type.fields.filter((f) => f.kind === 'date').map((f) => <option key={f.key} value={f.key}>By: {f.name}</option>)}
          </select>
        )}
        <Popover trigger={({ toggle, ref }) => <button ref={ref} className="chip-btn" onClick={toggle}><Icon name="list" size={13} /> Fields</button>}>
          {() => (
            <div className="pop-form">
              {type.fields.map((f) => (
                <label key={f.key} className="menu-check"><input type="checkbox" checked={view.fields.includes(f.key)}
                  onChange={() => patch({ fields: view.fields.includes(f.key) ? view.fields.filter((k) => k !== f.key) : [...view.fields, f.key] })} />
                  <span className="kind-ico">{KIND_ICON[f.kind]}</span>{f.name}</label>
              ))}
            </div>
          )}
        </Popover>
        <span className="dv-spacer" />
        <span className="hint saved-hint">Changes save automatically</span>
        <button className="btn small" onClick={() => {
          const v = { ...view, id: newId('v'), name: `${view.name} copy` };
          dispatch({ type: 'view/save', view: v });
          say(`Saved as a new view “${v.name}”.`, true);
        }}>Save as new</button>
      </div>
      {body}
      <div className="dv-foot">
        <span>{recs.length} {recs.length === 1 ? type.name.toLowerCase() : type.plural.toLowerCase()}</span>
        {shown.filter((f) => ['number', 'currency', 'percent', 'rating'].includes(f.kind)).map((f) => <span key={f.key}>{f.name}: {summarise(recs, f)}</span>)}
      </div>
    </div>
  );
}

function Title({ rec, onOpen }: { rec: Rec; onOpen?: (r: Rec) => void }) {
  return <button type="button" className="rec-title" onClick={() => onOpen?.(rec)}>{rec.title}</button>;
}

function TableLayout({ type, recs, fields, onOpen, view, patch }: { type: TypeDef; recs: Rec[]; fields: FieldDef[]; onOpen?: (r: Rec) => void; view: ViewDef; patch: (p: Partial<ViewDef>) => void }) {
  const cols = [{ key: 'title', name: 'Name', kind: 'text' } as FieldDef, ...fields];
  const w = (k: string) => view.widths?.[k] ?? (k === 'title' ? 200 : 140);
  const sort = view.sort ? { key: view.sort.field, dir: view.sort.dir } : null;
  const tableRef = useRef<HTMLTableElement>(null);
  const setW = (k: string, px: number) => patch({ widths: { ...view.widths, [k]: Math.max(60, Math.min(600, Math.round(px))) } });
  const fit = (k: string, label: string) => {
    const cells = [...(tableRef.current?.querySelectorAll<HTMLElement>(`[data-col="${k}"] > *`) ?? [])];
    setW(k, Math.max(label.length * 8 + 44, ...cells.map((c) => c.scrollWidth + 24)));
  };
  return (
    <div className="dv-table-wrap">
      <table ref={tableRef} className="dv-table" style={{ width: cols.reduce((n, c) => n + w(c.key), 0) }}>
        <colgroup>{cols.map((c) => <col key={c.key} style={{ width: w(c.key) }} />)}</colgroup>
        <thead><tr>{cols.map((f) => {
          const active = sort?.key === f.key;
          return (
            <th key={f.key} aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={active ? 'sorted' : ''}>
              <button type="button" className="th-btn" title={`Sort by ${f.name}`} onClick={() => { const n = nextSort(sort, f.key); patch({ sort: n ? { field: n.key, dir: n.dir } : undefined }); }}>
                {f.key !== 'title' && <span className="kind-ico">{KIND_ICON[f.kind]}</span>}<span className="th-label">{f.name}</span>
                <span className="sort-ind" aria-hidden="true">{active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
              </button>
              <ColResize label={f.name} value={w(f.key)} onChange={(px) => setW(f.key, px)} onFit={() => fit(f.key, f.name)} />
            </th>
          );
        })}</tr></thead>
        <tbody>
          {recs.map((r) => (
            <tr key={r.id}>
              <td data-col="title"><Title rec={r} onOpen={onOpen} />{r.tags.length > 0 && <TagChips names={r.tags} small />}</td>
              {fields.map((f) => <td key={f.key} data-col={f.key} className={`k-${f.kind}`}><FieldValue type={type} field={f} recId={r.id} value={r.get(f.key)} compact /></td>)}
            </tr>
          ))}
          {recs.length === 0 && <tr><td colSpan={fields.length + 1} className="empty">Nothing matches this view.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** Column divider for view tables: drag to resize (live), double-click to fit, arrow keys for fine steps. */
function ColResize({ label, value, onChange, onFit }: { label: string; value: number; onChange: (w: number) => void; onFit: () => void }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const end = () => { if (start.current && live !== null) onChange(live); start.current = null; setLive(null); document.body.classList.remove('col-resizing'); };
  return (
    <span className="col-resizer" role="separator" aria-orientation="vertical" tabIndex={0} aria-label={`Resize ${label} column (double-click to fit)`} aria-valuenow={live ?? value}
      title="Drag to resize · double-click to fit"
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, w: value }; document.body.classList.add('col-resizing'); }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const nw = Math.max(60, start.current.w + e.clientX - start.current.x);
        setLive(nw);
        const th = (e.currentTarget.parentElement as HTMLElement);
        const col = th.closest('table')?.querySelectorAll('col')[[...th.parentElement!.children].indexOf(th)] as HTMLElement | undefined;
        if (col) col.style.width = `${nw}px`;
      }}
      onPointerUp={end} onPointerCancel={end}
      onDoubleClick={onFit}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); onChange(value + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 40 : 10)); } }} />
  );
}

function BoardLayout({ type, recs, group, fields, onOpen }: { type: TypeDef; recs: Rec[]; group: FieldDef; fields: FieldDef[]; onOpen?: (r: Rec) => void }) {
  const { dispatch } = useStore();
  const [over, setOver] = useState<string | null>(null);
  const columns = group.kind === 'checkbox'
    ? [{ value: 'false', color: 'var(--muted)', label: 'Not yet' }, { value: 'true', color: 'var(--ok)', label: 'Done' }]
    : [...(group.options ?? []).map((o) => ({ ...o, label: o.value })), { value: '', color: 'var(--faint)', label: 'No ' + group.name.toLowerCase() }];
  const valueOf = (r: Rec) => { const v = r.get(group.key); return group.kind === 'checkbox' ? String(!!v) : String(v ?? ''); };
  return (
    <div className="dv-board">
      {columns.map((c) => {
        const items = recs.filter((r) => valueOf(r) === c.value);
        if (c.value === '' && !items.length) return null;
        return (
          <div key={c.value || 'none'} className={`dv-col${over === c.value ? ' over' : ''}`} style={{ '--c': c.color } as React.CSSProperties}
            onDragOver={(e) => { e.preventDefault(); setOver(c.value); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault(); setOver(null);
              const id = e.dataTransfer.getData('text/esther-rec');
              if (id) dispatch({ type: 'record/set', typeId: type.id, id, key: group.key, value: group.kind === 'checkbox' ? c.value === 'true' : c.value });
            }}>
            <div className="dv-col-head"><span className="choice" style={{ '--c': c.color } as React.CSSProperties}>{c.label}</span><span className="count">{items.length}</span></div>
            {items.map((r) => (
              <div key={r.id} className="dv-card" draggable onDragStart={(e) => e.dataTransfer.setData('text/esther-rec', r.id)}>
                <Title rec={r} onOpen={onOpen} />
                {fields.filter((f) => f.key !== group.key).map((f) => <div key={f.key} className="dv-card-field"><span>{f.name}</span><FieldValue type={type} field={f} recId={r.id} value={r.get(f.key)} compact /></div>)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function GalleryLayout({ type, recs, fields, onOpen }: { type: TypeDef; recs: Rec[]; fields: FieldDef[]; onOpen?: (r: Rec) => void }) {
  return (
    <div className="dv-gallery">
      {recs.map((r) => (
        <div key={r.id} className="dv-tile" style={{ '--c': type.color } as React.CSSProperties}>
          <div className="dv-tile-cap">{r.title.slice(0, 1)}</div>
          <Title rec={r} onOpen={onOpen} />
          {fields.map((f) => <div key={f.key} className="dv-card-field"><span>{f.name}</span><FieldValue type={type} field={f} recId={r.id} value={r.get(f.key)} compact /></div>)}
          {r.tags.length > 0 && <TagChips names={r.tags} small />}
        </div>
      ))}
    </div>
  );
}

function ListLayout({ type, recs, fields, onOpen }: { type: TypeDef; recs: Rec[]; fields: FieldDef[]; onOpen?: (r: Rec) => void }) {
  return (
    <ul className="dv-list">
      {recs.map((r) => (
        <li key={r.id}><Title rec={r} onOpen={onOpen} />
          <span className="dv-list-fields">{fields.slice(0, 3).map((f) => <FieldValue key={f.key} type={type} field={f} recId={r.id} value={r.get(f.key)} compact />)}</span>
        </li>
      ))}
      {recs.length === 0 && <li className="empty">Nothing here yet.</li>}
    </ul>
  );
}

function CalendarLayout({ recs, field, onOpen }: { recs: Rec[]; field: FieldDef; onOpen?: (r: Rec) => void }) {
  const { today } = useStore();
  const [month, setMonth] = useState(monthKey(today));
  const lead = (parseISO(`${month}-01`).getDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(month) }, (_, i) => dateInMonth(month, i + 1))];
  while (cells.length % 7) cells.push(null);
  return (
    <div className="dv-cal">
      <div className="dv-cal-head">
        <button className="icon-btn tiny" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><Icon name="chevronR" size={13} style={{ transform: 'rotate(180deg)' }} /></button>
        <strong>{monthTitle(month)}</strong>
        <button className="icon-btn tiny" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><Icon name="chevronR" size={13} /></button>
        <span className="hint">by {field.name}</span>
      </div>
      <div className="dv-cal-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="dow">{d}</span>)}
        {cells.map((c, i) => c ? (
          <div key={c} className={`dv-day${c === today ? ' today' : ''}`}>
            <span className="dv-day-n">{Number(c.slice(8))}</span>
            {recs.filter((r) => String(r.get(field.key) ?? '').slice(0, 10) === c).map((r) => (
              <button key={r.id} className="dv-chip" title={`${r.title} · ${relLabel(c, today)}`} onClick={() => onOpen?.(r)}>{r.title}</button>
            ))}
          </div>
        ) : <span key={`e${i}`} />)}
      </div>
    </div>
  );
}
