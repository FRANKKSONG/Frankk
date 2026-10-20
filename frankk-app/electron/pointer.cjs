// Where the mouse is and whether its main button is still held, for Esther's own moving and resizing.
// Esther moves cards itself instead of letting Windows drag a "title bar": no Aero Snap, no window-move animations
// from Windows or Windhawk, buttons inside the card always click, and the card can land on the grid as you drag.
const { screen } = require('electron');

let down = null;
if (process.platform === 'win32') {
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const GetAsyncKeyState = user32.func('int16_t __stdcall GetAsyncKeyState(int vKey)');
    const GetSystemMetrics = user32.func('int __stdcall GetSystemMetrics(int nIndex)');
    const SM_SWAPBUTTON = 23, VK_LBUTTON = 1, VK_RBUTTON = 2;
    // The main button is the right one for left-handed mouse settings.
    down = () => (GetAsyncKeyState(GetSystemMetrics(SM_SWAPBUTTON) ? VK_RBUTTON : VK_LBUTTON) & 0x8000) !== 0;
  } catch { down = null; }
}

/** The tests replace these to drive a drag without a real mouse. */
module.exports = { pointer: { at: () => screen.getCursorScreenPoint(), down } };
