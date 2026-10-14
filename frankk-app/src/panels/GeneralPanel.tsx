import { useMemo } from 'react';
import { Panel } from '../components/Panel';
import { Table, TaskRows } from '../components/TaskTable';
import { useUi } from '../ui';
import { ColumnsMenu } from '../components/ColumnsMenu';
import { Dropdown } from '../components/Dropdown';
import { Icon } from '../components/Icons';
import { useStore } from '../data/store';
import { useColumns, type ColDef } from '../hooks/useColumns';
import { usePersistentState } from '../hooks/usePersistentState';
import { FILTERS, SORTS, applyFilter, applySort, type Filter, type SortKey } from '../lib/tasks';

export const GENERAL_COLS: ColDef[] = [
  { id: 'title', label: 'To-do', width: 118, min: 60 },
  { id: 'progress', label: 'Progress', width: 60, min: 40 },
  { id: 'plan', label: 'Plan', width: 56, min: 40 },
  { id: 'due', label: 'Due', width: 64, min: 40 },
  { id: 'priority', label: 'Priority', width: 64, min: 48, defaultHidden: true },
  { id: 'list', label: 'List', width: 80, min: 40, defaultHidden: true },
];

export function GeneralPanel({ focused }: { focused: boolean }) {
  const { data, today } = useStore();
  const cols = useColumns('general', GENERAL_COLS);
  const [prefs, setPrefs] = usePersistentState<{ filter: Filter; sort: SortKey }>('prefs.general', { filter: 'all', sort: 'manual' });
  const { setNewTask, tagFilter } = useUi();

  const rows = useMemo(
    () => applySort(applyFilter(data.tasks.filter((t) => t.area === 'general' && (!tagFilter || t.tags.includes(tagFilter))), prefs.filter, today), prefs.sort),
    [data.tasks, prefs, today, tagFilter],
  );

  return (
    <Panel area="general" title="General" icon="tasks" focused={focused} onAdd={() => setNewTask({ area: 'general' })} addLabel="New General task"
      menu={(close) => <ColumnsMenu defs={GENERAL_COLS} cols={cols} close={close} />}
      toolbar={<>
        <Dropdown ariaLabel="Filter tasks" value={prefs.filter} options={FILTERS} onChange={(filter) => setPrefs((p) => ({ ...p, filter }))} icon="filter" />
        <Dropdown ariaLabel="Sort tasks" value={prefs.sort} options={SORTS} onChange={(sort) => setPrefs((p) => ({ ...p, sort }))} icon="sort" />
      </>}
      footer={<button className="foot-add" onClick={() => setNewTask({ area: 'general' })}><Icon name="plus" size={14} /> New task</button>}>
      <Table cols={cols} label="General tasks">
        <TaskRows tasks={rows} cols={cols} manual={prefs.sort === 'manual' && prefs.filter === 'all' && !tagFilter}
          empty={prefs.filter === 'all' ? 'No tasks yet. Add one with + New task.' : 'No tasks match this filter.'} />
      </Table>
      {prefs.sort === 'manual' && prefs.filter !== 'all' && <p className="hint">Reordering works on the full list: switch the filter to “All tasks”.</p>}
    </Panel>
  );
}
