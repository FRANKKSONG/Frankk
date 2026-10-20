/** Present only inside the Esther desktop app (see electron/preload.cjs). */
export interface DesktopState { shortcut: string; shortcutOk: boolean; alwaysOnTop: boolean; startWithWindows: boolean; version: string }
export interface Desktop {
  state: () => Promise<DesktopState>;
  set: (p: Partial<Pick<DesktopState, 'shortcut' | 'alwaysOnTop' | 'startWithWindows'>>) => Promise<DesktopState>;
  hide: () => void;
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
