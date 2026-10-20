import { useEffect, useState } from 'react';
import { ArchEmblem, Initial } from './components/Ornaments';
import { ListTabs } from './components/ListTabs';
import { TaskTable } from './components/TaskTable';
import { MonthCalendar, ThisWeek } from './components/Side';
import { SettingsMenu, SettingsPanel } from './components/Settings';
import { ResizeGrip, UpdatePill } from './components/DesktopBits';
import { Icon } from './components/Icons';
import { card, desktop, prettyKeys } from './lib/desktop';
import { applyTheme, DEFAULT_THEME, type ThemePrefs } from './lib/theme';
import { greeting, longToday } from './lib/dates';
import { lineFor } from './lib/greeting';
import { useUi } from './ui';
import { useStore } from './data/store';
import { usePersistentState } from './hooks/usePersistentState';

/**
 * Esther. On the website: one page (greeting along the top, list tabs over the task table, the month and this week
 * beside it). In the desktop app each window is one card you place anywhere on the desktop: header, tasks, calendar,
 * week, and settings.
 */
export default function App() {
  const { toast, say } = useUi();
  const { undo, canUndo, dispatch } = useStore();
  const [theme, setTheme] = usePersistentState<ThemePrefs>('theme.v3', DEFAULT_THEME);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = !!(e.target as HTMLElement).closest?.('input,select,textarea,[contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing && canUndo) { e.preventDefault(); undo(); say('Undone.'); }
      // On the desktop, Esc tucks Esther away (or closes Settings), unless you're typing or a menu is open.
      else if (e.key === 'Escape' && desktop && !typing && !document.querySelector('.popover')) (card === 'settings' ? desktop.closeSettings() : desktop.hide());
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canUndo, undo, say]);
  // Finished tasks clear themselves after the time you chose (a week unless you change it).
  const [clearAfter] = usePersistentState<number>('clearAfter', 7);
  useEffect(() => {
    if (!clearAfter || (card && card !== 'tasks')) return;
    const run = () => dispatch({ type: 'task/clear-done', before: new Date(Date.now() - clearAfter * 86_400_000).toISOString() });
    run();
    const id = window.setInterval(run, 3_600_000);
    return () => window.clearInterval(id);
  }, [clearAfter, dispatch]);
  useEffect(() => {
    if (!desktop) return;
    const root = document.documentElement;
    root.dataset.desktop = '1';
    if (card) root.dataset.card = card;
    // Esther's own blur: the main process sends the wallpaper behind this screen and where the card sits on it,
    // and the CSS blurs that copy under the card, so only the card is frosted, never the desktop.
    let scale = 1, screen = { x: 0, y: 0 };
    const place = (x: number, y: number) => {
      root.style.setProperty('--wall-x', `${(screen.x - x) / scale}px`);
      root.style.setProperty('--wall-y', `${(screen.y - y) / scale}px`);
    };
    const offBackdrop = desktop.onBackdrop((b) => {
      scale = b.scale || 1; screen = b.screen;
      if (!b.image) { delete root.dataset.wall; return; }
      root.style.setProperty('--wall', `url("${b.image}")`);
      root.style.setProperty('--wall-w', `${b.screen.width / scale}px`);
      root.style.setProperty('--wall-h', `${b.screen.height / scale}px`);
      place(b.x, b.y);
      root.dataset.wall = '1';
    });
    const offPlace = desktop.onPlace((p) => { screen = p.screen; place(p.x, p.y); });
    // Esther's own appear effect, in place of Windows' window animations.
    const appear = () => { if (document.visibilityState === 'visible') { root.classList.remove('appear'); void root.offsetWidth; root.classList.add('appear'); } };
    document.addEventListener('visibilitychange', appear);
    appear();
    return () => { offBackdrop?.(); offPlace?.(); document.removeEventListener('visibilitychange', appear); };
  }, []);

  const body = (() => {
    switch (card) {
      case 'header': return <Top theme={theme} setTheme={setTheme} />;
      case 'tasks': return <section className="card tasks-card" aria-label="Tasks"><ListTabs /><TaskTable /></section>;
      case 'calendar': return <MonthCalendar />;
      case 'week': return <ThisWeek />;
      case 'settings': return (
        <section className="card settings-card" aria-label="Settings">
          <header className="card-head"><h2>Settings</h2><button className="icon-btn" aria-label="Close settings" onClick={() => desktop!.closeSettings()}><Icon name="close" size={16} /></button></header>
          <SettingsPanel theme={theme} setTheme={setTheme} />
        </section>
      );
      default: return (
        <>
          <Top theme={theme} setTheme={setTheme} />
          <main className="layout">
            <div className="main-col"><ListTabs /><TaskTable /></div>
            <aside className="side-col"><MonthCalendar /><ThisWeek /></aside>
          </main>
        </>
      );
    }
  })();

  return (
    <div className={`app${card ? ` card-${card}` : ''}`}>
      {body}
      {card !== 'header' && <ResizeGrip />}
      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
        {toast?.msg}
        {toast?.undo && canUndo && <button className="toast-undo" onClick={() => { undo(); say('Undone.'); }}>Undo</button>}
      </div>
    </div>
  );
}

/** Logo, greeting and the day's line; the gear and hide buttons. Double-click the logo to put every card back. */
function Top({ theme, setTheme }: { theme: ThemePrefs; setTheme: (t: ThemePrefs) => void }) {
  const { today } = useStore();
  const { say } = useUi();
  const hello = greeting();
  const [shortcut, setShortcut] = useState('');
  useEffect(() => { desktop?.state().then((s) => setShortcut(s.shortcut)); }, []);
  return (
    <header className="top">
      {desktop && <span className="move-grip" title="Drag to move" aria-hidden="true"><Icon name="grip" size={14} /></span>}
      <div className="brand" title={desktop ? 'Double-click to put every card back where it started' : undefined}
        onDoubleClick={() => { if (desktop) { desktop.resetLayout(); say('Cards are back in their places.'); } }}>
        <ArchEmblem /><span className="wordmark" aria-label="Esther">Esther</span>
      </div>
      <div className="greet">
        <h1><Initial letter={hello[0]} size={38} /><span>{hello}</span></h1>
        <p><span className="greet-date">{longToday(today)}</span><span className="greet-line">{lineFor(today)}</span></p>
      </div>
      <div className="top-actions">
        <UpdatePill />
        <SettingsMenu theme={theme} setTheme={setTheme} />
        {desktop && <button className="icon-btn" aria-label="Hide Esther" title={`Hide (Esc). ${shortcut ? prettyKeys(shortcut) + ' brings it back.' : ''}`} onClick={() => desktop!.hide()}><Icon name="close" size={16} /></button>}
      </div>
    </header>
  );
}
