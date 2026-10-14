import { chromium } from 'playwright-core';
const [,, theme, out, w = '1536', h = '864'] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.addInitScript((t) => localStorage.setItem('esther.proto.v1.theme.v3', JSON.stringify({ theme: t, colors: {} })), theme);
await p.goto('http://127.0.0.1:5173/?today=2026-10-14'); await p.waitForTimeout(1500);
await p.screenshot({ path: out }); await b.close();
