// Windows-only touches for each card window:
// - no Windows open/close/minimise animations (DWMWA_TRANSITIONS_FORCEDISABLED), so only Esther's own fade plays;
// - a "tool window" (WS_EX_TOOLWINDOW): not in Alt+Tab or the taskbar, and left alone by Show desktop and by most
//   window-animation tools (Windhawk mods and the like look for ordinary app windows).
// With Windows' own glass, Windows rounds the corners (asked for explicitly: a frameless window isn't rounded by
// default); with Esther's own glass, Esther draws them, so Windows' rounding is switched off.
const GWL_EXSTYLE = -20;
const WS_EX_TOOLWINDOW = 0x80, WS_EX_APPWINDOW = 0x40000;
const DWMWA_TRANSITIONS_FORCEDISABLED = 3, DWMWA_WINDOW_CORNER_PREFERENCE = 33, DWMWCP_DONOTROUND = 1, DWMWCP_ROUND = 2;

let api;
function load() {
  if (api !== undefined) return api;
  api = null;
  if (process.platform !== 'win32') return api;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const dwm = koffi.load('dwmapi.dll');
    api = {
      Get: user32.func('intptr_t __stdcall GetWindowLongPtrW(uintptr_t hWnd, int nIndex)'),
      Set: user32.func('intptr_t __stdcall SetWindowLongPtrW(uintptr_t hWnd, int nIndex, intptr_t dwNewLong)'),
      Dwm: dwm.func('int32_t __stdcall DwmSetWindowAttribute(uintptr_t hwnd, uint32_t dwAttribute, const void *pvAttribute, uint32_t cbAttribute)'),
    };
  } catch { api = null; }
  return api;
}

/** Returns what was applied (for the Windows test). */
function styleCard(win, round = false) {
  const a = load();
  if (!a) return { applied: false };
  const hwnd = Number(win.getNativeWindowHandle().readBigUInt64LE(0));
  const one = Buffer.alloc(4); one.writeUInt32LE(1);
  const transitions = a.Dwm(hwnd, DWMWA_TRANSITIONS_FORCEDISABLED, one, 4) === 0;
  const corner = Buffer.alloc(4); corner.writeUInt32LE(round ? DWMWCP_ROUND : DWMWCP_DONOTROUND);
  const corners = a.Dwm(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, corner, 4) === 0;
  const ex = Number(a.Get(hwnd, GWL_EXSTYLE));
  a.Set(hwnd, GWL_EXSTYLE, (ex | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW);
  const tool = (Number(a.Get(hwnd, GWL_EXSTYLE)) & WS_EX_TOOLWINDOW) !== 0;
  return { applied: true, transitions, tool, corners, round };
}

module.exports = { styleCard };
