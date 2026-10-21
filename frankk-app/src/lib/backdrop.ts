/**
 * Esther's frosted glass, done once instead of every frame: the wallpaper behind the screen is blurred into a small
 * picture when it (or the Blur setting) changes. Each card shows its part of that picture, slid into line with the
 * real wallpaper, under a tint and a fine grain like Windows 11's acrylic. Nothing is blurred while you drag or type,
 * which is what made the live CSS blur feel laggy.
 */
const cache = new Map<string, Promise<string>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

/** The wallpaper blurred by `blur` screen pixels, as a picture about a quarter of the screen's size. */
export function blurredWallpaper(src: string, screenW: number, screenH: number, blur: number): Promise<string> {
  const key = `${src.length}:${src.slice(-40)}:${screenW}x${screenH}:${blur}`;
  if (!cache.has(key)) {
    if (cache.size > 6) cache.clear();
    cache.set(key, (async () => {
      const img = await loadImage(src);
      const w = Math.max(64, Math.round(screenW / 4)), h = Math.max(36, Math.round(screenH / 4));
      const r = (blur * w) / screenW; // the blur, in this smaller picture's pixels
      const m = Math.ceil(r * 3) + 2; // a margin of stretched edge, so the blur doesn't darken the borders
      const pad = document.createElement('canvas');
      pad.width = w + 2 * m; pad.height = h + 2 * m;
      const p = pad.getContext('2d')!;
      p.imageSmoothingQuality = 'high';
      p.drawImage(img, m, m, w, h);
      const iw = img.naturalWidth, ih = img.naturalHeight;
      p.drawImage(img, 0, 0, 1, ih, 0, m, m, h); // left edge
      p.drawImage(img, iw - 1, 0, 1, ih, w + m, m, m, h); // right
      p.drawImage(pad, m, m, w, 1, 0, 0, w + 2 * m, m); // top (with corners)
      p.drawImage(pad, m, h + m - 1, w, 1, 0, h + m, w + 2 * m, m); // bottom
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      const o = out.getContext('2d')!;
      o.filter = `${r > 0 ? `blur(${r}px) ` : ''}saturate(1.25)`;
      o.drawImage(pad, -m, -m);
      return out.toDataURL('image/jpeg', 0.9);
    })());
  }
  return cache.get(key)!;
}

const noise = new Map<number, string>();
/** A fine grain (Windows 11's acrylic has one) as a small tile; `strength` 0–1 is the Grain setting. */
export function noiseTile(strength: number): string {
  const a = Math.round(Math.max(0, Math.min(1, strength)) * 34);
  if (noise.has(a)) return noise.get(a)!;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const x = c.getContext('2d')!;
  const d = x.createImageData(96, 96);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = a; }
  x.putImageData(d, 0, 0);
  const url = c.toDataURL('image/png');
  noise.set(a, url);
  return url;
}
