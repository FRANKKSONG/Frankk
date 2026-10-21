import { useEffect, useRef, useState } from 'react';
import { ArchEmblem, Initial } from './components/Ornaments';
import { ListTabs } from './components/ListTabs';
import { TaskTable } from './components/TaskTable';
import { MonthCalendar, ThisWeek } from './components/Side';
import { SettingsMenu, SettingsPanel } from './components/Settings';
import { ResizeGrip, UpdatePill } from './components/DesktopBits';
import { Icon } from './components/Icons';
import { card, desktop, prettyKeys, type Backdrop } from './lib/desktop';
import { applyTheme, DEFAULT_GRAIN, DEFAULT_THEME, DEFAULT_WINDOW, type ThemePrefs } from './lib/theme';
import { blurredWallpaper, noiseTile } from './lib/backdrop';
import { Guides } from './components/Guides';
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
  // Desktop: which card this is, Esther's own frosted glass, moving by the title area, and the call-up and fade-out.
  const [backdrop, setBackdrop] = useState<Backdrop | null>(null);
  // The glass is one element behind the card, styled directly: changing where the wallpaper sits (as the card moves)
  // repaints only that element. (As page-wide CSS variables, every move restyled every element in the card.)
  const glass = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!desktop) return;
    const root = document.documentElement;
    root.dataset.desktop = '1';
    if (card) root.dataset.card = card;
    root.dataset.glass = desktop.glass;
    let scale = 1, screen = { x: 0, y: 0 };
    const place = (x: number, y: number) => {
      const g = glass.current;
      if (g) g.style.backgroundPosition = `${(screen.x - x) / scale}px ${(screen.y - y) / scale}px`;
    };
    const offBackdrop = desktop.onBackdrop((b) => {
      scale = b.scale || 1; screen = b.screen;
      if (glass.current) glass.current.style.backgroundSize = `${b.screen.width / scale}px ${b.screen.height / scale}px`;
      place(b.x, b.y);
      setBackdrop(b);
    });
    const offPlace = desktop.onPlace((p) => { screen = p.screen; place(p.x, p.y); });
    // Call-up and fade-out (Windows' own window animations are off for the cards).
    const play = (cls: 'entering' | 'leaving', delay = 0) => {
      root.classList.remove('entering', 'leaving');
      void root.offsetWidth; // restart the animation
      root.style.setProperty('--enter-delay', `${delay}ms`);
      root.classList.add(cls);
    };
    play('entering', Math.max(0, ['header', 'calendar', 'week', 'tasks'].indexOf(card)) * 40);
    // Into the Esther bubble and out of it: the card flies towards (or from) where the bubble is.
    const fly = (k: 'to' | 'from', v?: { x: number; y: number } | null) => {
      root.style.setProperty(`--${k}-x`, v ? `${v.x}px` : '0px');
      root.style.setProperty(`--${k}-y`, v ? `${v.y}px` : k === 'to' ? '6px' : '10px');
      root.style.setProperty(`--${k}-s`, v ? '.12' : k === 'to' ? '.98' : '.97');
      root.classList.toggle(`fly-${k}`, !!v);
    };
    const offEnter = desktop.onEnter((p) => { fly('from', p.from); play('entering', p.delay); });
    const offLeave = desktop.onLeave((p) => { fly('to', p.to); play('leaving'); });
    // Move a card by its title area: Esther moves the window itself (Windows' title-bar dragging is off).
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (e.button !== 0 || !t.closest?.(DRAG_AREAS) || t.closest(NOT_DRAG)) return;
      desktop!.track('move', 'start');
      root.setPointerCapture?.(e.pointerId);
      const end = () => { desktop!.track('move', 'end'); root.removeEventListener('pointerup', end); root.removeEventListener('lostpointercapture', end); };
      root.addEventListener('pointerup', end);
      root.addEventListener('lostpointercapture', end);
    };
    root.addEventListener('pointerdown', onDown);
    return () => { offBackdrop?.(); offPlace?.(); offEnter?.(); offLeave?.(); root.removeEventListener('pointerdown', onDown); };
  }, []);
  // The frosted glass is worked out once per wallpaper and Blur setting (not every frame).
  const { blur, grain = DEFAULT_GRAIN } = { ...DEFAULT_WINDOW, ...theme.window };
  useEffect(() => {
    const root = document.documentElement;
    if (!backdrop?.image) { delete root.dataset.wall; return; }
    let live = true;
    const t = window.setTimeout(() => {
      blurredWallpaper(backdrop.image!, backdrop.screen.width, backdrop.screen.height, blur).then((url) => {
        if (!live) return;
        const g = glass.current;
        if (!g) return;
        g.style.backgroundImage = `url("${url}")`;
        g.style.setProperty('--noise', `url("${noiseTile(grain)}")`);
        if (root.dataset.wall !== '1') root.dataset.wall = '1';
      }).catch(() => { delete root.dataset.wall; });
    }, 60);
    return () => { live = false; window.clearTimeout(t); };
  }, [backdrop, blur]);
  useEffect(() => { glass.current?.style.setProperty('--noise', `url("${noiseTile(grain)}")`); }, [grain]);

  const body = (() => {
    switch (card) {
      case 'header': return <Top theme={theme} setTheme={setTheme} />;
      case 'tasks': return <section className="card tasks-card" aria-label="Tasks"><ListTabs /><TaskTable /></section>;
      case 'calendar': return <MonthCalendar />;
      case 'week': return <ThisWeek />;
      case 'bubble': return <button className="bubble" aria-label="Esther: show or hide the cards" onClick={() => desktop!.bubbleClick()} onWheel={(e) => desktop!.bubbleWheel(e.deltaY)}>Esther</button>;
      case 'guides': return <Guides />;
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
      {card && !['bubble', 'guides'].includes(card) && <div ref={glass} className="glass" aria-hidden="true" />}
      {!['bubble', 'guides'].includes(card) && <ResizeGrip />}
      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
        {toast?.msg}
        {toast?.undo && canUndo && <button className="toast-undo" onClick={() => { undo(); say('Undone.'); }}>Undo</button>}
      </div>
    </div>
  );
}

/** Where a card can be picked up and moved, and the things inside those areas that are for clicking instead. */
const DRAG_AREAS = '.top, .card-head, .table-tools, .tabs-wrap, .tabs, .set-nav';
const NOT_DRAG = 'button, input, select, textarea, a, label, [role=tab], [role=switch], [contenteditable], .tab-item, .seg, .filter-chip, .drag-grip, .list-pill, .popover';

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
