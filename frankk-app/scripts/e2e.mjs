// Browser-driven checks for Milestone 1. Run: npm run e2e  (needs `npm run dev` or `vite preview` on :5173)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/?today=2026-10-14';
const exe = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('docs/screens', { recursive: true });

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + extra}`); };

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1586, height: 992 } });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });

const general = page.locator('section[aria-label="General"]');
const music = page.locator('section[aria-label="Music"]');
const seround = page.locator('section[aria-label="Seround"]');
const house = page.locator('section[aria-label="House"]');
const titles = async () => (await general.locator('.task .task-title').allTextContents()).map((s) => s.trim());
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('frankk.proto.data.v1')));
const box = async (loc) => (await loc.boundingBox());
const reload = async () => { await page.reload(); await page.waitForSelector('section[aria-label="General"]'); await page.waitForTimeout(900); };

await page.goto(BASE); await page.waitForSelector('section[aria-label="General"]'); await page.waitForTimeout(900);

/* ---------- General: create ---------- */
await general.getByRole('button', { name: 'New task' }).click();
await page.getByLabel('Task name', { exact: true }).fill('Pay parking fine');
await page.getByRole('textbox', { name: 'Steps', exact: true }).fill('Find ticket\nPay online');
await page.locator('.new-form input[type=date]').nth(1).fill('2026-10-20');
await page.getByRole('button', { name: 'Save task' }).click();
check('General: new task appears at top', (await titles())[0] === 'Pay parking fine', JSON.stringify(await titles()));
check('General: new task has steps 0/2 and due date saved', (await store()).tasks.find((t) => t.title === 'Pay parking fine')?.steps.length === 2);

/* ---------- steps & parent independence ---------- */
const food = general.locator('[data-task="t-food"]');
await food.locator('.task-title').click();
await food.getByLabel('Put away').check();
const s1 = (await store()).tasks.find((t) => t.id === 't-food');
check('Steps: all steps ticked does NOT complete parent', s1.steps.every((s) => s.done) && !s1.done);
await food.getByLabel('Complete Clean food box').check();
check('Parent: completing keeps steps as they were', (await store()).tasks.find((t) => t.id === 't-food').done === true);
await food.getByLabel('Reopen Clean food box').uncheck();
check('Parent: reopen works', (await store()).tasks.find((t) => t.id === 't-food').done === false);
await food.locator('.step.add input').fill('Dry overnight'); await food.locator('.step.add input').press('Enter');
check('Steps: add step inline', (await store()).tasks.find((t) => t.id === 't-food').steps.length === 4);

/* ---------- inline rename: save and cancel ---------- */
const dentist = general.locator('[data-task="t-dentist"]');
await dentist.locator('.task-title').dblclick();
await dentist.getByLabel('Task title').fill('Book dentist (Tuesday)'); await dentist.getByLabel('Task title').press('Escape');
check('Rename: Esc cancels', (await store()).tasks.find((t) => t.id === 't-dentist').title === 'Book dentist');
await dentist.locator('.task-title').dblclick();
await dentist.getByLabel('Task title').fill('Book dentist (Tuesday)'); await dentist.getByLabel('Task title').press('Enter');
const dt = (await store()).tasks.find((t) => t.id === 't-dentist');
check('Rename: Enter saves and note path is unchanged', dt.title === 'Book dentist (Tuesday)' && dt.notePath === 'Planning/Tasks/Book dentist.md');

/* ---------- dates ---------- */
await dentist.getByLabel(/Due date of/).click();
await dentist.locator('input[type=date]').fill('2026-10-30'); await dentist.locator('input[type=date]').press('Enter').catch(() => {});
await page.waitForTimeout(100);
check('Dates: due date edited inline, task date untouched', (await store()).tasks.find((t) => t.id === 't-dentist').due === '2026-10-30' && (await store()).tasks.find((t) => t.id === 't-dentist').plan === '2026-10-16');

/* ---------- filter / sort ---------- */
await general.getByRole('button', { name: /Filter tasks/ }).click();
await page.getByRole('menuitemradio', { name: 'Overdue' }).click();
check('Filter: Overdue shows only the overdue task', JSON.stringify(await titles()) === JSON.stringify(['Call landlord about the gate']), JSON.stringify(await titles()));
await general.getByRole('button', { name: /Filter tasks/ }).click();
await page.getByRole('menuitemradio', { name: 'Completed' }).click();
check('Filter: Completed shows done tasks (recoverable)', (await titles()).join() === 'Renew passport photos', (await titles()).join());
await general.getByRole('button', { name: /Filter tasks/ }).click();
await page.getByRole('menuitemradio', { name: 'All tasks' }).click();
await general.getByRole('button', { name: /Sort tasks/ }).click();
await page.getByRole('menuitemradio', { name: 'Title A–Z' }).click();
const sorted = await titles();
check('Sort: Title A–Z (open first)', sorted[0] === 'Book dentist (Tuesday)' && sorted.indexOf('Renew passport photos') === sorted.length - 1, sorted.join('|'));
check('Sort: row grips disabled when not manual', (await general.locator('.row-grip.off').count()) > 0);
await general.getByRole('button', { name: /Sort tasks/ }).click();
await page.getByRole('menuitemradio', { name: 'Manual order' }).click();

/* ---------- row drag (pointer) ---------- */
const before = await titles();
const g1 = await box(general.locator('[data-task="t-budget"] .row-grip'));
const target = await box(general.locator('[data-task="t-food"] .row-grip'));
await page.mouse.move(g1.x + 6, g1.y + 10); await page.mouse.down();
await page.mouse.move(g1.x + 6, g1.y - 20, { steps: 5 });
await page.mouse.move(target.x + 6, target.y - 8, { steps: 12 });
await page.mouse.up(); await page.waitForTimeout(300);
const after = await titles();
check('Row drag: Review budget moved above Clean food box', after.indexOf('Review budget') < after.indexOf('Clean food box') && after.join() !== before.join(), after.join('|'));
check('Row drag did not move the panel or toggle a checkbox', (await store()).tasks.find((t) => t.id === 't-budget').done === false);

/* ---------- row move via keyboard ---------- */
const orderBefore = await titles();
await general.locator('[data-task="t-budget"] .row-grip').focus();
await page.keyboard.press('Alt+ArrowDown'); await page.waitForTimeout(200);
const orderAfter = await titles();
check('Keyboard: Alt+Down moves the row', orderBefore.indexOf('Review budget') + 1 === orderAfter.indexOf('Review budget'), orderAfter.join('|'));
await reload();
const persisted = await titles();
check('Persistence: new task, order and edits survive restart', persisted.join() === orderAfter.join(), persisted.join('|'));

/* ---------- column resize ---------- */
const th = general.locator('.thead .th').nth(1); // Progress
const w0 = (await box(th)).width;
const handle = await box(th.locator('.col-resizer'));
await page.mouse.move(handle.x + 4, handle.y + 8); await page.mouse.down(); await page.mouse.move(handle.x + 34, handle.y + 8, { steps: 6 }); await page.mouse.up();
const w1 = (await box(general.locator('.thead .th').nth(1))).width;
check('Columns: drag resizes Progress independently', w1 > w0 + 15, `${w0} → ${w1}`);
const dueW = (await box(general.locator('.thead .th').nth(3))).width;
await reload();
const w2 = (await box(general.locator('.thead .th').nth(1))).width;
check('Columns: width persists after restart', Math.abs(w2 - w1) < 3, `${w1} vs ${w2}`);
await general.locator('.thead .th').nth(2).locator('.col-resizer').focus(); await page.keyboard.press('ArrowRight');
check('Columns: keyboard resize', (await box(general.locator('.thead .th').nth(2))).width > 0);
void dueW;

/* ---------- panel move & resize ---------- */
const gridItem = (n) => page.locator('.react-grid-item').nth(n);
const gen0 = await box(gridItem(1));
const grip = await box(general.locator('.panel-grip'));
const seroundBox = await box(gridItem(3));
await page.mouse.move(grip.x + 8, grip.y + 12); await page.mouse.down();
await page.mouse.move(grip.x + 100, grip.y + 30, { steps: 6 });
await page.mouse.move(seroundBox.x + 120, seroundBox.y + 30, { steps: 14 });
await page.mouse.up(); await page.waitForTimeout(900);
const gen1 = await box(page.locator('.react-grid-item:has(section[aria-label="General"])'));
check('Panel drag: General moved by its grip', Math.abs(gen1.x - gen0.x) > 200, `${gen0.x} → ${gen1.x}`);
const rh = page.locator('.react-grid-item:has(section[aria-label="House"]) .react-resizable-handle-se');
const hb = await box(page.locator('.react-grid-item:has(section[aria-label="House"])'));
await page.locator('.react-grid-item:has(section[aria-label="House"])').hover();
const rb = await box(rh);
await page.mouse.move(rb.x + 9, rb.y + 9); await page.mouse.down(); await page.mouse.move(rb.x + 9, rb.y + 69, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(900);
const hb2 = await box(page.locator('.react-grid-item:has(section[aria-label="House"])'));
check('Panel resize: House made taller via corner handle', hb2.height > hb.height + 20, `${hb.height} → ${hb2.height}`);
await page.waitForTimeout(500);
const layoutKey = () => page.evaluate(() => localStorage.getItem('frankk.proto.v1.layout.board'));
const lay1 = JSON.parse(await layoutKey()).items;
await reload();
const lay2 = JSON.parse(await layoutKey()).items;
const g = lay2.find((l) => l.i === 'general'), h = lay2.find((l) => l.i === 'house');
check('Layout persists after restart (saved positions and sizes identical)', JSON.stringify(lay1) === JSON.stringify(lay2) && g.x !== 0 && h.h > 17, JSON.stringify({ g, h }));

/* ---------- edit layout: hide / restore ---------- */
await page.getByRole('button', { name: /Edit layout/ }).click();
await page.getByRole('checkbox', { name: 'Calendar' }).uncheck();
await page.keyboard.press('Escape');
check('Layout: secondary widget can be hidden', (await page.locator('section[aria-label="Calendar"]').count()) === 0);
await page.getByRole('button', { name: /Edit layout/ }).click();
await page.getByRole('menuitem', { name: 'Restore default layout' }).click();
await page.waitForTimeout(500);
check('Layout: restore default brings it back', (await page.locator('section[aria-label="Calendar"]').count()) === 1);
const genReset = await box(page.locator('.react-grid-item:has(section[aria-label="General"])'));
check('Layout: restore default puts General back on the left', genReset.x < 200, String(genReset.x));

/* ---------- quick capture ---------- */
const count0 = (await store()).tasks.filter((t) => t.title === 'Quick one').length;
await page.getByLabel('Quick capture text').fill('Quick one');
await page.getByRole('button', { name: 'Save capture' }).dblclick();
await page.waitForTimeout(200);
check('Quick capture: double-click creates exactly one task', (await store()).tasks.filter((t) => t.title === 'Quick one').length === count0 + 1);
check('Quick capture: unavailable types are disabled', await page.getByRole('button', { name: 'Idea' }).isDisabled());

/* ---------- Music ---------- */
const jz = music.locator('[data-project="p-jzero"]');
check('Music: JZero shows Artist job pill + Mix/Master only', (await jz.textContent()).includes('Artist job') && (await jz.textContent()).includes('Mix / Master only'));
check('Music: JZero starts at 1/2', (await jz.locator('.progress-num').first().textContent()) === '1/2');
check('Music: only assigned stages listed as work (Mix, Master)', (await jz.locator('.stage-name').allTextContents()).join() === 'Mix,Master');
await jz.getByRole('button', { name: /Other stages outside my scope/ }).click();
check('Music: out-of-scope stages are in a separate, labelled list (6)', (await jz.locator('.outside-list .tag').count()) === 6);
await jz.getByLabel('Master done').check();
check('Music: JZero reaches 2/2 with the rest of the release out of scope', (await jz.locator('.progress-num').first().textContent()) === '2/2');
const single = music.locator('[data-project="p-single"]');
await single.getByRole('button', { name: /Expand FRANKK/ }).click();
check('Music: own release shows timeline and full-release wording', (await single.locator('.timeline li').count()) >= 5 && (await single.textContent()).includes('Full release'));
await single.getByLabel('Mark MV outside').count();
await music.getByRole('button', { name: 'New project or artist job' }).click();
await page.getByLabel('Artist / client').fill('Nok'); await page.getByLabel('Project / release').fill('Demo');
await page.locator('.chip-check', { hasText: 'Mix' }).click();
await page.getByRole('button', { name: 'Add', exact: true }).click();
const nok = (await store()).projects.find((p) => p.artist === 'Nok');
check('Music: new artist job with only chosen stage in scope', nok && nok.stages.filter((s) => s.inScope).map((s) => s.name).join() === 'Mix' && nok.kind === 'artist-job');

/* ---------- Seround ---------- */
check('Seround: brand groups use exact spelling', (await seround.locator('.group-head').allTextContents()).join('|').includes('Reva Gem Cosmentics'));
await seround.getByRole('button', { name: /Filter by brand/ }).click();
await page.getByRole('menuitemradio', { name: 'Eli Lao Origin' }).click();
check('Seround: brand filter shows one brand', (await seround.locator('.group-head').count()) === 1);
await seround.getByRole('button', { name: /Filter by brand/ }).click();
await page.getByRole('menuitemradio', { name: 'All brands' }).click();
await seround.getByRole('button', { name: /Office calendar/ }).click();
check('Seround: office calendar says Not connected', (await page.getByText('Not connected').first().isVisible()));
await page.keyboard.press('Escape');

/* ---------- House: bills ---------- */
const elec = house.locator('[data-bill="b-elec:2026-10"]');
check('House: Electricity starts Unpaid', (await elec.textContent()).includes('Unpaid'));
await elec.getByLabel(/Mark paid/).check();
const bill = (await store()).bills.find((b) => b.id === 'b-elec');
check('House: paying October does not pay other months', bill.payments['2026-10'].paid && !bill.payments['2026-11'] && bill.payments['2026-09'].paid === true);
check('House: missed Water bill (Sep) stays visible and unpaid', (await house.locator('[data-bill="b-water:2026-09"]').textContent()).includes('Missed'));
await house.locator('[data-bill="b-water:2026-10"]').getByLabel(/Bill options/).click();
await page.locator('.popover select').selectOption('5');
check('House: reminder offset editable', (await store()).bills.find((b) => b.id === 'b-water').reminderDays === 5);
await page.keyboard.press('Escape');

/* ---------- Search, Today, drawer ---------- */
await page.keyboard.press('Control+k');
await page.getByPlaceholder('Search tasks, projects and bills…').fill('packag');
await page.keyboard.press('Enter');
check('Search: Ctrl+K finds and opens a task drawer', await page.getByRole('dialog', { name: /Review packaging/ }).isVisible());
await page.getByRole('dialog', { name: /Review packaging/ }).getByRole('button', { name: /Open in Obsidian/ }).click();
check('Open in Obsidian: shows simulated dialog with obsidian:// link', (await page.locator('.uri').textContent()).startsWith('obsidian://open?vault=FRANKK%20VAULT'));
await page.locator('.modal').getByRole('button', { name: 'Close', exact: true }).click();
await page.keyboard.press('Escape');
await page.screenshot({ path: 'docs/screens/wide-after.png' });

/* ---------- Today strip ---------- */
const today = await page.locator('.today-item').allTextContents();
check('Today strip: today + overdue work shown, no invented items', today.length >= 3 && today.some((t) => /Record vocals/.test(t)) && !today.some((t) => /Review budget/.test(t)), today.join(' / '));

/* ---------- focus mode & narrow ---------- */
await general.getByRole('button', { name: 'Focus General' }).click();
check('Focus mode: General fills the main area', (await box(page.locator('.focus > .panel'))).width > 900);
await page.screenshot({ path: 'docs/screens/focus-general.png' });
await page.keyboard.press('Escape');
await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(700);
const sc = await page.evaluate(() => { const e = document.querySelector('.board-scroll'); return { sw: e.scrollWidth, cw: e.clientWidth }; });
check('Narrow 1024px: board keeps readable width and scrolls sideways', sc.sw > sc.cw, JSON.stringify(sc));
await page.screenshot({ path: 'docs/screens/narrow-1024.png' });
await page.setViewportSize({ width: 1586, height: 992 });

/* ---------- reset ---------- */
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('button', { name: 'Reset sample data' }).click();
await page.getByRole('button', { name: 'Yes, reset' }).click();
await page.getByRole('button', { name: 'Home' }).click(); await page.waitForTimeout(500);
check('Reset sample data restores the originals', !(await titles()).includes('Pay parking fine'));

check('No console errors or page errors', problems.length === 0, problems.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
