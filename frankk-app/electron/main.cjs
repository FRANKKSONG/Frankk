// Esther on the Windows desktop: a frameless, see-through window that sits on the desktop like a Rainmeter skin.
// It has no taskbar button. A global shortcut (Ctrl+Alt+E by default) shows and hides it; the tray icon has the rest.
const { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, Tray, nativeImage, nativeTheme, screen } = require('electron');
const { desktopLayer } = require('./desktop-layer.cjs');
const { setupUpdates } = require('./updates.cjs');
const { styleCard } = require('./win-style.cjs');
const { wallpaperFor, watchWallpaper } = require('./wallpaper.cjs');
const { pointer } = require('./pointer.cjs');
const { diag } = require('./diag.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const LAYERS = ['desktop', 'normal', 'top'];
// A desktop widget is meant to be seen while other windows sit around it: never pause it for looking "covered"
// (Chromium's occlusion tracking on Windows would otherwise freeze the page when it's on the desktop layer).
// Light on memory: no spare page process kept ready (Esther never opens web pages).
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,SpareRendererForSitePerProcess');
// Light on memory: graphics and networking run inside Esther's main process instead of two more processes.
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('enable-features', 'NetworkServiceInProcess,NetworkServiceInProcess2');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
// Draw with the graphics card even if Chromium is unsure about the driver (otherwise every card is drawn in software).
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

// Glass: Windows' own acrylic (live, needs Windows 11 22H2 or later) or mica, or Esther's own adjustable blur.
const NATIVE_GLASS = process.platform === 'win32' && Number(os.release().split('.')[2] ?? 0) >= 22621;
const MATERIALS = ['acrylic', 'mica', 'esther'];
const DEFAULTS = { material: NATIVE_GLASS ? 'acrylic' : 'esther', shortcut: 'Control+Alt+E', layer: 'desktop', snap: true, scale: 1, hiddenCards: [], bubble: true, bubbleSize: 0.6 };
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
if (!MATERIALS.includes(prefs.material) || (!NATIVE_GLASS && prefs.material !== 'esther')) prefs.material = DEFAULTS.material;
const nativeGlass = () => prefs.material !== 'esther';
if (typeof prefs.bubbleSize !== 'number' || !(prefs.bubbleSize >= 0.3 && prefs.bubbleSize <= 1.5)) prefs.bubbleSize = DEFAULTS.bubbleSize;
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
  tasks: { title: 'Esther · Tasks', min: [300, 280], place: (a, g) => ({ x: g, y: g + 112 + g, width: Math.min(1000, Math.round(a.width * 0.55)), height: a.height - 112 - 3 * g }) },
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
// ---- One page process for every window. The first card ("the host") opens all the others with window.open, so
// they share its page process instead of each starting its own (about 40 MB apiece). ----
let host = null;
const pending = new Map(); // window name → { options, resolve }
const hostReady = [];
/** Run `fn` when `w` has finished loading (now, if it already has). */
function whenLoaded(w, fn) { if (!w.webContents.isLoading() && w.webContents.getURL()) fn(); else w.webContents.once('did-finish-load', fn); }
/** Open one of Esther's windows: `name` is unique, `query` says what it shows. Resolves to the BrowserWindow. */
function openWindow(name, query, options) {
  if (!host || host.isDestroyed()) {
    const w = new BrowserWindow(options);
    host = w;
    load(w, query);
    w.webContents.setWindowOpenHandler((d) => {
      const p = pending.get(d.frameName);
      return p ? { action: 'allow', outlivesOpener: true, overrideBrowserWindowOptions: p.options } : { action: 'deny' };
    });
    w.webContents.on('did-create-window', (child, d) => {
      const p = pending.get(d.frameName);
      if (!p) return;
      pending.delete(d.frameName);
      child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      // (Only after its first load: a window.open'd window's own first load counts as a navigation.)
      child.webContents.once('did-finish-load', () => child.webContents.on('will-navigate', (e) => e.preventDefault()));
      p.resolve(child);
    });
    whenLoaded(w, () => { while (hostReady.length) hostReady.shift()(); });
    return Promise.resolve(w);
  }
  return new Promise((resolve) => {
    pending.set(name, { options, resolve });
    const go = () => host.webContents.executeJavaScript(`void window.open(${JSON.stringify(`?${new URLSearchParams(query)}`)}, ${JSON.stringify(name)})`, true);
    if (host.webContents.isLoading() || !host.webContents.getURL()) hostReady.push(go); else go();
  });
}

function load(w, query) {
  if (dev) w.loadURL(`${dev}?${new URLSearchParams(query)}`); else w.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), pageOptions(query));
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (e) => e.preventDefault());
}

/** `glass`: a card (or Settings) gets the chosen glass; the bubble and the guides are simply see-through. */
const windowLook = (glass = false) => ({
  frame: false, hasShadow: false, backgroundColor: '#00000000',
  // A widget, not an app window: it can't be maximised (double-click, dragging to the top edge), snapped,
  // minimised or made full screen.
  maximizable: false, minimizable: false, fullscreenable: false, thickFrame: false,
  // Windows doesn't resize the cards: a frameless window otherwise gets an invisible resize border just inside its
  // edges, which caught the mouse before Esther's own edges (so no grid, no guides, no Alt or Shift). Esther still
  // sets the size itself. (Only on Windows: elsewhere a window that isn't resizable can't be resized at all.)
  resizable: process.platform !== 'win32',
  // Windows' own glass: Windows blurs whatever is behind the card, live, and rounds its corners.
  // Esther's own glass: a see-through window; Esther draws the card, its corners and the blur.
  ...(glass && nativeGlass() ? { transparent: false, backgroundMaterial: prefs.material, roundedCorners: true } : { transparent: true, roundedCorners: false }),
  skipTaskbar: true, show: false, icon: path.join(__dirname, 'icon.png'),
  webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: false },
});

/** Set a window's bounds. On Windows the cards aren't resizable (see windowLook), and Electron then won't let
 *  even Esther make them shorter, so resizing is allowed just for the moment Esther changes the size. */
/** A window's smallest size, as Esther set it. (Asking the window doesn't work on Windows: a window that isn't
 *  resizable reports its current size as its smallest, so a card could never be made smaller.) */
function minSizeOf(w) {
  const id = [...cards].find(([, c]) => c === w)?.[0];
  if (id) return minOf(id);
  if (w === settingsWin) return [Math.round(480 * prefs.scale), Math.round(360 * prefs.scale)];
  return [200, 120];
}
function setBox(w, b) {
  if (w.isDestroyed()) return;
  const locked = !w.isResizable();
  if (locked) w.setResizable(true);
  w.setBounds(b);
  if (locked) w.setResizable(false);
}

const cardOn = (id) => !prefs.hiddenCards.includes(id);

/** What a card needs to draw its blur: the wallpaper of the screen it's on, and where it sits on that screen. */
function sendBackdrop(w) {
  if (w.isDestroyed() || nativeGlass()) return;
  const b = w.getBounds();
  const d = screen.getDisplayMatching(b);
  w.webContents.send('esther:backdrop', { image: wallpaperFor(d), screen: d.bounds, x: b.x, y: b.y, scale: prefs.scale });
}
const sendPlace = (w) => { if (!w.isDestroyed()) { const b = w.getBounds(); w.webContents.send('esther:place', { x: b.x, y: b.y, screen: screen.getDisplayMatching(b).bounds }); } };

async function createCard(id) {
  const [mw, mh] = minOf(id);
  const w = await openWindow(`esther-${id}`, { card: id, glass: nativeGlass() ? 'native' : 'esther' }, { ...placeOf(id), minWidth: mw, minHeight: mh, title: CARDS[id].title, ...windowLook(true) });
  w.webContents.on('did-finish-load', () => { w.webContents.setZoomFactor(prefs.scale); sendBackdrop(w); });
  whenLoaded(w, () => { w.webContents.setZoomFactor(prefs.scale); sendBackdrop(w); if (!startHidden && cardOn(id)) w.showInactive(); });
  w.styled = styleCard(w, nativeGlass());
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
  const [mw, mh] = minSizeOf(w);
  if (prefs.snap) {
    const wa = screen.getDisplayMatching(b).workArea;
    width = onGrid(b.x + width, wa.x) - b.x;
    height = onGrid(b.y + height, wa.y) - b.y;
  }
  return { width: Math.max(mw || 200, Math.round(width)), height: Math.max(mh || 120, Math.round(height)) };
}
// ---- Guides, like Illustrator's smart guides: the screen's centre, middle and quarters, and the other cards' edges
// and centres. A card dragged near one snaps to it and the guide lights up; the grid shows while you drag. ----
const SNAP = 10; // how close (px) a card's edge or centre must come to a guide to snap to it
function guideLines(w, wa) {
  const xs = [0.25, 0.5, 0.75].map((q) => ({ v: Math.round(wa.x + wa.width * q), kind: q === 0.5 ? 'centre' : 'quarter' }));
  const ys = [0.25, 0.5, 0.75].map((q) => ({ v: Math.round(wa.y + wa.height * q), kind: q === 0.5 ? 'middle' : 'quarter' }));
  for (const o of liveCards()) {
    if (o === w || !o.isVisible()) continue;
    const b = o.getBounds();
    xs.push({ v: b.x, kind: 'card' }, { v: Math.round(b.x + b.width / 2), kind: 'card' }, { v: b.x + b.width, kind: 'card' }, { v: b.x - GAP, kind: 'gap' }, { v: b.x + b.width + GAP, kind: 'gap' });
    ys.push({ v: b.y, kind: 'card' }, { v: Math.round(b.y + b.height / 2), kind: 'card' }, { v: b.y + b.height, kind: 'card' }, { v: b.y - GAP, kind: 'gap' }, { v: b.y + b.height + GAP, kind: 'gap' });
  }
  return { xs, ys };
}
/** Snap one axis: whichever of `anchors` (offsets from `pos`: an edge or the centre) comes closest to a guide, within SNAP. */
function snapAxis(pos, anchors, lines, origin) {
  let best = null;
  for (const a of anchors) for (const l of lines) {
    const d = Math.abs(pos + a - l.v);
    if (d <= SNAP && (!best || d < best.d)) best = { d, pos: l.v - a, line: l };
  }
  return best ? { pos: best.pos, line: best.line } : { pos: onGrid(pos, origin), line: null };
}
/**
 * The new bounds while resizing from `edge` (n, s, e, w or a corner such as se), like Illustrator:
 * Alt resizes from the centre (the opposite side moves too), Shift keeps the proportions, Shift+Alt does both.
 */
function resizeRect(b0, edge, dx, dy, mods, [mw, mh], snapX, snapY) {
  const E = edge.includes('e'), W = edge.includes('w'), N = edge.includes('n'), S = edge.includes('s');
  let l = b0.x, r = b0.x + b0.width, t = b0.y, bt = b0.y + b0.height;
  const lines = [];
  const snapEdge = (v, f, axis) => { const s = f(v); if (s.line) lines.push({ axis, ...s.line }); return s.pos; };
  if (E) r = snapEdge(r + dx, snapX, 'x');
  if (W) l = snapEdge(l + dx, snapX, 'x');
  if (S) bt = snapEdge(bt + dy, snapY, 'y');
  if (N) t = snapEdge(t + dy, snapY, 'y');
  const cx = b0.x + b0.width / 2, cy = b0.y + b0.height / 2;
  if (mods.alt) { if (E) l = 2 * cx - r; if (W) r = 2 * cx - l; if (S) t = 2 * cy - bt; if (N) bt = 2 * cy - t; }
  let w = r - l, h = bt - t;
  if (mods.shift) {
    const ratio = b0.width / b0.height;
    if ((E || W) && (N || S)) { if (Math.abs(w / b0.width - 1) >= Math.abs(h / b0.height - 1)) h = w / ratio; else w = h * ratio; }
    else if (E || W) h = w / ratio; else w = h * ratio;
    const k = Math.max(1, mw / w, mh / h); w *= k; h *= k;
  } else { w = Math.max(mw, w); h = Math.max(mh, h); }
  // Which side stays put: the opposite one, or the centre with Alt (or, with Shift on a side handle, the middle).
  const x = mods.alt || (mods.shift && !E && !W) ? cx - w / 2 : W ? b0.x + b0.width - w : b0.x;
  const y = mods.alt || (mods.shift && !N && !S) ? cy - h / 2 : N ? b0.y + b0.height - h : b0.y;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h), lines };
}
/** Follow the mouse from now until the button is let go: 'move' the card, or 'resize' it from an edge or corner. */
function track(w, kind, edge = 'se') {
  untrack(w);
  const b0 = w.getBounds(), c0 = pointer.at();
  const wa = screen.getDisplayMatching(b0).workArea;
  const min = minSizeOf(w);
  let started = false, shown = '';
  w.tracking = setInterval(() => {
    if (w.isDestroyed()) return untrack(w);
    if (pointer.down && !pointer.down()) return untrack(w); // let go outside the card
    const c = pointer.at(), dx = c.x - c0.x, dy = c.y - c0.y;
    if (!started && Math.abs(dx) + Math.abs(dy) < 4) return; // a click (or a double-click on the logo), not a drag
    if (!started) { started = true; if (prefs.snap) showGuides(wa); }
    const b = w.getBounds();
    const { xs, ys } = prefs.snap ? guideLines(w, wa) : { xs: [], ys: [] };
    let next, lines = [];
    if (kind === 'move') {
      let x = b0.x + dx, y = b0.y + dy;
      if (prefs.snap) {
        const sx = snapAxis(x, [0, b0.width / 2, b0.width], xs, wa.x), sy = snapAxis(y, [0, b0.height / 2, b0.height], ys, wa.y);
        x = Math.round(sx.pos); y = Math.round(sy.pos);
        lines = [sx.line && { axis: 'x', ...sx.line }, sy.line && { axis: 'y', ...sy.line }].filter(Boolean);
      }
      next = { x, y, width: b0.width, height: b0.height };
      if (x !== b.x || y !== b.y) w.setPosition(x, y);
    } else {
      const mods = pointer.mods ? pointer.mods() : (w.trackMods || {});
      const free = (v) => ({ pos: v, line: null });
      next = resizeRect(b0, edge, dx, dy, mods, min,
        prefs.snap ? (v) => snapAxis(v, [0], xs, wa.x) : free, prefs.snap ? (v) => snapAxis(v, [0], ys, wa.y) : free);
      lines = next.lines;
      if (next.x !== b.x || next.y !== b.y || next.width !== b.width || next.height !== b.height) {
        setBox(w, { x: next.x, y: next.y, width: next.width, height: next.height });
      }
    }
    // Tell the guides what to draw (only when something changed).
    const msg = JSON.stringify({ next, lines });
    if (prefs.snap && msg !== shown) { shown = msg; sendGuides({ area: wa, card: next, lines, others: liveCards().filter((o) => o !== w && o.isVisible()).map((o) => o.getBounds()) }); }
  }, 8);
}
function untrack(w) { if (w?.tracking) { clearInterval(w.tracking); w.tracking = null; hideGuides(); } }

// The guides window: see-through, never takes a click, above everything while you drag; made once, kept hidden.
let guidesWin = null;
async function makeGuides() {
  if (guidesWin && !guidesWin.isDestroyed()) return;
  const wa = screen.getPrimaryDisplay().workArea;
  guidesWin = await openWindow('esther-guides', { card: 'guides' }, { ...wa, title: 'Esther guides', ...windowLook(), focusable: false, alwaysOnTop: true });
  guidesWin.setIgnoreMouseEvents(true);
  styleCard(guidesWin);
  guidesWin.on('closed', () => { guidesWin = null; });
}
function showGuides(wa) {
  if (!guidesWin || guidesWin.isDestroyed()) { void makeGuides(); return; }
  const b = guidesWin.getBounds();
  if (b.x !== wa.x || b.y !== wa.y || b.width !== wa.width || b.height !== wa.height) setBox(guidesWin, wa);
  guidesWin.webContents.send('esther:guides', { show: true, area: wa, lines: [] });
  guidesWin.showInactive();
  guidesWin.setAlwaysOnTop(true, 'screen-saver');
}
const sendGuides = (g) => { if (guidesWin && !guidesWin.isDestroyed()) guidesWin.webContents.send('esther:guides', { show: true, ...g }); };
function hideGuides() {
  if (!guidesWin || guidesWin.isDestroyed() || !guidesWin.isVisible()) return;
  guidesWin.webContents.send('esther:guides', { show: false });
  setTimeout(() => { if (guidesWin && !guidesWin.isDestroyed()) guidesWin.hide(); }, 160);
}

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
    setBox(w, { x: b.x, y: b.y, width: Math.max(mw, Math.round(b.width * r)), height: Math.max(mh, Math.round(b.height * r)) });
    w.webContents.setZoomFactor(next);
    sendBackdrop(w);
  }
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.setZoomFactor(next);
  savePrefs();
}

/** Settings: its own card, opened from the gear and tucked away when you click elsewhere. */
let settingsOpening = false;
async function openSettings() {
  diag('settings: open');
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.shownAt = Date.now(); settingsWin.show(); settingsWin.focus(); enter([settingsWin]); return; }
  if (settingsOpening) return;
  settingsOpening = true;
  const a = screen.getPrimaryDisplay().workArea;
  const width = Math.min(Math.round(780 * prefs.scale), a.width - 80), height = Math.min(Math.round(640 * prefs.scale), a.height - 80);
  settingsWin = await openWindow('esther-settings', { card: 'settings', glass: nativeGlass() ? 'native' : 'esther' }, { width, height, x: a.x + Math.round((a.width - width) / 2), y: a.y + Math.round((a.height - height) / 2), title: 'Esther · Settings', ...windowLook(true) });
  settingsOpening = false;
  whenLoaded(settingsWin, () => { settingsWin.webContents.setZoomFactor(prefs.scale); sendBackdrop(settingsWin); settingsWin.shownAt = Date.now(); settingsWin.show(); settingsWin.focus(); diag(`settings: shown, focused ${settingsWin.isFocused()}`); });
  styleCard(settingsWin, nativeGlass());
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
  for (const [id, w] of cards) if (!w.isDestroyed()) { setBox(w, defaultPlace(id)); sendBackdrop(w); }
}

/** Put cards back on a screen if a monitor was unplugged, turned off or changed resolution. */
function ensureOnScreen() { for (const [id, w] of cards) if (!w.isDestroyed() && !onScreen(w.getBounds())) { delete prefs.cards[id]; setBox(w, defaultPlace(id)); } }

// ---- The Esther bubble: the word "Esther" on the desktop. Hiding gathers the cards into it, in the middle of the
// screen; clicking it (or the shortcut) sends them back out from it, and it shrinks to the bottom-left corner. ----
let bubble = null, collapsed = false;
const BIG = { width: 520, height: 190 }, SMALL = { width: 118, height: 43 };
const BUBBLE_SIZES = [0.3, 1.5]; // the big bubble, from 30% to 150% of 520 × 190
function bubbleBounds(big) {
  const wa = screen.getPrimaryDisplay().workArea;
  const k = prefs.bubbleSize;
  const s = big ? { width: Math.round(BIG.width * k), height: Math.round(BIG.height * k) } : SMALL;
  return big ? { x: Math.round(wa.x + (wa.width - s.width) / 2), y: Math.round(wa.y + (wa.height - s.height) / 2), ...s }
    : { x: wa.x + GAP, y: wa.y + wa.height - s.height - GAP, ...s };
}
const centre = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
/** Glide a window to new bounds (the bubble moving between the middle and the corner). */
function glide(w, to, ms = 300) {
  clearInterval(w.gliding);
  const from = w.getBounds(), t0 = Date.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  w.gliding = setInterval(() => {
    if (w.isDestroyed()) return clearInterval(w.gliding);
    const t = Math.min(1, (Date.now() - t0) / ms), k = ease(t);
    setBox(w, { x: Math.round(from.x + (to.x - from.x) * k), y: Math.round(from.y + (to.y - from.y) * k), width: Math.round(from.width + (to.width - from.width) * k), height: Math.round(from.height + (to.height - from.height) * k) });
    if (t >= 1) clearInterval(w.gliding);
  }, 8);
}
let bubbleOpening = false;
async function createBubble() {
  if (!prefs.bubble || (bubble && !bubble.isDestroyed()) || bubbleOpening) return;
  bubbleOpening = true;
  const w = await openWindow('esther-bubble', { card: 'bubble' }, { ...bubbleBounds(collapsed), title: 'Esther', ...windowLook(), focusable: false });
  bubbleOpening = false;
  if (!prefs.bubble) { w.destroy(); return; }
  bubble = w;
  styleCard(bubble);
  layer.add(bubble);
  whenLoaded(bubble, () => bubble?.showInactive());
  bubble.on('closed', () => { if (bubble === w) bubble = null; });
}
/** Make the big bubble bigger or smaller (Settings, or the mouse wheel over it). */
function setBubbleSize(k) {
  prefs.bubbleSize = Math.round(Math.max(BUBBLE_SIZES[0], Math.min(BUBBLE_SIZES[1], k)) * 100) / 100;
  if (bubble && !bubble.isDestroyed() && collapsed) setBox(bubble, bubbleBounds(true));
}
function setBubble(on) {
  prefs.bubble = on;
  if (on) createBubble();
  else if (bubble && !bubble.isDestroyed()) { bubble.destroy(); bubble = null; }
}
/** Where a card should fly to or from: the bubble in the middle of the screen, in the card's own CSS pixels. */
function flight(w) {
  if (!bubble || bubble.isDestroyed()) return null;
  const wb = w.getBounds(), c = centre(wb), b = centre(bubbleBounds(true)), z = w.webContents.getZoomFactor() || 1;
  // A card can only be drawn inside its own window, so it heads towards the bubble as far as its window allows
  // (shrinking as it goes), while the bubble grows in the middle.
  const dx = b.x - c.x, dy = b.y - c.y;
  const k = Math.min(1, (wb.width * 0.42) / Math.max(1, Math.abs(dx)), (wb.height * 0.42) / Math.max(1, Math.abs(dy)));
  return { x: Math.round((dx * k) / z), y: Math.round((dy * k) / z) };
}

// ---- Esther's own call-up and fade-out (Windows' window animations are off for the cards). ----
const leaving = new Map(); // fade-out timer → the windows it will hide
/** Play the call-up on these windows, one after another. They are shown already, still faded out. */
function enter(wins, fromBubble = false) { wins.forEach((w, i) => { if (w && !w.isDestroyed()) w.webContents.send('esther:enter', { delay: i * 40, from: fromBubble ? flight(w) : null }); }); }
/** Fade these windows out (into the bubble, if that's where they're going), then hide them. */
function leave(wins, after, intoBubble = false) {
  for (const w of wins) if (!w.isDestroyed()) w.webContents.send('esther:leave', { to: intoBubble ? flight(w) : null });
  const t = setTimeout(() => { leaving.delete(t); for (const w of wins) if (!w.isDestroyed()) w.hide(); after?.(); }, nativeGlass() ? 150 : intoBubble ? 320 : 170);
  leaving.set(t, wins);
}
const CALL_ORDER = ['header', 'calendar', 'week', 'tasks'];

/** Show every card, in front of everything (on the desktop layer, until you click elsewhere). Works from any state. */
function show() {
  diag('show');
  const fromBubble = collapsed && !!bubble;
  collapsed = false;
  if (bubble && !bubble.isDestroyed()) glide(bubble, bubbleBounds(false));
  // Coming back mid-fade: the cards stay (they're called up again below); anything else that was fading goes.
  const calling = new Set(CALL_ORDER.filter(cardOn).map((id) => cards.get(id)));
  for (const [t, wins] of leaving) { clearTimeout(t); for (const w of wins) if (!calling.has(w) && !w.isDestroyed()) w.hide(); }
  leaving.clear();
  ensureOnScreen();
  layer?.raise(); // first, so Windows doesn't place them at the bottom while they appear
  for (const [id, w] of cards) { if (w.isDestroyed() || !cardOn(id)) continue; if (w.isMinimized()) w.restore(); w.show(); }
  layer?.raise();
  cards.get('tasks')?.focus();
  enter(CALL_ORDER.filter(cardOn).map((id) => cards.get(id)), fromBubble);
  refreshTray();
}
/** Tuck the cards away: into the Esther bubble in the middle of the screen (or simply fade them, without it). */
function hide() {
  diag('hide');
  collapsed = true;
  const wins = liveCards().filter((w) => w.isVisible());
  if (settingsWin && !settingsWin.isDestroyed() && settingsWin.isVisible()) leave([settingsWin]);
  if (bubble && !bubble.isDestroyed()) glide(bubble, bubbleBounds(true), 340);
  leave(wins, refreshTray, !!bubble);
}
const anyCardFocused = () => liveCards().some((w) => w.isFocused());
/** The shortcut (and the bubble): if the cards are plainly in front, tuck them away; otherwise bring them forward. */
function toggle() {
  const visible = !collapsed && liveCards().some((w) => w.isVisible());
  const inFront = visible && anyCardFocused() && (prefs.layer !== 'desktop' || layer?.isRaised?.());
  if (inFront) hide(); else show();
}
/** Clicking the bubble: out of the bubble if gathered in it, into it if not. */
const bubbleClick = () => (collapsed ? show() : hide());
const broadcast = (channel, payload) => { for (const w of [...liveCards(), settingsWin, bubble]) if (w && !w.isDestroyed()) w.webContents.send(channel, payload); };

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
  // The system's own menu (on Windows 11: rounded, light or dark with Windows, and it closes like any menu).
  const ready = updates?.status().state === 'ready';
  trayMenu = Menu.buildFromTemplate([
    collapsed || !liveCards().some((w) => w.isVisible())
      ? { label: 'Show Esther', accelerator: prefs.shortcut, registerAccelerator: false, click: () => show() }
      : { label: 'Hide Esther', accelerator: prefs.shortcut, registerAccelerator: false, click: () => hide() },
    { type: 'separator' },
    { label: 'Cards', submenu: Object.keys(CARDS).map((id) => ({ label: CARD_NAMES[id], type: 'checkbox', checked: cardOn(id), click: (i) => setCard(id, i.checked) })) },
    { label: 'Put the cards back', click: () => { resetLayout(); show(); } },
    { label: 'Where the cards sit', submenu: [
      { label: 'On the desktop', type: 'radio', checked: prefs.layer === 'desktop', click: () => setPrefs({ layer: 'desktop' }) },
      { label: 'Like a window', type: 'radio', checked: prefs.layer === 'normal', click: () => setPrefs({ layer: 'normal' }) },
      { label: 'Always on top', type: 'radio', checked: prefs.layer === 'top', click: () => setPrefs({ layer: 'top' }) },
    ] },
    { type: 'separator' },
    { label: 'Settings…', click: () => openSettings() },
    ready ? { label: `Restart to update to ${updates.status().next}`, click: () => updates.install() }
      : { label: 'Check for updates', enabled: !!updates && !['dev', 'portable'].includes(updates.status().state), click: () => updates.check() },
    { label: 'Quit Esther', click: () => app.quit() },
  ]);
  tray.setContextMenu(trayMenu);
}
let trayMenu = null;
const CARD_NAMES = { header: 'Header', tasks: 'Tasks', calendar: 'Calendar', week: 'This week' };

/** The tray icon: Esther's "E" in Instrument Serif, one colour, in every size Windows asks for. */
function trayIcon() {
  const tone = process.platform !== 'win32' || nativeTheme.shouldUseDarkColors ? 'light' : 'dark';
  const img = nativeImage.createEmpty();
  for (const [px, scale] of [[16, 1], [20, 1.25], [24, 1.5], [32, 2], [48, 3]]) {
    const f = path.join(__dirname, 'tray', `e-${tone}-${px}.png`);
    if (fs.existsSync(f)) img.addRepresentation({ scaleFactor: scale, buffer: fs.readFileSync(f) });
  }
  return img.isEmpty() ? nativeImage.createFromPath(path.join(__dirname, 'tray.png')) : img;
}


function state() {
  return {
    shortcut: prefs.shortcut, shortcutOk, layer: prefs.layer, pinsToDesktop: !!layer?.native, snap: prefs.snap, scale: prefs.scale, scales: SCALES,
    cards: Object.keys(CARDS).map((id) => ({ id, on: cardOn(id) })), startWithWindows: startsWithWindows(), version: app.getVersion(),
    visible: !collapsed && liveCards().some((w) => w.isVisible()), bubble: !!prefs.bubble, bubbleSize: prefs.bubbleSize, material: prefs.material, nativeGlass: NATIVE_GLASS,
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
  if (typeof p.bubble === 'boolean') setBubble(p.bubble);
  // The glass is chosen when a window is made, so Esther restarts to switch it.
  if (MATERIALS.includes(p.material) && p.material !== prefs.material && (NATIVE_GLASS || p.material === 'esther')) {
    prefs.material = p.material; savePrefs();
    if (!process.env.ESTHER_TEST) { app.relaunch(); app.exit(0); }
  }
  if (typeof p.bubbleSize === 'number') setBubbleSize(p.bubbleSize);
  if (p.snap === true) for (const [, w] of cards) if (!w.isDestroyed()) { const b = w.getBounds(); const q = gridPoint(b, b.x, b.y); const z = gridSize(w, b.width, b.height); setBox(w, { ...q, ...z }); }
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
  app.whenReady().then(async () => {
    diag.start(app.getPath('userData'));
    diag(`start ${app.getVersion()} layer ${prefs.layer} scale ${prefs.scale}`);
    layer = desktopLayer(prefs.layer, diag);
    registerShortcut(prefs.shortcut);
    // Monitors coming and going (or waking from sleep) never leave it stranded off-screen.
    for (const ev of ['display-removed', 'display-metrics-changed', 'display-added']) screen.on(ev, () => setTimeout(() => { ensureOnScreen(); if (bubble && !bubble.isDestroyed()) setBox(bubble, bubbleBounds(collapsed)); }, 500));
    tray = new Tray(trayIcon());
    // The "E" is white on a dark taskbar and black on a light one.
    nativeTheme.on('updated', () => tray?.setImage(trayIcon()));
    tray.on('click', () => show());
    refreshTray();

    updates = setupUpdates({ app, send: (st) => { broadcast('esther:update', st); refreshTray(); }, log: (m) => console.warn(m) });
    ipcMain.handle('esther:state', () => state());
    ipcMain.handle('esther:update-status', () => updates.status());
    ipcMain.on('esther:update-check', () => updates.check());
    ipcMain.on('esther:update-install', () => updates.install());
    ipcMain.handle('esther:set', (_e, p) => setPrefs(p ?? {}));
    ipcMain.on('esther:hide', () => hide());
    ipcMain.on('esther:show', () => show());
    ipcMain.on('esther:bubble', () => bubbleClick());
    ipcMain.on('esther:bubble-wheel', (_e, d) => { if (!collapsed) return; setBubbleSize(prefs.bubbleSize * (d < 0 ? 1.06 : 1 / 1.06)); savePrefs(); broadcast('esther:changed', null); });
    ipcMain.on('esther:track', (e, t) => {
      const w = BrowserWindow.fromWebContents(e.sender);
      if (!w) return;
      if (t?.phase === 'mods') { w.trackMods = { shift: !!t.shift, alt: !!t.alt }; return; }
      if (t?.phase === 'start' && ['move', 'resize'].includes(t.kind)) track(w, t.kind, /^(n|s|e|w|ne|nw|se|sw)$/.test(t.edge) ? t.edge : 'se'); else untrack(w);
    });
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
      const [mw, mh] = minSizeOf(w);
      const id = [...cards].find(([, c]) => c === w)?.[0];
      // The grip reports CSS pixels; at other scales the window is that many times bigger or smaller.
      const z = prefs.scale;
      const want = id ? gridSize(w, s.width * z, s.height * z) : { width: Math.round(s.width * z), height: Math.round(s.height * z) };
      const b = w.getBounds();
      setBox(w, { x: b.x, y: b.y, width: Math.max(mw || 260, want.width), height: Math.max(mh || 200, want.height) });
    });
    // The windows come last, once everything they ask for is ready.
    for (const id of Object.keys(CARDS)) await createCard(id); // the first (the header) hosts the others' page process
    await createBubble();
    setTimeout(makeGuides, 1500); // ready before the first drag
    watchWallpaper(() => { diag('wallpaper changed'); for (const w of [...liveCards(), settingsWin]) if (w) sendBackdrop(w); });
    app.on('before-quit', () => { quitting = true; });
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  if (process.env.ESTHER_TEST) global.__esther = { resizeRect, trayMenu: () => trayMenu, guides: () => guidesWin, setBubbleSize, trayIcon, bubble: () => bubble, bubbleBounds, isCollapsed: () => collapsed, show, hide, toggle, resetLayout, defaultPlace, openSettings, setCard, setScale, pointer, GRID, diag, layer: () => layer, card: (id) => cards.get(id), settings: () => settingsWin, prefs: () => prefs };
  app.on('window-all-closed', () => app.quit());
}
