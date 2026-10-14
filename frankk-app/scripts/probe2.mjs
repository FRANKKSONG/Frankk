import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1586, height: 992 } });
await p.goto('http://127.0.0.1:5173/?today=2026-10-14'); await p.waitForTimeout(1200);
const dump = (tag) => p.evaluate((tag) => {
  const s = JSON.parse(localStorage.getItem('frankk.proto.v1.layout.board'));
  const rects = [...document.querySelectorAll('.react-grid-item')].map((e) => { const r = e.getBoundingClientRect(); return `${e.querySelector('section')?.getAttribute('aria-label')}@${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`; });
  return tag + '\n saved: ' + s.items.map((l) => `${l.i}:${l.x},${l.y},${l.w}x${l.h}`).join(' ') + '\n dom: ' + rects.join(' | ');
}, tag);
const grip = await p.locator('section[aria-label="General"] .panel-grip').boundingBox();
const tgt = await p.locator('.react-grid-item').nth(3).boundingBox();
await p.mouse.move(grip.x + 8, grip.y + 12); await p.mouse.down();
await p.mouse.move(grip.x + 100, grip.y + 30, { steps: 6 });
await p.mouse.move(tgt.x + 120, tgt.y + 30, { steps: 14 });
await p.mouse.up(); await p.waitForTimeout(800);
console.log(await dump('after drag'));
await p.reload(); await p.waitForTimeout(1500);
console.log(await dump('after reload'));
await b.close();
