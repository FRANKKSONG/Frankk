// Esther on the Windows desktop: a frameless, see-through window that sits on the desktop like a Rainmeter skin.
// It has no taskbar button. A global shortcut (Ctrl+Alt+E by default) shows and hides it; the tray icon has the rest.
const { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, Tray, nativeImage, screen } = require('electron');
const { desktopLayer } = require('./desktop-layer.cjs');
const { setupUpdates } = require('./updates.cjs');
const { styleCard } = require('./win-style.cjs');
const { wallpaperFor, watchWallpaper } = require('./wallpaper.cjs');
const { pointer } = require('./pointer.cjs');
const { diag } = require('./diag.cjs');
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
const GRID = 8; // the tiny invisible grid cards land on when you move or resize them (GAP is two steps)
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
  const g = (v) => Math.round(v / GRID) * GRID;
  return { x: a.x + g(p.x * k), y: a.y + g(p.y * k), width: Math.max(mw, g(p.width * k)), height: Math.max(mh, g(p.height * k)) };
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
  w.on('move', () => sendPlace(w));
  for (const ev of ['focus', 'blur', 'show', 'hide', 'minimize', 'restore']) w.on(ev, () => diag(`${id} ${ev}`));
  // Remember where you put it.
  let t;
  const remember = () => { clearTimeout(t); t = setTimeout(() => { if (!w.isDestroyed() && onScreen(w.getBounds())) { prefs.cards[id] = w.getBounds(); savePrefs(); } }, 400); };
  w.on('move', remember);
  w.on('resize', remember);
  w.on('maximize', () => w.unmaximize());
  // "Show desktop" or "minimise all" can minimise windows; with no taskbar button, a card comes straight back.
  w.on('minimize', () => { if (!w.isDestroyed()) w.restore(); });
  layer.add(w);
  cards.set(id, w);
  return w;
}
let startHidden = false;

// ---- Moving and resizing: Esther does it itself, on a tiny invisible grid (see pointer.cjs for why). ----
const onGrid = (v, origin) => origin + Math.round((v - origin) / GRID) * GRID;
/** Where a card's top-left corner lands: on the grid of the screen it's on. */
function gridPoint(b, x, y) {
  if (!prefs.snap) return { x, y };
  const wa = screen.getDisplayMatching({ ...b, x, y }).workArea;
  return { x: onGrid(x, wa.x), y: onGrid(y, wa.y) };
}
/** The size a card takes: its right and bottom edges land on the grid too, so cards line up with each other. */
function gridSize(w, width, height) {
  const b = w.getBounds();
  const [mw, mh] = w.getMinimumSize();
  if (prefs.snap) {
    const wa = screen.getDisplayMatching(b).workArea;
    width = onGrid(b.x + width, wa.x) - b.x;
    height = onGrid(b.y + height, wa.y) - b.y;
  }
  return { width: Math.max(mw || 200, Math.round(width)), height: Math.max(mh || 120, Math.round(height)) };
}
/** Follow the mouse from now until the button is let go: 'move' the card, or 'resize' it from its corner. */
function track(w, kind) {
  untrack(w);
  const b0 = w.getBounds(), c0 = pointer.at();
  let started = false;
  w.tracking = setInterval(() => {
    if (w.isDestroyed()) return untrack(w);
    if (pointer.down && !pointer.down()) return untrack(w); // let go outside the card
    const c = pointer.at(), dx = c.x - c0.x, dy = c.y - c0.y;
    if (!started && Math.abs(dx) + Math.abs(dy) < 4) return; // a click (or a double-click on the logo), not a drag
    started = true;
    const b = w.getBounds();
    if (kind === 'move') {
      const p = gridPoint(b0, b0.x + dx, b0.y + dy);
      if (p.x !== b.x || p.y !== b.y) w.setPosition(p.x, p.y);
    } else {
      const s = gridSize(w, b0.width + dx, b0.height + dy);
      if (s.width !== b.width || s.height !== b.height) w.setSize(s.width, s.height);
    }
  }, 8);
}
function untrack(w) { if (w?.tracking) { clearInterval(w.tracking); w.tracking = null; } }

/** Turn one card on or off. */
function setCard(id, on) {
  const w = cards.get(id);
  prefs.hiddenCards = prefs.hiddenCards.filter((k) => k !== id).concat(on ? [] : [id]);
  savePrefs();
  if (w && !w.isDestroyed()) { if (on) { w.show(); layer?.raise(); enter([w]); } else leave([w]); }
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
  diag('settings: open');
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.shownAt = Date.now(); settingsWin.show(); settingsWin.focus(); enter([settingsWin]); return; }
  const a = screen.getPrimaryDisplay().workArea;
  const width = Math.min(Math.round(780 * prefs.scale), a.width - 80), height = Math.min(Math.round(640 * prefs.scale), a.height - 80);
  settingsWin = new BrowserWindow({ width, height, x: a.x + Math.round((a.width - width) / 2), y: a.y + Math.round((a.height - height) / 2), title: 'Esther · Settings', ...windowLook() });
  load(settingsWin, { card: 'settings' });
  settingsWin.webContents.on('did-finish-load', () => { settingsWin.webContents.setZoomFactor(prefs.scale); sendBackdrop(settingsWin); });
  settingsWin.webContents.once('did-finish-load', () => { settingsWin.shownAt = Date.now(); settingsWin.show(); settingsWin.focus(); diag(`settings: shown, focused ${settingsWin.isFocused()}`); });
  styleCard(settingsWin);
  settingsWin.on('move', () => sendPlace(settingsWin));
  // Tucked away when you click elsewhere (but not in the moment it opens, while the click that opened it finishes).
  settingsWin.on('blur', () => setTimeout(() => {
    if (!settingsWin || settingsWin.isDestroyed() || settingsWin.isFocused() || process.env.ESTHER_TEST) return;
    if (Date.now() - (settingsWin.shownAt || 0) < 600) { diag('settings: blur right after opening, kept'); return; }
    diag('settings: hidden after clicking elsewhere'); leave([settingsWin]);
  }, 150));
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

// ---- Esther's own call-up and fade-out (Windows' window animations are off for the cards). ----
const leaving = new Map(); // fade-out timer → the windows it will hide
/** Play the call-up on these windows, one after another. They are shown already, still faded out. */
function enter(wins) { wins.forEach((w, i) => { if (w && !w.isDestroyed()) w.webContents.send('esther:enter', { delay: i * 40 }); }); }
/** Fade these windows out, then hide them. */
function leave(wins, after) {
  for (const w of wins) if (!w.isDestroyed()) w.webContents.send('esther:leave');
  const t = setTimeout(() => { leaving.delete(t); for (const w of wins) if (!w.isDestroyed()) w.hide(); after?.(); }, 170);
  leaving.set(t, wins);
}
const CALL_ORDER = ['header', 'calendar', 'week', 'tasks'];

/** Show every card, in front of everything (on the desktop layer, until you click elsewhere). Works from any state. */
function show() {
  diag('show');
  // Coming back mid-fade: the cards stay (they're called up again below); anything else that was fading goes.
  const calling = new Set(CALL_ORDER.filter(cardOn).map((id) => cards.get(id)));
  for (const [t, wins] of leaving) { clearTimeout(t); for (const w of wins) if (!calling.has(w) && !w.isDestroyed()) w.hide(); }
  leaving.clear();
  ensureOnScreen();
  layer?.raise(); // first, so Windows doesn't place them at the bottom while they appear
  for (const [id, w] of cards) { if (w.isDestroyed() || !cardOn(id)) continue; if (w.isMinimized()) w.restore(); w.show(); }
  layer?.raise();
  cards.get('tasks')?.focus();
  enter(CALL_ORDER.filter(cardOn).map((id) => cards.get(id)));
  refreshTray();
}
function hide() {
  diag('hide');
  const wins = liveCards().filter((w) => w.isVisible());
  if (settingsWin && !settingsWin.isDestroyed() && settingsWin.isVisible()) wins.push(settingsWin);
  leave(wins, refreshTray);
}
const anyCardFocused = () => liveCards().some((w) => w.isFocused());
/** The shortcut: if the cards are plainly in front, hide them; otherwise (hidden, behind other windows) bring them forward. */
function toggle() {
  const visible = liveCards().some((w) => w.isVisible());
  const inFront = visible && anyCardFocused() && (prefs.layer !== 'desktop' || layer?.isRaised?.());
  if (inFront) hide(); else show();
}
const broadcast = (channel, payload) => { for (const w of [...liveCards(), settingsWin, menuWin]) if (w && !w.isDestroyed()) w.webContents.send(channel, payload); };

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
  broadcast('esther:changed', null);
  // On Windows the tray menu is Esther's own (rounded, Windows 11 style); elsewhere the system menu.
  if (process.platform === 'win32') return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Show Esther  (${pretty(prefs.shortcut)})`, click: () => show() },
    { label: 'Hide', enabled: liveCards().some((w) => w.isVisible()), click: () => hide() },
    { type: 'separator' },
    { label: 'Cards', submenu: Object.keys(CARDS).map((id) => ({ label: CARD_NAMES[id], type: 'checkbox', checked: cardOn(id), click: (i) => setCard(id, i.checked) })) },
    { label: 'Put the cards back where they started', click: () => { resetLayout(); show(); } },
    { label: 'Settings…', click: () => openSettings() },
    { type: 'separator' },
    { label: 'Quit Esther', click: () => app.quit() },
  ]));
}
const CARD_NAMES = { header: 'Header', tasks: 'Tasks', calendar: 'Calendar', week: 'This week' };

// ---- The tray menu: a small window of its own, so it looks like the rest of Esther. ----
let menuWin = null, menuAt = null;
function openTrayMenu() {
  menuAt = pointer.at();
  if (!menuWin || menuWin.isDestroyed()) {
    menuWin = new BrowserWindow({ width: 300, height: 420, x: -32000, y: -32000, title: 'Esther menu', ...windowLook(), alwaysOnTop: true });
    load(menuWin, { card: 'menu' });
    styleCard(menuWin);
    menuWin.on('blur', () => setTimeout(() => { if (menuWin && !menuWin.isDestroyed() && !menuWin.isFocused()) menuWin.hide(); }, 80));
    menuWin.on('closed', () => { menuWin = null; });
  } else menuWin.webContents.send('esther:changed', null);
  menuWin.wanted = true;
}
/** The menu page says how big it is; it opens by the mouse, above the taskbar. */
function placeTrayMenu(width, height) {
  if (!menuWin || menuWin.isDestroyed() || !menuWin.wanted) return;
  const at = menuAt ?? pointer.at();
  const wa = screen.getDisplayNearestPoint(at).workArea;
  const x = Math.max(wa.x + 8, Math.min(at.x - width, wa.x + wa.width - width - 8));
  const y = at.y - height - 8 >= wa.y ? Math.min(at.y - height - 8, wa.y + wa.height - height - 8) : Math.min(at.y + 8, wa.y + wa.height - height - 8);
  menuWin.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height) });
  if (!menuWin.isVisible()) { menuWin.show(); menuWin.focus(); enter([menuWin]); }
}
function closeTrayMenu() { if (menuWin && !menuWin.isDestroyed()) { menuWin.wanted = false; menuWin.hide(); } }

function state() {
  return {
    shortcut: prefs.shortcut, shortcutOk, layer: prefs.layer, pinsToDesktop: !!layer?.native, snap: prefs.snap, scale: prefs.scale, scales: SCALES,
    cards: Object.keys(CARDS).map((id) => ({ id, on: cardOn(id) })), startWithWindows: startsWithWindows(), version: app.getVersion(),
    visible: liveCards().some((w) => w.isVisible()),
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
  if (p.snap === true) for (const [, w] of cards) if (!w.isDestroyed()) { const b = w.getBounds(); const q = gridPoint(b, b.x, b.y); const z = gridSize(w, b.width, b.height); w.setBounds({ ...q, ...z }); }
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
    diag.start(app.getPath('userData'));
    diag(`start ${app.getVersion()} layer ${prefs.layer} scale ${prefs.scale}`);
    layer = desktopLayer(prefs.layer, diag);
    for (const id of Object.keys(CARDS)) createCard(id);
    registerShortcut(prefs.shortcut);
    // Monitors coming and going (or waking from sleep) never leave it stranded off-screen.
    for (const ev of ['display-removed', 'display-metrics-changed', 'display-added']) screen.on(ev, () => setTimeout(ensureOnScreen, 500));
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'tray.png')));
    tray.on('click', () => show());
    if (process.platform === 'win32') tray.on('right-click', () => openTrayMenu());
    refreshTray();

    updates = setupUpdates({ app, send: (st) => { broadcast('esther:update', st); refreshTray(); }, log: (m) => console.warn(m) });
    ipcMain.handle('esther:state', () => state());
    ipcMain.handle('esther:update-status', () => updates.status());
    ipcMain.on('esther:update-check', () => updates.check());
    ipcMain.on('esther:update-install', () => updates.install());
    ipcMain.handle('esther:set', (_e, p) => setPrefs(p ?? {}));
    ipcMain.on('esther:hide', () => hide());
    ipcMain.on('esther:show', () => show());
    ipcMain.on('esther:track', (e, t) => { const w = BrowserWindow.fromWebContents(e.sender); if (!w) return; if (t?.phase === 'start' && ['move', 'resize'].includes(t.kind)) track(w, t.kind); else untrack(w); });
    ipcMain.on('esther:menu-size', (_e, s) => s && placeTrayMenu(s.width, s.height));
    ipcMain.on('esther:menu-close', () => closeTrayMenu());
    ipcMain.handle('esther:save-log', async (e) => {
      const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: 'esther-log.txt', filters: [{ name: 'Text', extensions: ['txt'] }] });
      if (r.canceled || !r.filePath) return false;
      fs.writeFileSync(r.filePath, `Esther ${app.getVersion()} on ${process.platform} ${process.getSystemVersion()}\n${diag.text()}`);
      return true;
    });
    ipcMain.on('esther:lower', () => layer?.lower());
    ipcMain.on('esther:settings', () => openSettings());
    ipcMain.on('esther:settings-close', () => settingsWin?.isDestroyed() === false && leave([settingsWin]));
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
      const want = id ? gridSize(w, s.width * z, s.height * z) : { width: Math.round(s.width * z), height: Math.round(s.height * z) };
      w.setSize(Math.max(mw || 260, want.width), Math.max(mh || 200, want.height));
    });
    watchWallpaper(() => { diag('wallpaper changed'); for (const w of [...liveCards(), settingsWin]) if (w) sendBackdrop(w); });
    app.on('before-quit', () => { quitting = true; });
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  if (process.env.ESTHER_TEST) global.__esther = { show, hide, toggle, resetLayout, defaultPlace, openSettings, openTrayMenu, setCard, setScale, pointer, GRID, diag, layer: () => layer, card: (id) => cards.get(id), settings: () => settingsWin, menu: () => menuWin, prefs: () => prefs };
  app.on('window-all-closed', () => app.quit());
}
