// Checks for the desktop app, run inside Electron: npm run test:desktop (on Linux: xvfb-run electron --no-sandbox ...).
// Loads the real main process, then checks the cards, the bridge, syncing between cards, hide/show, the layout,
// settings, and (on Windows) where the cards sit in the window stack.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { app, BrowserWindow, globalShortcut } = require('electron');
process.env.ESTHER_TEST = '1';
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'esther-desk-'));
app.setPath('userData', userData);
// A test wallpaper (a 64×36 gradient PNG) for Esther's own blur.
process.env.ESTHER_WALLPAPER = path.join(userData, 'wall.png');
fs.writeFileSync(process.env.ESTHER_WALLPAPER, (() => {
  const zlib = require('node:zlib');
  const W = 64, H = 36, raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) raw.set([x * 4, y * 7, 160, 255], y * (W * 4 + 1) + 1 + x * 4);
  const crc = (b) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})());
require(path.join(__dirname, '..', 'electron', 'main.cjs'));

const results = [];
const check = (n, ok, x = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  → ' + x}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.log(`TIMEOUT after 120 s; ${results.filter(Boolean).length}/${results.length} checks had passed`); app.exit(1); }, 120_000);
process.on('unhandledRejection', (e) => { console.log('ERROR', e?.stack ?? e); app.exit(1); });
const IDS = ['header', 'tasks', 'calendar', 'week'];

app.whenReady().then(async () => {
  console.log('desktop checks starting on', process.platform);
  const E = global.__esther;
  const C = (id) => E.card(id);
  const ready = () => IDS.every((id) => C(id) && C(id).isVisible() && !C(id).webContents.isLoading());
  for (let i = 0; i < 150 && !ready(); i++) await wait(100);
  const js = (id, code) => Promise.race([C(id).webContents.executeJavaScript(code), wait(10_000).then(() => { throw new Error(`${id} card did not answer: ${code.slice(0, 70)}`); })]);
  await wait(500);

  check('Four cards open, each its own window', ready(), IDS.map((id) => `${id}:${!!C(id) && C(id).isVisible()}`).join(' '));
  for (const id of IDS) check(`The ${id} card shows its own part`, (await js(id, `document.documentElement.dataset.card`)) === id);
  check('Cards have no frame and no taskbar button, and are see-through', C('tasks').getBackgroundColor().toLowerCase().endsWith('00') && !C('tasks').isMenuBarVisible());
  check('Cards sit in different places (spread over the desktop)', new Set(IDS.map((id) => `${C(id).getBounds().x},${C(id).getBounds().y}`)).size === 4, JSON.stringify(IDS.map((id) => C(id).getBounds())));
  check('Tasks card: list tabs and the table', await js('tasks', `!!document.querySelector('.table') && document.querySelectorAll('[role=tab]').length >= 2`));
  check('Calendar card: the month', await js('calendar', `document.querySelectorAll('.cal-grid .day').length >= 28`));
  check('Week card: Monday to Sunday', await js('week', `document.querySelectorAll('.wday').length >= 7`));
  check('Header card: the Esther logo in Instrument Serif', (await js('header', `getComputedStyle(document.querySelector('.wordmark')).fontFamily`)).includes('Instrument Serif'));
  check('Card backgrounds are transparent around the card', (await js('tasks', `getComputedStyle(document.body).backgroundColor`)) === 'rgba(0, 0, 0, 0)');

  check('Ctrl+Alt+E is registered', globalShortcut.isRegistered('Control+Alt+E'));
  const st = await js('tasks', `window.estherDesktop.state()`);
  check('The bridge reports its settings, starting on the desktop layer', st.shortcut === 'Control+Alt+E' && st.shortcutOk && st.layer === 'desktop', JSON.stringify(st));
  await js('tasks', `window.estherDesktop.set({ shortcut: 'Control+Alt+T', layer: 'top' })`);
  check('Changing the shortcut moves it', globalShortcut.isRegistered('Control+Alt+T') && !globalShortcut.isRegistered('Control+Alt+E'));
  check('Always on top applies to every card', IDS.every((id) => C(id).isAlwaysOnTop()));
  await js('tasks', `window.estherDesktop.set({ layer: 'desktop' })`);
  check('Back on the desktop, no card is on top', IDS.every((id) => !C(id).isAlwaysOnTop()));

  // Cards keep each other up to date.
  await js('tasks', `(() => { const i = document.querySelector('input[aria-label="Add a task"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Synced across cards'); i.dispatchEvent(new Event('input', { bubbles: true })); i.form.requestSubmit(); })()`);
  await wait(300);
  await js('tasks', `(() => { const row = [...document.querySelectorAll('.task')].find((r) => r.textContent.includes('Synced across cards')); const inp = row.querySelector('.date-chip input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(inp, new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)); inp.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await wait(800);
  check('A task typed in the Tasks card appears in the Week card', await js('week', `document.querySelector('.wday.today')?.textContent.includes('Synced across cards')`));
  await js('calendar', `document.querySelector('.day.today').click()`); await wait(500);
  check('Picking a day on the Calendar card filters the Tasks card', await js('tasks', `!!document.querySelector('.filter-chip')`));
  await js('tasks', `document.querySelector('.filter-chip button').click()`); await wait(200);
  await js('week', `[...document.querySelectorAll('.tline-title')].find((b) => b.textContent === 'Synced across cards').click()`); await wait(500);
  check('Clicking a task in the Week card opens it in the Tasks card', (await js('tasks', `document.querySelector('.task.open .task-title')?.textContent`)) === 'Synced across cards');

  // Esther's own blur, rounded corners.
  check('Each card gets the wallpaper behind it for its own blur', (await js('calendar', `document.documentElement.dataset.wall === '1' && getComputedStyle(document.documentElement).getPropertyValue('--wall').startsWith('url("data:image/jpeg')`)));
  check('The blurred copy is drawn under the card, with the Blur setting', (await js('calendar', `getComputedStyle(document.querySelector('.app > .card'), '::before').filter`)).startsWith('blur('));
  check('Cards have rounded corners', parseFloat(await js('tasks', `getComputedStyle(document.querySelector('.app > .card')).borderTopLeftRadius`)) >= 6);
  const wx = await js('calendar', `getComputedStyle(document.documentElement).getPropertyValue('--wall-x')`);
  C('calendar').setPosition(C('calendar').getBounds().x + 40, C('calendar').getBounds().y); await wait(500);
  check('Moving a card keeps its blurred wallpaper lined up with the real one', parseFloat(await js('calendar', `getComputedStyle(document.documentElement).getPropertyValue('--wall-x')`)) !== parseFloat(wx));

  // Placing cards (snapping off for exact sizes; it has its own check below).
  await js('tasks', `window.estherDesktop.set({ snap: false })`);
  const t0 = C('tasks').getBounds();
  await js('tasks', `window.estherDesktop.size(700, 420)`); await wait(400);
  const t1 = C('tasks').getBounds();
  check('A card\'s corner grip resizes it and keeps its position', t1.width === 700 && t1.height === 420 && t1.x === t0.x && t1.y === t0.y, JSON.stringify({ t0, t1 }));
  C('calendar').setPosition(300, 200); await wait(700);
  const saved = JSON.parse(fs.readFileSync(path.join(userData, 'desktop.json'), 'utf8'));
  check('Where you put each card is remembered', saved.cards?.calendar?.x === 300 && saved.cards?.tasks?.width === 700, JSON.stringify(saved.cards));
  await js('header', `document.querySelector('.brand').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`); await wait(500);
  const home = E.defaultPlace('calendar'), now = C('calendar').getBounds();
  check('Double-clicking the Esther logo puts every card back', now.x === home.x && now.y === home.y && C('tasks').getBounds().width === E.defaultPlace('tasks').width, JSON.stringify({ home, now }));

  // Snapping: a card let go near another lines up with it, with an even gap; a resize matches its neighbour.
  await js('tasks', `window.estherDesktop.set({ snap: true })`);
  const cal = C('calendar').getBounds(), wk = C('week').getBounds();
  // On Windows, snapping happens when a drag ends ('moved'), which a programmatic move doesn't send, so send it.
  C('week').setPosition(cal.x + 9, cal.y + cal.height + 16 + 7); if (process.platform === 'win32') C('week').emit('moved'); await wait(900);
  const wk2 = C('week').getBounds();
  check('Snapping: a card dropped near another lines up with it, with an even gap', wk2.x === cal.x && wk2.y === cal.y + cal.height + 16, JSON.stringify({ cal, wk2 }));
  await js('week', `window.estherDesktop.size(${cal.width - 8}, ${wk.height})`); await wait(400);
  check('Snapping: resizing a card near its neighbour\'s width matches it', C('week').getBounds().width === cal.width, JSON.stringify({ cal: cal.width, week: C('week').getBounds().width }));
  E.resetLayout(); await wait(500);

  // Closing a card (Alt+F4) only turns it off; Settings or the tray brings it back.
  C('calendar').close(); await wait(400);
  check('Closing a card hides it instead of losing it', !C('calendar').isDestroyed() && !C('calendar').isVisible() && E.prefs().hiddenCards.includes('calendar'));
  E.hide(); await wait(300); E.show(); await wait(500);
  check('A card you turned off stays off when Esther shows again', !C('calendar').isVisible() && C('tasks').isVisible());
  const st2 = await js('tasks', `window.estherDesktop.set({ card: { id: 'calendar', on: true } })`); await wait(500);
  check('Turning the card back on in Settings brings it back', C('calendar').isVisible() && st2.cards.find((c) => c.id === 'calendar').on, JSON.stringify(st2.cards));

  // Size (scale).
  const w100 = C('tasks').getBounds().width;
  await js('tasks', `window.estherDesktop.set({ scale: 0.75 })`); await wait(600);
  check('Size 75% shrinks every card and its contents', C('tasks').webContents.getZoomFactor() === 0.75 && Math.abs(C('tasks').getBounds().width - w100 * 0.75) <= 2, JSON.stringify({ w100, now: C('tasks').getBounds().width, z: C('tasks').webContents.getZoomFactor() }));
  await js('tasks', `window.estherDesktop.set({ scale: 1 })`); await wait(600);
  check('Size back to 100%', C('tasks').webContents.getZoomFactor() === 1 && Math.abs(C('tasks').getBounds().width - w100) <= 2, JSON.stringify({ w100, now: C('tasks').getBounds().width }));

  // Hiding and coming back.
  E.hide(); await wait(300);
  check('Hide tucks every card away', IDS.every((id) => !C(id).isVisible()));
  E.toggle(); await wait(500);
  check('The shortcut brings every card back', IDS.every((id) => C(id).isVisible()));
  C('week').setBounds({ x: -5000, y: -5000, width: 360, height: 300 }); await wait(200); E.show(); await wait(400);
  check('A card stranded off-screen (monitor change) comes back on screen', C('week').getBounds().x > -1000);
  if (process.platform === 'win32') check('Windows: cards can\'t be maximised, minimised or made full screen', IDS.every((id) => !C(id).isMaximizable() && !C(id).isMinimizable() && !C(id).isFullScreenable()));
  C('tasks').maximize(); await wait(300);
  check('Asking a card to maximise does nothing', !C('tasks').isMaximized());
  check('Text is a solid colour (no see-through grey)', await js('week', `(() => { const c = getComputedStyle(document.querySelector('.card-head .quiet')).color; return !c.includes('/') && !c.startsWith('rgba'); })()`));

  // Settings: its own card; a change there reaches the other cards.
  E.openSettings(); await wait(1500);
  const S = E.settings();
  check('The gear opens the Settings card', !!S && S.isVisible() && (await S.webContents.executeJavaScript(`document.documentElement.dataset.card`)) === 'settings');
  check('Settings has a sidebar of sections', await S.webContents.executeJavaScript(`document.querySelectorAll('.set-nav button').length === 5 && !!document.querySelector('.set-body .set-row')`));
  await S.webContents.executeJavaScript(`[...document.querySelectorAll('.set-nav button')].find((b) => b.textContent === 'Cards').click()`); await wait(300);
  check('Settings → Cards lists every card with an on/off switch', (await S.webContents.executeJavaScript(`document.querySelectorAll('.set-body [role=switch]').length`)) === 4);
  await S.webContents.executeJavaScript(`[...document.querySelectorAll('.set-nav button')].find((b) => b.textContent === 'Look').click()`); await wait(300);
  await S.webContents.executeJavaScript(`[...document.querySelectorAll('[role=radio]')].find((b) => b.textContent.includes('Illuminated')).click()`); await wait(700);
  check('Changing the look in Settings changes every card', (await js('tasks', `document.documentElement.dataset.look`)) === 'illuminated' && (await js('calendar', `document.documentElement.dataset.look`)) === 'illuminated');

  // Windows only: the desktop layer, checked against the real window stack.
  if (process.platform === 'win32') {
    check('Windows: cards skip Windows\' window animations and are tool windows', IDS.every((id) => C(id).styled?.applied && C(id).styled.transitions && C(id).styled.tool), JSON.stringify(IDS.map((id) => C(id).styled)));
    const L = E.layer();
    S.hide();
    const other = new BrowserWindow({ width: 900, height: 700, x: 50, y: 50, title: 'Another app' });
    await other.loadURL('data:text/html,<h1>another app</h1>');
    other.show(); other.focus(); await wait(1500);
    const oh = Number(other.getNativeWindowHandle().readBigUInt64LE(0));
    for (const id of ['tasks', 'calendar']) {
      const d = L.debug(C(id));
      check(`Windows: after clicking another app, the ${id} card is above the desktop, under the app, and showing`, d && d.helperOwner === d.desk && d.aboveDesktop && d.below(oh) && C(id).isVisible(), JSON.stringify({ ...d, below: undefined }));
    }
    E.toggle(); await wait(800);
    check('Windows: the shortcut brings the cards in front of the other app', !L.debug(C('tasks')).below(oh));
    other.focus(); await wait(1500);
    check('Windows: clicking the other app again puts the cards back on the desktop, still visible', L.debug(C('tasks')).aboveDesktop && L.debug(C('tasks')).below(oh) && C('tasks').isVisible());
    other.destroy();
  } else console.log('(Windows window-stack checks run on Windows only)');

  const up = await js('tasks', `window.estherDesktop.updates.status()`);
  check('The updater reports its state (off when not installed)', up.state === 'dev' && up.version === app.getVersion(), JSON.stringify(up));
  console.log(`\n${results.filter(Boolean).length}/${results.length} desktop checks passed`);
  app.exit(results.every(Boolean) ? 0 : 1);
});
