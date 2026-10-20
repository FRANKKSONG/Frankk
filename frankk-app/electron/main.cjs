// Esther on the Windows desktop: a frameless, see-through window that sits on the desktop like a Rainmeter skin.
// It has no taskbar button. A global shortcut (Ctrl+Alt+E by default) shows and hides it; the tray icon has the rest.
const { app, BrowserWindow, globalShortcut, ipcMain, Menu, Tray, nativeImage, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = { shortcut: 'Control+Alt+E', alwaysOnTop: false, bounds: null, hidden: false };
const file = () => path.join(app.getPath('userData'), 'desktop.json');
let prefs = { ...DEFAULTS };
try { prefs = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) }; } catch { /* first run */ }
const savePrefs = () => { try { fs.mkdirSync(path.dirname(file()), { recursive: true }); fs.writeFileSync(file(), JSON.stringify(prefs, null, 2)); } catch { /* read-only profile */ } };

let win = null;
let tray = null;
let shortcutOk = false;
const dev = process.env.ESTHER_DEV_URL;

/** Saved bounds, if they are still on a connected screen; otherwise a size that fits the main screen. */
function startBounds() {
  const area = screen.getPrimaryDisplay().workArea;
  const b = prefs.bounds;
  if (b && screen.getAllDisplays().some((d) => b.x < d.workArea.x + d.workArea.width - 80 && b.x + b.width > d.workArea.x + 80 && b.y >= d.workArea.y - 10 && b.y < d.workArea.y + d.workArea.height - 60)) return b;
  const width = Math.min(1180, area.width - 80), height = Math.min(760, area.height - 80);
  return { width, height, x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.round((area.height - height) / 2) };
}

function createWindow() {
  win = new BrowserWindow({
    ...startBounds(),
    minWidth: 520, minHeight: 360,
    frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    skipTaskbar: true, show: false, alwaysOnTop: prefs.alwaysOnTop, title: 'Esther',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  if (dev) win.loadURL(dev); else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // Show once the page is ready. 'ready-to-show' doesn't always fire for see-through windows, so the page load counts too.
  let first = true;
  const firstShow = () => { if (!first) return; first = false; if (!prefs.hidden) show(); };
  win.once('ready-to-show', firstShow);
  win.webContents.once('did-finish-load', firstShow);
  // Remember where you put it.
  let t;
  const remember = () => { clearTimeout(t); t = setTimeout(() => { if (win && !win.isMinimized()) { prefs.bounds = win.getBounds(); savePrefs(); } }, 400); };
  win.on('move', remember);
  win.on('resize', remember);
  // Links never open inside Esther.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function show() { if (!win) return; win.show(); win.focus(); prefs.hidden = false; savePrefs(); refreshTray(); }
function hide() { if (!win) return; win.hide(); prefs.hidden = true; savePrefs(); refreshTray(); }
function toggle() { if (!win) return; if (win.isVisible() && win.isFocused()) hide(); else show(); }

function registerShortcut(accel) {
  globalShortcut.unregisterAll();
  try { shortcutOk = globalShortcut.register(accel, toggle); } catch { shortcutOk = false; }
  return shortcutOk;
}

const startsWithWindows = () => app.getLoginItemSettings().openAtLogin;
const pretty = (a) => a.replace('Control', 'Ctrl').replace('CommandOrControl', 'Ctrl');

function refreshTray() {
  if (!tray) return;
  tray.setToolTip(`Esther · ${pretty(prefs.shortcut)} shows and hides`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: win && win.isVisible() ? `Hide  (${pretty(prefs.shortcut)})` : `Show  (${pretty(prefs.shortcut)})`, click: () => (win.isVisible() ? hide() : show()) },
    { type: 'separator' },
    { label: 'Always on top', type: 'checkbox', checked: prefs.alwaysOnTop, click: (i) => setPrefs({ alwaysOnTop: i.checked }) },
    { label: 'Start with Windows', type: 'checkbox', checked: startsWithWindows(), click: (i) => setPrefs({ startWithWindows: i.checked }) },
    { label: 'Put it back in the middle', click: () => { prefs.bounds = null; win.setBounds(startBounds()); show(); } },
    { type: 'separator' },
    { label: 'Quit Esther', click: () => app.quit() },
  ]));
}

function state() { return { shortcut: prefs.shortcut, shortcutOk, alwaysOnTop: prefs.alwaysOnTop, startWithWindows: startsWithWindows(), version: app.getVersion() }; }

function setPrefs(p) {
  if (typeof p.shortcut === 'string' && p.shortcut !== prefs.shortcut) {
    const old = prefs.shortcut;
    if (registerShortcut(p.shortcut)) prefs.shortcut = p.shortcut; else registerShortcut(old);
  }
  if (typeof p.alwaysOnTop === 'boolean') { prefs.alwaysOnTop = p.alwaysOnTop; win?.setAlwaysOnTop(p.alwaysOnTop); }
  if (typeof p.startWithWindows === 'boolean') app.setLoginItemSettings({ openAtLogin: p.startWithWindows, args: ['--hidden-start'] });
  savePrefs();
  refreshTray();
  return state();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  // Opening Esther again just brings this one up.
  app.on('second-instance', () => show());
  app.whenReady().then(() => {
    if (process.argv.includes('--hidden-start')) prefs.hidden = true;
    createWindow();
    registerShortcut(prefs.shortcut);
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'tray.png')));
    tray.on('click', () => (win.isVisible() ? hide() : show()));
    refreshTray();

    ipcMain.handle('esther:state', () => state());
    ipcMain.handle('esther:set', (_e, p) => setPrefs(p ?? {}));
    ipcMain.on('esther:hide', () => hide());
    ipcMain.on('esther:quit', () => app.quit());
    // Transparent windows can't be resized from their edges on Windows, so Esther has its own corner grip.
    ipcMain.on('esther:size', (_e, s) => {
      if (!win || !s) return;
      const b = win.getBounds();
      win.setBounds({ x: b.x, y: b.y, width: Math.max(520, Math.round(s.width)), height: Math.max(360, Math.round(s.height)) });
    });
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => app.quit());
}
