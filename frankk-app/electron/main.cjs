// Esther on the Windows desktop: a frameless, see-through window that sits on the desktop like a Rainmeter skin.
// It has no taskbar button. A global shortcut (Ctrl+Alt+E by default) shows and hides it; the tray icon has the rest.
const { app, BrowserWindow, globalShortcut, ipcMain, Menu, Tray, nativeImage, screen } = require('electron');
const os = require('node:os');
const { desktopLayer } = require('./desktop-layer.cjs');
const { setupUpdates } = require('./updates.cjs');
const fs = require('node:fs');
const path = require('node:path');

const LAYERS = ['desktop', 'normal', 'top'];
// Frosted glass (Windows 11's acrylic material) needs Windows 11 22H2 or later.
const glassSupported = process.platform === 'win32' && Number(os.release().split('.')[2] ?? 0) >= 22621;
// A desktop widget is meant to be seen while other windows sit around it: never pause it for looking "covered"
// (Chromium's occlusion tracking on Windows would otherwise freeze the page when it's on the desktop layer).
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

const DEFAULTS = { shortcut: 'Control+Alt+E', layer: 'desktop', bounds: null, glass: true };
const file = () => path.join(app.getPath('userData'), 'desktop.json');
let prefs = { ...DEFAULTS };
try { prefs = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) }; } catch { /* first run */ }
// 1.1 had an "always on top" switch; it becomes the 'top' layer.
if (prefs.alwaysOnTop === true) prefs.layer = 'top';
delete prefs.alwaysOnTop;
if (!LAYERS.includes(prefs.layer)) prefs.layer = 'desktop';
// Esther always appears when it starts (older versions could start hidden and look broken).
delete prefs.hidden;
const glassOn = () => glassSupported && prefs.glass !== false;
const savePrefs = () => { try { fs.mkdirSync(path.dirname(file()), { recursive: true }); fs.writeFileSync(file(), JSON.stringify(prefs, null, 2)); } catch { /* read-only profile */ } };

let win = null;
let layer = null;
let updates = null;
let tray = null;
let shortcutOk = false;
const dev = process.env.ESTHER_DEV_URL;

const onScreen = (b) => !!b && screen.getAllDisplays().some((d) => b.x < d.workArea.x + d.workArea.width - 80 && b.x + b.width > d.workArea.x + 80 && b.y >= d.workArea.y - 10 && b.y < d.workArea.y + d.workArea.height - 60);

/** Saved bounds, if they are still on a connected screen; otherwise a size that fits the main screen. */
function startBounds() {
  const area = screen.getPrimaryDisplay().workArea;
  const b = prefs.bounds;
  if (onScreen(b)) return b;
  const width = Math.min(1180, area.width - 80), height = Math.min(760, area.height - 80);
  return { width, height, x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.round((area.height - height) / 2) };
}

function createWindow() {
  win = new BrowserWindow({
    ...startBounds(),
    minWidth: 520, minHeight: 360,
    frame: false, hasShadow: false, backgroundColor: '#00000000',
    // A widget, not an app window: it can't be maximised (double-click, dragging to the top edge), snapped,
    // minimised or made full screen. Resize it from its corner grip.
    maximizable: false, minimizable: false, fullscreenable: false, thickFrame: false,
    // Frosted glass: Windows blurs whatever is behind the window. Otherwise the window is simply see-through.
    ...(glassOn() ? { transparent: false, backgroundMaterial: 'acrylic', roundedCorners: true } : { transparent: true }),
    skipTaskbar: true, show: false, title: 'Esther',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true, backgroundThrottling: false },
  });
  if (dev) win.loadURL(dev); else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // Show once the page is ready. 'ready-to-show' doesn't always fire for see-through windows, so the page load counts too.
  let first = true;
  const firstShow = () => { if (!first) return; first = false; show(); };
  win.once('ready-to-show', firstShow);
  win.webContents.once('did-finish-load', firstShow);
  // Remember where you put it.
  let t;
  const remember = () => { clearTimeout(t); t = setTimeout(() => { if (win && !win.isMinimized() && onScreen(win.getBounds())) { prefs.bounds = win.getBounds(); savePrefs(); } }, 400); };
  win.on('move', remember);
  win.on('resize', remember);
  layer = desktopLayer(win, prefs.layer, (m) => console.warn(m));
  win.on('maximize', () => win.unmaximize());
  // "Show desktop" (Win+D, or the corner of the taskbar) can minimise it. Esther has no taskbar button to come back
  // from, so on the desktop layer it un-minimises straight away and stays on the desktop.
  win.on('minimize', () => { if (prefs.layer === 'desktop') setTimeout(() => { if (win.isMinimized()) { win.restore(); layer?.lower(); } }, 50); });
  // Links never open inside Esther.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

/** Put it back on a screen if a monitor was unplugged, turned off or changed resolution. */
function ensureOnScreen() { if (win && !onScreen(win.getBounds())) { prefs.bounds = null; win.setBounds(startBounds()); } }

/** Show it in front of everything (on the desktop layer, until you click elsewhere). Works from any state: hidden, minimised, off-screen. */
function show() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  ensureOnScreen();
  layer?.raise(); // first, so Windows doesn't place it at the bottom while it appears
  win.show();
  layer?.raise();
  win.focus();
  refreshTray();
}
function hide() { if (!win) return; win.hide(); refreshTray(); }
/** The shortcut: if Esther is plainly in front, hide it; in every other case (hidden, minimised, behind other windows) bring it forward. */
function toggle() {
  if (!win) return;
  const inFront = win.isVisible() && !win.isMinimized() && win.isFocused() && (prefs.layer !== 'desktop' || layer?.isRaised?.());
  if (inFront) hide(); else show();
}

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
    { label: `Show Esther  (${pretty(prefs.shortcut)})`, click: () => show() },
    { label: 'Hide', enabled: !!win && win.isVisible(), click: () => hide() },
    { type: 'separator' },
    { label: 'On the desktop (under other windows)', type: 'radio', checked: prefs.layer === 'desktop', click: () => setPrefs({ layer: 'desktop' }) },
    { label: 'Like a normal window', type: 'radio', checked: prefs.layer === 'normal', click: () => setPrefs({ layer: 'normal' }) },
    { label: 'Always on top', type: 'radio', checked: prefs.layer === 'top', click: () => setPrefs({ layer: 'top' }) },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: startsWithWindows(), click: (i) => setPrefs({ startWithWindows: i.checked }) },
    ...(updates?.status().state === 'ready' ? [{ label: `Restart to update to ${updates.status().next}`, click: () => updates.install() }] : [{ label: 'Check for updates', enabled: !!updates && !['dev', 'portable'].includes(updates.status().state), click: () => updates.check() }]),
    { label: 'Put it back in the middle', click: () => { prefs.bounds = null; win.setBounds(startBounds()); show(); } },
    { type: 'separator' },
    { label: 'Quit Esther', click: () => app.quit() },
  ]));
}

function state() { return { shortcut: prefs.shortcut, shortcutOk, layer: prefs.layer, pinsToDesktop: !!layer?.native, glass: glassOn(), glassSupported, startWithWindows: startsWithWindows(), version: app.getVersion() }; }

function setPrefs(p) {
  if (typeof p.shortcut === 'string' && p.shortcut !== prefs.shortcut) {
    const old = prefs.shortcut;
    if (registerShortcut(p.shortcut)) prefs.shortcut = p.shortcut; else registerShortcut(old);
  }
  if (LAYERS.includes(p.layer)) { prefs.layer = p.layer; layer?.setMode(p.layer); }
  if (typeof p.startWithWindows === 'boolean') app.setLoginItemSettings({ openAtLogin: p.startWithWindows });
  // Glass is chosen when the window is made, so Esther restarts to switch it.
  if (typeof p.glass === 'boolean' && p.glass !== prefs.glass) { prefs.glass = p.glass; savePrefs(); app.relaunch(); app.exit(0); }
  savePrefs();
  refreshTray();
  return state();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  // Opening Esther again just brings this one up.
  app.on('second-instance', () => show());
  app.whenReady().then(() => {
    createWindow();
    registerShortcut(prefs.shortcut);
    // Monitors coming and going (or waking from sleep) never leave it stranded off-screen.
    for (const ev of ['display-removed', 'display-metrics-changed', 'display-added']) screen.on(ev, () => setTimeout(ensureOnScreen, 500));
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'tray.png')));
    tray.on('click', () => show());
    refreshTray();

    updates = setupUpdates({ app, send: (st) => { win?.webContents.send('esther:update', st); refreshTray(); }, log: (m) => console.warn(m) });
    ipcMain.handle('esther:state', () => state());
    ipcMain.handle('esther:update-status', () => updates.status());
    ipcMain.on('esther:update-check', () => updates.check());
    ipcMain.on('esther:update-install', () => updates.install());
    ipcMain.handle('esther:set', (_e, p) => setPrefs(p ?? {}));
    ipcMain.on('esther:hide', () => hide());
    // Esc / done: on the desktop layer, step back behind your windows instead of vanishing.
    ipcMain.on('esther:lower', () => layer?.lower());
    ipcMain.on('esther:quit', () => app.quit());
    // Transparent windows can't be resized from their edges on Windows, so Esther has its own corner grip.
    // Only the size changes; the top-left corner stays where it is (setting both at once misplaced it on Windows).
    ipcMain.on('esther:size', (_e, s) => {
      if (!win || !s || win.isMinimized()) return;
      win.setSize(Math.max(520, Math.round(s.width)), Math.max(360, Math.round(s.height)));
    });
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  if (process.env.ESTHER_TEST) global.__esther = { show, hide, toggle, layer: () => layer, win: () => win };
  app.on('window-all-closed', () => app.quit());
}
