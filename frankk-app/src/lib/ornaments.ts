/**
 * Manuscript ornaments drawn as SVG (no outside images): a vine border with ivy leaves and
 * gold dots (after Gothic marginal borders), a diaper (lozenge) band, and vellum / print grain.
 * Colours come from the active theme so each look gets its own ink and pigments.
 */
export interface OrnamentInk { ink: string; stem: string; red: string; blue: string; green: string; gold: string; ground: string }

const uri = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

// Ivy leaf pointing up from (0,0)
const LEAF = 'M0 0C-1.5-1-5-2.5-5.5-6-5.8-8.5-4-9.5-2.6-8.6-2.4-10.8-1.2-12 0-13.2 1.2-12 2.4-10.8 2.6-8.6 4-9.5 5.8-8.5 5.5-6 5-2.5 1.5-1 0 0Z';

export function vineBorder(c: OrnamentInk): string {
  const leaf = (x: number, up: boolean, fill: string) =>
    `<g transform="translate(${x} ${up ? 9 : 13}) ${up ? '' : 'rotate(180)'}"><path d="M0 0 L0 -2" stroke="${c.ink}" stroke-width=".9"/><path transform="translate(0 -2) scale(.62)" d="${LEAF}" fill="${fill}" stroke="${c.ink}" stroke-width="1.3"/></g>`;
  const dot = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="1.9" fill="${c.gold}" stroke="${c.ink}" stroke-width=".7"/>`;
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="22" viewBox="0 0 96 22">
    <path d="M0 10.2H96M0 11.8H96" stroke="${c.ink}" stroke-width=".8"/>
    <path d="M0 11H96" stroke="${c.stem}" stroke-width="1.3"/>
    <path d="M14 9.8V12.2M15.6 9.8V12.2M62 9.8V12.2M63.6 9.8V12.2" stroke="${c.ink}" stroke-width=".7"/>
    ${leaf(6, true, c.red)}${leaf(30, false, c.blue)}${leaf(54, true, c.green)}${leaf(78, false, c.red)}
    ${dot(18, 4)}${dot(42, 18)}${dot(66, 4)}${dot(90, 18)}
  </svg>`);
}

export function vineBorderVertical(c: OrnamentInk): string {
  const leaf = (y: number, left: boolean, fill: string) =>
    `<g transform="translate(${left ? 9 : 13} ${y}) rotate(${left ? -90 : 90})"><path d="M0 0 L0 -2" stroke="${c.ink}" stroke-width=".9"/><path transform="translate(0 -2) scale(.62)" d="${LEAF}" fill="${fill}" stroke="${c.ink}" stroke-width="1.3"/></g>`;
  const dot = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="1.9" fill="${c.gold}" stroke="${c.ink}" stroke-width=".7"/>`;
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="96" viewBox="0 0 22 96">
    <path d="M10.2 0V96M11.8 0V96" stroke="${c.ink}" stroke-width=".8"/>
    <path d="M11 0V96" stroke="${c.stem}" stroke-width="1.3"/>
    ${leaf(6, true, c.blue)}${leaf(30, false, c.red)}${leaf(54, true, c.green)}${leaf(78, false, c.blue)}
    ${dot(4, 18)}${dot(18, 42)}${dot(4, 66)}${dot(18, 90)}
  </svg>`);
}

/** Lozenge diaper pattern, as on Gothic borders: lapis and vermilion diamonds, gold lattice. */
export function diaper(c: OrnamentInk): string {
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">
    <rect width="12" height="12" fill="${c.blue}"/>
    <path d="M6 0L12 6 6 12 0 6Z" fill="${c.red}"/>
    <path d="M6 0L12 6 6 12 0 6Z" fill="none" stroke="${c.gold}" stroke-width="1"/>
    <circle cx="6" cy="6" r="1.2" fill="${c.gold}"/>
  </svg>`);
}

/** Vellum mottling (soft blotches + fibres) or coarse print grain for the dark look. */
export function grain(kind: 'vellum' | 'print'): string {
  if (kind === 'print') {
    return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .92 0 0 0 0 .88 0 0 0 0 .8 0 0 0 1.6 -.55"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`);
  }
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420"><filter id="b"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .62 0 0 0 0 .42 0 0 0 0 .38 0 0 0 .9 -.35"/></filter><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .4 0 0 0 0 .3 0 0 0 0 .2 0 0 0 .5 -.15"/></filter><rect width="100%" height="100%" filter="url(#b)"/><rect width="100%" height="100%" filter="url(#f)"/></svg>`);
}
