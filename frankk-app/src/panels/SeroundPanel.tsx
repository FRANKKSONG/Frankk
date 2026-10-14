import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { Table, TaskRows, nextSort } from '../components/TaskTable';
import { SORTABLE, applySort, type SortDir, type SortKey } from '../lib/tasks';
import { ColumnsMenu } from '../components/ColumnsMenu';
import { Dropdown } from '../components/Dropdown';
import { Popover } from '../components/Popover';
import { Editable } from '../components/Editable';
import { Icon } from '../components/Icons';
import { ColorSelect } from '../components/ColorSelect';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { useColumns, type ColDef } from '../hooks/useColumns';
import { usePersistentState } from '../hooks/usePersistentState';

export const SEROUND_COLS: ColDef[] = [
  { id: 'title', label: 'Task', width: 116, min: 60 },
  { id: 'progress', label: 'Progress', width: 62, min: 40 },
  { id: 'plan', label: 'Plan', width: 68, min: 44, defaultHidden: true },
  { id: 'due', label: 'Due', width: 70, min: 44 },
  { id: 'workstream', label: 'Workstream', width: 86, min: 50, defaultHidden: true },
  { id: 'priority', label: 'Priority', width: 64, min: 48, defaultHidden: true },
];

export function SeroundPanel({ focused }: { focused: boolean }) {
  const { data, dispatch } = useStore();
  const { say, setNewTask, tagFilter } = useUi();
  const cols = useColumns('seround', SEROUND_COLS);
  const [prefs, setPrefs] = usePersistentState<{ brand: string; showDone: boolean; collapsed: string[]; sort: SortKey; dir: SortDir }>('prefs.seround', { brand: 'all', showDone: true, collapsed: [], sort: 'manual', dir: 'asc' });
  const [newBrand, setNewBrand] = useState('');

  const brand = prefs.brand === 'all' || data.brands.includes(prefs.brand) ? prefs.brand : 'all';
  const groups = useMemo(() => data.brands
    .filter((b) => brand === 'all' || brand === b)
    .map((b) => {
      const all = data.tasks.filter((t) => t.area === 'seround' && t.brand === b && (prefs.showDone || !t.done) && (!tagFilter || t.tags.includes(tagFilter)));
      const sorted = applySort(all, prefs.sort, prefs.dir);
      return { brand: b, queue: sorted.filter((t) => t.workstream === 'content'), tasks: sorted.filter((t) => t.workstream !== 'content') };
    }),
  [data.tasks, data.brands, brand, prefs.showDone, tagFilter, prefs.sort, prefs.dir]);

  const brandOptions = [{ id: 'all', label: 'All brands' }, ...data.brands.map((b) => ({ id: b, label: b }))];
  const addBrand = () => {
    if (!newBrand.trim()) return;
    dispatch({ type: 'brand/add', name: newBrand });
    say(`Brand “${newBrand.trim()}” added.`, true);
    setNewBrand('');
  };

  return (
    <Panel area="seround" title="Seround" icon="seround" focused={focused} onAdd={() => setNewTask({ area: 'seround', brand: brand === 'all' ? undefined : brand })} addLabel="New brand task"
      menu={(close) => (
        <>
          <div className="pop-form">
            <label>Add a brand
              <span className="inline-row">
                <input value={newBrand} placeholder="Brand name" onChange={(e) => setNewBrand(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addBrand(); }} />
                <button className="btn small" onClick={addBrand} disabled={!newBrand.trim()}>Add</button>
              </span>
            </label>
          </div>
          <label className="menu-check"><input type="checkbox" checked={prefs.showDone} onChange={() => setPrefs((p) => ({ ...p, showDone: !p.showDone }))} />Show completed</label>
          <ColumnsMenu defs={SEROUND_COLS} cols={cols} close={close} />
        </>
      )}
      toolbar={<>
        <Dropdown ariaLabel="Filter by brand" value={brand} options={brandOptions} onChange={(b) => setPrefs((p) => ({ ...p, brand: b }))} />
        <Popover align="right" trigger={({ toggle, ref }) => (
          <button ref={ref} className="chip-btn" onClick={toggle}><Icon name="calendar" size={13} /> Office calendar</button>
        )}>
          {() => (
            <div className="pop-info">
              <strong>Not connected</strong>
              <p>The office Google Calendar hasn’t been chosen or authorised yet (planned for Milestone 6). Calendar connections are separate from vault sync, and this app never exports a task that TaskNotes already exports.</p>
            </div>
          )}
        </Popover>
      </>}
      footer={<button className="foot-add" onClick={() => setNewTask({ area: 'seround', brand: brand === 'all' ? undefined : brand })}><Icon name="plus" size={13} /> Brand task</button>}>
      <Table cols={cols} label="Seround tasks" sortable={Object.keys(SORTABLE)}
        sort={prefs.sort === 'manual' ? null : { key: Object.keys(SORTABLE).find((k) => SORTABLE[k] === prefs.sort) ?? prefs.sort, dir: prefs.dir }}
        onSort={(col) => setPrefs((p) => { const n = nextSort(p.sort === 'manual' ? null : { key: p.sort, dir: p.dir }, SORTABLE[col]); return { ...p, sort: n ? (n.key as SortKey) : 'manual', dir: n?.dir ?? 'asc' }; })}>
        {groups.map((g) => {
          const closed = prefs.collapsed.includes(g.brand);
          return (
            <div key={g.brand} className="group" style={{ '--brand': data.brandColors[g.brand] ?? 'var(--seround)' } as React.CSSProperties}>
              <div className="group-head">
                <button className="chev-btn" aria-expanded={!closed} aria-label={`${closed ? 'Expand' : 'Collapse'} ${g.brand}`}
                  onClick={() => setPrefs((p) => ({ ...p, collapsed: closed ? p.collapsed.filter((x) => x !== g.brand) : [...p.collapsed, g.brand] }))}>
                  <Icon name="chevron" size={12} style={{ transform: closed ? 'rotate(-90deg)' : undefined }} />
                </button>
                <Editable label="Brand name" value={g.brand} lang={g.brand.startsWith('sundey') ? 'lo' : undefined}
                  onSave={(v) => { dispatch({ type: 'brand/rename', from: g.brand, to: v }); say(`Renamed to “${v.trim()}”.`, true); }} />
                <ColorSelect compact label={`Colour for ${g.brand}`} value={data.brandColors[g.brand] ?? '#d4a03c'}
                  onChange={(color) => dispatch({ type: 'brand/color', name: g.brand, color })} />
                <span className="count">{[...g.queue, ...g.tasks].filter((t) => !t.done).length} open</span>
              </div>
              {!closed && (
                <>
                  {g.queue.length > 0 && (
                    <div className="queue">
                      <div className="sub-label"><Icon name="check" size={11} /> Repost queue</div>
                      <TaskRows tasks={g.queue} cols={cols} manual={prefs.sort === 'manual'} />
                      <QueueAdd brand={g.brand} />
                    </div>
                  )}
                  {(g.tasks.length > 0 || g.queue.length === 0) && <TaskRows tasks={g.tasks} cols={cols} manual={prefs.sort === 'manual'} empty="No tasks for this brand." />}
                </>
              )}
            </div>
          );
        })}
      </Table>
    </Panel>
  );
}

/** One-line add for the repost queue: type and press Enter. */
function QueueAdd({ brand }: { brand: string }) {
  const { dispatch, today } = useStore();
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    dispatch({ type: 'task/add', title: text, area: 'seround', extra: { brand, workstream: 'content', mode: 'simple', plan: today, content: { destination: 'Facebook page', repostStatus: 'queued' } } });
    setText('');
  };
  return (
    <div className="queue-add">
      <Icon name="plus" size={12} />
      <input value={text} placeholder="Add a clip to repost, press Enter" aria-label={`Add to ${brand} repost queue`} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
    </div>
  );
}
