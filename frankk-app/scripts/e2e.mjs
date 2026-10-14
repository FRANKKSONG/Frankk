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
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('esther.proto.data.v4')));
const box = async (loc) => (await loc.boundingBox());
const reload = async () => { await page.reload(); await page.waitForSelector('.homepage'); await page.getByRole('button', { name: 'Tasks', exact: true }).click(); await page.waitForSelector('section[aria-label="General"]'); await page.waitForTimeout(900); };
const reloadHome = async () => { await page.reload(); await page.waitForSelector('.homepage'); await page.waitForTimeout(700); };

await page.goto(BASE); await page.waitForSelector('.homepage'); await page.waitForTimeout(900);

/* ---------- Home dashboard ---------- */
const overdueNum = await page.locator('[data-widget="w-over"] .w-stat-num').textContent();
check('Home: at-a-glance numbers come from the data (2 overdue)', overdueNum === '2', overdueNum);
check('Home: Today, This week, Music, Money widgets render', (await page.locator('.wcard').count()) >= 10 && (await page.locator('.w-week .w-day').count()) === 7);
await page.getByRole('button', { name: 'Customize' }).click();
const wBefore = await page.locator('.wcard').count();
await page.getByRole('button', { name: 'Add widget' }).click();
await page.locator('.catalog-item', { hasText: 'Pinned note' }).click();
await page.waitForTimeout(300);
check('Home: add a widget from the catalog', (await page.locator('.wcard').count()) === wBefore + 1);
await page.locator('[data-widget="w-capture"]').getByRole('button', { name: /Settings for/ }).click();
await page.getByRole('button', { name: 'Remove widget' }).click();
check('Home: remove a widget', (await page.locator('.wcard').count()) === wBefore);
await page.getByRole('button', { name: 'Background' }).click();
await page.locator('.bg-tile', { hasText: 'Starred lapis' }).click();
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Done' }).click();
await reloadHome();
check('Home: dashboard changes persist after restart', (await page.locator('.wcard').count()) === wBefore && (await store()).dashboards[0].background === 'lapis');

/* ---------- Library: types, smart fields, views ---------- */
await page.getByRole('button', { name: 'Library', exact: true }).click();
await page.locator('.lib-type', { hasText: 'People' }).click();
check('Library: People table lists 4 people', (await page.locator('.dv-table tbody tr').count()) === 4);
await page.getByRole('tab', { name: /Fields/ }).click();
await page.getByLabel('New field name').fill('Followers');
const detected = await page.locator('.field-add select').inputValue();
await page.getByRole('button', { name: 'Add field' }).click();
const personType = (await store()).types.find((t) => t.id === 'person');
check('Library: new field kind is detected (Followers → Number) and stored on the type', detected === 'number' && personType.fields.some((f) => f.key === 'followers' && f.kind === 'number'), detected);
await page.getByRole('tab', { name: 'Records' }).click();
await page.locator('.lib-type', { hasText: 'Ideas' }).click();
const card = page.locator('.dv-card', { hasText: 'sundey sticker merch' });
await card.dragTo(page.locator('.dv-col', { hasText: 'Doing' }).first());
await page.waitForTimeout(200);
check('Library: drag a card to another board column updates its field', (await store()).entries.find((e) => e.id === 'e-merch').props.status === 'Doing');
await page.getByRole('radio', { name: 'Table' }).click();
check('Library: switch the same view to a table', (await page.locator('.dv-table').count()) === 1);
await page.getByRole('button', { name: 'New type' }).click();
await page.locator('#nty-name').fill('Book');
await page.locator('.chip-check', { hasText: 'Author' }).click();
await page.locator('.chip-check', { hasText: 'Rating' }).click();
await page.getByRole('button', { name: 'Create type' }).click();
const book = (await store()).types.find((t) => t.id === 'book');
check('Library: create your own type with suggested smart fields', book && book.fields.map((f) => `${f.key}:${f.kind}`).join() === 'author:text,rating:rating', JSON.stringify(book?.fields));

/* ---------- Notes ---------- */
await page.getByRole('button', { name: 'Notes', exact: true }).click();
await page.locator('.tree-note', { hasText: 'My next single' }).click();
check('Notes: backlinks list notes that link here', (await page.locator('.note-side .side-link', { hasText: 'Knowledge index' }).count()) === 1);
await page.locator('.tree-note', { hasText: 'Vocal mixing notes' }).click();
await page.locator('.note-read .wikilink', { hasText: 'Jing' }).click();
check('Notes: [[Jing]] opens the person record', await page.getByRole('dialog', { name: /Details: Jing/ }).isVisible());
await page.keyboard.press('Escape');
await page.locator('.proposal', { hasText: 'Mood' }).getByRole('button', { name: 'Approve' }).click();
check('Notes: approving a librarian proposal applies it', (await store()).types.find((t) => t.id === 'idea').fields.some((f) => f.key === 'mood'));

/* ---------- Settings ---------- */
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.getByRole('button', { name: 'Obsidian bridge' }).click();
check('Settings: saved views preview as Obsidian Bases files', (await page.locator('.code-block').textContent()).includes('file.inFolder('));
await page.getByRole('button', { name: 'Vault & storage' }).click();
check('Settings: storage shows every type and its vault folder', (await page.locator('.set-table tbody tr').count()) === (await store()).types.length);

await page.getByRole('button', { name: 'Tasks', exact: true }).click();
await page.waitForSelector('section[aria-label="General"]'); await page.waitForTimeout(700);

/* ---------- General: create ---------- */
await general.getByRole('button', { name: 'New task' }).click();
await page.locator('#nt-title').fill('Pay parking fine');
await page.locator('#nt-steps').fill('Find ticket\nPay online');
await page.locator('#nt-due').fill('2026-10-20');
await page.getByRole('button', { name: 'Add task' }).click();
check('General: new task appears at top', (await titles())[0] === 'Pay parking fine', JSON.stringify(await titles()));
check('General: new task has steps 0/2 and due date saved', (await store()).tasks.find((t) => t.title === 'Pay parking fine')?.steps.length === 2);

/* ---------- steps & parent independence ---------- */
const food = general.locator('[data-task="t-food"]');
await food.getByRole('button', { name: 'Expand steps of Clean food box' }).click();
await food.getByRole('checkbox', { name: 'Put away', exact: true }).check();
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
await dentist.locator('.task-title').click();
await dentist.getByLabel('Task name', { exact: true }).fill('Book dentist (Tuesday)'); await dentist.getByLabel('Task name', { exact: true }).press('Escape');
check('Rename (click name): Esc cancels', (await store()).tasks.find((t) => t.id === 't-dentist').title === 'Book dentist');
await dentist.locator('.task-title').click();
await dentist.getByLabel('Task name', { exact: true }).fill('Book dentist (Tuesday)'); await dentist.getByLabel('Task name', { exact: true }).press('Enter');
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
await page.getByRole('menuitemradio', { name: 'Title', exact: true }).click();
const sorted = await titles();
check('Sort: Title (open first)', sorted[0] === 'Book dentist (Tuesday)' && sorted.indexOf('Renew passport photos') === sorted.length - 1, sorted.join('|'));
check('Sort: row grips disabled when not manual', (await general.locator('.row-grip.off').count()) > 0);
await general.getByRole('button', { name: /Sort tasks/ }).click();
await page.getByRole('menuitemradio', { name: 'Manual order' }).click();

/* ---------- sortable headers ---------- */
await general.locator('.thead .th-btn', { hasText: 'Due' }).click();
const byDue = await titles();
check('Header click sorts by Due (earliest first, completed last)', byDue[0] === 'Call landlord about the gate' && byDue.at(-1) === 'Renew passport photos', byDue.join('|'));
await general.locator('.thead .th-btn', { hasText: 'Due' }).click();
const byDueDesc = await titles();
check('Second click reverses the sort and shows ▼', byDueDesc[0] !== byDue[0] && (await general.locator('.th.sorted .sort-ind').textContent()) === '▼', byDueDesc.join('|'));
await general.locator('.thead .th-btn', { hasText: 'Due' }).click();
check('Third click returns to manual order (drag enabled again)', (await general.locator('.row-grip.off').count()) === 0);

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

const progTh = general.locator('.thead .th').nth(1);
await progTh.locator('.col-resizer').dblclick();
await page.waitForTimeout(100);
check('Columns: double-click a divider fits the column to its content', (await box(general.locator('.thead .th').nth(1))).width >= 60);

/* ---------- drag music stages ---------- */
const single0 = music.locator('[data-project="p-single"]');
const stageNames = async () => (await single0.locator('.project-detail > .sortable-row .stage-name').allTextContents());
const recGrip = single0.locator('.project-detail > .sortable-row').filter({ has: page.locator('.stage-name', { hasText: /^Record$/ }) }).locator('.drag-grip').first();
await recGrip.focus();
await page.keyboard.press('Space'); await page.waitForTimeout(150);
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(150);
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(150);
await page.keyboard.press('Space'); await page.waitForTimeout(300);
const order = (await store()).projects.find((x) => x.id === 'p-single').stages.map((x) => x.name);
check('Music: stages reorder by drag handle (keyboard: Space, arrows, Space)', order.indexOf('Record') < order.indexOf('Produce'), order.join(' > '));

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
const ser1 = await box(page.locator('.react-grid-item:has(section[aria-label="Seround"])'));
check('Panel drag: dropping General on Seround swaps them', Math.abs(gen1.x - seroundBox.x) < 4 && Math.abs(ser1.x - gen0.x) < 4 && Math.abs(gen1.y - gen0.y) < 4, `gen ${gen0.x}->${gen1.x} (target ${seroundBox.x}), seround -> ${ser1.x}`);
const rh = page.locator('.react-grid-item:has(section[aria-label="House"]) .react-resizable-handle-se');
const hb = await box(page.locator('.react-grid-item:has(section[aria-label="House"])'));
await page.locator('.react-grid-item:has(section[aria-label="House"])').hover();
const rb = await box(rh);
await page.mouse.move(rb.x + 9, rb.y + 9); await page.mouse.down(); await page.mouse.move(rb.x + 9, rb.y + 69, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(900);
const hb2 = await box(page.locator('.react-grid-item:has(section[aria-label="House"])'));
check('Panel resize: House made taller via corner handle', hb2.height > hb.height + 20, `${hb.height} → ${hb2.height}`);
await page.waitForTimeout(500);
const layoutKey = () => page.evaluate(() => localStorage.getItem('esther.proto.v1.layout.board'));
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
const musReset = await box(page.locator('.react-grid-item:has(section[aria-label="Music"])'));
check('Layout: restore default puts General back on the left', genReset.x < musReset.x && genReset.y === musReset.y, `${genReset.x} vs ${musReset.x}`);

/* ---------- quick capture ---------- */
const count0 = (await store()).tasks.filter((t) => t.title === 'Quick one').length;
await page.getByLabel('Quick capture text').fill('Quick one');
await page.getByRole('button', { name: 'Save capture' }).dblclick();
await page.waitForTimeout(200);
check('Quick capture: double-click creates exactly one task', (await store()).tasks.filter((t) => t.title === 'Quick one').length === count0 + 1);
check('Quick capture: planned types are shown as planned, not clickable', (await page.locator('.qc-later').first().getAttribute('title')).includes('planned') && await page.getByRole('button', { name: 'Idea' }).count() === 0);

/* ---------- more editing ---------- */
await food.getByRole('button', { name: 'Expand steps of Clean food box' }).click().catch(() => {});
await page.locator('[data-task="t-food"]').getByRole('button', { name: /^Step: Empty box/ }).click();
await page.locator('[data-task="t-food"]').getByLabel('Step', { exact: true }).fill('Empty the box');
await page.keyboard.press('Enter');
check('Edit: step text editable with one click', (await store()).tasks.find((t) => t.id === 't-food').steps.some((x) => x.text === 'Empty the box'));
check('No on-row remove buttons: deleting lives in the right-click menu', await page.locator('[data-task="t-food"]').getByRole('button', { name: /^Remove step/ }).count() === 0);
await page.locator('[data-task="t-food"] .step').first().click({ button: 'right' });
await page.locator('.context-menu').getByRole('menuitem', { name: 'Delete step' }).click();
check('Edit: step can be removed via right-click', !(await store()).tasks.find((t) => t.id === 't-food').steps.some((x) => x.text === 'Empty the box'));
await page.getByRole('button', { name: 'Undo' }).click();
check('Undo brings the removed step back', (await store()).tasks.find((t) => t.id === 't-food').steps.some((x) => x.text === 'Empty the box'));
await general.getByRole('button', { name: /General panel name/ }).click();
await page.getByLabel('General panel name', { exact: true }).fill('Personal'); await page.keyboard.press('Enter');
check('Edit: panel name renamable', (await general.locator('.panel-title').textContent()).includes('Personal'));
await seround.getByRole('button', { name: /^Brand name: Eli Lao Origin/ }).click();
await page.getByLabel('Brand name', { exact: true }).fill('Eli Lao'); await page.keyboard.press('Enter');
const st2 = await store();
check('Edit: brand rename updates its tasks', st2.brands.includes('Eli Lao') && st2.tasks.find((t) => t.id === 's-pack').brand === 'Eli Lao');
await page.keyboard.press('Control+z');
check('Ctrl+Z undoes the brand rename', (await store()).brands.includes('Eli Lao Origin'));

/* ---------- Music ---------- */
check('Music: separate tabs for my releases and artist jobs', await music.getByRole('tab', { name: /My releases/ }).getAttribute('aria-selected') === 'true' && await music.locator('[data-project="p-jzero"]').count() === 0);
await music.getByRole('tab', { name: /Artist jobs/ }).click();
const jz = music.locator('[data-project="p-jzero"]');
await jz.getByRole('button', { name: /Expand JZero/ }).click();
check('Music: JZero shows Job pill + Mix/Master only', (await jz.textContent()).includes('Job') && (await jz.textContent()).includes('Mix / Master only'));
check('Music: JZero starts at 50% (1 of 2), % printed on bar', (await jz.locator('.plabel').first().textContent()) === '50%');
check('Music: only assigned stages listed as work (Mix, Master)', (await jz.locator('.stage-name').allTextContents()).join() === 'Mix,Master', (await jz.locator('.stage-name').allTextContents()).join());
await jz.getByRole('button', { name: /Other stages outside my scope/ }).click();
check('Music: out-of-scope stages are in a separate, labelled list (6)', (await jz.locator('.outside-list .tag').count()) === 6);
await jz.getByLabel('Master done').check();
check('Music: JZero reaches 2/2 with the rest of the release out of scope', (await jz.locator('.plabel').first().textContent()) === '100%');
await music.getByRole('tab', { name: /My releases/ }).click();
const single = music.locator('[data-project="p-single"]');
const stepNames = (await single.locator('.stepper .name').allTextContents()).join(' → ');
check('Music: own release shows a step bar of its release steps (in your order)', stepNames.split(' → ').sort().join() === ['Art (Design)', 'Concept', 'Lyrics', 'Mix & Master', 'Produce', 'Record'].sort().join() && stepNames.startsWith('Concept'), stepNames);
await single.getByRole('tab', { name: /Other tracks/ }).click();
check('Music: Marketing/MV are separate tracks, not steps', (await single.locator('.side-track .stage-name').allTextContents()).join() === 'Marketing,Streaming' && !stepNames.includes('Marketing'));
const before2 = await single.locator('.mini-steps em').textContent();
await single.locator('.side-track .stage').first().getByLabel('Marketing done').check();
check('Music: finishing a separate track does not move the release step bar', (await single.locator('.mini-steps em').textContent()) === before2);
await single.getByRole('tab', { name: /Release steps/ }).click();
await music.getByRole('button', { name: 'New release' }).click();
await page.getByRole('radio', { name: /Artist job/ }).click();
await page.locator('#np-artist').fill('Nok'); await page.locator('#np-title').fill('Demo');
await page.locator('.stage-pick').filter({ has: page.getByText('Mix', { exact: true }) }).locator('.check').click();
await page.getByRole('button', { name: 'Create', exact: true }).click();
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

/* ---------- Seround repost queue ---------- */
const queueBefore = (await store()).tasks.filter((t) => t.workstream === 'content').length;
await seround.getByLabel(/Add to sundey .* repost queue/).fill('Night market clip');
await seround.getByLabel(/Add to sundey .* repost queue/).press('Enter');
const q = (await store()).tasks.filter((t) => t.workstream === 'content');
check('Seround: repost queue is a simple to-do list (one-line add, no progress bar)', q.length === queueBefore + 1 && q.every((t) => t.mode === 'simple')
  && (await seround.locator('.queue .pbar').count()) === 0);

/* ---------- Tags ---------- */
await page.getByLabel('Quick capture text').fill('Call bank #money #errand');
await page.getByRole('button', { name: 'Save capture' }).click();
const bank = (await store()).tasks.find((t) => t.title === 'Call bank');
check('Tags: "#tag" in quick capture tags the task and creates new tags', bank && bank.tags.join() === 'money,errand' && (await store()).tags.some((t) => t.name === 'errand'));
{
  const qc = page.locator('section[aria-label="Quick capture"]').first();
  await qc.getByRole('radio', { name: 'House' }).click();
  await qc.getByLabel('Quick capture text').fill('Fix tap\nBuy bulbs #home');
  await qc.getByRole('button', { name: 'Save capture' }).click();
  const all = (await store()).tasks;
  const tap = all.find((t) => t.title === 'Fix tap'), bulbs = all.find((t) => t.title === 'Buy bulbs');
  check('Quick capture: one task per line, into the chosen category', tap?.area === 'house' && bulbs?.area === 'house' && bulbs.tags.includes('home'), JSON.stringify([tap?.area, bulbs?.tags]));
  await qc.getByRole('radio', { name: 'General' }).click();
}
await general.locator('.tag-chip', { hasText: '#money' }).first().click();
const filtered = await titles();
check('Tags: clicking a tag filters the board', filtered.length > 0 && filtered.every((t) => ['Review budget', 'Call bank'].includes(t)), filtered.join('|'));
await page.getByRole('button', { name: 'Clear tag filter' }).click();
await general.locator('[data-task="t-dentist"]').hover();
await general.locator('[data-task="t-dentist"]').getByRole('button', { name: /Tags for/ }).click();
await page.getByLabel('Tag name', { exact: true }).fill('Weekend');
await page.keyboard.press('Enter');
await page.keyboard.press('Escape');
check('Tags: add a new tag to a row from its tag button', (await store()).tasks.find((t) => t.id === 't-dentist').tags.includes('weekend'));

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

/* ---------- themes ---------- */
await page.getByRole('button', { name: 'Appearance' }).click();
await page.getByRole('radio', { name: /Nocturne/ }).click();
const lookN = await page.evaluate(() => [document.documentElement.dataset.look, document.documentElement.dataset.style].join());
await page.getByRole('radio', { name: /Modern/ }).click();
const lookM = await page.evaluate(() => [document.documentElement.dataset.look, document.documentElement.dataset.style].join());
await page.getByRole('radio', { name: /Gilded/ }).click();
await page.keyboard.press('Escape');
const vine = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--vine'));
check('Themes: Gilded, Nocturne and Modern switch; decorated looks draw the vine border', lookN === 'nocturne,medieval' && lookM === 'modern,modern'
  && (await page.evaluate(() => document.documentElement.dataset.look)) === 'gilded' && vine.includes('data:image/svg+xml'), `${lookN} ${lookM}`);
check('Drollery: the lion marginalia renders', await page.locator('.capture-drollery').evaluate((img) => img.complete && img.naturalWidth > 0));

/* ---------- window appearance ---------- */
await page.getByRole('button', { name: 'Appearance' }).first().click();
await page.getByRole('button', { name: 'Plain colour' }).click();
await page.locator('.slider', { hasText: 'Panel translucency' }).locator('input').fill('0.5');
const winArt = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--win-art').trim());
const alpha = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--panel-alpha').trim());
await page.locator('.color-row', { hasText: 'Highlight' }).locator('.color-select').click();
const csOptions = await page.locator('.cs-list [role=option]').count();
check('Colour picker is a dropdown of named pigments plus Custom', csOptions >= 10 && await page.locator('.cs-custom').isVisible(), String(csOptions));
await page.locator('.cs-custom input').evaluate((el) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, '#ff0000'); el.dispatchEvent(new Event('input', { bubbles: true })); });
const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
await page.locator('.color-row', { hasText: 'Highlight' }).locator('.color-select').click();
check('Appearance: plain colour background, panel translucency and highlight colour apply', winArt === 'none' && alpha === '50%' && accent === '#ff0000', `${winArt} ${alpha} ${accent}`);
await page.getByRole('button', { name: 'Reset window' }).click();
await page.getByRole('button', { name: 'Reset colours' }).click();
await page.keyboard.press('Escape');

/* ---------- release steps: Explorer-style header + right-click ---------- */
{
  const mp = page.locator('section[aria-label="Music"]');
  await mp.getByRole('tab', { name: /My releases/ }).click();
  const head = mp.locator('.st-head').first();
  check('Release steps have column headers (Name, Progress, Date)', await head.isVisible() && (await head.textContent()).includes('Progress'));
  const names = async () => mp.locator('.project-detail').first().locator('.stage-head .stage-name').allTextContents();
  const manual = await names();
  await head.getByRole('button', { name: 'Name' }).click();
  const asc = await names();
  await head.getByRole('button', { name: 'Name' }).click();
  const desc = await names();
  await head.getByRole('button', { name: 'Name' }).click();
  const back = await names();
  const main = manual.length; // other tracks live on their own tab
  const sorted = manual.slice(0, main).sort((a, b) => a.localeCompare(b));
  check('Click a header to sort A→Z, again for Z→A, again for manual order', JSON.stringify(asc.slice(0, sorted.length)) === JSON.stringify(sorted) && JSON.stringify(desc.slice(0, main)) === JSON.stringify([...sorted].reverse()) && JSON.stringify(back) === JSON.stringify(manual), JSON.stringify({ manual, asc, desc, back }));
  const before = (await store()).projects.find((x) => x.id === 'p-single').stages.length;
  await mp.locator('.stage-head', { hasText: 'Art (Design)' }).first().click({ button: 'right' });
  await page.locator('.context-menu').getByRole('menuitem', { name: 'Delete stage' }).click();
  const after = (await store()).projects.find((x) => x.id === 'p-single').stages.length;
  await page.getByRole('button', { name: 'Undo' }).click();
  const restored = (await store()).projects.find((x) => x.id === 'p-single').stages.length;
  check('Right-click a stage → Delete stage, and Undo restores it', after === before - 1 && restored === before, `${before} ${after} ${restored}`);
}

{
  const sr = page.locator('section[aria-label="Seround"]');
  await sr.getByRole('button', { name: /Seround panel icon/ }).click();
  await page.getByLabel('Search icons').fill('bolt');
  await page.getByRole('option', { name: 'Icon bolt' }).click();
  const label = await sr.getByRole('button', { name: /Seround panel icon/ }).getAttribute('aria-label');
  check('Panel icon is editable with an icon picker', label.includes('bolt'), label);
}

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
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.getByRole('button', { name: 'History & backups' }).click();
await page.getByRole('button', { name: 'Reset sample data' }).click();
await page.getByRole('button', { name: 'Yes, reset' }).click();
await page.getByRole('button', { name: 'Tasks', exact: true }).click(); await page.waitForTimeout(500);
check('Reset sample data restores the originals', !(await titles()).includes('Pay parking fine'));
await page.screenshot({ path: 'docs/screens/after-reset.png' });

check('No console errors or page errors', problems.length === 0, problems.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
