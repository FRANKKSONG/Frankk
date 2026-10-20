import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './pages/HomePage';
import { TasksPage } from './pages/TasksPage';
import { SettingsPage } from './pages/SettingsPage';
import { applyTheme, DEFAULT_THEME, type ThemePrefs } from './lib/theme';
import { useUi } from './ui';
import { useStore } from './data/store';
import { usePersistentState } from './hooks/usePersistentState';

export default function App() {
  const { page, toast, say } = useUi();
  const { undo, canUndo } = useStore();
  const [theme, setTheme] = usePersistentState<ThemePrefs>('theme.v3', DEFAULT_THEME);
  const [nav, setNav] = usePersistentState<{ collapsed: boolean }>('nav', { collapsed: false });
  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = !!(e.target as HTMLElement).closest?.('input,select,textarea,[contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); setNav((n) => ({ collapsed: !n.collapsed })); }
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing && canUndo) { e.preventDefault(); undo(); say('Undone.'); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canUndo, undo, say, setNav]);

  return (
    <div className={`app${nav.collapsed ? ' nav-collapsed' : ''}`}>
      <Sidebar collapsed={nav.collapsed} onToggle={() => setNav((n) => ({ collapsed: !n.collapsed }))} />
      <main className="main">
        {page === 'home' && <HomePage />}
        {page === 'tasks' && <TasksPage />}
        {page === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} />}
      </main>
      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
        {toast?.msg}
        {toast?.undo && canUndo && <button className="toast-undo" onClick={() => { undo(); say('Undone.'); }}>Undo</button>}
      </div>
    </div>
  );
}
