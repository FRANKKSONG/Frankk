import { useState } from 'react';
import { Icon } from './Icons';
import { DateChip } from './DateChip';
import { useStore } from '../data/store';
import { newId } from '../data/model';
import type { ISODate } from '../lib/dates';

/** Type a task and press Enter. On Home you also choose its list; on a list it goes there. */
export function AddTask({ listId, date, pickList, placeholder = 'Add a task, Enter', autoFocus }: { listId?: string; date?: ISODate; pickList?: boolean; placeholder?: string; autoFocus?: boolean }) {
  const { data, dispatch, today } = useStore();
  const [text, setText] = useState('');
  const [day, setDay] = useState<ISODate | undefined>(date);
  const [list, setList] = useState(listId ?? data.lists[0]?.id);
  const target = data.lists.some((l) => l.id === list) ? list : data.lists[0]?.id;
  const add = () => {
    if (!text.trim() || !target) return;
    dispatch({ type: 'task/add', task: { id: newId('t'), listId: target, title: text, date: date ?? day } });
    setText('');
  };
  return (
    <form className="add-task" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <Icon name="plus" size={14} />
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoFocus={autoFocus} />
      {pickList && data.lists.length > 1 && (
        <select className="list-pick" aria-label="List" value={target} onChange={(e) => setList(e.target.value)}>
          {data.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      )}
      {!date && <DateChip value={day} today={today} label="Date of the new task" onChange={setDay} />}
    </form>
  );
}
