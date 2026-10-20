// Where Esther sits among your windows, on Windows:
//   'desktop' – on the desktop, under every other window (like a Rainmeter skin set to "On desktop"),
//   'normal'  – like any window,
//   'top'     – always on top.
// Electron can't keep a window under the others, so this talks to Windows directly (user32) through koffi:
// every time Windows is about to restack Esther (WM_WINDOWPOSCHANGING) it is told "put it at the bottom".
// When you press the shortcut Esther comes to the front until you click elsewhere. When you show the desktop
// (Win+D), Esther is lifted above it so it stays visible. Anywhere else (or if koffi can't load) it is a normal window.
const WM_WINDOWPOSCHANGING = 0x0046;
const HWND_TOP = 0, HWND_BOTTOM = 1;
const SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOACTIVATE = 0x10;
const KEEP = SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE;
/** WINDOWPOS on 64-bit Windows: { HWND hwnd; HWND hwndInsertAfter; ... }, so the "insert after" handle is at byte 8. */
const INSERT_AFTER_OFFSET = 8;

function desktopLayer(win, initialMode, log = () => {}) {
  let mode = initialMode;
  let raised = false;
  let overDesktop = false;
  const apply = () => win.setAlwaysOnTop(mode === 'top');
  if (process.platform !== 'win32') { apply(); return { setMode(m) { mode = m; apply(); }, raise() {}, lower() {}, native: false }; }

  let api;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    api = {
      SetWindowPos: user32.func('bool __stdcall SetWindowPos(uintptr_t hWnd, uintptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32_t uFlags)'),
      GetForegroundWindow: user32.func('uintptr_t __stdcall GetForegroundWindow()'),
      GetClassNameW: user32.func('int __stdcall GetClassNameW(uintptr_t hWnd, _Out_ uint16_t *lpClassName, int nMaxCount)'),
      // Writes bytes to an address Windows hands us (the WINDOWPOS of WM_WINDOWPOSCHANGING).
      Poke: kernel32.func('void __stdcall RtlMoveMemory(uintptr_t Destination, const uint8_t *Source, size_t Length)'),
    };
  } catch (e) { log(`desktop layer unavailable: ${e.message}`); apply(); return { setMode(m) { mode = m; apply(); }, raise() {}, lower() {}, native: false }; }

  const hwnd = Number(win.getNativeWindowHandle().readBigUInt64LE(0));
  const bottom = Buffer.alloc(8); bottom.writeBigUInt64LE(BigInt(HWND_BOTTOM));
  const pinned = () => mode === 'desktop' && !raised && !overDesktop;
  const toBottom = () => { if (pinned()) api.SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, KEEP); };
  const toTop = () => api.SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0, KEEP);

  win.hookWindowMessage(WM_WINDOWPOSCHANGING, (_wParam, lParam) => {
    if (!pinned()) return;
    try { api.Poke(Number(lParam.readBigUInt64LE(0)) + INSERT_AFTER_OFFSET, bottom, 8); } catch { /* leave Windows' choice */ }
  });

  // Win+D / "Show desktop" brings the desktop itself to the front; lift Esther above it while it's there.
  const name = new Uint16Array(64);
  const poll = setInterval(() => {
    if (mode !== 'desktop' || win.isDestroyed() || !win.isVisible()) return;
    const fg = api.GetForegroundWindow();
    const n = api.GetClassNameW(fg, name, 64);
    const cls = String.fromCharCode(...name.subarray(0, Math.max(0, n)));
    const desk = cls === 'WorkerW' || cls === 'Progman';
    if (desk && !overDesktop) { overDesktop = true; toTop(); }
    else if (!desk && overDesktop && fg !== hwnd) { overDesktop = false; toBottom(); }
  }, 400);
  win.on('closed', () => clearInterval(poll));

  // Clicking away after the shortcut brought it forward puts it back on the desktop.
  win.on('blur', () => { if (raised) { raised = false; toBottom(); } });
  win.on('show', () => setTimeout(toBottom, 0));

  apply();
  toBottom();
  return {
    native: true,
    setMode(m) { mode = m; raised = false; apply(); if (m === 'desktop') toBottom(); else toTop(); },
    /** Bring it to the front until you click elsewhere. */
    raise() { raised = true; toTop(); },
    lower() { raised = false; toBottom(); },
  };
}

module.exports = { desktopLayer, INSERT_AFTER_OFFSET };
