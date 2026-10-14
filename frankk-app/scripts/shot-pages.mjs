import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1536, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://127.0.0.1:5173/?today=2026-10-14'); await p.waitForTimeout(1200);
for (const [name, label] of [['tasks', 'Tasks'], ['library', 'Library'], ['notes', 'Notes'], ['settings', 'Settings'], ['calendar', 'Calendar']]) {
  await p.getByRole('button', { name: label, exact: true }).first().click(); await p.waitForTimeout(700);
  await p.screenshot({ path: `docs/screens/${name}.png` });
}
console.log('errors:', errs.join(' | ') || 'none');
await b.close();
