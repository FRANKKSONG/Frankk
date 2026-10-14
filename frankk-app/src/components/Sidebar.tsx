import { Icon, type IconName } from './Icons';
import { useUi } from '../ui';
import type { Area } from '../data/types';

export type View = 'home' | 'library' | 'calendar' | 'settings';

const NAV: { id: string; label: string; icon: IconName; area?: Area; view?: View }[] = [
  { id: 'home', label: 'Home', icon: 'home', view: 'home' },
  { id: 'tasks', label: 'Tasks', icon: 'tasks', area: 'general' },
  { id: 'music', label: 'Music', icon: 'music', area: 'music' },
  { id: 'seround', label: 'Seround', icon: 'seround', area: 'seround' },
  { id: 'house', label: 'House', icon: 'house', area: 'house' },
  { id: 'library', label: 'Library', icon: 'library', view: 'library' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', view: 'calendar' },
];

export function Sidebar({ view, setView }: { view: View; setView: (v: View) => void }) {
  const { focusArea, setFocusArea } = useUi();
  const active = (n: (typeof NAV)[number]) => (n.area ? view === 'home' && focusArea === n.area : n.id === 'home' ? view === 'home' && !focusArea : view === n.view);
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="wordmark" aria-label="FRANKK">FRANKK</div>
      <ul>
        {NAV.map((n) => (
          <li key={n.id}>
            <button className={active(n) ? 'active' : ''} aria-current={active(n) ? 'page' : undefined} title={n.label}
              onClick={() => { setView('home'); if (n.area) setFocusArea(n.area); else { setFocusArea(null); if (n.view) setView(n.view); } }}>
              <Icon name={n.icon} size={18} /><span>{n.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar-foot">
        <div className="vault-box">
          <div className="vault-name"><Icon name="folder" size={16} /><span><small>Obsidian vault</small><b>Sample data</b></span></div>
          <button className="btn small" disabled title="Not connected: the real vault is connected in Milestone 2 (read-only)">Not connected</button>
        </div>
        <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')} title="Settings"><Icon name="settings" size={18} /><span>Settings</span></button>
        <p className="tiny">Local notes · Yours to keep</p>
      </div>
    </nav>
  );
}
