// Smoke test for the desktop app, run inside Electron (npm run test:desktop, needs a display; uses Xvfb on Linux).
// Loads the real main process, then checks the window, the bridge, hide/show and the saved settings.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { app, BrowserWindow, globalShortcut } = require('electron');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'esther-desk-'));
app.setPath('userData', userData);
require(path.join(__dirname, '..', 'electron', 'main.cjs'));

const results = [];
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  → ' + x}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  // Wait (up to 15 s) for the window to appear and its page to finish loading.
  let win;
  for (let i = 0; i < 150 && !(win && win.isVisible() && !win.webContents.isLoading()); i++) { await wait(100); win = BrowserWindow.getAllWindows()[0]; }
  check('A window opens', !!win && win.isVisible());
  check('It has no frame and no taskbar button, and is see-through', win && !win.isMenuBarVisible() && win.getBackgroundColor().toLowerCase().endsWith('00'), win?.getBackgroundColor());
  const js = (code) => win.webContents.executeJavaScript(code);
  check('The page loads with the desktop bridge', await js(`!!window.estherDesktop && document.documentElement.dataset.desktop === '1'`));
  check('The page shows the task table and tabs', await js(`!!document.querySelector('.table') && document.querySelectorAll('[role=tab]').length >= 2`));
  check('The page background is transparent', await js(`getComputedStyle(document.querySelector('.app')).backgroundColor`) === 'rgba(0, 0, 0, 0)');
  check('Ctrl+Alt+E is registered as the show/hide shortcut', globalShortcut.isRegistered('Control+Alt+E'));
  const st = await js(`window.estherDesktop.state()`);
  check('The bridge reports its settings', st.shortcut === 'Control+Alt+E' && st.shortcutOk === true, JSON.stringify(st));
  await js(`window.estherDesktop.set({ shortcut: 'Control+Alt+T', alwaysOnTop: true })`);
  check('Changing the shortcut moves it', globalShortcut.isRegistered('Control+Alt+T') && !globalShortcut.isRegistered('Control+Alt+E'));
  check('Always on top can be switched on', win.isAlwaysOnTop());
  await js(`window.estherDesktop.size(700, 500)`); await wait(300);
  const b = win.getBounds();
  check('The corner grip resizes the window', b.width === 700 && b.height === 500, JSON.stringify(b));
  await js(`window.estherDesktop.hide()`); await wait(300);
  check('Hide tucks it away', !win.isVisible());
  await wait(600);
  const saved = JSON.parse(fs.readFileSync(path.join(userData, 'desktop.json'), 'utf8'));
  check('Settings and size are remembered', saved.shortcut === 'Control+Alt+T' && saved.alwaysOnTop === true && saved.hidden === true, JSON.stringify(saved));
  // Typing and saving work: add a task through the page and read it back.
  win.show(); await wait(300);
  await js(`(() => { const i = document.querySelector('input[aria-label="Add a task"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Typed on the desktop'); i.dispatchEvent(new Event('input', { bubbles: true })); i.form.requestSubmit(); })()`);
  await wait(300);
  check('You can type a task in and it is saved', await js(`JSON.parse(localStorage.getItem('esther.todo.v1')).tasks.some((t) => t.title === 'Typed on the desktop')`));
  console.log(`\n${results.filter(Boolean).length}/${results.length} desktop checks passed`);
  app.exit(results.every(Boolean) ? 0 : 1);
});
