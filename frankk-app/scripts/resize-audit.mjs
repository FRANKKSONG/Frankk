import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:5173/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
const bad = [];
const audit = async (label, thSel, scope = p) => {
  const heads = scope.locator(thSel); const n = await heads.count();
  for (let i = 0; i < n; i++) {
    const th = heads.nth(i); const r = th.locator('.col-resizer'); if (!(await r.count()) || !(await r.first().isVisible())) continue;
    await r.first().scrollIntoViewIfNeeded();
    for (const dx of [40, -30]) {
      await r.first().scrollIntoViewIfNeeded(); const w0 = (await th.boundingBox()).width; const rb = await r.first().boundingBox();
      await p.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2); await p.mouse.down(); await p.mouse.move(rb.x + rb.width / 2 + dx, rb.y + rb.height / 2, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(150);
      const w1 = (await th.boundingBox()).width;
      if (Math.abs((w1 - w0) - dx) > 6) bad.push(`${label} col ${i} (${(await th.textContent()).trim().slice(0, 14)}) dx ${dx}: ${Math.round(w0)}→${Math.round(w1)}`);
    }
  }
};
await p.getByRole('button', { name: 'Tasks', exact: true }).first().click(); await p.waitForTimeout(900);
for (const a of ['General', 'Seround', 'House']) await audit(`board ${a}`, `section[aria-label="${a}"] .thead .th`);
const m = p.locator('section[aria-label="Music"]');
for (const t of ['Artist jobs', 'All']) { await m.getByRole('tab', { name: new RegExp(t) }).click(); await audit(`board Music ${t}`, `section[aria-label="Music"] .thead .th`); }
for (const a of ['General', 'Seround', 'House']) { await p.getByRole('button', { name: a, exact: true }).first().click(); await p.waitForTimeout(500); await audit(`focus ${a}`, `section[aria-label="${a}"] .thead .th`); }
await p.getByRole('button', { name: 'Music', exact: true }).first().click(); await p.waitForTimeout(500);
await p.locator('section[aria-label="Music"]').getByRole('tab', { name: /My releases/ }).click(); await p.waitForTimeout(300);
await audit('focus Music stages', '.st-head .th');
for (const t of ['Artist jobs', 'All']) { await p.locator('section[aria-label="Music"]').getByRole('tab', { name: new RegExp(t) }).click(); await audit(`focus Music ${t}`, `section[aria-label="Music"] .thead .th`); }
await p.getByRole('button', { name: 'Library', exact: true }).first().click(); await p.waitForTimeout(500);
await audit('library', '.dv-table thead th');
console.log(bad.length ? bad.join('\n') : 'ALL RESIZERS OK');
await b.close();
