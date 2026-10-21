// Where Esther's cards sit among your windows, on Windows:
//   'desktop' – on the desktop: just above the wallpaper and icons, under your apps (like a Rainmeter skin set to
//               "On desktop"). Clicking other apps, the desktop or the taskbar never hides them.
//   'normal'  – like any window.
//   'top'     – always on top.
//
// How 'desktop' works: every card is "owned" by the desktop window (the one holding the icons). Windows always
// keeps owned windows above their owner, and moves them with it: when you click the empty desktop or press
// Show desktop, Windows brings the desktop forward and the cards come along, so they never blink away (with a
// tiny helper window as the reference point, as Rainmeter does, they were briefly covered until Esther noticed).
// A light check puts back a card that has still slipped under the desktop, and re-attaches the cards if
// Explorer restarts (a new desktop window).
// Anywhere but Windows (or if koffi can't load) the cards are normal windows.
const { BrowserWindow } = require('electron');

const HWND_TOP = 0, HWND_BOTTOM = 1;
const SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOACTIVATE = 0x10, SWP_NOOWNERZORDER = 0x200;
const KEEP = SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_NOOWNERZORDER;
const GWLP_HWNDPARENT = -8;
const GW_HWNDNEXT = 2, GW_OWNER = 4;

const handleOf = (w) => Number(w.getNativeWindowHandle().readBigUInt64LE(0));

function desktopLayer(initialMode, log = () => {}) {
  let mode = initialMode;
  let raised = false;
  const wins = new Set();
  const live = () => [...wins].filter((w) => !w.isDestroyed());
  const apply = () => live().forEach((w) => w.setAlwaysOnTop(mode === 'top'));

  let api = null;
  if (process.platform === 'win32') {
    try {
      const koffi = require('koffi');
      const user32 = koffi.load('user32.dll');
      api = {
        SetWindowPos: user32.func('bool __stdcall SetWindowPos(uintptr_t hWnd, uintptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32_t uFlags)'),
        FindWindowW: user32.func('uintptr_t __stdcall FindWindowW(str16 lpClassName, str16 lpWindowName)'),
        FindWindowExW: user32.func('uintptr_t __stdcall FindWindowExW(uintptr_t hWndParent, uintptr_t hWndChildAfter, str16 lpszClass, str16 lpszWindow)'),
        SetWindowLongPtrW: user32.func('intptr_t __stdcall SetWindowLongPtrW(uintptr_t hWnd, int nIndex, intptr_t dwNewLong)'),
        GetWindow: user32.func('uintptr_t __stdcall GetWindow(uintptr_t hWnd, uint32_t uCmd)'),
        IsWindow: user32.func('bool __stdcall IsWindow(uintptr_t hWnd)'),
        IsWindowVisible: user32.func('bool __stdcall IsWindowVisible(uintptr_t hWnd)'),
        IsIconic: user32.func('bool __stdcall IsIconic(uintptr_t hWnd)'),
      };
      try {
        const dwm = koffi.load('dwmapi.dll');
        api.DwmGetWindowAttribute = dwm.func('int32_t __stdcall DwmGetWindowAttribute(uintptr_t hwnd, uint32_t dwAttribute, _Out_ void *pvAttribute, uint32_t cbAttribute)');
      } catch { /* no DWM: treat nothing as cloaked */ }
    } catch (e) { log(`desktop layer unavailable: ${e.message}`); api = null; }
  }

  /** The window that shows the desktop icons: Progman, or (with some wallpaper settings) a WorkerW. */
  function desktopWindow() {
    const progman = api.FindWindowW('Progman', null);
    if (progman && api.FindWindowExW(progman, 0, 'SHELLDLL_DefView', null)) return progman;
    for (let w = api.FindWindowExW(0, 0, 'WorkerW', null), i = 0; w && i < 200; w = api.FindWindowExW(0, w, 'WorkerW', null), i++) {
      if (api.FindWindowExW(w, 0, 'SHELLDLL_DefView', null)) return w;
    }
    return progman || 0;
  }

  let helper = null, helperHwnd = 0;
  function makeHelper() {
    const desk = desktopWindow();
    if (!desk) { helperHwnd = 0; return; }
    if (!helper || helper.isDestroyed()) {
      helper = new BrowserWindow({ width: 1, height: 1, x: -32000, y: -32000, show: false, frame: false, transparent: true, skipTaskbar: true, focusable: false, resizable: false, title: 'Esther desktop helper' });
      helper.on('closed', () => { helper = null; helperHwnd = 0; setTimeout(() => { if (live().length) { makeHelper(); settle(); } }, 1500); });
    }
    helperHwnd = handleOf(helper);
    api.SetWindowLongPtrW(helperHwnd, GWLP_HWNDPARENT, desk);
    helper.showInactive();
  }
  const helperOk = () => helperHwnd && api.IsWindow(helperHwnd) && api.GetWindow(helperHwnd, GW_OWNER) === desktopWindow();

  /** Is a below b in the window stack? */
  const below = (a, b) => { for (let w = api.GetWindow(b, GW_HWNDNEXT), i = 0; w && i < 5000; w = api.GetWindow(w, GW_HWNDNEXT), i++) if (w === a) return true; return false; };
  const pinned = () => mode === 'desktop' && !raised;

  /** On the desktop layer the cards are owned by the desktop window; otherwise by nothing. */
  function own(w) {
    if (!api || w.isDestroyed()) return;
    const h = handleOf(w), want = mode === 'desktop' ? desktopWindow() : 0;
    if (api.GetWindow(h, GW_OWNER) !== want) { api.SetWindowLongPtrW(h, GWLP_HWNDPARENT, want); log(`layer: ${w.getTitle()} ${want ? 'attached to' : 'detached from'} the desktop`); }
  }
  /** Put back only the cards that have slipped under the desktop. Cards that are fine are left alone. */
  function settle() {
    if (!api || mode !== 'desktop') return;
    if (!helperOk()) makeHelper();
    for (const w of live()) own(w);
    if (!helperHwnd || raised) return;
    const desk = desktopWindow();
    for (const w of live()) {
      if (!w.isVisible()) continue;
      const h = handleOf(w);
      if (!below(desk, h)) { api.SetWindowPos(h, HWND_BOTTOM, 0, 0, 0, 0, KEEP); log(`layer: ${w.getTitle()} had slipped under the desktop, put back`); }
    }
  }
  const DWMWA_CLOAKED = 14;
  const cloaked = (h) => { if (!api.DwmGetWindowAttribute) return false; const b = Buffer.alloc(4); return api.DwmGetWindowAttribute(h, DWMWA_CLOAKED, b, 4) === 0 && b.readUInt32LE(0) !== 0; };
  /** Is this card above some other app's window that you can see? (Then it isn't on the desktop layer any more.) */
  function aboveAnApp(h) {
    const ours = new Set(BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).map(handleOf));
    const desk = desktopWindow();
    // Walk down the window stack from the card until the desktop: any app window on the way is under the card.
    for (let w = api.GetWindow(h, GW_HWNDNEXT), i = 0; w && i < 5000; w = api.GetWindow(w, GW_HWNDNEXT), i++) {
      if (w === desk) return false; // (Esther's own windows, the helper included, are skipped below)
      if (!ours.has(w) && api.IsWindowVisible(w) && !api.IsIconic(w) && !cloaked(w)) return w;
    }
    return 0;
  }
  /** After you click away: the cards that are above your apps go back down to the desktop (once, not in a loop).
   *  Cards already in place aren't touched at all, so nothing redraws or flickers. */
  function lowerAll() {
    if (!api || !pinned()) return;
    if (!helperOk()) makeHelper();
    if (!helperHwnd) return;
    const moved = [];
    for (const w of live()) {
      if (!w.isVisible()) continue;
      const h = handleOf(w);
      // To the bottom: the desktop owns the card, so Windows keeps it just above the desktop.
      if (aboveAnApp(h)) { api.SetWindowPos(h, HWND_BOTTOM, 0, 0, 0, 0, KEEP); moved.push(w.getTitle()); }
    }
    log(`layer: lowered ${moved.length ? moved.join(', ') : 'nothing (all in place)'}`);
  }
  const anyFocused = () => live().some((w) => w.isFocused());

  if (api) {
    makeHelper();
    // A light check: only acts if a card has fallen under the desktop or Explorer has restarted.
    setInterval(settle, 500);
  }

  return {
    native: !!api,
    /** Manage a card window. */
    add(w) {
      wins.add(w);
      w.setAlwaysOnTop(mode === 'top');
      own(w);
      // Clicking from one card to another isn't "clicking away"; only when no card has focus do they go back down.
      w.on('blur', () => setTimeout(() => { if (!anyFocused()) { raised = false; lowerAll(); } }, 120));
      w.on('show', () => setTimeout(settle, 0));
      w.on('closed', () => wins.delete(w));
    },
    setMode(m) { mode = m; raised = false; apply(); live().forEach(own); if (m === 'desktop') lowerAll(); else if (api) live().forEach((w) => api.SetWindowPos(handleOf(w), HWND_TOP, 0, 0, 0, 0, KEEP)); },
    /** Bring the cards to the front until you click elsewhere. */
    raise() { raised = true; if (api) live().forEach((w) => w.isVisible() && api.SetWindowPos(handleOf(w), HWND_TOP, 0, 0, 0, 0, KEEP)); },
    lower() { raised = false; lowerAll(); },
    isRaised: () => raised,
    /** For the Windows test: where things are in the window stack. */
    aboveAnApp: (w) => (api ? aboveAnApp(handleOf(w)) : false),
    owner: (w) => (api ? api.GetWindow(handleOf(w), GW_OWNER) : 0),
    desktop: () => (api ? desktopWindow() : 0),
    debug: (w) => (api ? { hwnd: handleOf(w), helperHwnd, desk: desktopWindow(), helperOwner: helperHwnd ? api.GetWindow(helperHwnd, GW_OWNER) : 0, aboveDesktop: below(desktopWindow(), handleOf(w)), below: (other) => below(handleOf(w), other) } : null),
  };
}

module.exports = { desktopLayer };
