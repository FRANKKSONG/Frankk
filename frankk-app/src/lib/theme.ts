import { diaper, grain, vineBorder, vineBorderVertical, type OrnamentInk } from './ornaments';

/**
 * Esther themes. Every colour in the app comes from these CSS variables.
 * Illuminated: vellum, iron-gall ink and flat pigments (lapis, vermilion, verdigris, orpiment, gold).
 * Nocturne: the same manuscript vocabulary printed dark, with coarse grain.
 * Modern: the plain look.
 */
export type ThemeId = 'illuminated' | 'nocturne' | 'modern';
export type ColorKey = 'accent' | 'general' | 'music' | 'seround' | 'house';

export interface ThemePrefs {
  theme: ThemeId;
  colors: Partial<Record<ColorKey, string>>;
}

interface Theme {
  label: string;
  blurb: string;
  dark: boolean;
  medieval: boolean;
  grain?: 'vellum' | 'print';
  ink?: OrnamentInk;
  vars: Record<string, string>;
}

const SERIF = "'Alegreya', 'Noto Sans Lao', Georgia, 'Times New Roman', serif";
const SC = "'Alegreya SC', 'Alegreya', Georgia, serif";
const GOTHIC = "'Grenze Gotisch', 'UnifrakturMaguntia', Georgia, serif";
const FRAKTUR = "'UnifrakturMaguntia', 'Grenze Gotisch', Georgia, serif";
const MODERN = "'Inter', 'Noto Sans Lao', 'Segoe UI', system-ui, sans-serif";

export const THEMES: Record<ThemeId, Theme> = {
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
      'font-display': MODERN, 'font-serif': "'Source Serif 4', Georgia, serif", 'font-body': MODERN, 'font-sc': MODERN, 'font-cap': "'Source Serif 4', Georgia, serif",
      radius: '8px', 'radius-sm': '6px', 'pill-radius': '99px',
      shadow: '0 8px 24px rgba(0,0,0,.4)', 'grain-opacity': '0',
    },
  },
};

export const COLOR_KEYS: { key: ColorKey; label: string }[] = [
  { key: 'accent', label: 'Accent' }, { key: 'general', label: 'General' }, { key: 'music', label: 'Music' },
  { key: 'seround', label: 'Seround' }, { key: 'house', label: 'House' },
];

export const DEFAULT_THEME: ThemePrefs = { theme: 'illuminated', colors: {} };

export const themeOf = (prefs: ThemePrefs): ThemeId => (prefs.theme in THEMES ? prefs.theme : 'illuminated');

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
  root.dataset.look = id;
  root.dataset.style = t.medieval ? 'medieval' : 'modern';
  root.style.colorScheme = t.dark ? 'dark' : 'light';
}
