// Esther on the Windows desktop: a frameless, see-through window that sits on the desktop like a Rainmeter skin.
// It has no taskbar button. A global shortcut (Ctrl+Alt+E by default) shows and hides it; the tray icon has the rest.
const { app, BrowserWindow, globalShortcut, ipcMain, Menu, Tray, nativeImage, screen } = require('electron');
const { desktopLayer } = require('./desktop-layer.cjs');
const { setupUpdates } = require('./updates.cjs');
const { styleCard } = require('./win-style.cjs');
const { wallpaperFor, watchWallpaper } = require('./wallpaper.cjs');
const fs = require('node:fs');
const path = require('node:path');

const LAYERS = ['desktop', 'normal', 'top'];
// A desktop widget is meant to be seen while other windows sit around it: never pause it for looking "covered"
// (Chromium's occlusion tracking on Windows would otherwise freeze the page when it's on the desktop layer).
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

const DEFAULTS = { shortcut: 'Control+Alt+E', layer: 'desktop', snap: true, scale: 1, hiddenCards: [] };
const SCALES = [0.5, 0.6, 0.75, 0.85, 0.9, 0.95, 1, 1.1, 1.25, 1.5];
const file = () => path.join(app.getPath('userData'), 'desktop.json');
let prefs = { ...DEFAULTS };
try { prefs = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) }; } catch { /* first run */ }
// 1.1 had an "always on top" switch; it becomes the 'top' layer.
if (prefs.alwaysOnTop === true) prefs.layer = 'top';
delete prefs.alwaysOnTop;
if (!LAYERS.includes(prefs.layer)) prefs.layer = 'desktop';
// Esther always appears when it starts (older versions could start hidden and look broken).
delete prefs.hidden;
// 1.4–1.5 used Windows' acrylic; Esther now draws its own blur (adjustable, round corners).
delete prefs.glass;
if (!SCALES.includes(prefs.scale)) prefs.scale = 1;
if (!Array.isArray(prefs.hiddenCards)) prefs.hiddenCards = [];
let quitting = false;
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
const GAP = 16; // the even gap between cards, and between cards and the screen edge
// Default places, worked out in unscaled units (see defaultPlace) so every size gets the same tidy layout.
const CARDS = {
  header: { title: 'Esther', min: [420, 96], place: (a, g) => ({ x: g, y: g, width: Math.min(680, a.width - 480), height: 112 }) },
  tasks: { title: 'Esther · Tasks', min: [520, 300], place: (a, g) => ({ x: g, y: g + 112 + g, width: Math.min(1000, Math.round(a.width * 0.55)), height: a.height - 112 - 3 * g }) },
  calendar: { title: 'Esther · Calendar', min: [300, 330], place: (a, g) => ({ x: a.width - g - 360, y: g, width: 360, height: 400 }) },
  week: { title: 'Esther · This week', min: [280, 220], place: (a, g) => ({ x: a.width - g - 360, y: g + 400 + g, width: 360, height: Math.max(240, a.height - 400 - 3 * g) }) },
};
const cards = new Map();
const liveCards = () => [...cards.values()].filter((w) => !w.isDestroyed());
if (!prefs.cards || typeof prefs.cards !== 'object') prefs.cards = {};
delete prefs.bounds; // the single-window size from 1.4

const onScreen = (b) => !!b && screen.getAllDisplays().some((d) => b.x < d.workArea.x + d.workArea.width - 60 && b.x + b.width > d.workArea.x + 60 && b.y >= d.workArea.y - 10 && b.y < d.workArea.y + d.workArea.height - 40);
const minOf = (id) => CARDS[id].min.map((n) => Math.round(n * prefs.scale));
const defaultPlace = (id) => {
  const a = screen.getPrimaryDisplay().workArea, k = prefs.scale;
  const p = CARDS[id].place({ width: a.width / k, height: a.height / k }, GAP / k);
  const [mw, mh] = minOf(id);
  return { x: a.x + Math.round(p.x * k), y: a.y + Math.round(p.y * k), width: Math.max(mw, Math.round(p.width * k)), height: Math.max(mh, Math.round(p.height * k)) };
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
  // See-through: Esther draws the card, its rounded corners and its own blur of the wallpaper behind it.
  transparent: true, roundedCorners: false,
  skipTaskbar: true, show: false, icon: path.join(__dirname, 'icon.png'),
  webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true, backgroundThrottling: false },
});

const cardOn = (id) => !prefs.hiddenCards.includes(id);

/** What a card needs to draw its blur: the wallpaper of the screen it's on, and where it sits on that screen. */
function sendBackdrop(w) {
  if (w.isDestroyed()) return;
  const b = w.getBounds();
  const d = screen.getDisplayMatching(b);
  w.webContents.send('esther:backdrop', { image: wallpaperFor(d), screen: d.bounds, x: b.x, y: b.y, scale: prefs.scale });
}
const sendPlace = (w) => { if (!w.isDestroyed()) { const b = w.getBounds(); w.webContents.send('esther:place', { x: b.x, y: b.y, screen: screen.getDisplayMatching(b).bounds }); } };

function createCard(id) {
  const [mw, mh] = minOf(id);
  const w = new BrowserWindow({ ...placeOf(id), minWidth: mw, minHeight: mh, title: CARDS[id].title, ...windowLook() });
  load(w, { card: id });
  w.webContents.on('did-finish-load', () => { w.webContents.setZoomFactor(prefs.scale); sendBackdrop(w); });
  w.webContents.once('did-finish-load', () => { if (!startHidden && cardOn(id)) w.showInactive(); });
  w.styled = styleCard(w);
  // Alt+F4 or closing a card only hides it; turn it back on from Settings → Cards or the tray.
  w.on('close', (e) => { if (quitting) return; e.preventDefault(); setCard(id, false); });
  // Snap into line with the other cards and the screen edges when you let go.
  let snapping = false, settle;
  const snapNow = () => { if (snapping || !prefs.snap || w.isDestroyed()) return; const b = w.getBounds(); const n = snapMove(id, b); if (n.x !== b.x || n.y !== b.y) { snapping = true; w.setPosition(n.x, n.y); setTimeout(() => { snapping = false; }, 50); } };
  if (process.platform === 'win32') w.on('moved', snapNow); else w.on('move', () => { clearTimeout(settle); settle = setTimeout(snapNow, 300); });
  w.on('move', () => sendPlace(w));
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

// ---- Snapping: cards line up with each other (with an even gap) and with the screen edges. ----
const NEAR = 14;
const others = (id) => [...cards].filter(([k, w]) => k !== id && !w.isDestroyed() && w.isVisible()).map(([, w]) => w.getBounds());
const nearest = (value, targets) => { let best = value, dist = NEAR + 1; for (const t of targets) { const d = Math.abs(t - value); if (d < dist) { dist = d; best = t; } } return best; };
/** Where a card should land after a move. */
function snapMove(id, b) {
  const wa = screen.getDisplayMatching(b).workArea;
  const os = others(id);
  const xs = [wa.x + GAP, wa.x + wa.width - GAP - b.width, ...os.flatMap((o) => [o.x, o.x + o.width + GAP, o.x - GAP - b.width, o.x + o.width - b.width])];
  const ys = [wa.y + GAP, wa.y + wa.height - GAP - b.height, ...os.flatMap((o) => [o.y, o.y + o.height + GAP, o.y - GAP - b.height, o.y + o.height - b.height])];
  return { x: nearest(b.x, xs), y: nearest(b.y, ys) };
}
/** The size a card should take while you resize it from its corner: edges and sizes line up with the others. */
function snapSize(id, b, width, height) {
  if (!prefs.snap) return { width, height };
  const wa = screen.getDisplayMatching(b).workArea;
  const os = others(id);
  const rights = [wa.x + wa.width - GAP, ...os.flatMap((o) => [o.x + o.width, o.x - GAP])].map((r) => r - b.x);
  const bottoms = [wa.y + wa.height - GAP, ...os.flatMap((o) => [o.y + o.height, o.y - GAP])].map((r) => r - b.y);
  return { width: nearest(width, [...rights, ...os.map((o) => o.width)]), height: nearest(height, [...bottoms, ...os.map((o) => o.height)]) };
}

/** Turn one card on or off. */
function setCard(id, on) {
  const w = cards.get(id);
  prefs.hiddenCards = prefs.hiddenCards.filter((k) => k !== id).concat(on ? [] : [id]);
  savePrefs();
  if (w && !w.isDestroyed()) { if (on) { w.show(); layer?.raise(); } else w.hide(); }
  refreshTray();
  broadcast('esther:changed', null);
}

/** Make everything bigger or smaller; cards keep their top-left corner. */
function setScale(next) {
  if (!SCALES.includes(next) || next === prefs.scale) return;
  const r = next / prefs.scale;
  prefs.scale = next;
  for (const [id, w] of cards) {
    if (w.isDestroyed()) continue;
    const b = w.getBounds();
    const [mw, mh] = minOf(id);
    w.setMinimumSize(mw, mh);
    w.setBounds({ x: b.x, y: b.y, width: Math.max(mw, Math.round(b.width * r)), height: Math.max(mh, Math.round(b.height * r)) });
    w.webContents.setZoomFactor(next);
    sendBackdrop(w);
  }
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.setZoomFactor(next);
  savePrefs();
}

/** Settings: its own card, opened from the gear and tucked away when you click elsewhere. */
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  const a = screen.getPrimaryDisplay().workArea;
  const width = Math.min(Math.round(780 * prefs.scale), a.width - 80), height = Math.min(Math.round(640 * prefs.scale), a.height - 80);
  settingsWin = new BrowserWindow({ width, height, x: a.x + Math.round((a.width - width) / 2), y: a.y + Math.round((a.height - height) / 2), title: 'Esther · Settings', ...windowLook() });
  load(settingsWin, { card: 'settings' });
  settingsWin.webContents.on('did-finish-load', () => { settingsWin.webContents.setZoomFactor(prefs.scale); sendBackdrop(settingsWin); });
  settingsWin.webContents.once('did-finish-load', () => { settingsWin.show(); settingsWin.focus(); });
  styleCard(settingsWin);
  settingsWin.on('move', () => sendPlace(settingsWin));
  settingsWin.on('blur', () => setTimeout(() => { if (settingsWin && !settingsWin.isDestroyed() && !settingsWin.isFocused() && !process.env.ESTHER_TEST) settingsWin.hide(); }, 150));
  settingsWin.on('closed', () => { settingsWin = null; });
}

/** Put every card back where it started. */
function resetLayout() {
  prefs.cards = {};
  savePrefs();
  for (const [id, w] of cards) if (!w.isDestroyed()) { w.setBounds(defaultPlace(id)); sendBackdrop(w); }
}

/** Put cards back on a screen if a monitor was unplugged, turned off or changed resolution. */
function ensureOnScreen() { for (const [id, w] of cards) if (!w.isDestroyed() && !onScreen(w.getBounds())) { delete prefs.cards[id]; w.setBounds(defaultPlace(id)); } }

/** Show every card, in front of everything (on the desktop layer, until you click elsewhere). Works from any state. */
function show() {
  ensureOnScreen();
  layer?.raise(); // first, so Windows doesn't place them at the bottom while they appear
  for (const [id, w] of cards) { if (w.isDestroyed() || !cardOn(id)) continue; if (w.isMinimized()) w.restore(); w.show(); }
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
    { label: 'Cards', submenu: Object.keys(CARDS).map((id) => ({ label: CARDS[id].title.replace('Esther · ', '').replace('Esther', 'Header'), type: 'checkbox', checked: cardOn(id), click: (i) => setCard(id, i.checked) })) },
    { label: 'Put the cards back where they started', click: () => { resetLayout(); show(); } },
    { label: 'Settings…', click: () => openSettings() },
    { type: 'separator' },
    { label: 'Quit Esther', click: () => app.quit() },
  ]));
}

function state() {
  return {
    shortcut: prefs.shortcut, shortcutOk, layer: prefs.layer, pinsToDesktop: !!layer?.native, snap: prefs.snap, scale: prefs.scale, scales: SCALES,
    cards: Object.keys(CARDS).map((id) => ({ id, on: cardOn(id) })), startWithWindows: startsWithWindows(), version: app.getVersion(),
  };
}

function setPrefs(p) {
  if (typeof p.shortcut === 'string' && p.shortcut !== prefs.shortcut) {
    const old = prefs.shortcut;
    if (registerShortcut(p.shortcut)) prefs.shortcut = p.shortcut; else registerShortcut(old);
  }
  if (LAYERS.includes(p.layer)) { prefs.layer = p.layer; layer?.setMode(p.layer); }
  if (typeof p.startWithWindows === 'boolean') app.setLoginItemSettings({ openAtLogin: p.startWithWindows });
  if (typeof p.snap === 'boolean') prefs.snap = p.snap;
  if (typeof p.scale === 'number') setScale(p.scale);
  if (p.card && CARDS[p.card.id]) setCard(p.card.id, !!p.card.on);
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
      const id = [...cards].find(([, c]) => c === w)?.[0];
      // The grip reports CSS pixels; at other scales the window is that many times bigger or smaller.
      const z = prefs.scale;
      const want = id ? snapSize(id, w.getBounds(), Math.round(s.width * z), Math.round(s.height * z)) : { width: Math.round(s.width * z), height: Math.round(s.height * z) };
      w.setSize(Math.max(mw || 260, want.width), Math.max(mh || 200, want.height));
    });
    watchWallpaper(() => { for (const w of [...liveCards(), settingsWin]) if (w) sendBackdrop(w); });
    app.on('before-quit', () => { quitting = true; });
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  if (process.env.ESTHER_TEST) global.__esther = { show, hide, toggle, resetLayout, defaultPlace, openSettings, setCard, setScale, snapMove, layer: () => layer, card: (id) => cards.get(id), settings: () => settingsWin, prefs: () => prefs };
  app.on('window-all-closed', () => app.quit());
}
