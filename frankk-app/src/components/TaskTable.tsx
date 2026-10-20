import { useMemo, useState } from 'react';
import { Icon } from './Icons';
import { Check } from './Check';
import { Select } from './Select';
import { DateChip } from './DateChip';
import { Editable } from './Editable';
import { SortableList } from './SortableList';
import { useContextMenu, type MenuItem } from './ContextMenu';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { usePersistentState } from '../hooks/usePersistentState';
import { newId, type Task } from '../data/model';
import { longToday, shortDate, type ISODate } from '../lib/dates';

type SortKey = 'manual' | 'title' | 'list' | 'subs' | 'date';
type Show = 'all' | 'open' | 'done';

/** Every task in one table: pick a list tab, sort by any column, filter open/done, open a row for its subtasks. */
export function TaskTable() {
  const { data, dispatch, today } = useStore();
  const { tab, day, setDay, openTaskId, setOpenTask } = useUi();
  const [sort, setSort] = usePersistentState<{ key: SortKey; dir: 1 | -1 }>('table.sort', { key: 'manual', dir: 1 });
  // Finished tasks stay in the list, crossed out, until they clear (see App); "All" is the normal view.
  const [show, setShow] = usePersistentState<Show>('table.view', 'all');
  const listName = (id: string) => data.lists.find((l) => l.id === id)?.name ?? '';
  const listIndex = (id: string) => data.lists.findIndex((l) => l.id === id);
  const allTab = tab === 'all' || !data.lists.some((l) => l.id === tab);
  const listId = allTab ? null : tab;

  const rows = useMemo(() => {
    const r = data.tasks.filter((t) => (!listId || t.listId === listId) && (!day || t.date === day) && (show === 'all' || (show === 'done') === t.done));
    if (sort.key === 'manual') return r;
    const val = (t: Task): string | number => sort.key === 'title' ? t.title.toLowerCase() : sort.key === 'list' ? listIndex(t.listId)
      : sort.key === 'subs' ? (t.subtasks.length ? t.subtasks.filter((s) => s.done).length / t.subtasks.length : -1) : (t.date ?? '9999');
    return [...r].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir);
  }, [data, listId, day, show, sort]);

  const head = (key: SortKey, label: string, cls = '') => (
    <button className={`th ${cls}${sort.key === key ? ' sorted' : ''}`} role="columnheader" aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
      onClick={() => setSort((s) => (s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : { key: 'manual', dir: 1 }))}>
      {label}{sort.key === key && <Icon name={sort.dir === 1 ? 'up' : 'down'} size={11} />}
    </button>
  );
  const counts = { open: 0, done: 0 };
  for (const t of data.tasks) if (!listId || t.listId === listId) counts[t.done ? 'done' : 'open']++;

  return (
    <section className={`card table-card${allTab ? ' all' : ''}`} aria-label="Tasks">
      <div className="table-tools">
        <div className="seg" role="radiogroup" aria-label="Show">
          {(['all', 'open', 'done'] as Show[]).map((s) => (
            <button key={s} role="radio" aria-checked={show === s} onClick={() => setShow(s)}>
              {s === 'open' ? 'To do' : s === 'done' ? 'Done' : 'All'}<small>{s === 'all' ? counts.open + counts.done : counts[s]}</small>
            </button>
          ))}
        </div>
        {day && <span className="filter-chip">{day === today ? 'Today' : longToday(day)}<button className="icon-btn tiny" aria-label="Show every day" onClick={() => setDay(null)}><Icon name="close" size={11} /></button></span>}
        {sort.key !== 'manual' && <button className="link-btn" onClick={() => setSort({ key: 'manual', dir: 1 })}>Back to my order</button>}
      </div>
      <div className="table" role="table" aria-label="Tasks">
        <div className="tr thead" role="row">
          <span /><span />
          {head('title', 'Task')}
          {allTab && head('list', 'List')}
          {head('subs', 'Subtasks', 'num')}
          {head('date', 'Date')}
        </div>
        <AddRow listId={listId} day={day} />
        {rows.length ? (
          <SortableList items={rows} disabled={sort.key !== 'manual'} label={(t) => t.title} onMove={(_a, _b, order) => dispatch({ type: 'task/order', ids: order })}>
            {(t, grip) => <Row task={t} grip={grip} showList={allTab} open={openTaskId === t.id} onOpen={(o) => setOpenTask(o ? t.id : null)} listName={listName(t.listId)} />}
          </SortableList>
        ) : (
          <p className="quiet empty-note">{show === 'done' ? 'Nothing finished here yet.' : day ? `Nothing on ${shortDate(day, today)}.` : 'Nothing to do here. Add a task above.'}</p>
        )}
      </div>
      <p className="hint">Click a column to sort · drag ⠿ to reorder · right-click a row for more · Ctrl+Z undoes</p>
    </section>
  );
}

function AddRow({ listId, day }: { listId: string | null; day: ISODate | null }) {
  const { data, dispatch, today } = useStore();
  const [text, setText] = useState('');
  const [date, setDate] = useState<ISODate | undefined>();
  const [pick, setPick] = useState(data.lists[0]?.id);
  const target = listId ?? (data.lists.some((l) => l.id === pick) ? pick : data.lists[0]?.id);
  const when = date ?? day ?? undefined;
  const add = () => {
    if (!text.trim() || !target) return;
    dispatch({ type: 'task/add', task: { id: newId('t'), listId: target, title: text, date: when } });
    setText(''); setDate(undefined);
  };
  return (
    <form className="tr add-row" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <span /><Icon name="plus" size={14} />
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task, Enter" aria-label="Add a task" />
      {!listId && (
        <Select className="list-pick" label="List for the new task" value={target ?? ''} onChange={setPick} options={data.lists.map((l) => ({ value: l.id, label: l.name, dot: l.color }))} />
      )}
      <span />
      <DateChip value={when} today={today} label="Date of the new task" onChange={setDate} />
    </form>
  );
}

/** "clears in 6 days" / "clears today". */
function clearsIn(doneAt: string, days: number): string {
  const left = Math.ceil((new Date(doneAt).getTime() + days * 86_400_000 - Date.now()) / 86_400_000);
  return left <= 0 ? 'clears soon' : left === 1 ? 'clears tomorrow' : `clears in ${left} days`;
}

function Row({ task, grip, showList, open, onOpen, listName }: { task: Task; grip: React.ReactNode; showList: boolean; open: boolean; onOpen: (o: boolean) => void; listName: string }) {
  const { data, dispatch, today } = useStore();
  const [clearAfter] = usePersistentState<number>('clearAfter', 7);
  const { say } = useUi();
  const menu = useContextMenu();
  const list = data.lists.find((l) => l.id === task.listId);
  const subsDone = task.subtasks.filter((s) => s.done).length;
  const items: MenuItem[] = [
    { label: open ? 'Hide subtasks' : 'Show subtasks', icon: 'list', onClick: () => onOpen(!open) },
    ...data.lists.filter((l) => l.id !== task.listId).map((l, i) => ({ label: `Move to ${l.name}`, icon: 'folder' as const, sep: i === 0, onClick: () => { dispatch({ type: 'task/update', id: task.id, patch: { listId: l.id } }); say(`Moved to ${l.name}.`, true); } })),
    ...(task.date ? [{ label: 'Remove date', icon: 'calendar' as const, sep: true, onClick: () => dispatch({ type: 'task/update', id: task.id, patch: { date: undefined } }) }] : []),
    { label: 'Delete task', icon: 'trash', danger: true, sep: true, onClick: () => { dispatch({ type: 'task/remove', id: task.id }); say(`Deleted “${task.title}”.`, true); } },
  ];
  return (
    <div className={`task${task.done ? ' done' : ''}${open ? ' open' : ''}`} data-task={task.id} role="rowgroup">
      <div className="tr" role="row" onContextMenu={(e) => menu(e, items)}>
        {grip}
        <Check checked={task.done} label={`${task.done ? 'Reopen' : 'Complete'} ${task.title}`} onChange={() => dispatch({ type: 'task/toggle', id: task.id })} />
        <span className="td title-cell" role="cell">
          <button className="expand" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} subtasks of ${task.title}`} onClick={() => onOpen(!open)}>
            <Icon name="chevronR" size={12} style={{ transform: open ? 'rotate(90deg)' : undefined }} />
          </button>
          <Editable className="task-title" label="Task name" value={task.title} onSave={(v) => dispatch({ type: 'task/update', id: task.id, patch: { title: v } })} />
          {task.done && clearAfter > 0 && task.doneAt && <span className="clears">{clearsIn(task.doneAt, clearAfter)}</span>}
        </span>
        {showList && (
          <span className="td" role="cell">
            <Select label={`List of ${task.title}`} value={task.listId} onChange={(listId) => dispatch({ type: 'task/update', id: task.id, patch: { listId } })}
              options={data.lists.map((l) => ({ value: l.id, label: l.name, dot: l.color }))}
              trigger={() => <span className="list-pill" style={{ '--lc': list?.color } as React.CSSProperties}><i className="dot" style={{ background: list?.color }} /><span>{listName}</span></span>} />
          </span>
        )}
        <span className="td num" role="cell">
          <button className={`subs-btn${task.subtasks.length ? '' : ' none'}`} aria-label={`Subtasks of ${task.title}: ${subsDone} of ${task.subtasks.length} done`} onClick={() => onOpen(!open)}>
            {task.subtasks.length ? <><span className="bar"><i style={{ width: `${(subsDone / task.subtasks.length) * 100}%` }} /></span>{subsDone}/{task.subtasks.length}</> : '—'}
          </button>
        </span>
        <span className="td" role="cell"><DateChip value={task.date} today={today} label={`Date of ${task.title}`} onChange={(date) => dispatch({ type: 'task/update', id: task.id, patch: { date } })} /></span>
      </div>
      {open && <Subtasks task={task} />}
    </div>
  );
}

function Subtasks({ task }: { task: Task }) {
  const { dispatch } = useStore();
  const { say } = useUi();
  const menu = useContextMenu();
  const [text, setText] = useState('');
  return (
    <div className="subtasks">
      <SortableList items={task.subtasks} label={(s) => s.text} onMove={(_a, _b, order) => dispatch({ type: 'sub/order', taskId: task.id, ids: order })}>
        {(s, grip) => (
          <div className={`sub${s.done ? ' done' : ''}`} onContextMenu={(e) => menu(e, [
            { label: 'Delete subtask', icon: 'trash', danger: true, onClick: () => { dispatch({ type: 'sub/remove', taskId: task.id, subId: s.id }); say(`Deleted “${s.text}”.`, true); } },
          ])}>
            {grip}
            <Check checked={s.done} label={`${s.done ? 'Reopen' : 'Complete'} ${s.text}`} onChange={() => dispatch({ type: 'sub/toggle', taskId: task.id, subId: s.id })} />
            <Editable className="sub-text" label="Subtask" value={s.text} onSave={(v) => dispatch({ type: 'sub/update', taskId: task.id, subId: s.id, text: v })} />
          </div>
        )}
      </SortableList>
      <form className="sub add" onSubmit={(e) => { e.preventDefault(); dispatch({ type: 'sub/add', taskId: task.id, text }); setText(''); }}>
        <Icon name="plus" size={12} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a subtask, Enter" aria-label={`Add a subtask to ${task.title}`} />
      </form>
    </div>
  );
}
