/**
 * Esther themes. Every colour in the app comes from these CSS variables.
 * Manuscript / Parchment draw on medieval illumination: lapis, vermilion, verdigris,
 * orpiment and gold leaf on oak-gall ink or vellum. Modern is the plain look.
 */
export type ThemeId = 'manuscript' | 'parchment' | 'modern';
export type ColorKey = 'accent' | 'general' | 'music' | 'seround' | 'house';

export interface ThemePrefs {
  theme: ThemeId;
  colors: Partial<Record<ColorKey, string>>;
}

interface Theme {
  label: string;
  blurb: string;
  dark: boolean;
  vars: Record<string, string>;
}

const FONT_BODY_MS = "'Alegreya Sans', 'Noto Sans Lao', 'Segoe UI', system-ui, sans-serif";
const FONT_MODERN = "'Inter', 'Noto Sans Lao', 'Segoe UI', system-ui, sans-serif";

export const THEMES: Record<ThemeId, Theme> = {
  manuscript: {
    label: 'Manuscript',
    blurb: 'Candlelit oak and gold leaf',
    dark: true,
    vars: {
      bg: '#16110c', 'bg-2': '#211913', 'bg-3': '#2b2119', 'bg-hover': '#352920', 'pop-bg': '#2a2018',
      line: '#4b3a27', 'line-soft': '#332619', 'line-gold': '#8a6d33',
      text: '#efe3c6', muted: '#bba886', faint: '#8a7859',
      accent: '#c9a24a', 'accent-ink': '#1b130b',
      general: '#cf5c3f', music: '#5a7fc8', seround: '#d4a03c', house: '#4f9e83',
      danger: '#d6573f', ok: '#7fb06a', warn: '#e0aa45', info: '#6f93cf',
      'font-display': "'Cinzel', 'Trajan Pro', Georgia, serif",
      'font-serif': "'IM Fell English', 'EB Garamond', Georgia, serif",
      'font-body': FONT_BODY_MS,
      'font-cap': "'UnifrakturMaguntia', 'Cinzel', Georgia, serif",
      radius: '6px', 'radius-sm': '4px',
      shadow: '0 1px 0 rgba(255,220,150,.05) inset, 0 8px 24px rgba(0,0,0,.45)',
      'grain-opacity': '.07',
    },
  },
  parchment: {
    label: 'Parchment',
    blurb: 'Vellum, ink and pigment',
    dark: false,
    vars: {
      bg: '#e6d9bb', 'bg-2': '#f4ead3', 'bg-3': '#ebdfc2', 'bg-hover': '#e3d4b2', 'pop-bg': '#f7efdc',
      line: '#c5ae84', 'line-soft': '#dccaa5', 'line-gold': '#a8843a',
      text: '#2a1f15', muted: '#5f4c36', faint: '#8d7859',
      accent: '#9c7426', 'accent-ink': '#fbf4e2',
      general: '#b0442b', music: '#2f5299', seround: '#a87a1e', house: '#2f7a62',
      danger: '#b23a24', ok: '#4f8a3d', warn: '#a8741a', info: '#2f5299',
      'font-display': "'Cinzel', 'Trajan Pro', Georgia, serif",
      'font-serif': "'IM Fell English', 'EB Garamond', Georgia, serif",
      'font-body': FONT_BODY_MS,
      'font-cap': "'UnifrakturMaguntia', 'Cinzel', Georgia, serif",
      radius: '6px', 'radius-sm': '4px',
      shadow: '0 1px 0 rgba(255,255,255,.5) inset, 0 6px 18px rgba(80,55,20,.18)',
      'grain-opacity': '.10',
    },
  },
  modern: {
    label: 'Modern',
    blurb: 'Plain warm charcoal',
    dark: true,
    vars: {
      bg: '#191918', 'bg-2': '#1f1f1e', 'bg-3': '#262625', 'bg-hover': '#2e2e2c', 'pop-bg': '#2a2927',
      line: '#363531', 'line-soft': '#2a2927', 'line-gold': '#4a4843',
      text: '#ece8e1', muted: '#9a958b', faint: '#6f6b63',
      accent: '#e5935a', 'accent-ink': '#1b120b',
      general: '#d9814a', music: '#5fa8d8', seround: '#d8a63a', house: '#8aa97b',
      danger: '#e0705a', ok: '#8fbf7f', warn: '#e6b04d', info: '#5fa8d8',
      'font-display': FONT_MODERN,
      'font-serif': "'Source Serif 4', Georgia, serif",
      'font-body': FONT_MODERN,
      'font-cap': "'Source Serif 4', Georgia, serif",
      radius: '10px', 'radius-sm': '7px',
      shadow: '0 8px 24px rgba(0,0,0,.4)',
      'grain-opacity': '0',
    },
  },
};

export const COLOR_KEYS: { key: ColorKey; label: string }[] = [
  { key: 'accent', label: 'Accent' }, { key: 'general', label: 'General' }, { key: 'music', label: 'Music' },
  { key: 'seround', label: 'Seround' }, { key: 'house', label: 'House' },
];

export const DEFAULT_THEME: ThemePrefs = { theme: 'manuscript', colors: {} };

export function themeColor(prefs: ThemePrefs, key: ColorKey): string {
  return prefs.colors[key] ?? THEMES[prefs.theme].vars[key];
}

export function applyTheme(prefs: ThemePrefs) {
  const t = THEMES[prefs.theme] ?? THEMES.manuscript;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(`--${k}`, v);
  for (const [k, v] of Object.entries(prefs.colors)) if (v) root.style.setProperty(`--${k}`, v);
  root.dataset.look = prefs.theme;
  root.style.colorScheme = t.dark ? 'dark' : 'light';
}
