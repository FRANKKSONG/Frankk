import { Icon } from './Icons';
import { ArchEmblem } from './Ornaments';
import { useUi } from '../ui';
import { useStore } from '../data/store';
import { newId, nextColor } from '../data/model';
import { SortableList } from './SortableList';

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { page, go, listId } = useUi();
  const { data, dispatch } = useStore();
  const current = listId ?? data.lists[0]?.id;
  const addList = () => {
    const id = newId('l');
    dispatch({ type: 'list/add', list: { id, name: 'New list', color: nextColor(data.lists) } });
    go('tasks', { listId: id });
  };
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand"><ArchEmblem /><div className="wordmark" aria-label="Esther">Esther</div></div>
      <ul className="nav">
        <li><button className={page === 'home' ? 'active' : ''} aria-current={page === 'home' ? 'page' : undefined} onClick={() => go('home')} title="Home"><Icon name="home" size={18} /><span>Home</span></button></li>
      </ul>
      <div className="nav-label"><span>Lists</span><button className="icon-btn tiny" aria-label="New list" title="New list" onClick={addList}><Icon name="plus" size={13} /></button></div>
      <div className="nav-lists">
        <SortableList items={data.lists} label={(l) => l.name} onMove={(_a, _b, order) => dispatch({ type: 'list/order', ids: order })}>
          {(l, grip) => {
            const open = data.tasks.filter((t) => t.listId === l.id && !t.done).length;
            const on = page === 'tasks' && current === l.id;
            return (
              <div className={`nav-list${on ? ' active' : ''}`}>
                {!collapsed && grip}
                <button className="nav-item" aria-current={on ? 'page' : undefined} title={l.name} onClick={() => go('tasks', { listId: l.id })}>
                  <i className="dot" style={{ background: l.color }} /><span>{l.name}</span>{open > 0 && <small>{open}</small>}
                </button>
              </div>
            );
          }}
        </SortableList>
      </div>
      <div className="sidebar-foot">
        <span className="build-tag" title="Esther build number">Esther {__ESTHER_BUILD__}</span>
        <button className={page === 'settings' ? 'active' : ''} onClick={() => go('settings')} title="Settings"><Icon name="settings" size={18} /><span>Settings</span></button>
        <button className="nav-toggle" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} title={`${collapsed ? 'Expand' : 'Collapse'} menu (Ctrl+\\)`}>
          <Icon name="chevronR" size={16} style={{ transform: collapsed ? undefined : 'rotate(180deg)' }} /><span>Collapse</span>
        </button>
      </div>
    </nav>
  );
}
