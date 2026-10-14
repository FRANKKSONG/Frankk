import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Compactor, type Layout, type LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { Sidebar } from './components/Sidebar';
import { Icon } from './components/Icons';
import { Popover } from './components/Popover';
import { TodayStrip } from './components/TodayStrip';
import { QuickCapture } from './components/QuickCapture';
import { ComingUp } from './components/ComingUp';
import { MiniCalendar } from './components/MiniCalendar';
import { TaskDrawer } from './components/TaskDrawer';
import { NoteDialog } from './components/NoteDialog';
import { SearchPalette } from './components/SearchPalette';
import { SettingsPage } from './pages/SettingsPage';
import { HomePage } from './pages/HomePage';
import { NotesPage } from './pages/NotesPage';
import { LibraryPage } from './pages/LibraryPage';
import { CalendarPage } from './pages/CalendarPage';
import { NewTaskDialog } from './components/NewTaskDialog';
import { Initial } from './components/Ornaments';
import { AppearanceButton } from './components/Appearance';
import { Dropdown } from './components/Dropdown';
import { applyTheme, DEFAULT_THEME, type ThemePrefs } from './lib/theme';
import { GeneralPanel } from './panels/GeneralPanel';
import { MusicPanel, ProjectDialog } from './panels/MusicPanel';
import { SeroundPanel } from './panels/SeroundPanel';
import { HousePanel } from './panels/HousePanel';
import { useUi } from './ui';
import { pushUiUndo } from './lib/undo';
import { useStore } from './data/store';
import { usePersistentState } from './hooks/usePersistentState';
import { COLS, DEFAULT_LAYOUT, DEFAULT_ROWS, MARGIN, MIN_BOARD_WIDTH, WIDGETS, defaultItem, swapOnDrop, type WidgetId } from './layout';
import type { Area } from './data/types';

const hasCoarsePointer = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export default function App() {
  const { page, focusArea, setFocusArea, setPalette, paletteOpen, noteDialog, drawerTaskId, projectDialog, toast, say } = useUi();
  const { undo, canUndo } = useStore();
  const [theme, setTheme] = usePersistentState<ThemePrefs>('theme.v3', DEFAULT_THEME);
  const [nav, setNav] = usePersistentState<{ collapsed: boolean }>('nav', { collapsed: typeof window !== 'undefined' && window.innerWidth < 1280 });
  const toggleNav = () => setNav((n) => ({ collapsed: !n.collapsed }));
  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = !!(e.target as HTMLElement).closest?.('input,select,textarea');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); }
      else if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); setNav((n) => ({ collapsed: !n.collapsed })); }
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (canUndo) { undo(); say('Undone.'); }
      }
      else if (e.key === 'Escape' && focusArea && !paletteOpen && !noteDialog && !drawerTaskId && !projectDialog && !(e.target as HTMLElement).closest?.('input,select,textarea')) setFocusArea(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focusArea, paletteOpen, noteDialog, drawerTaskId, projectDialog, setPalette, setFocusArea, canUndo, undo, say, setNav]);

  return (
    <div className={`app${nav.collapsed ? ' nav-collapsed' : ''}`}>
      <Sidebar collapsed={nav.collapsed} onToggle={toggleNav} />
      <main className="main">
        {page === 'home' && <HomePage theme={theme} setTheme={setTheme} />}
        {page === 'tasks' && <TasksBoard theme={theme} setTheme={setTheme} />}
        {page === 'notes' && <NotesPage />}
        {page === 'library' && <LibraryPage />}
        {page === 'calendar' && <CalendarPage />}
        {page === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} />}
      </main>
      <TaskDrawer />
      <NoteDialog />
      <SearchPalette />
      {projectDialog && <ProjectDialog />}
      <NewTaskDialog />
      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
        {toast?.msg}
        {toast?.undo && canUndo && <button className="toast-undo" onClick={() => { undo(); say('Undone.'); }}>Undo</button>}
      </div>
    </div>
  );
}

function PanelFor({ area, focused }: { area: Area; focused: boolean }) {
  switch (area) {
    case 'general': return <GeneralPanel focused={focused} />;
    case 'music': return <MusicPanel focused={focused} />;
    case 'seround': return <SeroundPanel focused={focused} />;
    case 'house': return <HousePanel focused={focused} />;
  }
}

// While a panel is being dragged it floats over the others instead of shoving them around;
// on release it swaps with the panel it was dropped on (see swapOnDrop).
const floatingCompactor: Compactor = { ...verticalCompactor, allowOverlap: true, compact: (l: Layout) => l };

/** The Tasks page: the bento board of every area at a glance. */
function TasksBoard({ theme, setTheme }: { theme: ThemePrefs; setTheme: (t: ThemePrefs) => void }) {
  const { focusArea, setPalette, tagFilter, setTagFilter, say } = useUi();
  const { data } = useStore();
  const [day, setDay] = useState<string | null>(null);
  const [saved, setSaved] = usePersistentState<{ items: LayoutItem[]; hidden: WidgetId[] }>('layout.board.v3', { items: DEFAULT_LAYOUT, hidden: [] });
  const { width, containerRef, mounted } = useContainerWidth();
  const [height, setHeight] = useState(800);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const before = useRef<LayoutItem[] | null>(null);
  const snapshot = useRef<typeof saved | null>(null);
  // Moving or resizing a panel can be undone with Ctrl+Z (or the toast's Undo).
  const remember = (label: string) => {
    const prev = snapshot.current;
    snapshot.current = null;
    if (!prev) return;
    pushUiUndo(label, () => { skipNext.current = true; setSaved(prev); });
    say(`${label}.`, true);
  };
  const skipNext = useRef(false);

  // Fit the default board to the window height so everything is visible at a glance.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, [containerRef, focusArea]);
  useEffect(() => { if (mounted) { const t = window.setTimeout(() => setReady(true), 120); return () => window.clearTimeout(t); } }, [mounted]);
  const rowHeight = Math.max(18, Math.min(56, Math.floor((height - 4 - (DEFAULT_ROWS - 1) * MARGIN[1]) / DEFAULT_ROWS)));

  const visible = useMemo(() => {
    const byId = new Map(saved.items.map((l) => [l.i, l]));
    // The Today strip is pinned: full width across the top, height adjustable from its bottom edge only.
    return WIDGETS.filter((w) => !saved.hidden.includes(w.id)).map((w) => {
      const l = byId.get(w.id) ?? defaultItem(w.id);
      return w.id === 'today' ? { ...l, x: 0, y: 0, w: COLS, isDraggable: false, resizeHandles: ['s' as const] } : l;
    });
  }, [saved]);

  const store = (next: readonly LayoutItem[]) => setSaved((s) => {
    const merged = new Map(s.items.map((l) => [l.i, l]));
    for (const l of next) merged.set(l.i, { ...merged.get(l.i), ...l });
    return { ...s, items: [...merged.values()] };
  });
  const onLayoutChange = (next: readonly LayoutItem[]) => {
    if (dragging) return;
    if (skipNext.current) { skipNext.current = false; return; }
    store(next);
  };
  const toggleWidget = (id: WidgetId) => setSaved((s) => {
    const hidden = s.hidden.includes(id);
    // When restoring a widget, drop it back at the bottom so it never overlaps others.
    const items = hidden ? [...s.items.filter((l) => l.i !== id), { ...defaultItem(id), y: 9999 }] : s.items;
    return { items, hidden: hidden ? s.hidden.filter((h) => h !== id) : [...s.hidden, id] };
  });

  const render = (id: WidgetId): ReactNode => {
    switch (id) {
      case 'today': return <TodayStrip />;
      case 'capture': return <QuickCapture />;
      case 'coming': return <ComingUp day={day} clearDay={() => setDay(null)} />;
      case 'calendar': return <MiniCalendar day={day} onDay={setDay} />;
      default: return <PanelFor area={id} focused={false} />;
    }
  };

  const touch = hasCoarsePointer();
  const boardWidth = Math.max(width, MIN_BOARD_WIDTH);

  return (
    <div className="home">
      <header className="home-head">
        <div>
          <h1><Initial letter="T" /><span className="sr-only">T</span><span className="greet-rest">asks</span></h1>
          <p className="tagline">Every area at a glance. Drag, resize and edit anything.</p>
        </div>
        <div className="head-actions">
          <button className="search-btn" onClick={() => setPalette(true)} aria-label="Search (Ctrl+K)"><Icon name="search" /><span>Search anything…</span><kbd>Ctrl</kbd><kbd>K</kbd></button>
          <span className={`tag-filter${tagFilter ? ' active' : ''}`}>
            <Dropdown ariaLabel="Filter by tag" icon="tag" value={tagFilter ?? ''} onChange={(v) => setTagFilter(v || null)}
              options={[{ id: '', label: 'All tags' }, ...data.tags.map((t) => ({ id: t.name, label: `#${t.name}` }))]} />
            {tagFilter && <button className="icon-btn tiny" aria-label="Clear tag filter" onClick={() => setTagFilter(null)}><Icon name="close" size={11} /></button>}
          </span>
          <AppearanceButton prefs={theme} setPrefs={setTheme} />
          <Popover align="right" trigger={({ toggle, ref, open }) => (
            <button ref={ref} className="btn" aria-haspopup="menu" aria-expanded={open} onClick={toggle}><Icon name="layout" size={15} /> Edit layout</button>
          )}>
            {(close) => (
              <div className="pop-form">
                <strong>Layout</strong>
                <p className="menu-note">Drag a panel’s dotted grip to move it. Drag any edge or corner to resize it, like a window.</p>
                {WIDGETS.filter((w) => w.secondary).map((w) => (
                  <label key={w.id} className="menu-check"><input type="checkbox" checked={!saved.hidden.includes(w.id)} onChange={() => toggleWidget(w.id)} />{w.label}</label>
                ))}
                <button role="menuitem" onClick={() => { setSaved({ items: DEFAULT_LAYOUT, hidden: [] }); close(); }}>Restore default layout</button>
              </div>
            )}
          </Popover>
        </div>
      </header>

      {focusArea && <div className="focus"><PanelFor area={focusArea} focused /></div>}
      {/* The board stays mounted (just hidden) in focus mode so its width tracking keeps working. */}
      <div className={`board-scroll${ready ? ' ready' : ''}`} ref={containerRef} hidden={!!focusArea}>
          {mounted && !focusArea && (
            <div style={{ width: boardWidth }}>
              <ReactGridLayout
                width={boardWidth}
                layout={visible}
                gridConfig={{ cols: COLS, rowHeight, margin: MARGIN, containerPadding: [0, 0] }}
                dragConfig={{ enabled: !touch, handle: '.panel-grip', cancel: 'input,select,textarea,button,a,.no-drag' }}
                resizeConfig={{ enabled: true, handles: ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] }}
                compactor={dragging ? floatingCompactor : verticalCompactor}
                onDragStart={() => { before.current = visible.map((l) => ({ ...l })); snapshot.current = saved; setDragging(true); }}
                onResizeStart={() => { snapshot.current = saved; }}
                onResizeStop={() => remember('Panel resized')}
                onDragStop={(_l, _old, item) => {
                  const prev = before.current;
                  before.current = null;
                  setDragging(false);
                  if (!prev || !item) return;
                  skipNext.current = true;
                  store(verticalCompactor.compact(swapOnDrop(prev, item), COLS));
                  if (prev.some((l) => { const n = item.i === l.i ? item : null; return n && (n.x !== l.x || n.y !== l.y); })) remember('Panel moved'); else snapshot.current = null;
                }}
                onLayoutChange={onLayoutChange}
              >
                {visible.map((l) => {
                  const area = ['general', 'music', 'seround', 'house', 'today'].includes(l.i);
                  // Area panels carry their own grip in the header; the pinned Today strip has none; the rest get one in their top-left corner.
                  return (
                    <div key={l.i} className={`widget${area ? '' : ' has-grip'}`}>
                      {!area && <span className="panel-grip widget-grip" title="Drag to move" aria-label={`Move ${WIDGETS.find((w) => w.id === l.i)?.label ?? l.i}`}><Icon name="grip" size={12} /></span>}
                      {render(l.i as WidgetId)}
                    </div>
                  );
                })}
              </ReactGridLayout>
            </div>
          )}
      </div>
      <footer className="assistant-bar">
        <Popover align="right" trigger={({ toggle, ref }) => (
          <button ref={ref} className="btn" onClick={toggle}><Icon name="sparkle" size={15} /> Ask assistant</button>
        )}>
          {() => <div className="pop-info"><strong>Not available yet</strong><p>AI help comes after the core workflows are reliable. It will propose changes for you to approve; nothing is connected or sent anywhere.</p></div>}
        </Popover>
      </footer>
    </div>
  );
}
