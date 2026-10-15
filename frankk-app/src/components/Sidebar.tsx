import { Icon, type IconName } from './Icons';
import { useUi, type Page } from '../ui';
import { ArchEmblem, Drollery } from './Ornaments';
import type { Area } from '../data/types';

const NAV: { id: string; label: string; icon: IconName; page: Page; area?: Area; sub?: boolean }[] = [
  { id: 'home', label: 'Home', icon: 'home', page: 'home' },
  { id: 'tasks', label: 'Tasks', icon: 'tasks', page: 'tasks' },
  { id: 'general', label: 'General', icon: 'check', page: 'tasks', area: 'general', sub: true },
  { id: 'music', label: 'Music', icon: 'music', page: 'tasks', area: 'music', sub: true },
  { id: 'seround', label: 'Seround', icon: 'seround', page: 'tasks', area: 'seround', sub: true },
  { id: 'house', label: 'House', icon: 'house', page: 'tasks', area: 'house', sub: true },
  { id: 'notes', label: 'Notes', icon: 'note', page: 'notes' },
  { id: 'library', label: 'Library', icon: 'library2', page: 'library' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', page: 'calendar' },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { focusArea, setFocusArea, page, go } = useUi();
  const active = (n: (typeof NAV)[number]) => (n.area ? page === 'tasks' && focusArea === n.area : n.id === 'tasks' ? page === 'tasks' && !focusArea : page === n.page);
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand"><ArchEmblem /><div className="wordmark" aria-label="Esther">Esther</div></div>
      <ul>
        {NAV.map((n) => (
          <li key={n.id} className={n.sub ? 'sub' : ''}>
            <button className={active(n) ? 'active' : ''} aria-current={active(n) ? 'page' : undefined} title={n.label}
              onClick={() => { go(n.page); setFocusArea(n.area ?? null); }}>
              <Icon name={n.icon} size={n.sub ? 15 : 18} /><span>{n.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar-foot">
        <Drollery className="side-drollery" />
        <div className="vault-box">
          <div className="vault-name"><Icon name="folder" size={16} /><span><small>Obsidian vault</small><b>Sample data</b></span></div>
          <button className="btn small" onClick={() => go('settings')} title="See Vault & storage in Settings">Not connected</button>
        </div>
        <span className="build-tag" title="Esther build number">Esther build {__ESTHER_BUILD__}</span>
        <button className={page === 'settings' ? 'active' : ''} onClick={() => go('settings')} title="Settings"><Icon name="settings" size={18} /><span>Settings</span></button>
        <button className="nav-toggle" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} title={`${collapsed ? 'Expand' : 'Collapse'} menu (Ctrl+\\)`}>
          <Icon name="chevronR" size={16} style={{ transform: collapsed ? undefined : 'rotate(180deg)' }} /><span>Collapse</span>
        </button>
      </div>
    </nav>
  );
}
