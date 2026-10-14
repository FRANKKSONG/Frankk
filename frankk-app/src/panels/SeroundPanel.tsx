import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { Table, TaskRows } from '../components/TaskTable';
import { NewTaskForm } from '../components/NewTaskForm';
import { ColumnsMenu } from '../components/ColumnsMenu';
import { Dropdown } from '../components/Dropdown';
import { Popover } from '../components/Popover';
import { Editable } from '../components/Editable';
import { Icon } from '../components/Icons';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { useColumns, type ColDef } from '../hooks/useColumns';
import { usePersistentState } from '../hooks/usePersistentState';

export const SEROUND_COLS: ColDef[] = [
  { id: 'title', label: 'Task', width: 104, min: 60 },
  { id: 'progress', label: 'Progress', width: 62, min: 44 },
  { id: 'plan', label: 'Plan', width: 58, min: 40, defaultHidden: true },
  { id: 'due', label: 'Due', width: 50, min: 40 },
  { id: 'workstream', label: 'Workstream', width: 86, min: 50, defaultHidden: true },
  { id: 'priority', label: 'Priority', width: 64, min: 48, defaultHidden: true },
];

export function SeroundPanel({ focused }: { focused: boolean }) {
  const { data, dispatch } = useStore();
  const { say } = useUi();
  const cols = useColumns('seround', SEROUND_COLS);
  const [prefs, setPrefs] = usePersistentState<{ brand: string; showDone: boolean; collapsed: string[] }>('prefs.seround', { brand: 'all', showDone: true, collapsed: [] });
  const [adding, setAdding] = useState(false);
  const [newBrand, setNewBrand] = useState('');

  const brand = prefs.brand === 'all' || data.brands.includes(prefs.brand) ? prefs.brand : 'all';
  const groups = useMemo(() => data.brands
    .filter((b) => brand === 'all' || brand === b)
    .map((b) => ({ brand: b, tasks: data.tasks.filter((t) => t.area === 'seround' && t.brand === b && (prefs.showDone || !t.done)) })),
  [data.tasks, data.brands, brand, prefs.showDone]);

  const brandOptions = [{ id: 'all', label: 'All brands' }, ...data.brands.map((b) => ({ id: b, label: b }))];
  const addBrand = () => {
    if (!newBrand.trim()) return;
    dispatch({ type: 'brand/add', name: newBrand });
    say(`Brand “${newBrand.trim()}” added.`, true);
    setNewBrand('');
  };

  return (
    <Panel area="seround" title="Seround" icon="seround" focused={focused} onAdd={() => setAdding(true)} addLabel="New brand task"
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
      footer={adding ? undefined : <button className="foot-add" onClick={() => setAdding(true)}><Icon name="plus" size={13} /> Brand task</button>}>
      <Table cols={cols} label="Seround tasks">
        {groups.map((g) => {
          const closed = prefs.collapsed.includes(g.brand);
          return (
            <div key={g.brand} className="group">
              <div className="group-head">
                <button className="chev-btn" aria-expanded={!closed} aria-label={`${closed ? 'Expand' : 'Collapse'} ${g.brand}`}
                  onClick={() => setPrefs((p) => ({ ...p, collapsed: closed ? p.collapsed.filter((x) => x !== g.brand) : [...p.collapsed, g.brand] }))}>
                  <Icon name="chevron" size={12} style={{ transform: closed ? 'rotate(-90deg)' : undefined }} />
                </button>
                <Editable label="Brand name" value={g.brand} lang={g.brand.startsWith('sundey') ? 'lo' : undefined}
                  onSave={(v) => { dispatch({ type: 'brand/rename', from: g.brand, to: v }); say(`Renamed to “${v.trim()}”.`, true); }} />
                <span className="count">{g.tasks.filter((t) => !t.done).length} open</span>
              </div>
              {!closed && <TaskRows tasks={g.tasks} cols={cols} manual empty="No tasks for this brand." />}
            </div>
          );
        })}
      </Table>
      {adding && <NewTaskForm area="seround" brand={brand === 'all' ? undefined : brand} onDone={() => setAdding(false)} />}
    </Panel>
  );
}
