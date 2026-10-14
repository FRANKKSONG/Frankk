import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { Table, TaskRows } from '../components/TaskTable';
import { Editable } from '../components/Editable';
import { NewTaskForm } from '../components/NewTaskForm';
import { ColumnsMenu } from '../components/ColumnsMenu';
import { Dropdown } from '../components/Dropdown';
import { Popover } from '../components/Popover';
import { Icon } from '../components/Icons';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { useColumns, type ColDef, type Columns } from '../hooks/useColumns';
import { usePersistentState } from '../hooks/usePersistentState';
import { visibleOccurrences, type Occurrence } from '../lib/bills';
import { monthKey, monthName, relLabel, shortDate } from '../lib/dates';

export const HOUSE_COLS: ColDef[] = [
  { id: 'title', label: 'Task', width: 86, min: 60 },
  { id: 'progress', label: 'Status', width: 58, min: 44 },
  { id: 'plan', label: 'Plan', width: 52, min: 40, defaultHidden: true },
  { id: 'due', label: 'Due', width: 48, min: 40 },
  { id: 'priority', label: 'Priority', width: 64, min: 48, defaultHidden: true },
];

type View = 'both' | 'tasks' | 'bills';
const VIEWS: { id: View; label: string }[] = [{ id: 'both', label: 'Tasks & bills' }, { id: 'tasks', label: 'Tasks' }, { id: 'bills', label: 'Bills' }];

export function HousePanel({ focused }: { focused: boolean }) {
  const { data, today } = useStore();
  const cols = useColumns('house', HOUSE_COLS);
  const [view, setView] = usePersistentState<{ v: View }>('prefs.house', { v: 'both' });
  const [adding, setAdding] = useState<null | 'task' | 'bill'>(null);

  const occurrences = useMemo(
    () => data.bills.flatMap((b) => visibleOccurrences(b, today)).sort((a, b) => a.due.localeCompare(b.due)),
    [data.bills, today],
  );
  const tasks = data.tasks.filter((t) => t.area === 'house');

  return (
    <Panel area="house" title="House" icon="house" focused={focused} onAdd={() => setAdding('task')} addLabel="New household task or bill"
      menu={(close) => <ColumnsMenu defs={HOUSE_COLS} cols={cols} close={close} />}
      toolbar={<Dropdown ariaLabel="Show" value={view.v} options={VIEWS} onChange={(v) => setView({ v })} />}
      footer={adding ? undefined : <button className="foot-add" onClick={() => setAdding('task')}><Icon name="plus" size={14} /> Task or bill</button>}>
      <Table cols={cols} label="House tasks and bills">
        {view.v !== 'tasks' && (
          <div className="group">
            {view.v === 'both' && <div className="group-label">Bills</div>}
            {occurrences.length === 0 && <div className="empty">No bills yet.</div>}
            {occurrences.map((o) => <BillRow key={`${o.bill.id}${o.month}`} o={o} cols={cols} />)}
          </div>
        )}
        {view.v !== 'bills' && (
          <div className="group">
            {view.v === 'both' && <div className="group-label">Tasks</div>}
            <TaskRows tasks={tasks} cols={cols} manual empty="No household tasks yet." />
          </div>
        )}
      </Table>
      {adding && (
        <div>
          <div className="seg" role="tablist" aria-label="What to add">
            <button role="tab" aria-selected={adding === 'task'} onClick={() => setAdding('task')}>Task</button>
            <button role="tab" aria-selected={adding === 'bill'} onClick={() => setAdding('bill')}>Recurring bill</button>
          </div>
          {adding === 'task' ? <NewTaskForm area="house" onDone={() => setAdding(null)} /> : <NewBillForm onDone={() => setAdding(null)} />}
        </div>
      )}
    </Panel>
  );
}

function BillRow({ o, cols }: { o: Occurrence; cols: Columns }) {
  const { dispatch, today } = useStore();
  const { openNote, say } = useUi();
  const label = `${o.bill.title} (${monthName(o.month)})`;
  const status = o.paid ? 'paid' : o.missed ? 'missed' : 'unpaid';
  return (
    <div className={`task bill${o.paid ? ' is-done' : ''}`} data-bill={`${o.bill.id}:${o.month}`}>
      <div className="trow" style={{ gridTemplateColumns: cols.template }} role="row">
        <span />
        <label className="check no-drag">
          <input type="checkbox" checked={o.paid} aria-label={`${o.paid ? 'Mark unpaid' : 'Mark paid'}: ${label}`}
            onChange={() => { dispatch({ type: 'bill/pay', billId: o.bill.id, month: o.month, paid: !o.paid }); say(`${label} marked ${o.paid ? 'unpaid' : 'paid'}. Other months are unchanged.`); }} />
          <span className="box" />
        </label>
        {cols.visible.map((c) => {
          if (c.id === 'title') return (
            <div key={c.id} className="cell title-cell col">
              <span className="bill-name"><Editable className="task-title" label="Bill name" value={o.bill.title} onSave={(v) => dispatch({ type: 'bill/patch', billId: o.bill.id, patch: { title: v } })} />{o.month !== monthKey(today) && <em className="muted">· {monthName(o.month)}</em>}</span>
              <span className="sub" title={`Monthly · reminder ${o.bill.reminderDays === 0 ? 'on the day' : `${o.bill.reminderDays} days before`}`}><Icon name="bell" size={10} />{o.bill.reminderDays === 0 ? 'on the day' : `${o.bill.reminderDays}d before`} · monthly</span>
            </div>
          );
          if (c.id === 'progress') return <div key={c.id} className="cell"><span className={`pill ${status}`}>{o.paid ? '✓ Paid' : o.missed ? 'Missed' : 'Unpaid'}</span></div>;
          if (c.id === 'due') return <div key={c.id} className="cell"><span className={`date-static${o.missed ? ' overdue' : ''}`} title={shortDate(o.due, today)}>{relLabel(o.due, today)}</span></div>;
          return <div key={c.id} className="cell" />;
        })}
        <span />
        <Popover align="right" trigger={({ toggle, ref }) => (
          <button ref={ref} className="icon-btn tiny" aria-label={`Bill options for ${label}`} aria-haspopup="menu" onClick={toggle}><Icon name="more" size={14} /></button>
        )}>
          {(close) => (
            <div className="pop-form">
              <strong>{o.bill.title}</strong>
              <label>Due day each month
                <input type="number" min={1} max={31} defaultValue={o.bill.dueDay}
                  onBlur={(e) => dispatch({ type: 'bill/patch', billId: o.bill.id, patch: { dueDay: Number(e.target.value) } })} />
              </label>
              <label>Remind me
                <select value={o.bill.reminderDays} onChange={(e) => dispatch({ type: 'bill/update', billId: o.bill.id, patch: { reminderDays: Number(e.target.value) } })}>
                  {[0, 1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n === 0 ? 'On the day' : `${n} day${n > 1 ? 's' : ''} before`}</option>)}
                </select>
              </label>
              <p className="menu-note">Reminder timing is saved, but no notification is delivered in this prototype.</p>
              <label>Payment note ({monthName(o.month)})
                <input defaultValue={o.note ?? ''} placeholder="Reference or note (optional)"
                  onBlur={(e) => dispatch({ type: 'bill/update', billId: o.bill.id, patch: { note: { month: o.month, text: e.target.value } } })} />
              </label>
              <button role="menuitem" onClick={() => { close(); openNote(o.bill.notePath); }}><Icon name="external" size={13} /> Open in Obsidian</button>
            </div>
          )}
        </Popover>
      </div>
    </div>
  );
}

function NewBillForm({ onDone }: { onDone: () => void }) {
  const { dispatch, today } = useStore();
  const { say } = useUi();
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(1);
  const [remind, setRemind] = useState(2);
  const submit = () => {
    if (!title.trim()) return;
    dispatch({ type: 'bill/add', title, dueDay: day, reminderDays: remind, start: monthKey(today) });
    say('Recurring bill added (sample data). No amount is stored.');
    onDone();
  };
  return (
    <form className="new-form" onSubmit={(e) => { e.preventDefault(); submit(); }} onKeyDown={(e) => { if (e.key === 'Escape') onDone(); }}>
      <input autoFocus placeholder="Bill name (e.g. Gas bill)" aria-label="Bill name" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="form-row">
        <label>Due day each month<input type="number" min={1} max={31} value={day} onChange={(e) => setDay(Number(e.target.value))} /></label>
        <label>Remind<select value={remind} onChange={(e) => setRemind(Number(e.target.value))}>{[0, 1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n === 0 ? 'On the day' : `${n} days before`}</option>)}</select></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn primary" disabled={!title.trim()}>Save bill</button>
      </div>
    </form>
  );
}
