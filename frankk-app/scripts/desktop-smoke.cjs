// Smoke test for the desktop app, run inside Electron (npm run test:desktop, needs a display; uses Xvfb on Linux).
// Loads the real main process, then checks the window, the bridge, hide/show and the saved settings.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { app, BrowserWindow, globalShortcut } = require('electron');
process.env.ESTHER_TEST = '1';
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'esther-desk-'));
app.setPath('userData', userData);
require(path.join(__dirname, '..', 'electron', 'main.cjs'));

const results = [];
const check = (n, ok, x = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  → ' + x}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Never hang: a stuck check reports what passed so far and fails.
setTimeout(() => { console.log(`TIMEOUT after 90 s; ${results.filter(Boolean).length}/${results.length} checks had passed`); app.exit(1); }, 90_000);
process.on('unhandledRejection', (e) => { console.log('ERROR', e?.stack ?? e); app.exit(1); });

app.whenReady().then(async () => {
  console.log('desktop checks starting on', process.platform);
  // Wait (up to 15 s) for the window to appear and its page to finish loading.
  let win;
  for (let i = 0; i < 150 && !(win && win.isVisible() && !win.webContents.isLoading()); i++) { await wait(100); win = BrowserWindow.getAllWindows()[0]; }
  check('A window opens', !!win && win.isVisible());
  check('It has no frame and no taskbar button, and is see-through', win && !win.isMenuBarVisible() && win.getBackgroundColor().toLowerCase().endsWith('00'), win?.getBackgroundColor());
  // Each request to the page gets 10 s; a stall names the step instead of hanging the whole run.
  const js = (code) => Promise.race([win.webContents.executeJavaScript(code), wait(10_000).then(() => { throw new Error(`page did not answer: ${code.slice(0, 80)}`); })]);
  console.log('page state:', JSON.stringify({ url: win.webContents.getURL().slice(-40), loading: win.webContents.isLoading(), crashed: win.webContents.isCrashed(), visible: win.isVisible(), bounds: win.getBounds() }));
  check('The page loads with the desktop bridge', await js(`!!window.estherDesktop && document.documentElement.dataset.desktop === '1'`));
  check('The page shows the task table and tabs', await js(`!!document.querySelector('.table') && document.querySelectorAll('[role=tab]').length >= 2`));
  check('The page background is transparent', await js(`getComputedStyle(document.querySelector('.app')).backgroundColor`) === 'rgba(0, 0, 0, 0)');
  check('Ctrl+Alt+E is registered as the show/hide shortcut', globalShortcut.isRegistered('Control+Alt+E'));
  const st = await js(`window.estherDesktop.state()`);
  check('The bridge reports its settings', st.shortcut === 'Control+Alt+E' && st.shortcutOk === true, JSON.stringify(st));
  check('It starts on the desktop layer', st.layer === 'desktop', JSON.stringify(st));
  await js(`window.estherDesktop.set({ shortcut: 'Control+Alt+T', layer: 'top' })`);
  check('Changing the shortcut moves it', globalShortcut.isRegistered('Control+Alt+T') && !globalShortcut.isRegistered('Control+Alt+E'));
  check('Always on top can be switched on', win.isAlwaysOnTop());
  await js(`window.estherDesktop.set({ layer: 'desktop' })`);
  check('Back on the desktop it is not on top', !win.isAlwaysOnTop());
  await js(`window.estherDesktop.size(700, 500)`); await wait(300);
  const b = win.getBounds();
  check('The corner grip resizes the window', b.width === 700 && b.height === 500, JSON.stringify(b));
  await js(`window.estherDesktop.hide()`); await wait(300);
  check('Hide tucks it away', !win.isVisible());
  await wait(600);
  const saved = JSON.parse(fs.readFileSync(path.join(userData, 'desktop.json'), 'utf8'));
  check('Settings and size are remembered', saved.shortcut === 'Control+Alt+T' && saved.layer === 'desktop' && saved.bounds?.width === 700, JSON.stringify(saved));
  // Typing and saving work: add a task through the page and read it back.
  win.show(); await wait(300);
  await js(`(() => { const i = document.querySelector('input[aria-label="Add a task"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Typed on the desktop'); i.dispatchEvent(new Event('input', { bubbles: true })); i.form.requestSubmit(); })()`);
  await wait(300);
  check('You can type a task in and it is saved', await js(`JSON.parse(localStorage.getItem('esther.todo.v1')).tasks.some((t) => t.title === 'Typed on the desktop')`));
  // Coming back from every way it can disappear.
  const e = global.__esther;
  win.minimize(); await wait(300); e.show(); await wait(300);
  check('After being minimised (Win+D), the shortcut brings it back', win.isVisible() && !win.isMinimized());
  win.setBounds({ x: -5000, y: -5000, width: 700, height: 500 }); await wait(200); e.show(); await wait(300);
  const nb = win.getBounds();
  check('Off-screen (a monitor went away), the shortcut puts it back on screen', nb.x > -1000 && nb.y > -1000, JSON.stringify(nb));
  e.hide(); await wait(200); e.toggle(); await wait(300);
  check('Hidden, the shortcut shows it', win.isVisible());
  check('Text colours are solid on the desktop (no see-through grey)', await js(`(() => { const c = getComputedStyle(document.querySelector('.greet-date')).color; return !c.includes('/') && !c.startsWith('rgba'); })()`), await js(`getComputedStyle(document.querySelector('.greet-date')).color`));
  if (process.platform === 'win32') check('Windows: it cannot be maximised, minimised or made full screen like an app window', !win.isMaximizable() && !win.isMinimizable() && !win.isFullScreenable());
  win.maximize(); await wait(300);
  check('Asking it to maximise does nothing', !win.isMaximized());

  // Windows only: the desktop layer, checked against the real window stack.
  if (process.platform === 'win32') {
    const L = e.layer();
    await js(`window.estherDesktop.set({ layer: 'desktop' })`);
    const other = new BrowserWindow({ width: 900, height: 700, x: 50, y: 50, title: 'Another app' });
    await other.loadURL('data:text/html,<h1>another app</h1>');
    other.show(); other.focus(); await wait(1200);
    const d = L.debug();
    console.log('window stack:', JSON.stringify({ ...d, below: undefined }));
    check('Windows: the desktop helper is attached to the desktop window', d && d.helperHwnd && d.helperOwner === d.desk, JSON.stringify(d));
    check('Windows: after clicking another app, Esther is still above the desktop (not hidden under it)', d && d.aboveDesktop);
    check('Windows: ...and under the other app', d && d.below(Number(other.getNativeWindowHandle().readBigUInt64LE(0))));
    check('Windows: ...and still showing', win.isVisible() && !win.isMinimized());
    e.toggle(); await wait(800);
    check('Windows: the shortcut brings it in front of the other app', !L.debug().below(Number(other.getNativeWindowHandle().readBigUInt64LE(0))));
    other.focus(); await wait(1000);
    check('Windows: clicking the other app again puts Esther back on the desktop, still visible', L.debug().aboveDesktop && win.isVisible());
    other.destroy();
  } else console.log('(Windows window-stack checks run on Windows only)');

  const up = await js(`window.estherDesktop.updates.status()`);
  check('The updater reports its state (off when not installed)', up.state === 'dev' && up.version === app.getVersion(), JSON.stringify(up));
  console.log(`\n${results.filter(Boolean).length}/${results.length} desktop checks passed`);
  app.exit(results.every(Boolean) ? 0 : 1);
});
