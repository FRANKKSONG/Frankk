import { useEffect, useState } from 'react';
import { ArchEmblem, Initial } from './components/Ornaments';
import { ListTabs } from './components/ListTabs';
import { TaskTable } from './components/TaskTable';
import { MonthCalendar, ThisWeek } from './components/Side';
import { SettingsMenu } from './components/SettingsMenu';
import { ResizeGrip } from './components/DesktopBits';
import { Icon } from './components/Icons';
import { desktop, prettyKeys } from './lib/desktop';
import { applyTheme, DEFAULT_THEME, type ThemePrefs } from './lib/theme';
import { greeting, longToday } from './lib/dates';
import { lineFor } from './lib/greeting';
import { useUi } from './ui';
import { useStore } from './data/store';
import { usePersistentState } from './hooks/usePersistentState';

/** Esther on one page: greeting along the top, your lists as tabs over the task table, the month and this week beside it. */
export default function App() {
  const { toast, say } = useUi();
  const { undo, canUndo, today } = useStore();
  const [theme, setTheme] = usePersistentState<ThemePrefs>('theme.v3', DEFAULT_THEME);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = !!(e.target as HTMLElement).closest?.('input,select,textarea,[contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing && canUndo) { e.preventDefault(); undo(); say('Undone.'); }
      // On the desktop, Esc tucks Esther away (unless you're typing or a menu is open).
      else if (e.key === 'Escape' && desktop && !typing && !document.querySelector('.popover')) desktop.hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canUndo, undo, say]);
  const hello = greeting();
  const [shortcut, setShortcut] = useState('');
  useEffect(() => { if (!desktop) return; document.documentElement.dataset.desktop = '1'; desktop.state().then((s) => setShortcut(s.shortcut)); }, []);

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><ArchEmblem /><span className="wordmark" aria-label="Esther">Esther</span></div>
        <div className="greet">
          <h1><Initial letter={hello[0]} size={38} /><span>{hello}</span></h1>
          <p><span className="greet-date">{longToday(today)}</span><span className="greet-line">{lineFor(today)}</span></p>
        </div>
        <div className="top-actions">
          <SettingsMenu theme={theme} setTheme={setTheme} />
          {desktop && <button className="icon-btn" aria-label="Hide Esther" title={`Hide (Esc). ${shortcut ? prettyKeys(shortcut) + ' brings it back.' : ''}`} onClick={() => desktop!.hide()}><Icon name="close" size={16} /></button>}
        </div>
      </header>
      <main className="layout">
        <div className="main-col">
          <ListTabs />
          <TaskTable />
        </div>
        <aside className="side-col">
          <MonthCalendar />
          <ThisWeek />
        </aside>
      </main>
      <ResizeGrip />
      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
        {toast?.msg}
        {toast?.undo && canUndo && <button className="toast-undo" onClick={() => { undo(); say('Undone.'); }}>Undo</button>}
      </div>
    </div>
  );
}
