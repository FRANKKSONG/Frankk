import { useState } from 'react';
import { Icon } from './Icons';
import { SortableList } from './SortableList';
import { useContextMenu } from './ContextMenu';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { newId, nextColor, PIGMENTS } from '../data/model';

/** Lists as tabs across the top of the table. Double-click a tab to rename it; right-click for colour and delete. */
export function ListTabs() {
  const { data, dispatch } = useStore();
  const { tab, setTab, setOpenTask, say } = useUi();
  const menu = useContextMenu();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const openCount = (id?: string) => data.tasks.filter((t) => !t.done && (!id || t.listId === id)).length;
  const pick = (t: string) => { setTab(t); setOpenTask(null); setConfirm(null); };
  const addList = () => {
    const id = newId('l');
    dispatch({ type: 'list/add', list: { id, name: 'New list', color: nextColor(data.lists) } });
    pick(id);
    setRenaming(id);
  };
  const doomed = data.lists.find((l) => l.id === confirm);
  const others = data.lists.filter((l) => l.id !== confirm);
  const count = data.tasks.filter((t) => t.listId === confirm).length;
  const remove = (keep: boolean) => {
    if (!doomed) return;
    dispatch({ type: 'list/remove', id: doomed.id, moveTo: keep ? others[0].id : undefined });
    say(keep && count ? `Deleted “${doomed.name}”. Its tasks moved to ${others[0].name}.` : `Deleted “${doomed.name}”.`, true);
    setConfirm(null);
    if (tab === doomed.id) setTab('all');
  };
  return (
    <div className="tabs-wrap">
      <div className="tabs" role="tablist" aria-label="Lists">
        <button role="tab" aria-selected={tab === 'all'} className="tab" onClick={() => pick('all')}>All<small>{openCount()}</small></button>
        <SortableList grid className="tab-sort" items={data.lists} label={(l) => l.name} onMove={(_a, _b, order) => dispatch({ type: 'list/order', ids: order })}>
          {(l, grip) => renaming === l.id ? (
            <input className="tab tab-edit" autoFocus defaultValue={l.name} aria-label="List name" onFocus={(e) => e.target.select()}
              onBlur={(e) => { if (e.target.value.trim()) dispatch({ type: 'list/update', id: l.id, patch: { name: e.target.value.trim() } }); setRenaming(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = l.name; e.currentTarget.blur(); } }} />
          ) : (
            <span className="tab-item">
              {grip}
              <button role="tab" aria-selected={tab === l.id} className="tab" title="Double-click to rename · right-click for more"
                onClick={() => pick(l.id)} onDoubleClick={() => setRenaming(l.id)}
                onContextMenu={(e) => menu(e, [
                  { label: 'Rename', icon: 'pencil', onClick: () => setRenaming(l.id) },
                  ...PIGMENTS.slice(0, 8).map((p, i) => ({ label: `Colour: ${p.name}`, icon: 'palette' as const, sep: i === 0, onClick: () => dispatch({ type: 'list/update', id: l.id, patch: { color: p.color } }) })),
                  { label: 'Delete list…', icon: 'trash', danger: true, sep: true, disabled: data.lists.length < 2, onClick: () => setConfirm(l.id) },
                ])}>
                <i className="dot" style={{ background: l.color }} />{l.name}<small>{openCount(l.id)}</small>
              </button>
            </span>
          )}
        </SortableList>
        <button className="tab tab-add" aria-label="New list" title="New list" onClick={addList}><Icon name="plus" size={13} /></button>
      </div>
      {doomed && (
        <div className="confirm" role="alertdialog" aria-label={`Delete ${doomed.name}`}>
          <span>Delete the list “{doomed.name}”?{count ? ` It has ${count} task${count === 1 ? '' : 's'}.` : ''}</span>
          {count > 0 && <button className="btn" onClick={() => remove(true)}>Move tasks to {others[0].name}</button>}
          <button className="btn danger" onClick={() => remove(false)}>{count ? 'Delete with its tasks' : 'Delete list'}</button>
          <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
