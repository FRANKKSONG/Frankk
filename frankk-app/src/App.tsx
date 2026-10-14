import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Compactor, type Layout, type LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { Sidebar, type View } from './components/Sidebar';
import { Icon } from './components/Icons';
import { Popover } from './components/Popover';
import { TodayStrip } from './components/TodayStrip';
import { QuickCapture } from './components/QuickCapture';
import { ComingUp } from './components/ComingUp';
import { MiniCalendar } from './components/MiniCalendar';
import { TaskDrawer } from './components/TaskDrawer';
import { NoteDialog } from './components/NoteDialog';
import { SearchPalette } from './components/SearchPalette';
import { Placeholder, SettingsPage } from './components/Pages';
import { GeneralPanel } from './panels/GeneralPanel';
import { MusicPanel, ProjectDialog } from './panels/MusicPanel';
import { SeroundPanel } from './panels/SeroundPanel';
import { HousePanel } from './panels/HousePanel';
import { useUi } from './ui';
import { useStore } from './data/store';
import { usePersistentState } from './hooks/usePersistentState';
import { greeting } from './lib/dates';
import { COLS, DEFAULT_LAYOUT, DEFAULT_ROWS, MARGIN, MIN_BOARD_WIDTH, WIDGETS, defaultItem, swapOnDrop, type WidgetId } from './layout';
import type { Area } from './data/types';

const hasCoarsePointer = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export default function App() {
  const [view, setView] = useState<View>('home');
  const { focusArea, setFocusArea, setPalette, paletteOpen, noteDialog, drawerTaskId, projectDialog, toast, say } = useUi();
  const { undo, canUndo } = useStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = !!(e.target as HTMLElement).closest?.('input,select,textarea');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); }
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (canUndo) { undo(); say('Undone.'); }
      }
      else if (e.key === 'Escape' && focusArea && !paletteOpen && !noteDialog && !drawerTaskId && !projectDialog && !(e.target as HTMLElement).closest?.('input,select,textarea')) setFocusArea(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focusArea, paletteOpen, noteDialog, drawerTaskId, projectDialog, setPalette, setFocusArea, canUndo, undo, say]);

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} />
      <main className="main">
        {view === 'home' && <Home />}
        {view === 'settings' && <SettingsPage />}
        {view === 'library' && <Placeholder title="Library" milestone="a later milestone">References, links and attachments from your vault will appear here. Nothing is linked yet.</Placeholder>}
        {view === 'calendar' && <Placeholder title="Calendar" milestone="Milestone 6">A full calendar needs an explicitly chosen, read-only calendar first. The Home mini calendar is a date overview only.</Placeholder>}
      </main>
      <TaskDrawer />
      <NoteDialog />
      <SearchPalette />
      {projectDialog && <ProjectDialog />}
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

function Home() {
  const { focusArea } = useUi();
  const { setPalette } = useUi();
  const [day, setDay] = useState<string | null>(null);
  const [saved, setSaved] = usePersistentState<{ items: LayoutItem[]; hidden: WidgetId[] }>('layout.board', { items: DEFAULT_LAYOUT, hidden: [] });
  const { width, containerRef, mounted } = useContainerWidth();
  const [height, setHeight] = useState(800);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const before = useRef<LayoutItem[] | null>(null);
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
  const rowHeight = Math.max(12, Math.min(40, Math.floor((height - 4 - (DEFAULT_ROWS - 1) * MARGIN[1]) / DEFAULT_ROWS)));

  const visible = useMemo(() => {
    const byId = new Map(saved.items.map((l) => [l.i, l]));
    return WIDGETS.filter((w) => !saved.hidden.includes(w.id)).map((w) => byId.get(w.id) ?? defaultItem(w.id));
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
          <h1>{greeting()}, FRANKK</h1>
          <p className="tagline">A little structure. More room to create.</p>
        </div>
        <div className="head-actions">
          <button className="search-btn" onClick={() => setPalette(true)} aria-label="Search (Ctrl+K)"><Icon name="search" /><span>Search anything…</span><kbd>Ctrl</kbd><kbd>K</kbd></button>
          <Popover align="right" trigger={({ toggle, ref, open }) => (
            <button ref={ref} className="btn" aria-haspopup="menu" aria-expanded={open} onClick={toggle}><Icon name="layout" size={15} /> Edit layout</button>
          )}>
            {(close) => (
              <div className="pop-form">
                <strong>Layout</strong>
                <p className="menu-note">Drag a panel’s dotted grip to move it. Drag an edge or corner to resize it.</p>
                {WIDGETS.filter((w) => w.secondary).map((w) => (
                  <label key={w.id} className="menu-check"><input type="checkbox" checked={!saved.hidden.includes(w.id)} onChange={() => toggleWidget(w.id)} />{w.label}</label>
                ))}
                <button role="menuitem" onClick={() => { setSaved({ items: DEFAULT_LAYOUT, hidden: [] }); close(); }}>Restore default layout</button>
              </div>
            )}
          </Popover>
          <div className="vault-badge" title="Sample records stored in this browser only"><Icon name="folder" size={18} /><span><small>SAMPLE DATA</small><b>No vault connected</b></span></div>
        </div>
      </header>

      {focusArea ? (
        <div className="focus"><PanelFor area={focusArea} focused /></div>
      ) : (
        <div className={`board-scroll${ready ? ' ready' : ''}`} ref={containerRef}>
          {mounted && (
            <div style={{ width: boardWidth }}>
              <ReactGridLayout
                width={boardWidth}
                layout={visible}
                gridConfig={{ cols: COLS, rowHeight, margin: MARGIN, containerPadding: [0, 0] }}
                dragConfig={{ enabled: !touch, handle: '.panel-grip', cancel: 'input,select,textarea,button,a,.no-drag' }}
                resizeConfig={{ enabled: true, handles: ['e', 'w', 's', 'se', 'sw'] }}
                compactor={dragging ? floatingCompactor : verticalCompactor}
                onDragStart={() => { before.current = visible.map((l) => ({ ...l })); setDragging(true); }}
                onDragStop={(_l, _old, item) => {
                  const prev = before.current;
                  before.current = null;
                  setDragging(false);
                  if (!prev || !item) return;
                  skipNext.current = true;
                  store(verticalCompactor.compact(swapOnDrop(prev, item), COLS));
                }}
                onLayoutChange={onLayoutChange}
              >
                {visible.map((l) => <div key={l.i} className="widget">{render(l.i as WidgetId)}</div>)}
              </ReactGridLayout>
            </div>
          )}
        </div>
      )}
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
