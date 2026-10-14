import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { TableHeader, TaskRows } from '../components/TaskTable';
import { NewTaskForm } from '../components/NewTaskForm';
import { ColumnsMenu } from '../components/ColumnsMenu';
import { Dropdown } from '../components/Dropdown';
import { Popover } from '../components/Popover';
import { Icon } from '../components/Icons';
import { useStore } from '../data/store';
import { useColumns, type ColDef } from '../hooks/useColumns';
import { usePersistentState } from '../hooks/usePersistentState';
import { BRANDS } from '../data/types';

export const SEROUND_COLS: ColDef[] = [
  { id: 'title', label: 'Task', width: 90, min: 80 },
  { id: 'progress', label: 'Progress', width: 66, min: 56 },
  { id: 'plan', label: 'Plan', width: 62, min: 52, defaultHidden: true },
  { id: 'due', label: 'Due', width: 62, min: 52 },
];

export function SeroundPanel({ focused }: { focused: boolean }) {
  const { data } = useStore();
  const cols = useColumns('seround', SEROUND_COLS);
  const [prefs, setPrefs] = usePersistentState<{ brand: string; showDone: boolean; collapsed: string[] }>('prefs.seround', { brand: 'all', showDone: true, collapsed: [] });
  const [adding, setAdding] = useState(false);

  const groups = useMemo(() => BRANDS
    .filter((b) => prefs.brand === 'all' || prefs.brand === b)
    .map((b) => ({ brand: b, tasks: data.tasks.filter((t) => t.area === 'seround' && t.brand === b && (prefs.showDone || !t.done)) })),
  [data.tasks, prefs.brand, prefs.showDone]);

  const brandOptions = [{ id: 'all', label: 'All brands' }, ...BRANDS.map((b) => ({ id: b, label: b }))];

  return (
    <Panel area="seround" title="Seround" icon="seround" focused={focused} onAdd={() => setAdding(true)} addLabel="New brand task"
      menu={(close) => (
        <>
          <label className="menu-check"><input type="checkbox" checked={prefs.showDone} onChange={() => setPrefs((p) => ({ ...p, showDone: !p.showDone }))} />Show completed</label>
          <ColumnsMenu defs={SEROUND_COLS} cols={cols} close={close} />
        </>
      )}
      toolbar={<>
        <Dropdown ariaLabel="Filter by brand" value={prefs.brand} options={brandOptions} onChange={(brand) => setPrefs((p) => ({ ...p, brand }))} />
        <Popover align="right" trigger={({ toggle, ref }) => (
          <button ref={ref} className="chip-btn" onClick={toggle}><Icon name="calendar" size={14} /> Office calendar</button>
        )}>
          {() => (
            <div className="pop-info">
              <strong>Not connected</strong>
              <p>The office Google Calendar hasn’t been chosen or authorised yet (planned for Milestone 6). Calendar connections are separate from vault sync, and this app never exports a task that TaskNotes already exports.</p>
            </div>
          )}
        </Popover>
      </>}
      footer={adding ? undefined : <button className="foot-add" onClick={() => setAdding(true)}><Icon name="plus" size={14} /> Brand task</button>}>
      <div className="table" role="table" aria-label="Seround tasks">
        <TableHeader cols={cols} />
        {groups.map((g) => {
          const closed = prefs.collapsed.includes(g.brand);
          return (
            <div key={g.brand} className="group">
              <button className="group-head" aria-expanded={!closed}
                onClick={() => setPrefs((p) => ({ ...p, collapsed: closed ? p.collapsed.filter((x) => x !== g.brand) : [...p.collapsed, g.brand] }))}>
                <Icon name="chevron" size={13} style={{ transform: closed ? 'rotate(-90deg)' : undefined }} />
                <span lang={g.brand.startsWith('sundey') ? 'lo' : undefined}>{g.brand}</span>
                <span className="count">{g.tasks.filter((t) => !t.done).length} open</span>
              </button>
              {!closed && <TaskRows tasks={g.tasks} cols={cols} manual empty="No tasks for this brand." />}
            </div>
          );
        })}
      </div>
      {adding && <NewTaskForm area="seround" brand={prefs.brand === 'all' ? undefined : prefs.brand} onDone={() => setAdding(false)} />}
    </Panel>
  );
}
