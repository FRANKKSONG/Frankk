import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1586, height: 992 } });
await p.goto('http://127.0.0.1:5173/?today=2026-10-14'); await p.waitForTimeout(800);
console.log(await p.evaluate(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.width)]; };
  return JSON.stringify({
    scroll: r(document.querySelector('.board-scroll')),
    grid: r(document.querySelector('.react-grid-layout')),
    items: [...document.querySelectorAll('.react-grid-item')].map(r),
    saved: JSON.parse(localStorage.getItem('frankk.proto.v1.layout.board') || 'null')?.items.map((l) => `${l.i}:${l.x},${l.y},${l.w}x${l.h}`),
  });
}));
await b.close();
