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
const openList = async (name) => { await page.locator('.nav-list > .nav-item', { hasText: name }).click(); await page.waitForSelector('.list-head'); };

/* ---------- bringing over the earlier Esther ---------- */
await page.goto(BASE);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('esther.proto.data.v4', JSON.stringify({ tasks: [
    { id: 'old-1', title: 'Poster', area: 'general', list: 'B-YOU', done: false, due: '2026-10-22', steps: [{ id: 'st', text: 'Sketch', done: true }] },
    { id: 'old-2', title: 'Fix the tap', area: 'house', done: false, plan: '2026-10-20' },
  ] }));
});
await page.reload(); await page.waitForSelector('.greet');
{
  const d = await store();
  check('Earlier tasks come over: B-YOU and House become lists, steps become subtasks', d.lists.map((l) => l.name).join() === 'General,B-YOU,House' && d.tasks.find((t) => t.id === 'old-1').subtasks.length === 1, JSON.stringify(d));
  check('The earlier data is left untouched', !!(await page.evaluate(() => localStorage.getItem('esther.proto.data.v4'))));
}

/* ---------- start from the sample ---------- */
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForSelector('.greet');

/* ---------- Home ---------- */
check('Home: greeting with the date and a line', /Good (morning|afternoon|evening)/.test(await page.locator('.greet h1').textContent()) && (await page.locator('.greet-date').textContent()).includes('20 Oct 2026') && (await page.locator('.greet-line').textContent()).length > 10);
check('Home: the month, with today marked and dots on days that have tasks', (await page.locator('.cal h2').textContent()) === 'October 2026' && (await page.locator('.day.today').textContent()).startsWith('20') && (await page.locator('.day', { hasText: /^21/ }).locator('.marks i').count()) === 1);
check('Home: this week runs Monday to Sunday with today highlighted', (await page.locator('.week .wday:not(.late) h3 span').allTextContents()).join('|') === 'Mon 19|Today|Wed 21|Thu 22|Fri 23|Sat 24|Sun 25');
check('Home: today shows its task', (await page.locator('.wday.today .tline-title').allTextContents()).includes('Plan the week'));
await page.locator('.day', { hasText: /^23/ }).click();
check('Calendar: picking a day shows it', (await page.locator('.cal-day h3').textContent()).includes('23 Oct'));
await page.getByLabel('Add a task for 23 Oct, Enter').fill('Pick up the suit');
await page.getByLabel('Add a task for 23 Oct, Enter').press('Enter');
check('Calendar: add a task on that day', (await task('Pick up the suit'))?.date === '2026-10-23' && (await page.locator('.wday', { hasText: 'Fri 23' }).locator('.tline-title').allTextContents()).includes('Pick up the suit'));
await page.locator('.wday.today .tline', { hasText: 'Plan the week' }).getByRole('checkbox').check();
check('This week: tick a task done', (await task('Plan the week')).done === true);
await page.locator('.wday.today .tline', { hasText: 'Plan the week' }).getByRole('checkbox').uncheck();
await page.locator('.wday', { hasText: 'Sat 24' }).hover();
await page.getByRole('button', { name: 'Add a task on Sat 24' }).click();
await page.getByLabel('Add for Sat 24, Enter').fill('Walk Goose and Miko');
await page.getByLabel('Add for Sat 24, Enter').press('Enter');
check('This week: add a task on a day', (await task('Walk Goose and Miko'))?.date === '2026-10-24');
await page.locator('.wday.today .tline-title', { hasText: 'Plan the week' }).click();
await page.waitForSelector('.list-head');
check('Clicking a task on Home opens it in its list with subtasks showing', (await page.locator('.list-name').textContent()) === 'General' && (await page.locator('.task.open .sub-text').count()) === 2);

/* ---------- Tasks ---------- */
await page.getByLabel('Add a task to General, Enter').fill('Renew car insurance');
await page.getByLabel('Add a task to General, Enter').press('Enter');
check('Tasks: add a task (goes to the top, no date)', (await page.locator('.task .task-title').first().textContent()) === 'Renew car insurance' && !(await task('Renew car insurance')).date);
const ins = page.locator('.task', { hasText: 'Renew car insurance' });
await ins.locator('.date-chip input').evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '2026-10-30'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
check('Tasks: give it a date', (await task('Renew car insurance')).date === '2026-10-30' && (await ins.locator('.date-chip button').textContent()).includes('30 Oct'));
await ins.locator('.task-title').click();
await page.getByRole('textbox', { name: 'Task name' }).fill('Renew car insurance (AIA)');
await page.getByRole('textbox', { name: 'Task name' }).press('Enter');
check('Tasks: rename by clicking the name', !!(await task('Renew car insurance (AIA)')));
const aia = page.locator('.task', { hasText: 'Renew car insurance (AIA)' });
await aia.getByRole('button', { name: /Show subtasks/ }).click();
await page.getByLabel('Add a subtask to Renew car insurance (AIA)').fill('Find the policy number');
await page.getByLabel('Add a subtask to Renew car insurance (AIA)').press('Enter');
await page.getByLabel('Add a subtask to Renew car insurance (AIA)').fill('Pay online');
await page.getByLabel('Add a subtask to Renew car insurance (AIA)').press('Enter');
await aia.locator('.sub', { hasText: 'Find the policy number' }).getByRole('checkbox').check();
{
  const t = await task('Renew car insurance (AIA)');
  check('Subtasks: add two and tick one; the task stays open', t.subtasks.length === 2 && t.subtasks[0].done && !t.subtasks[1].done && !t.done && (await aia.locator('.subs-btn').textContent()).includes('1/2'), JSON.stringify(t));
}
await aia.locator('.task-line').click({ button: 'right' });
await page.getByRole('menuitem', { name: 'Move to Home' }).click();
{ const d = await store(); const t = d.tasks.find((x) => x.title === 'Renew car insurance (AIA)'); check('Right-click: move a task to another list', d.lists.find((l) => l.id === t.listId).name === 'Home'); }
await page.locator('.task', { hasText: 'Reply to emails' }).locator('.task-line').click({ button: 'right' });
await page.getByRole('menuitem', { name: 'Delete task' }).click();
check('Right-click: delete a task', !(await task('Reply to emails')));
await page.getByRole('button', { name: 'Undo' }).click();
check('Undo brings it back', !!(await task('Reply to emails')));
await page.locator('.task', { hasText: 'Reply to emails' }).getByRole('checkbox').first().click(); await page.waitForTimeout(150);
check('Done tasks fold into "Done"', (await page.locator('.done-group .link-btn').textContent()).includes('Done · 1') && !(await page.locator('.list-card > .sortable-row .task-title', { hasText: 'Reply to emails' }).count()));

/* ---------- lists ---------- */
await page.getByRole('button', { name: 'New list' }).click();
await page.waitForSelector('.list-head');
await page.locator('.list-name').click();
await page.getByRole('textbox', { name: 'List name' }).fill('Seround');
await page.getByRole('textbox', { name: 'List name' }).press('Enter');
check('Lists: make your own list and name it', (await store()).lists.some((l) => l.name === 'Seround') && (await page.locator('.nav-list > .nav-item', { hasText: 'Seround' }).count()) === 1);
await page.getByLabel('Add a task to Seround, Enter').fill('Post for Eli Lao Origin');
await page.getByLabel('Add a task to Seround, Enter').press('Enter');
await page.getByRole('button', { name: 'List options' }).click();
await page.getByRole('button', { name: 'Delete this list…' }).click();
await page.getByRole('button', { name: /Delete list, move tasks to/ }).click();
{
  const d = await store();
  check('Lists: delete a list and keep its tasks in another list', !d.lists.some((l) => l.name === 'Seround') && d.lists.find((l) => l.id === d.tasks.find((t) => t.title === 'Post for Eli Lao Origin').listId).name === 'General');
}

/* ---------- settings ---------- */
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('radio', { name: /Illuminated/ }).click();
check('Settings: switch the look', (await page.evaluate(() => document.documentElement.dataset.look)) === 'illuminated');
await page.getByRole('radio', { name: /Gilded/ }).click();

/* ---------- keeps after reload ---------- */
await page.reload(); await page.waitForSelector('.greet');
check('Everything is still there after a reload', !!(await task('Renew car insurance (AIA)')) && !!(await task('Walk Goose and Miko')));
check('Gone: notes, journal, music, knight, search, smart bar', (await page.locator('.knight, .note-doc, .cmd, .search-btn').count()) === 0 && (await page.locator('.sidebar').textContent()).match(/Notes|Library|Music|Calendar/) === null);

check('No errors in the browser console', problems.length === 0, problems.join(' | '));
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
