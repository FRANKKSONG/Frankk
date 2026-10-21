// Draws the tray icons (Esther's "E" in Instrument Serif, white and black, 16–48 px) into electron/tray.
// Run once after changing the look: node scripts/make-tray-icons.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const font = fs.readFileSync('node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2').toString('base64');
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.setContent('<canvas id=c></canvas>');
const out = await page.evaluate(async (font) => {
  const f = new FontFace('IS', `url(data:font/woff2;base64,${font})`);
  await f.load(); document.fonts.add(f);
  const res = {};
  for (const tone of ['light', 'dark']) for (const px of [16, 20, 24, 32, 48]) {
    const c = document.createElement('canvas'); c.width = c.height = px;
    const x = c.getContext('2d');
    const size = px * 1.32;
    x.font = `${size}px IS`;
    const m = x.measureText('E');
    const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    x.fillStyle = tone === 'light' ? '#ffffff' : '#000000';
    x.fillText('E', (px - w) / 2 + m.actualBoundingBoxLeft, (px - h) / 2 + m.actualBoundingBoxAscent);
    res[`e-${tone}-${px}.png`] = c.toDataURL('image/png').split(',')[1];
  }
  return res;
}, font);
for (const [name, b64] of Object.entries(out)) fs.writeFileSync(path.join('electron', 'tray', name), Buffer.from(b64, 'base64'));
await browser.close();
console.log('wrote', Object.keys(out).length, 'tray icons');
