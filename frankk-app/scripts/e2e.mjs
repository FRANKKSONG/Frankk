// Browser checks for Esther. Run: npm run e2e  (needs `npm run dev` on :5173)
import { chromium } from 'playwright-core';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/?today=2026-10-20';
const exe = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + extra}`); };

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 940 } });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('esther.todo.v1')));
const task = async (title) => (await store()).tasks.find((t) => t.title === title);

/* ---------- bringing over the earlier Esther ---------- */
await page.goto(BASE);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('esther.proto.data.v4', JSON.stringify({ tasks: [
    { id: 'old-1', title: 'Poster', area: 'general', list: 'B-YOU', done: false, due: '2026-10-22', steps: [{ id: 'st', text: 'Sketch', done: true }] },
    { id: 'old-2', title: 'Fix the tap', area: 'house', done: false, plan: '2026-10-20' },
  ] }));
});
await page.reload(); await page.waitForSelector('.table');
{
  const d = await store();
  check('Earlier tasks come over: B-YOU and House become lists, steps become subtasks', d.lists.map((l) => l.name).join() === 'General,B-YOU,House' && d.tasks.find((t) => t.id === 'old-1').subtasks.length === 1, JSON.stringify(d));
  check('The earlier data is left untouched', !!(await page.evaluate(() => localStorage.getItem('esther.proto.data.v4'))));
}

/* ---------- start from the sample ---------- */
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForSelector('.table');

/* ---------- one page ---------- */
check('Greeting with the date and a line', /Good (morning|afternoon|evening)/.test(await page.locator('.greet h1').textContent()) && (await page.locator('.greet-date').textContent()).includes('20 Oct 2026') && (await page.locator('.greet-line').textContent()).length > 10);
check('Lists are tabs across the top: All, then each list with its open count', (await page.getByRole('tab').allTextContents()).join('|') === 'All3|General2|Home1');
check('The table shows every list on All, with a List column', (await page.locator('.task .task-title').allTextContents()).join('|') === 'Plan the week|Reply to emails|Buy dog food' && (await page.locator('.thead').textContent()).includes('List'));
check('Calendar marks today and days with tasks', (await page.locator('.day.today').textContent()).startsWith('20') && (await page.locator('.day', { hasText: /^21/ }).locator('.marks i').count()) === 1);
check('This week runs Monday to Sunday', (await page.locator('.week .wday:not(.late) h3 span').allTextContents()).join('|') === 'Mon 19|Today|Wed 21|Thu 22|Fri 23|Sat 24|Sun 25');

/* ---------- table ---------- */
await page.getByLabel('Add a task', { exact: true }).fill('Renew car insurance');
await page.getByLabel('List for the new task').click();
await page.getByRole('option', { name: 'Home' }).click();
await page.getByLabel('Add a task', { exact: true }).press('Enter');
{ const d = await store(); const t = d.tasks.find((x) => x.title === 'Renew car insurance'); check('Add a task from the table into a chosen list', d.lists.find((l) => l.id === t.listId).name === 'Home' && !t.date); }
await page.getByRole('tab', { name: /^General/ }).click();
check('A list tab shows only that list, without the List column', (await page.locator('.task .task-title').allTextContents()).join('|') === 'Plan the week|Reply to emails' && !(await page.locator('.thead').textContent()).includes('List'));
await page.getByLabel('Add a task', { exact: true }).fill('Pick up the suit');
await page.getByLabel('Add a task', { exact: true }).press('Enter');
{ const d = await store(); const t = d.tasks.find((x) => x.title === 'Pick up the suit'); check('Adding on a list tab puts it in that list', d.lists.find((l) => l.id === t.listId).name === 'General'); }
const suit = page.locator('.task', { hasText: 'Pick up the suit' });
await suit.locator('.date-chip input').evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '2026-10-23'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
check('Set a date in the Date column; it shows on the calendar and in This week', (await task('Pick up the suit')).date === '2026-10-23' && (await page.locator('.wday', { hasText: 'Fri 23' }).locator('.tline-title').allTextContents()).includes('Pick up the suit'));
await suit.locator('.task-title').click();
await page.getByRole('textbox', { name: 'Task name' }).fill('Pick up the suit (tailor)');
await page.getByRole('textbox', { name: 'Task name' }).press('Enter');
check('Rename by clicking the name', !!(await task('Pick up the suit (tailor)')));
const tailor = page.locator('.task', { hasText: 'Pick up the suit (tailor)' });
await tailor.getByRole('button', { name: /Show subtasks/ }).click();
await page.getByLabel('Add a subtask to Pick up the suit (tailor)').fill('Bring the receipt');
await page.getByLabel('Add a subtask to Pick up the suit (tailor)').press('Enter');
await page.getByLabel('Add a subtask to Pick up the suit (tailor)').fill('Try it on');
await page.getByLabel('Add a subtask to Pick up the suit (tailor)').press('Enter');
await tailor.locator('.sub', { hasText: 'Bring the receipt' }).getByRole('checkbox').check();
{ const t = await task('Pick up the suit (tailor)'); check('Subtasks: add two, tick one; the Subtasks column shows 1/2', t.subtasks.length === 2 && t.subtasks[0].done && !t.done && (await tailor.locator('.subs-btn').textContent()).includes('1/2')); }
await page.locator('.th', { hasText: 'Date' }).click();
check('Click the Date column to sort by date', (await page.locator('.task .task-title').allTextContents()).join('|') === 'Plan the week|Reply to emails|Pick up the suit (tailor)');
await page.locator('.th', { hasText: 'Date' }).click();
check('Click again to sort the other way', (await page.locator('.task .task-title').allTextContents())[0] === 'Pick up the suit (tailor)');
await page.getByRole('button', { name: 'Back to my order' }).click();
await page.locator('.day', { hasText: /^22/ }).first().click();
check('Click a calendar day: the table shows only that day', (await page.locator('.task .task-title').allTextContents()).join('|') === 'Reply to emails' && (await page.locator('.filter-chip').count()) === 1);
await page.getByRole('button', { name: 'Show every day' }).click();
await page.locator('.task', { hasText: 'Reply to emails' }).locator('.tr').click({ button: 'right' });
await page.getByRole('menuitem', { name: 'Move to Home' }).click();
check('Right-click: move a task to another list', !(await page.locator('.task .task-title', { hasText: 'Reply to emails' }).count()));
await page.getByRole('tab', { name: /^All/ }).click();
await page.locator('.task', { hasText: 'Buy dog food' }).locator('.tr').click({ button: 'right' });
await page.getByRole('menuitem', { name: 'Delete task' }).click();
check('Right-click: delete a task', !(await task('Buy dog food')));
await page.getByRole('button', { name: 'Undo' }).click();
check('Undo brings it back', !!(await task('Buy dog food')));
await page.locator('.task', { hasText: 'Plan the week' }).getByRole('checkbox', { name: 'Complete Plan the week' }).click();
await page.waitForTimeout(150);
check('Ticking a task keeps it in the list, crossed out, and says when it clears', (await page.locator('.task.done .task-title').allTextContents()).includes('Plan the week') && (await page.locator('.task.done .clears').textContent()) === 'clears in 7 days' && !!(await task('Plan the week')).doneAt);
await page.getByRole('radio', { name: /To do/ }).click();
check('"To do" hides finished tasks', !(await page.locator('.task .task-title', { hasText: 'Plan the week' }).count()));
await page.getByRole('radio', { name: /Done/ }).click();
check('"Done" shows only finished tasks', (await page.locator('.task .task-title').allTextContents()).join('|') === 'Plan the week');
await page.getByRole('radio', { name: /^All/ }).click();
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('esther.todo.v1')); d.tasks.find((t) => t.title === 'Plan the week').doneAt = '2026-01-01T00:00:00.000Z'; localStorage.setItem('esther.todo.v1', JSON.stringify(d)); });
await page.reload(); await page.waitForSelector('.table');
check('Finished tasks older than a week clear themselves', !(await task('Plan the week')));
await page.locator('.wday', { hasText: 'Wed 21' }).locator('.tline-title', { hasText: 'Buy dog food' }).click();
check('Clicking a task in This week opens it in the table', (await page.locator('.task.open .task-title').textContent()) === 'Buy dog food');

/* ---------- lists ---------- */
await page.getByRole('button', { name: 'New list' }).click();
await page.getByRole('textbox', { name: 'List name' }).fill('Seround');
await page.getByRole('textbox', { name: 'List name' }).press('Enter');
check('New list: a tab you name straight away, and it opens', (await page.getByRole('tab', { name: /^Seround/ }).getAttribute('aria-selected')) === 'true');
await page.getByLabel('Add a task', { exact: true }).fill('Post for Eli Lao Origin');
await page.getByLabel('Add a task', { exact: true }).press('Enter');
await page.getByRole('tab', { name: /^Seround/ }).dblclick();
await page.getByRole('textbox', { name: 'List name' }).fill('Seround work');
await page.getByRole('textbox', { name: 'List name' }).press('Enter');
check('Double-click a tab to rename it', (await store()).lists.some((l) => l.name === 'Seround work'));
await page.getByRole('tab', { name: /^Seround work/ }).click({ button: 'right' });
await page.getByRole('menuitem', { name: 'Delete list…' }).click();
await page.getByRole('button', { name: /Move tasks to/ }).click();
{ const d = await store(); check('Right-click a tab: delete the list and keep its tasks', !d.lists.some((l) => l.name === 'Seround work') && d.lists.find((l) => l.id === d.tasks.find((t) => t.title === 'Post for Eli Lao Origin').listId).name === 'General'); }

/* ---------- settings ---------- */
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('radio', { name: /Illuminated/ }).click();
check('Settings menu: switch the look', (await page.evaluate(() => document.documentElement.dataset.look)) === 'illuminated');
await page.getByRole('radio', { name: /Gilded/ }).click();
await page.keyboard.press('Escape');

/* ---------- keeps after reload ---------- */
await page.reload(); await page.waitForSelector('.table');
check('Everything is still there after a reload', !!(await task('Pick up the suit (tailor)')) && !!(await task('Renew car insurance')));
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByLabel('Panel colour').click();
await page.getByRole('option', { name: /Vellum|Ochre/ }).first().click();
await page.waitForTimeout(200);
{
  const text = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text').trim());
  check('Settings: pick a panel colour; text switches to stay readable', text === '#1c1915' || text === '#f4efe6', text);
}
await page.getByLabel('Panel opacity').fill('0.5');
check('Settings: panel opacity', (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--panel-alpha').trim())) === '50%');
await page.keyboard.press('Escape');
check('One page: no sidebar or other pages', (await page.locator('.sidebar, .knight, .note-doc').count()) === 0);

check('No errors in the browser console', problems.length === 0, problems.join(' | '));
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
