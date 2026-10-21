// Esther's own blur: each card shows a blurred copy of the part of your wallpaper that sits behind it. Windows'
// acrylic can't be made more or less blurry and forces square corners; this can, and the corners stay round.
// The wallpaper is read from where Windows keeps the current one (TranscodedWallpaper), cropped the way "Fill" shows
// it on each screen, and picked up again as soon as the wallpaper changes.
const { nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

function wallpaperFile() {
  if (process.env.ESTHER_WALLPAPER) return process.env.ESTHER_WALLPAPER;
  if (process.platform === 'win32' && process.env.APPDATA) return path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper');
  return null;
}

const cache = new Map();
let stamp = '';
const mtime = () => { try { const f = wallpaperFile(); return f ? String(fs.statSync(f).mtimeMs) : ''; } catch { return ''; } };

/** The wallpaper as this screen shows it (cover-cropped to the screen), as a JPEG data URL; null if there's none. */
function wallpaperFor(display) {
  const file = wallpaperFile();
  if (!file) return null;
  const key = `${display.id}:${display.bounds.width}x${display.bounds.height}:${stamp}`;
  if (cache.has(key)) return cache.get(key);
  let url = null;
  try {
    const img = nativeImage.createFromBuffer(fs.readFileSync(file));
    const { width: iw, height: ih } = img.getSize();
    if (iw && ih) {
      const { width: dw, height: dh } = display.bounds;
      const scale = Math.max(dw / iw, dh / ih);
      const cw = Math.round(dw / scale), ch = Math.round(dh / scale);
      const crop = img.crop({ x: Math.round((iw - cw) / 2), y: Math.round((ih - ch) / 2), width: cw, height: ch });
      // Small is fine: it's blurred anyway.
      const out = crop.resize({ width: Math.min(dw, 1600), quality: 'good' });
      url = `data:image/jpeg;base64,${out.toJPEG(80).toString('base64')}`;
    }
  } catch { url = null; }
  cache.clear();
  cache.set(key, url);
  return url;
}

/** Calls back as soon as the wallpaper changes: Windows rewrites the file, and Esther is told by the file system
 *  (with a check every 5 seconds as well, in case a notice is missed). */
function watchWallpaper(onChange) {
  stamp = mtime();
  let t = null;
  const check = () => { const m = mtime(); if (m !== stamp) { stamp = m; cache.clear(); onChange(); } };
  const soon = () => { clearTimeout(t); t = setTimeout(check, 250); };
  const file = wallpaperFile();
  if (file) { try { fs.watch(path.dirname(file), { persistent: false }, (_ev, name) => { if (!name || name === path.basename(file)) soon(); }); } catch { /* no watching: the check below still works */ } }
  return setInterval(check, 5_000);
}

module.exports = { wallpaperFor, watchWallpaper };
