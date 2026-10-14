import lion from '../assets/drollery-lion.jpg';

/**
 * Built-in background art, drawn in code: a millefleur meadow (after the flower-strewn
 * grounds of the Unicorn tapestries), a starred lapis vault, plain vellum, and the lion drollery.
 * Uploaded images replace these per dashboard.
 */
const uri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function millefleur(): string {
  const r = rand(11);
  const flowers: string[] = [];
  const cols = ['#c8553a', '#e9dfc5', '#d4a03c', '#5a7fc8', '#b44a6e', '#efe5cc'];
  for (let i = 0; i < 70; i++) {
    const x = Math.round(r() * 480), y = Math.round(r() * 480), s = 0.6 + r() * 0.8, c = cols[Math.floor(r() * cols.length)], rot = Math.round(r() * 360);
    const stem = `<path d="M0 0 C ${4 * s} ${10 * s}, ${-3 * s} ${16 * s}, ${2 * s} ${24 * s}" stroke="#3f6b45" stroke-width="${1.4 * s}" fill="none"/>`
      + `<path d="M${1 * s} ${12 * s} q ${7 * s} ${-2 * s} ${10 * s} ${4 * s} q ${-6 * s} ${2 * s} ${-10 * s} ${-4 * s}z" fill="#4f7e52"/>`;
    const petals = Array.from({ length: 5 }, (_, k) => `<ellipse cx="0" cy="${-4 * s}" rx="${2.2 * s}" ry="${3.6 * s}" fill="${c}" transform="rotate(${k * 72})"/>`).join('');
    flowers.push(`<g transform="translate(${x} ${y}) rotate(${rot})">${stem}${petals}<circle r="${1.6 * s}" fill="#d4a03c"/></g>`);
  }
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480"><rect width="480" height="480" fill="#1d2a22"/>${flowers.join('')}</svg>`);
}

function lapisStars(): string {
  const r = rand(5);
  const stars = Array.from({ length: 40 }, () => {
    const x = Math.round(r() * 400), y = Math.round(r() * 400), s = 2 + r() * 4;
    return `<path transform="translate(${x} ${y})" d="M0 ${-s}L${s * .25} ${-s * .25} ${s} 0 ${s * .25} ${s * .25} 0 ${s} ${-s * .25} ${s * .25} ${-s} 0 ${-s * .25} ${-s * .25}z" fill="#d9a63a"/>`;
  }).join('');
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#1d2f6b"/>${stars}</svg>`);
}

function vellum(): string {
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><filter id="b"><feTurbulence type="fractalNoise" baseFrequency=".01" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .91 0 0 0 0 .86 0 0 0 0 .74 0 0 0 .6 .4"/></filter><rect width="400" height="400" fill="#e9dfc5"/><rect width="400" height="400" filter="url(#b)"/></svg>`);
}

export interface ArtPreset { id: string; name: string; css: string; tile: boolean }

let cache: ArtPreset[] | null = null;
export function artPresets(): ArtPreset[] {
  if (!cache) {
    cache = [
      { id: 'millefleur', name: 'Millefleur meadow', css: `url("${millefleur()}")`, tile: true },
      { id: 'lapis', name: 'Starred lapis', css: `url("${lapisStars()}")`, tile: true },
      { id: 'vellum', name: 'Vellum', css: `url("${vellum()}")`, tile: true },
      { id: 'lion', name: 'Lion drollery', css: `url("${lion}")`, tile: false },
      { id: 'none', name: 'Plain', css: 'none', tile: false },
    ];
  }
  return cache;
}

export function artCss(bg: string | undefined): { image: string; tile: boolean } {
  if (bg?.startsWith('data:image')) return { image: `url("${bg}")`, tile: false };
  const p = artPresets().find((a) => a.id === (bg ?? 'millefleur')) ?? artPresets()[0];
  return { image: p.css, tile: p.tile };
}

/** Shrink an uploaded picture so it can be stored with the dashboard (as it would be in Esther/Assets). */
export function downscaleImage(file: File, max = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
