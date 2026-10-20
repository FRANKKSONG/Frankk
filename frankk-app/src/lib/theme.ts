import { diaper, grain, vineBorder, vineBorderVertical, type OrnamentInk } from './ornaments';
import { artCss } from './art';

/**
 * Esther themes. Every colour in the app comes from these CSS variables.
 * Illuminated: vellum, iron-gall ink and flat pigments (lapis, vermilion, verdigris, orpiment, gold).
 * Nocturne: the same manuscript vocabulary printed dark, with coarse grain.
 * Modern: the plain look.
 */
export type ThemeId = 'gilded' | 'illuminated' | 'nocturne' | 'modern';
export type ColorKey = 'accent' | 'general' | 'music' | 'seround' | 'house';

/** The app window itself: what sits behind every page, and how see-through the panels are. */
export interface WindowPrefs {
  /** Art preset id, an uploaded image (data URL), or 'color' for a plain colour. */
  background: string;
  color: string;
  /** How solid panels are: 0.35 = very glassy, 1 = solid. */
  opacity: number;
  /** Background blur behind panels, in px. */
  blur: number;
  /** How much the background art is darkened. */
  dim: number;
  /** Your own colour for the panels (any colour; text turns light or dark to stay readable). Unset = the look's own. */
  panelColor?: string;
}

/** Perceived brightness of a #rrggbb colour, 0 (black) to 1 (white). */
export function brightness(hex: string): number {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return 0;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface ThemePrefs {
  theme: ThemeId;
  colors: Partial<Record<ColorKey, string>>;
  window?: WindowPrefs;
}

export const DEFAULT_WINDOW: WindowPrefs = { background: 'millefleur', color: '#0e0c0a', opacity: 0.8, blur: 16, dim: 0.8 };

interface Theme {
  label: string;
  blurb: string;
  dark: boolean;
  medieval: boolean;
  /** gilded = readable dashboard with medieval accents. */
  gilded?: boolean;
  grain?: 'vellum' | 'print';
  ink?: OrnamentInk;
  vars: Record<string, string>;
}

const SERIF = "'Alegreya', 'Noto Sans Lao', Georgia, 'Times New Roman', serif";
const SC = "'Alegreya SC', 'Alegreya', Georgia, serif";
const GOTHIC = "'Grenze Gotisch', 'UnifrakturMaguntia', Georgia, serif";
const FRAKTUR = "'UnifrakturMaguntia', 'Grenze Gotisch', Georgia, serif";
/** Artful pairing for the readable looks: a clean display serif for headings, a crafted sans for everything else. */
const DISPLAY_SERIF = "'Instrument Serif', 'Cormorant Garamond', Georgia, serif";
const ART_SANS = "'Instrument Sans', 'Noto Sans Lao', 'Segoe UI', system-ui, sans-serif";

export const THEMES: Record<ThemeId, Theme> = {
  gilded: {
    label: 'Gilded',
    blurb: 'Readable dashboard, art and gold',
    dark: true, medieval: false, gilded: true,
    ink: { ink: '#0e0c0a', stem: '#8c6a5a', red: '#e0694c', blue: '#6f93df', green: '#5fb08e', gold: '#d9a63a', ground: '#0e0c0a' },
    vars: {
      bg: '#0e0c0a', 'bg-2': '#191613', 'bg-3': '#221e1a', 'bg-hover': '#2a2520', 'pop-bg': '#1d1a16',
      line: '#3b352d', 'line-soft': '#2a2520', 'line-gold': '#a8873e',
      text: '#f2ede3', muted: '#b9af9d', faint: '#82796a',
      accent: '#d9a63a', 'accent-ink': '#15110c', gold: '#d9a63a',
      general: '#e0694c', music: '#6f93df', seround: '#e3b04b', house: '#5fb08e',
      danger: '#e5604a', ok: '#7cc08a', warn: '#e8b24f', info: '#6f93df',
      'font-display': DISPLAY_SERIF, 'font-serif': DISPLAY_SERIF, 'font-body': ART_SANS, 'font-sc': ART_SANS, 'font-cap': DISPLAY_SERIF,
      radius: '16px', 'radius-sm': '9px', 'pill-radius': '99px', edge: 'rgba(255,255,255,.07)',
      shadow: '0 12px 32px rgba(0,0,0,.28)', 'grain-opacity': '0',
    },
  },
  illuminated: {
    label: 'Illuminated',
    blurb: 'Vellum, ink and gold leaf',
    dark: false, medieval: true, grain: 'vellum',
    ink: { ink: '#3a2a1c', stem: '#c99a8a', red: '#b8382a', blue: '#2c4a9a', green: '#3d7a4e', gold: '#c9a13b', ground: '#efe5cc' },
    vars: {
      bg: '#e9dfc5', 'bg-2': '#f2e9d2', 'bg-3': '#e7dbbd', 'bg-hover': '#e2d3b0', 'pop-bg': '#f4ecd6',
      line: '#5a4632', 'line-soft': '#cdbb94', 'line-gold': '#b08a34',
      text: '#2a1e14', muted: '#5b4733', faint: '#8a7558',
      accent: '#b8382a', 'accent-ink': '#f6eedb', gold: '#c49a33',
      general: '#b8382a', music: '#2c4a9a', seround: '#a8761c', house: '#2f6f4c',
      danger: '#b8382a', ok: '#3d7a4e', warn: '#b8862a', info: '#2c4a9a',
      'font-display': GOTHIC, 'font-serif': SERIF, 'font-body': SERIF, 'font-sc': SC, 'font-cap': FRAKTUR,
      radius: '0px', 'radius-sm': '0px', 'pill-radius': '0px',
      shadow: 'none', 'grain-opacity': '.55',
    },
  },
  nocturne: {
    label: 'Nocturne',
    blurb: 'Black ink, bone and red',
    dark: true, medieval: true, grain: 'print',
    ink: { ink: '#0d0b09', stem: '#8c6a5a', red: '#c2453a', blue: '#4a68b0', green: '#4f8a5e', gold: '#d9a63a', ground: '#161311' },
    vars: {
      bg: '#12100e', 'bg-2': '#1a1714', 'bg-3': '#221e1a', 'bg-hover': '#2a2520', 'pop-bg': '#1d1a16',
      line: '#cbbfa6', 'line-soft': '#3a332b', 'line-gold': '#d9a63a',
      text: '#ebe3d1', muted: '#b3a78f', faint: '#7f7564',
      accent: '#d9a63a', 'accent-ink': '#12100e', gold: '#d9a63a',
      general: '#c9473b', music: '#5a78c0', seround: '#d9a63a', house: '#5a9a6c',
      danger: '#c9473b', ok: '#6ea56f', warn: '#d9a63a', info: '#6f8fd0',
      'font-display': GOTHIC, 'font-serif': SERIF, 'font-body': SERIF, 'font-sc': SC, 'font-cap': FRAKTUR,
      radius: '0px', 'radius-sm': '0px', 'pill-radius': '0px',
      shadow: 'none', 'grain-opacity': '.16',
    },
  },
  modern: {
    label: 'Modern',
    blurb: 'Plain warm charcoal',
    dark: true, medieval: false,
    vars: {
      bg: '#191918', 'bg-2': '#1f1f1e', 'bg-3': '#262625', 'bg-hover': '#2e2e2c', 'pop-bg': '#2a2927',
      line: '#363531', 'line-soft': '#2a2927', 'line-gold': '#4a4843',
      text: '#ece8e1', muted: '#9a958b', faint: '#6f6b63',
      accent: '#e5935a', 'accent-ink': '#1b120b', gold: '#e6b04d',
      general: '#d9814a', music: '#5fa8d8', seround: '#d8a63a', house: '#8aa97b',
      danger: '#e0705a', ok: '#8fbf7f', warn: '#e6b04d', info: '#5fa8d8',
      'font-display': DISPLAY_SERIF, 'font-serif': DISPLAY_SERIF, 'font-body': ART_SANS, 'font-sc': ART_SANS, 'font-cap': DISPLAY_SERIF,
      radius: '14px', 'radius-sm': '8px', 'pill-radius': '99px', edge: 'rgba(255,255,255,.07)',
      shadow: '0 8px 24px rgba(0,0,0,.4)', 'grain-opacity': '0',
    },
  },
};

export const COLOR_KEYS: { key: ColorKey; label: string }[] = [{ key: 'accent', label: 'Highlight' }];

export const DEFAULT_THEME: ThemePrefs = { theme: 'gilded', colors: {} };

export const themeOf = (prefs: ThemePrefs): ThemeId => (prefs.theme in THEMES ? prefs.theme : 'gilded');

export function themeColor(prefs: ThemePrefs, key: ColorKey): string {
  return prefs.colors[key] ?? THEMES[themeOf(prefs)].vars[key];
}

export function applyTheme(prefs: ThemePrefs) {
  const id = themeOf(prefs);
  const t = THEMES[id];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(`--${k}`, v);
  for (const [k, v] of Object.entries(prefs.colors)) if (v) root.style.setProperty(`--${k}`, v);
  if (t.ink) {
    const ink = { ...t.ink, red: prefs.colors.general ?? t.ink.red, blue: prefs.colors.music ?? t.ink.blue };
    root.style.setProperty('--vine', vineBorder(ink));
    root.style.setProperty('--vine-v', vineBorderVertical(ink));
    root.style.setProperty('--diaper', diaper(ink));
  } else {
    for (const k of ['--vine', '--vine-v', '--diaper']) root.style.setProperty(k, 'none');
  }
  root.style.setProperty('--grain', t.grain ? grain(t.grain) : 'none');
  if (!t.vars.edge) root.style.setProperty('--edge', t.vars.line);
  const w = { ...DEFAULT_WINDOW, ...prefs.window };
  const art = w.background === 'color' ? { image: 'none', tile: false } : artCss(w.background);
  root.style.setProperty('--win-color', w.color);
  root.style.setProperty('--win-art', art.image);
  root.style.setProperty('--win-art-size', art.tile ? 'auto' : 'cover');
  root.style.setProperty('--win-dim', String(w.dim));
  root.style.setProperty('--panel-alpha', `${Math.round(w.opacity * 100)}%`);
  root.style.setProperty('--blur', `${w.blur}px`);
  // Your panel colour: panels, menus and their hover shades follow it, and text flips light/dark for contrast.
  if (w.panelColor) {
    const light = brightness(w.panelColor) > 0.42;
    const ink = light ? '#000' : '#fff';
    root.style.setProperty('--bg-2', w.panelColor);
    root.style.setProperty('--bg-3', `color-mix(in srgb, ${w.panelColor} 90%, ${ink})`);
    root.style.setProperty('--bg-hover', `color-mix(in srgb, ${w.panelColor} 84%, ${ink})`);
    root.style.setProperty('--pop-bg', `color-mix(in srgb, ${w.panelColor} 94%, ${ink})`);
    root.style.setProperty('--text', light ? '#1c1915' : '#f4efe6');
    root.style.setProperty('--muted', light ? '#4d463c' : '#c2b8a6');
    root.style.setProperty('--faint', light ? '#776f63' : '#8f8676');
    root.style.setProperty('--edge', light ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.09)');
    root.style.setProperty('--line-soft', light ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.1)');
  }
  root.dataset.look = id;
  root.dataset.style = t.medieval ? 'medieval' : t.gilded ? 'gilded' : 'modern';
  root.style.colorScheme = (w.panelColor ? brightness(w.panelColor) <= 0.42 : t.dark) ? 'dark' : 'light';
}
