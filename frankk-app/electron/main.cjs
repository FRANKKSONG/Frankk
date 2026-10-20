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

let layer = null;
let updates = null;
let tray = null;
let shortcutOk = false;
let settingsWin = null;
const dev = process.env.ESTHER_DEV_URL;

/**
 * Esther's cards. Each is its own small window you can drag anywhere on the desktop, so the desktop works like an
 * operation room. Default places are worked out from the main screen; double-click the Esther logo to go back to them.
 */
const CARDS = {
  header: { title: 'Esther', min: [420, 96], place: (a) => ({ x: a.x + 40, y: a.y + 40, width: Math.min(680, a.width - 480), height: 112 }) },
  tasks: { title: 'Esther · Tasks', min: [520, 300], place: (a) => ({ x: a.x + 40, y: a.y + 176, width: Math.min(1000, Math.round(a.width * 0.55)), height: a.height - 216 }) },
  calendar: { title: 'Esther · Calendar', min: [300, 330], place: (a) => ({ x: a.x + a.width - 400, y: a.y + 40, width: 360, height: 400 }) },
  week: { title: 'Esther · This week', min: [280, 220], place: (a) => ({ x: a.x + a.width - 400, y: a.y + 460, width: 360, height: Math.max(240, a.height - 500) }) },
};
const cards = new Map();
const liveCards = () => [...cards.values()].filter((w) => !w.isDestroyed());
if (!prefs.cards || typeof prefs.cards !== 'object') prefs.cards = {};
delete prefs.bounds; // the single-window size from 1.4

const onScreen = (b) => !!b && screen.getAllDisplays().some((d) => b.x < d.workArea.x + d.workArea.width - 60 && b.x + b.width > d.workArea.x + 60 && b.y >= d.workArea.y - 10 && b.y < d.workArea.y + d.workArea.height - 40);
const defaultPlace = (id) => {
  const a = screen.getPrimaryDisplay().workArea;
  const p = CARDS[id].place(a);
  return { ...p, width: Math.max(CARDS[id].min[0], Math.round(p.width)), height: Math.max(CARDS[id].min[1], Math.round(p.height)) };
};
const placeOf = (id) => (onScreen(prefs.cards[id]) ? prefs.cards[id] : defaultPlace(id));

const pageOptions = (query) => ({ query });
function load(w, query) {
  if (dev) w.loadURL(`${dev}?${new URLSearchParams(query)}`); else w.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), pageOptions(query));
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (e) => e.preventDefault());
}

const windowLook = () => ({
  frame: false, hasShadow: false, backgroundColor: '#00000000',
  // A widget, not an app window: it can't be maximised (double-click, dragging to the top edge), snapped,
  // minimised or made full screen.
  maximizable: false, minimizable: false, fullscreenable: false, thickFrame: false,
  // Frosted glass: Windows blurs only what's behind each card. Otherwise each card is simply see-through.
  ...(glassOn() ? { transparent: false, backgroundMaterial: 'acrylic', roundedCorners: true } : { transparent: true }),
  skipTaskbar: true, show: false, icon: path.join(__dirname, 'icon.png'),
  webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true, backgroundThrottling: false },
});

function createCard(id) {
  const w = new BrowserWindow({ ...placeOf(id), minWidth: CARDS[id].min[0], minHeight: CARDS[id].min[1], title: CARDS[id].title, ...windowLook() });
  load(w, { card: id });
  w.webContents.once('did-finish-load', () => { if (!startHidden) w.showInactive(); });
  // Remember where you put it.
  let t;
  const remember = () => { clearTimeout(t); t = setTimeout(() => { if (!w.isDestroyed() && onScreen(w.getBounds())) { prefs.cards[id] = w.getBounds(); savePrefs(); } }, 400); };
  w.on('move', remember);
  w.on('resize', remember);
  w.on('maximize', () => w.unmaximize());
  // "Show desktop" (Win+D) can minimise windows; with no taskbar button, a card comes straight back.
  w.on('minimize', () => setTimeout(() => { if (!w.isDestroyed() && w.isMinimized()) w.restore(); }, 50));
  layer.add(w);
  cards.set(id, w);
  return w;
}
let startHidden = false;

/** Settings: its own card, opened from the gear and tucked away when you click elsewhere. */
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  const a = screen.getPrimaryDisplay().workArea;
  const width = Math.min(600, a.width - 80), height = Math.min(760, a.height - 80);
  settingsWin = new BrowserWindow({ width, height, x: a.x + Math.round((a.width - width) / 2), y: a.y + Math.round((a.height - height) / 2), title: 'Esther · Settings', ...windowLook() });
  load(settingsWin, { card: 'settings' });
  settingsWin.webContents.once('did-finish-load', () => { settingsWin.show(); settingsWin.focus(); });
  settingsWin.on('blur', () => setTimeout(() => { if (settingsWin && !settingsWin.isDestroyed() && !settingsWin.isFocused() && !process.env.ESTHER_TEST) settingsWin.hide(); }, 150));
  settingsWin.on('closed', () => { settingsWin = null; });
}

/** Put every card back where it started. */
function resetLayout() {
  prefs.cards = {};
  savePrefs();
  for (const [id, w] of cards) if (!w.isDestroyed()) w.setBounds(defaultPlace(id));
}

/** Put cards back on a screen if a monitor was unplugged, turned off or changed resolution. */
function ensureOnScreen() { for (const [id, w] of cards) if (!w.isDestroyed() && !onScreen(w.getBounds())) { delete prefs.cards[id]; w.setBounds(defaultPlace(id)); } }

/** Show every card, in front of everything (on the desktop layer, until you click elsewhere). Works from any state. */
function show() {
  ensureOnScreen();
  layer?.raise(); // first, so Windows doesn't place them at the bottom while they appear
  for (const w of liveCards()) { if (w.isMinimized()) w.restore(); w.show(); }
  layer?.raise();
  cards.get('tasks')?.focus();
  refreshTray();
}
function hide() { for (const w of liveCards()) w.hide(); settingsWin?.isDestroyed() === false && settingsWin.hide(); refreshTray(); }
const anyCardFocused = () => liveCards().some((w) => w.isFocused());
/** The shortcut: if the cards are plainly in front, hide them; otherwise (hidden, behind other windows) bring them forward. */
function toggle() {
  const visible = liveCards().some((w) => w.isVisible());
  const inFront = visible && anyCardFocused() && (prefs.layer !== 'desktop' || layer?.isRaised?.());
  if (inFront) hide(); else show();
}
const broadcast = (channel, payload) => { for (const w of [...liveCards(), settingsWin]) if (w && !w.isDestroyed()) w.webContents.send(channel, payload); };

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
    { label: 'Hide', enabled: liveCards().some((w) => w.isVisible()), click: () => hide() },
    { type: 'separator' },
    { label: 'On the desktop (under other windows)', type: 'radio', checked: prefs.layer === 'desktop', click: () => setPrefs({ layer: 'desktop' }) },
    { label: 'Like a normal window', type: 'radio', checked: prefs.layer === 'normal', click: () => setPrefs({ layer: 'normal' }) },
    { label: 'Always on top', type: 'radio', checked: prefs.layer === 'top', click: () => setPrefs({ layer: 'top' }) },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: startsWithWindows(), click: (i) => setPrefs({ startWithWindows: i.checked }) },
    ...(updates?.status().state === 'ready' ? [{ label: `Restart to update to ${updates.status().next}`, click: () => updates.install() }] : [{ label: 'Check for updates', enabled: !!updates && !['dev', 'portable'].includes(updates.status().state), click: () => updates.check() }]),
    { label: 'Put the cards back where they started', click: () => { resetLayout(); show(); } },
    { label: 'Settings…', click: () => openSettings() },
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
    layer = desktopLayer(prefs.layer, (m) => console.warn(m));
    for (const id of Object.keys(CARDS)) createCard(id);
    registerShortcut(prefs.shortcut);
    // Monitors coming and going (or waking from sleep) never leave it stranded off-screen.
    for (const ev of ['display-removed', 'display-metrics-changed', 'display-added']) screen.on(ev, () => setTimeout(ensureOnScreen, 500));
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'tray.png')));
    tray.on('click', () => show());
    refreshTray();

    updates = setupUpdates({ app, send: (st) => { broadcast('esther:update', st); refreshTray(); }, log: (m) => console.warn(m) });
    ipcMain.handle('esther:state', () => state());
    ipcMain.handle('esther:update-status', () => updates.status());
    ipcMain.on('esther:update-check', () => updates.check());
    ipcMain.on('esther:update-install', () => updates.install());
    ipcMain.handle('esther:set', (_e, p) => setPrefs(p ?? {}));
    ipcMain.on('esther:hide', () => hide());
    ipcMain.on('esther:lower', () => layer?.lower());
    ipcMain.on('esther:settings', () => openSettings());
    ipcMain.on('esther:settings-close', () => settingsWin?.isDestroyed() === false && settingsWin.hide());
    ipcMain.on('esther:reset-layout', () => resetLayout());
    ipcMain.on('esther:quit', () => app.quit());
    // Transparent windows can't be resized from their edges on Windows, so Esther has its own corner grip.
    // Only the size changes; the top-left corner stays where it is (setting both at once misplaced it on Windows).
    ipcMain.on('esther:size', (e, s) => {
      const w = BrowserWindow.fromWebContents(e.sender);
      if (!w || !s || w.isMinimized()) return;
      const [mw, mh] = w.getMinimumSize();
      w.setSize(Math.max(mw || 260, Math.round(s.width)), Math.max(mh || 200, Math.round(s.height)));
    });
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  if (process.env.ESTHER_TEST) global.__esther = { show, hide, toggle, resetLayout, defaultPlace, openSettings, layer: () => layer, card: (id) => cards.get(id), settings: () => settingsWin };
  app.on('window-all-closed', () => app.quit());
}
