// Where Esther sits among your windows, on Windows:
//   'desktop' – on the desktop: always just above the wallpaper and icons, under your apps (like a Rainmeter skin
//               set to "On desktop"). Clicking other apps, the desktop or the taskbar never hides it.
//   'normal'  – like any window.
//   'top'     – always on top.
//
// How 'desktop' works (the same idea Rainmeter uses): a tiny invisible helper window is "owned" by the desktop
// window (the one holding the icons). Windows always keeps owned windows directly above their owner, so the helper
// sits just above the desktop. Every time Windows is about to restack Esther (WM_WINDOWPOSCHANGING) it is told to
// go right under the helper: above the desktop, below every app. Esther itself is not owned by the desktop, so if
// Explorer restarts Esther survives; the helper is simply made again.
// Anywhere but Windows (or if koffi can't load) it is a normal window.
const { BrowserWindow } = require('electron');

const WM_WINDOWPOSCHANGING = 0x0046;
const HWND_TOP = 0, HWND_BOTTOM = 1;
const SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOACTIVATE = 0x10;
const KEEP = SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE;
const GWLP_HWNDPARENT = -8;
const GW_HWNDNEXT = 2, GW_OWNER = 4;
/** WINDOWPOS on 64-bit Windows: { HWND hwnd; HWND hwndInsertAfter; ... }, so the "insert after" handle is at byte 8. */
const INSERT_AFTER_OFFSET = 8;

const handleOf = (w) => Number(w.getNativeWindowHandle().readBigUInt64LE(0));

function desktopLayer(win, initialMode, log = () => {}) {
  let mode = initialMode;
  let raised = false;
  const apply = () => win.setAlwaysOnTop(mode === 'top');
  const plain = { setMode(m) { mode = m; apply(); }, raise() { raised = true; }, lower() { raised = false; }, isRaised: () => raised, native: false, debug: () => null };
  if (process.platform !== 'win32') { apply(); return plain; }

  let api;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    api = {
      SetWindowPos: user32.func('bool __stdcall SetWindowPos(uintptr_t hWnd, uintptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32_t uFlags)'),
      FindWindowW: user32.func('uintptr_t __stdcall FindWindowW(str16 lpClassName, str16 lpWindowName)'),
      FindWindowExW: user32.func('uintptr_t __stdcall FindWindowExW(uintptr_t hWndParent, uintptr_t hWndChildAfter, str16 lpszClass, str16 lpszWindow)'),
      SetWindowLongPtrW: user32.func('intptr_t __stdcall SetWindowLongPtrW(uintptr_t hWnd, int nIndex, intptr_t dwNewLong)'),
      GetWindow: user32.func('uintptr_t __stdcall GetWindow(uintptr_t hWnd, uint32_t uCmd)'),
      IsWindow: user32.func('bool __stdcall IsWindow(uintptr_t hWnd)'),
      // Writes bytes to an address Windows hands us (the WINDOWPOS of WM_WINDOWPOSCHANGING).
      Poke: kernel32.func('void __stdcall RtlMoveMemory(uintptr_t Destination, const uint8_t *Source, size_t Length)'),
    };
  } catch (e) { log(`desktop layer unavailable: ${e.message}`); apply(); return plain; }

  /** The window that shows the desktop icons: Progman, or (when a wallpaper slideshow etc. is on) a WorkerW. */
  function desktopWindow() {
    const progman = api.FindWindowW('Progman', null);
    if (progman && api.FindWindowExW(progman, 0, 'SHELLDLL_DefView', null)) return progman;
    for (let w = api.FindWindowExW(0, 0, 'WorkerW', null), i = 0; w && i < 200; w = api.FindWindowExW(0, w, 'WorkerW', null), i++) {
      if (api.FindWindowExW(w, 0, 'SHELLDLL_DefView', null)) return w;
    }
    return progman || 0;
  }

  const hwnd = handleOf(win);
  let helper = null, helperHwnd = 0, desk = 0;
  const after = Buffer.alloc(8);

  /** (Re)make the helper and attach it to the desktop window. */
  function makeHelper() {
    desk = desktopWindow();
    if (!desk) { helperHwnd = 0; return; }
    if (!helper || helper.isDestroyed()) {
      helper = new BrowserWindow({ width: 1, height: 1, x: -32000, y: -32000, show: false, frame: false, transparent: true, skipTaskbar: true, focusable: false, resizable: false, title: 'Esther desktop helper' });
      helper.on('closed', () => { helper = null; helperHwnd = 0; setTimeout(() => { if (!win.isDestroyed()) { makeHelper(); toBottom(); } }, 1500); });
    }
    helperHwnd = handleOf(helper);
    api.SetWindowLongPtrW(helperHwnd, GWLP_HWNDPARENT, desk);
    helper.showInactive();
    api.SetWindowPos(helperHwnd, HWND_BOTTOM, 0, 0, 0, 0, KEEP);
  }

  const pinned = () => mode === 'desktop' && !raised;
  /** Right under the helper: above the desktop, under every app. */
  const toBottom = () => {
    if (!pinned()) return;
    if (!helperHwnd || !api.IsWindow(helperHwnd) || api.GetWindow(helperHwnd, GW_OWNER) !== desktopWindow()) makeHelper();
    api.SetWindowPos(hwnd, helperHwnd || HWND_BOTTOM, 0, 0, 0, 0, KEEP);
  };
  const toTop = () => api.SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0, KEEP);

  win.hookWindowMessage(WM_WINDOWPOSCHANGING, (_wParam, lParam) => {
    if (!pinned() || !helperHwnd) return;
    after.writeBigUInt64LE(BigInt(helperHwnd));
    try { api.Poke(Number(lParam.readBigUInt64LE(0)) + INSERT_AFTER_OFFSET, after, 8); } catch { /* leave Windows' choice */ }
  });

  // Keep it in place: Explorer restarts, the desktop being raised (Win+D), wallpaper changes. Cheap check twice a second.
  const keep = setInterval(() => { if (!win.isDestroyed() && win.isVisible() && pinned()) toBottom(); }, 500);
  win.on('closed', () => { clearInterval(keep); if (helper && !helper.isDestroyed()) helper.destroy(); });

  // Clicking away after the shortcut brought it forward puts it back on the desktop.
  win.on('blur', () => { if (raised) { raised = false; toBottom(); } });
  win.on('show', () => setTimeout(toBottom, 0));

  makeHelper();
  apply();
  toBottom();

  /** Is a below b in the window stack? (Walks down from b.) */
  const below = (a, b) => { for (let w = api.GetWindow(b, GW_HWNDNEXT), i = 0; w && i < 5000; w = api.GetWindow(w, GW_HWNDNEXT), i++) if (w === a) return true; return false; };
  return {
    native: true,
    setMode(m) { mode = m; raised = false; apply(); if (m === 'desktop') toBottom(); else toTop(); },
    /** Bring it to the front until you click elsewhere. */
    raise() { raised = true; toTop(); },
    lower() { raised = false; toBottom(); },
    isRaised: () => raised,
    /** For the Windows test: where things are in the window stack. */
    debug: () => ({ hwnd, helperHwnd, desk: desktopWindow(), helperOwner: helperHwnd ? api.GetWindow(helperHwnd, GW_OWNER) : 0, aboveDesktop: below(desktopWindow(), hwnd), below: (other) => below(hwnd, other) }),
  };
}

module.exports = { desktopLayer, INSERT_AFTER_OFFSET };
