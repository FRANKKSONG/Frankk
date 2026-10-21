/** Present only inside the Esther desktop app (see electron/preload.cjs). */
/** Where the window sits: on the desktop under other windows, like a normal window, or always on top. */
export type Layer = 'desktop' | 'normal' | 'top';
/** Which edge or corner of a card is being dragged to resize it. */
export type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type Material = 'acrylic' | 'mica' | 'esther';
export interface DesktopState {
  shortcut: string; shortcutOk: boolean; layer: Layer; pinsToDesktop: boolean; snap: boolean; scale: number; scales: number[];
  cards: { id: Card; on: boolean }[]; startWithWindows: boolean; version: string; visible: boolean; bubble: boolean; bubbleSize: number;
  /** The glass: Windows' acrylic or mica (live), or Esther's own adjustable blur. `nativeGlass`: Windows can do its own. */
  material: Material; nativeGlass: boolean;
}
export interface Backdrop { image: string | null; screen: { x: number; y: number; width: number; height: number }; x: number; y: number; scale: number }
/** The self-updater: 'dev' and 'portable' builds don't update themselves. */
export interface UpdateStatus { state: 'idle' | 'checking' | 'current' | 'downloading' | 'ready' | 'error' | 'dev' | 'portable'; version: string; next?: string; percent?: number; error?: string }
export interface Desktop {
  updates: { status: () => Promise<UpdateStatus>; check: () => void; install: () => void; on: (cb: (s: UpdateStatus) => void) => () => void };
  state: () => Promise<DesktopState>;
  set: (p: Partial<Pick<DesktopState, 'shortcut' | 'layer' | 'startWithWindows' | 'snap' | 'scale' | 'bubble' | 'bubbleSize' | 'material'>> & { card?: { id: Card; on: boolean } }) => Promise<DesktopState>;
  hide: () => void;
  card: string;
  glass: 'native' | 'esther';
  openSettings: () => void;
  closeSettings: () => void;
  resetLayout: () => void;
  onBackdrop: (cb: (b: Backdrop) => void) => () => void;
  onPlace: (cb: (p: { x: number; y: number; screen: Backdrop['screen'] }) => void) => () => void;
  onChanged: (cb: () => void) => () => void;
  /** `from`/`to`: where the Esther bubble is, from this card, when the cards come out of it or go into it. */
  onEnter: (cb: (p: { delay: number; from?: { x: number; y: number } | null }) => void) => () => void;
  onLeave: (cb: (p: { to?: { x: number; y: number } | null }) => void) => () => void;
  bubbleClick: () => void;
  bubbleWheel: (deltaY: number) => void;
  onGuides: (cb: (g: import('../components/Guides').GuidesMsg) => void) => () => void;
  show: () => void;
  track: (kind: 'move' | 'resize', phase: 'start' | 'end', edge?: Edge) => void;
  trackMods: (shift: boolean, alt: boolean) => void;
  saveLog: () => Promise<boolean>;
  saveData: (text: string) => void;
  onData: (cb: (d: import('../data/model').Data) => void) => () => void;
  quit: () => void;
  size: (width: number, height: number) => void;
}

export const desktop: Desktop | undefined = typeof window !== 'undefined' ? (window as unknown as { estherDesktop?: Desktop }).estherDesktop : undefined;

/** "Control+Alt+E" → "Ctrl + Alt + E". */
export const prettyKeys = (a: string) => a.split('+').map((k) => (k === 'Control' || k === 'CommandOrControl' ? 'Ctrl' : k)).join(' + ');

/** A key press as an Electron accelerator, or null while only modifiers are held. Needs Ctrl or Alt so it can't steal typing. */
export function accelerator(e: { key: string; code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;
  if (!e.ctrlKey && !e.altKey) return null;
  const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit\d$/.test(e.code) ? e.code.slice(5) : /^F\d{1,2}$/.test(e.key) ? e.key
    : e.code === 'Space' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : null;
  if (!key) return null;
  return [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super', key].filter(Boolean).join('+');
}

/** The card this window shows in the desktop app ('' on the website, where everything is one page). */
export type Card = 'header' | 'tasks' | 'calendar' | 'week' | 'settings' | 'bubble' | 'guides';
export const card = (desktop?.card || '') as Card | '';
