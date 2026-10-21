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
  await js('tasks', `[...document.querySelectorAll('.task')].find((r) => r.textContent.includes('Synced across cards')).querySelector('.date-chip button').click()`); await wait(300);
  check('The date chip opens Esther\'s own rounded date picker', await js('tasks', `!!document.querySelector('.popover.date-pop .date-picker') && parseFloat(getComputedStyle(document.querySelector('.popover.date-pop')).borderTopLeftRadius) >= 6`));
  await js('tasks', `window.dispatchEvent(new Event('blur'))`); await wait(200);
  check('Clicking outside the card closes an open picker', await js('tasks', `!document.querySelector('.popover')`));
  await js('tasks', `[...document.querySelectorAll('.task')].find((r) => r.textContent.includes('Synced across cards')).querySelector('.date-chip button').click()`); await wait(300);
  await js('tasks', `document.querySelector('.date-pop .dp-today').click()`);
  await wait(800);
  check('A task typed in the Tasks card appears in the Week card', await js('week', `document.querySelector('.wday.today')?.textContent.includes('Synced across cards')`));
  await js('calendar', `document.querySelector('.day.today').click()`); await wait(500);
  check('Picking a day on the Calendar card filters the Tasks card', await js('tasks', `!!document.querySelector('.filter-chip')`));
  await js('tasks', `document.querySelector('.filter-chip button').click()`); await wait(200);
  await js('week', `[...document.querySelectorAll('.tline-title')].find((b) => b.textContent === 'Synced across cards').click()`); await wait(500);
  check('Clicking a task in the Week card opens it in the Tasks card', (await js('tasks', `document.querySelector('.task.open .task-title')?.textContent`)) === 'Synced across cards');

  // The glass: Windows' own (acrylic, live, on Windows 11) or Esther's own blur of the wallpaper.
  if (E.prefs().material !== 'esther') {
    check('Windows\' own acrylic glass, with rounded corners asked of Windows', IDS.every((id) => C(id).styled?.round && C(id).styled.corners) && (await js('calendar', `document.documentElement.dataset.glass`)) === 'native', JSON.stringify(IDS.map((id) => C(id).styled)));
    check('The card adds only the tint and grain over Windows\' glass', await js('calendar', `getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(document.querySelector('.glass'), '::after').backgroundImage.includes('gradient')`));
  } else {
    check('Each card gets the wallpaper behind it for its own blur', await js('calendar', `document.documentElement.dataset.wall === '1' && getComputedStyle(document.querySelector('.glass')).backgroundImage.startsWith('url("data:image/jpeg')`));
    check('The frosted copy is worked out once and sits on its own element (no live blur, no page-wide variables)', await js('calendar', `(() => { const g = getComputedStyle(document.querySelector('.glass')); const r = getComputedStyle(document.documentElement); return g.filter === 'none' && r.getPropertyValue('--wall') === '' && r.getPropertyValue('--wall-x') === '' && r.getPropertyValue('--noise') === ''; })()`));
    check('Fluent grain and tint over the glass', (await js('calendar', `getComputedStyle(document.querySelector('.glass'), '::after').backgroundImage`)).includes('data:image/png'));
    check('Cards have rounded corners', parseFloat(await js('tasks', `getComputedStyle(document.querySelector('.app > .card')).borderTopLeftRadius`)) >= 6);
    const wx = await js('calendar', `getComputedStyle(document.querySelector('.glass')).backgroundPositionX`);
    C('calendar').setPosition(C('calendar').getBounds().x + 40, C('calendar').getBounds().y); await wait(500);
    check('Moving a card keeps its blurred wallpaper lined up with the real one', parseFloat(await js('calendar', `getComputedStyle(document.querySelector('.glass')).backgroundPositionX`)) === parseFloat(wx) - 40, String(wx));
  }

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

  // Moving and resizing: Esther follows the mouse itself and lands the card on an 8 px grid.
  await js('tasks', `window.estherDesktop.set({ snap: true })`);
  const { screen: scr } = require('electron');
  let fake = { x: 0, y: 0 };
  const realPointer = { at: E.pointer.at, down: E.pointer.down };
  E.pointer.at = () => fake; E.pointer.down = null;
  const wk = C('week').getBounds(), wa = scr.getDisplayMatching(wk).workArea;
  fake = { x: wk.x + 60, y: wk.y + 20 };
  await js('week', `window.estherDesktop.track('move', 'start')`); await wait(100);
  fake = { x: wk.x + 60 - 37, y: wk.y + 20 - 21 }; await wait(200);
  await js('week', `window.estherDesktop.track('move', 'end')`); await wait(200);
  const wk2 = C('week').getBounds();
  // It lands on the grid, or on a guide (another card's edge, the screen's centre…) within 10 px.
  check('Dragging a card by its title moves it with the mouse, onto the grid or a guide', Math.abs(wk2.x - (wk.x - 37)) <= 10 && Math.abs(wk2.y - (wk.y - 21)) <= 10 && (wk2.x !== wk.x - 37 || wk2.y !== wk.y - 21), JSON.stringify({ wk, wk2, wa }));
  fake = { x: wk2.x + wk2.width - 5, y: wk2.y + wk2.height - 5 };
  await js('week', `window.estherDesktop.track('resize', 'start')`); await wait(100);
  fake = { x: fake.x + 29, y: fake.y + 13 }; await wait(200);
  await js('week', `window.estherDesktop.track('resize', 'end')`); await wait(200);
  const wk3 = C('week').getBounds();
  check('Resizing from the corner follows the mouse, edges on the grid', (wk3.x + wk3.width - wa.x) % E.GRID === 0 && (wk3.y + wk3.height - wa.y) % E.GRID === 0 && Math.abs(wk3.width - (wk2.width + 29)) <= 4, JSON.stringify({ wk2, wk3 }));
  fake = { x: 5, y: 5 }; await wait(100);
  check('Letting go stops following the mouse', C('week').getBounds().x === wk3.x);
  // Guides: while dragging, the grid and the screen's centre and quarters show; near the centre, the card snaps to it.
  {
    const cb = C('calendar').getBounds();
    const cx = wa.x + wa.width / 2;
    fake = { x: cb.x + 30, y: cb.y + 20 };
    await js('calendar', `window.estherDesktop.track('move', 'start')`); await wait(100);
    const want = cx - cb.width / 2; // where the calendar's centre is on the screen's centre
    fake = { x: cb.x + 30 + (want - cb.x) + 7, y: cb.y + 20 + 33 }; await wait(250);
    const G = E.guides();
    const drawn = G && G.isVisible() && (await G.webContents.executeJavaScript(`document.querySelector('canvas.guides.on') !== null`));
    const cb2 = C('calendar').getBounds();
    check('Dragging shows the grid and guides over the screen', !!drawn);
    check('A card dragged near the screen\'s centre snaps to it', Math.abs(cb2.x + cb2.width / 2 - cx) <= 1, JSON.stringify({ cb2, cx }));
    await js('calendar', `window.estherDesktop.track('move', 'end')`); await wait(300);
    check('The guides go away when you let go', !E.guides().isVisible());
  }
  // Resizing from any edge or corner, with the grid and guides showing; Alt from the centre, Shift in proportion.
  {
    E.resetLayout(); await wait(400);
    const resize = async (id, edge, ddx, ddy, mods = {}) => {
      const b = C(id).getBounds();
      E.pointer.mods = () => mods;
      fake = { x: b.x + 10, y: b.y + 10 };
      await js(id, `window.estherDesktop.track('resize', 'start', '${edge}')`); await wait(80);
      fake = { x: fake.x + ddx, y: fake.y + ddy }; await wait(220);
      const during = E.guides()?.isVisible();
      await js(id, `window.estherDesktop.track('resize', 'end')`); await wait(250);
      E.pointer.mods = null;
      return { b, a: C(id).getBounds(), during };
    };
    const near = (a, b, t = 10) => Math.abs(a - b) <= t;
    let r = await resize('calendar', 'e', 41, 0);
    check('Resizing from the right edge: wider, same place, with the grid and guides showing', r.during && near(r.a.width, r.b.width + 41) && r.a.x === r.b.x && r.a.height === r.b.height, JSON.stringify(r));
    r = await resize('calendar', 'w', -43, 0);
    check('Resizing from the left edge: the right edge stays put', near(r.a.width, r.b.width + 43) && r.a.x + r.a.width === r.b.x + r.b.width, JSON.stringify(r));
    r = await resize('calendar', 'n', 0, 37);
    check('Resizing from the top edge: the bottom stays put', near(r.a.height, r.b.height - 37) && r.a.y + r.a.height === r.b.y + r.b.height, JSON.stringify(r));
    r = await resize('calendar', 'e', 40, 0, { alt: true });
    check('Alt: the opposite side moves too (resized from the centre)', near(r.a.width, r.b.width + 80, 20) && near(r.a.x + r.a.width / 2, r.b.x + r.b.width / 2, 2), JSON.stringify(r));
    r = await resize('calendar', 'se', 60, 10, { shift: true });
    check('Shift: the proportions stay the same', Math.abs(r.a.width / r.a.height - r.b.width / r.b.height) < 0.02 && r.a.x === r.b.x && r.a.y === r.b.y, JSON.stringify(r));
    r = await resize('calendar', 'se', 50, 0, { shift: true, alt: true });
    check('Shift+Alt: in proportion, from the centre', Math.abs(r.a.width / r.a.height - r.b.width / r.b.height) < 0.02 && near(r.a.x + r.a.width / 2, r.b.x + r.b.width / 2, 2) && near(r.a.y + r.a.height / 2, r.b.y + r.b.height / 2, 2), JSON.stringify(r));
    check('Every card has resize edges on all four sides and corners', (await js('week', `document.querySelectorAll('.edge').length`)) === 8);
    E.resetLayout(); await wait(400);
  }
  check('Cards use no Windows title-bar dragging (buttons in them always click)', (await js('header', `[...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).webkitAppRegion === 'drag').length`)) === 0);
  E.pointer.at = realPointer.at; E.pointer.down = realPointer.down;
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

  // Hiding and coming back, with Esther's own fade-out and call-up.
  E.hide(); await wait(40);
  check('Hiding gathers the cards into the Esther bubble first', IDS.every((id) => C(id).isVisible()) && (await js('tasks', `document.documentElement.classList.contains('leaving') && document.documentElement.classList.contains('fly-to')`)));
  await wait(450);
  {
    const bb = E.bubble().getBounds(), big = E.bubbleBounds(true);
    E.setBubbleSize(0.5); await wait(100);
    check('The bubble can be made smaller', E.bubble().getBounds().width === 260, JSON.stringify(E.bubble().getBounds()));
    E.setBubbleSize(0.6); await wait(100);
    check('…and the bubble grows into "Esther" in the middle of the screen', E.isCollapsed() && E.bubble().isVisible() && bb.x === big.x && bb.y === big.y && bb.width === big.width, JSON.stringify({ bb, big }));
    check('The bubble is "Esther" in Instrument Serif italic', await E.bubble().webContents.executeJavaScript(`(() => { const s = getComputedStyle(document.querySelector('.bubble')); return document.querySelector('.bubble').textContent === 'Esther' && s.fontFamily.includes('Instrument Serif') && s.fontStyle === 'italic'; })()`));
  }
  check('Hide tucks every card away', IDS.every((id) => !C(id).isVisible()));
  E.toggle(); await wait(60);
  check('The shortcut calls the cards up with an animation', await js('tasks', `document.documentElement.classList.contains('entering') && (document.documentElement.dataset.glass === 'native' ? getComputedStyle(document.querySelector('.app > .card')).animationName === 'native-in' : getComputedStyle(document.querySelector('.app')).animationName === 'esther-in')`));
  await wait(700);
  check('The shortcut brings every card back', IDS.every((id) => C(id).isVisible()) && (await js('tasks', `getComputedStyle(document.querySelector('.app')).opacity`)) === '1');
  C('week').setBounds({ x: -5000, y: -5000, width: 360, height: 300 }); await wait(200); E.show(); await wait(400);
  E.hide(); await wait(500);
  await E.bubble().webContents.executeJavaScript(`document.querySelector('.bubble').click()`); await wait(80);
  check('Clicking the bubble brings the cards back out of it', IDS.every((id) => C(id).isVisible()) && (await js('calendar', `document.documentElement.classList.contains('fly-from')`)));
  await wait(500);
  { const bb = E.bubble().getBounds(), small = E.bubbleBounds(false); check('…and the bubble becomes a small "Esther" in the bottom-left corner', !E.isCollapsed() && bb.x === small.x && bb.y === small.y && bb.height === small.height, JSON.stringify({ bb, small })); }
  await js('tasks', `window.estherDesktop.set({ bubble: false })`); await wait(200);
  check('The bubble can be turned off in Settings', !E.bubble());
  await js('tasks', `window.estherDesktop.set({ bubble: true })`); await wait(1200);
  check('…and on again', !!E.bubble() && E.bubble().isVisible());
  check('A card stranded off-screen (monitor change) comes back on screen', C('week').getBounds().x > -1000);
  if (process.platform === 'win32') check('Windows: cards can\'t be maximised, minimised or made full screen', IDS.every((id) => !C(id).isMaximizable() && !C(id).isMinimizable() && !C(id).isFullScreenable()));
  C('tasks').maximize(); await wait(300);
  check('Asking a card to maximise does nothing', !C('tasks').isMaximized());
  check('Text is a solid colour (no see-through grey)', await js('week', `(() => { const c = getComputedStyle(document.querySelector('.card-head .quiet')).color; return !c.includes('/') && !c.startsWith('rgba'); })()`));

  // The tray icon: Esther's "E".
  check('The tray icon is the monochrome "E" in every size', E.trayIcon().getScaleFactors().length >= 4, JSON.stringify(E.trayIcon().getScaleFactors()));
  // Compact Tasks: narrow enough to sit beside the calendar and the week.
  C('tasks').setSize(360, 600); await wait(500);
  check('Tasks fits a narrow card: compact rows, list shown as a dot', await js('tasks', `(() => { const h = getComputedStyle(document.querySelector('.thead')).display === 'none'; const row = document.querySelector('.task .tr'); return h && row.getBoundingClientRect().height < 50 && !!row.querySelector('.row-dot') && getComputedStyle(row.querySelector('.row-dot')).display !== 'none' && document.querySelector('.table').scrollWidth <= document.querySelector('.table').clientWidth + 1; })()`));
  E.resetLayout(); await wait(500);
  // The tray menu: Windows' own menu.
  {
    const items = E.trayMenu().items;
    const labels = items.map((i) => i.label);
    check('The tray menu is the system\'s own, with the cards, Settings and Quit', ['Hide Esther', 'Cards', 'Put the cards back', 'Where the cards sit', 'Settings…', 'Quit Esther'].every((l) => labels.includes(l)), JSON.stringify(labels));
    const cal = () => E.trayMenu().items.find((i) => i.label === 'Cards').submenu.items.find((i) => i.label === 'Calendar');
    cal().click(); await wait(500);
    check('Turning a card off from the tray menu', !C('calendar').isVisible() && cal().checked === false);
    cal().click(); await wait(500);
    check('…and back on', C('calendar').isVisible() && cal().checked === true);
    E.trayMenu().items.find((i) => i.label === 'Settings…').click(); await wait(1500);
    check('Settings… in the tray menu opens Settings', !!E.settings() && E.settings().isVisible());
  }

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
    check('Windows: on the desktop layer the cards (and the bubble) are attached to the desktop window', IDS.every((id) => L.owner(C(id)) === L.desktop()) && L.owner(E.bubble()) === L.desktop(), JSON.stringify(IDS.map((id) => L.owner(C(id))).concat([L.desktop()])));
    // The gear, clicked with the real mouse: nothing in the header may act as a title bar or cover it.
    {
      const koffi = require('koffi');
      const u = koffi.load('user32.dll');
      const SetCursorPos = u.func('bool __stdcall SetCursorPos(int X, int Y)');
      const mouse_event = u.func('void __stdcall mouse_event(uint32_t f, uint32_t dx, uint32_t dy, uint32_t d, uintptr_t e)');
      const WindowFromPoint = u.func('uintptr_t __stdcall WindowFromPoint(int64_t pt)');
      const SendMessageW = u.func('intptr_t __stdcall SendMessageW(uintptr_t h, uint32_t m, uintptr_t w, intptr_t l)');
      const GetAncestor = u.func('uintptr_t __stdcall GetAncestor(uintptr_t h, uint32_t f)');
      const GetClassNameW = u.func('int __stdcall GetClassNameW(uintptr_t h, _Out_ uint16_t *buf, int n)');
      const cls = (h) => { const b = new Uint16Array(128); const n = GetClassNameW(h, b, 128); return String.fromCharCode(...b.slice(0, n)); };
      E.show(); await wait(800);
      const r = await js('header', `(() => { const b = document.querySelector('button[aria-label=Settings]').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
      const hb = C('header').getBounds(), z = C('header').webContents.getZoomFactor();
      const dip = { x: Math.round(hb.x + r.x * z), y: Math.round(hb.y + r.y * z) };
      const px = scr.dipToScreenPoint(dip);
      const hh = Number(C('header').getNativeWindowHandle().readBigUInt64LE(0));
      const under = Number(GetAncestor(Number(WindowFromPoint(BigInt(px.x) & 0xffffffffn | (BigInt(px.y) << 32n))), 2));
      const hit = Number(SendMessageW(hh, 0x84, 0, (px.y << 16) | (px.x & 0xffff)));
      check('Windows: the gear is on top at its spot and is a normal clickable area (not a title bar)', under === hh && hit === 1, JSON.stringify({ under, hh, hit, px }));
      SetCursorPos(px.x, px.y); await wait(100);
      mouse_event(0x2, 0, 0, 0, 0); await wait(60); mouse_event(0x4, 0, 0, 0, 0); await wait(1500);
      check('Windows: clicking the gear with the mouse opens Settings', !!E.settings() && E.settings().isVisible(), E.diag.text().split('\n').slice(-12).join(' | '));
      E.settings()?.hide();

      // Clicking the empty desktop, and Show desktop, must never cover the cards, not even for a moment.
      const pt = (p) => BigInt(p.x) & 0xffffffffn | (BigInt(p.y) << 32n);
      const hw = (w) => Number(w.getNativeWindowHandle().readBigUInt64LE(0));
      const watchCover = async (ms, during) => {
        // Only the cards no other app overlaps (the test machine has its own terminal window open over part of the desktop;
        // a card under an app is meant to stay under it).
        const spots = IDS.map((id) => { const b = C(id).getBounds(); return { id, h: hw(C(id)), p: scr.dipToScreenPoint({ x: b.x + Math.round(b.width / 2), y: b.y + 14 }) }; })
          .filter((q) => Number(GetAncestor(Number(WindowFromPoint(pt(q.p))), 2)) === q.h);
        const miss = {}, seen = []; let samples = 0; const t0 = Date.now();
        const t = setInterval(() => {
          samples++;
          for (const q of spots) {
            const r = Number(GetAncestor(Number(WindowFromPoint(pt(q.p))), 2));
            if (r === q.h) continue;
            miss[q.id] = (miss[q.id] || 0) + 1;
            const what = `${q.id}@${Date.now() - t0}ms:${cls(r)}`;
            if (seen.length < 8 && !seen.some((x) => x.split(':')[1] === cls(r) && x.startsWith(q.id))) seen.push(what);
          }
        }, 4);
        await wait(150); const before = { ...miss };
        await during(); await wait(ms); clearInterval(t);
        return { miss, before, samples, seen, watched: spots.map((q) => q.id) };
      };
      // The runner's own console window would sit over the cards; minimise it so the desktop is clear, as on a real one.
      const FindWindowW = u.func('uintptr_t __stdcall FindWindowW(str16 c, str16 t)');
      const ShowWindow = u.func('bool __stdcall ShowWindow(uintptr_t h, int n)');
      for (const c of ['CASCADIA_HOSTING_WINDOW_CLASS', 'ConsoleWindowClass']) for (let h = FindWindowW(c, null), i = 0; h && i < 10; h = FindWindowW(c, null), i++) ShowWindow(h, 6);
      E.layer().lower(); await wait(500);
      check('Windows: clicking away puts the cards back down (none stays above an app)', IDS.every((id) => !E.layer().aboveAnApp(C(id))), IDS.map((id) => { const a = E.layer().aboveAnApp(C(id)); return a ? `${id} above ${cls(a)}` : ''; }).join(' '));
      const tb = C('tasks').getBounds(), cb = C('calendar').getBounds(), wa2 = scr.getPrimaryDisplay().workArea;
      const blank = scr.dipToScreenPoint({ x: Math.round((tb.x + tb.width + cb.x) / 2), y: wa2.y + wa2.height - 30 });
      const r1 = await watchCover(1000, async () => { SetCursorPos(blank.x, blank.y); await wait(50); mouse_event(0x2, 0, 0, 0, 0); await wait(40); mouse_event(0x4, 0, 0, 0, 0); });
      check('Windows: clicking the empty desktop never covers the cards (no flicker)', r1.watched.length >= 2 && !Object.keys(r1.miss).length && IDS.every((id) => C(id).isVisible()), JSON.stringify({ ...r1, blank }));
      const toggleDesktop = () => new Promise((res) => require('node:child_process').exec('powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).ToggleDesktop()"', () => res()));
      const r2 = await watchCover(1500, toggleDesktop);
      check('Windows: Show desktop never covers the cards (no flicker)', r2.watched.length >= 2 && !Object.keys(r2.miss).length && IDS.every((id) => C(id).isVisible()), JSON.stringify(r2));
      await toggleDesktop(); await wait(800);

      // Resizing with the real mouse from an edge, holding Alt: Esther's own resizing (not Windows'), from the centre,
      // with the guides showing.
      const keybd_event = u.func('void __stdcall keybd_event(uint8_t vk, uint8_t scan, uint32_t flags, uintptr_t extra)');
      E.show(); await wait(800);
      const rb = C('calendar').getBounds();
      const edgeDip = { x: rb.x + 2, y: rb.y + Math.round(rb.height / 2) };
      const ep = scr.dipToScreenPoint(edgeDip);
      const ch = hw(C('calendar'));
      const edgeHit = Number(SendMessageW(ch, 0x84, 0, (ep.y << 16) | (ep.x & 0xffff)));
      check('Windows: a card\'s edge is Esther\'s to resize, not Windows\' (no native resize border)', edgeHit === 1, `hit test ${edgeHit} (1 = Esther's, 10-17 = Windows' resize border)`);
      SetCursorPos(ep.x, ep.y); await wait(150);
      keybd_event(0x12, 0, 0, 0); await wait(50); // Alt down
      mouse_event(0x2, 0, 0, 0, 0); await wait(80);
      let guidesSeen = false;
      for (let i = 1; i <= 10; i++) { SetCursorPos(ep.x - 4 * i, ep.y); await wait(30); guidesSeen ||= !!E.guides()?.isVisible(); }
      await wait(150);
      mouse_event(0x4, 0, 0, 0, 0); await wait(50);
      keybd_event(0x12, 0, 2, 0); await wait(300); // Alt up
      const ra = C('calendar').getBounds();
      check('Windows: dragging an edge with the real mouse resizes with the grid and guides showing', guidesSeen && ra.width > rb.width + 20, JSON.stringify({ rb, ra, guidesSeen }));
      check('Windows: holding Alt resizes from the centre (the opposite edge moves too)', Math.abs((ra.x + ra.width / 2) - (rb.x + rb.width / 2)) <= 4 && ra.width >= rb.width + 60, JSON.stringify({ rb, ra }));
      E.resetLayout(); await wait(400);
    }
    const other = new BrowserWindow({ width: 900, height: 700, x: 50, y: 50, title: 'Another app' });
    await other.loadURL('data:text/html,<h1>another app</h1>');
    other.show(); other.focus(); await wait(1500);
    const oh = Number(other.getNativeWindowHandle().readBigUInt64LE(0));
    // Minimising another app leaves the cards alone: nothing hidden, minimised or re-layered.
    {
      const before = E.diag.text().split('\n').length;
      other.minimize(); await wait(1200);
      const after = E.diag.text().split('\n').slice(before - 1).join(' | ');
      check('Windows: minimising another app doesn\'t touch the cards (no flicker)', IDS.every((id) => C(id).isVisible()) && !/(hide|minimize|restore|lowered (?!nothing)|slipped)/.test(after), after);
      other.restore(); other.focus(); await wait(1500);
    }
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

  // Tasks are shared with the native Tasks card through a file: Esther writes it, and takes changes made to it.
  {
    const f = path.join(userData, 'tasks.json');
    const shared = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
    check('Esther shares its tasks in tasks.json', !!shared && shared.tasks.some((t) => t.title === 'Synced across cards'), shared ? `${shared.tasks.length} tasks` : 'no file');
    shared.tasks.unshift({ id: 't-native', listId: shared.lists[0].id, title: 'Added by the native card', done: false, subtasks: [] });
    fs.writeFileSync(f, JSON.stringify(shared, null, 2)); await wait(1500);
    check('A task added to tasks.json by the native card shows up in Esther', await js('tasks', `[...document.querySelectorAll('.task-title')].some((e) => e.textContent === 'Added by the native card')`));
  }

  // Light on memory: one page process for all of Esther's windows; graphics and networking in the main process.
  {
    const m = app.getAppMetrics();
    const kb = (p) => p.memory.privateBytes ?? p.memory.workingSetSize;
    const total = Math.round(m.reduce((t, p) => t + kb(p), 0) / 1024);
    const pages = new Set([...IDS.map((id) => C(id)), E.bubble(), E.guides(), E.settings()].filter((w) => w && !w.isDestroyed()).map((w) => w.webContents.getOSProcessId()));
    console.log(`memory: ${m.length} processes, ${total} MB (${m.map((p) => `${p.type} ${Math.round(kb(p) / 1024)}`).join(', ')})`);
    check('All of Esther\'s windows share one page process', pages.size === 1, `${pages.size} page processes`);
    check('Esther runs as at most 4 processes', m.length <= 4, m.map((p) => p.type).join(', '));
  }
  const up = await js('tasks', `window.estherDesktop.updates.status()`);
  check('The updater reports its state (off when not installed)', up.state === 'dev' && up.version === app.getVersion(), JSON.stringify(up));
  console.log(`\n${results.filter(Boolean).length}/${results.length} desktop checks passed`);
  app.exit(results.every(Boolean) ? 0 : 1);
});
