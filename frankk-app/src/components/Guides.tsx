import { useEffect, useRef, useState } from 'react';
import { desktop } from '../lib/desktop';

type Rect = { x: number; y: number; width: number; height: number };
type Line = { axis: 'x' | 'y'; v: number; kind: 'centre' | 'middle' | 'quarter' | 'card' | 'gap' };
export interface GuidesMsg { show: boolean; area?: Rect; card?: Rect; lines?: Line[]; others?: Rect[] }

const GRID = 8;
const LABEL: Record<Line['kind'], string> = { centre: 'Centre', middle: 'Middle', quarter: 'Quarter', card: 'Aligned', gap: 'Even gap' };

/**
 * The guides window, shown only while a card is dragged or resized: the grid it lands on, the screen's centre,
 * middle and quarters (dashed), and, lit up like Illustrator's smart guides, whichever guide the card has snapped to.
 */
export function Guides() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => desktop!.onGuides((g: GuidesMsg) => {
    setOn(g.show);
    if (g.show && g.area) draw(canvas.current!, g);
  }), []);
  return <canvas ref={canvas} className={`guides${on ? ' on' : ''}`} />;
}

function draw(c: HTMLCanvasElement, g: GuidesMsg) {
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth, H = window.innerHeight;
  // Everything comes in screen pixels; the page may be zoomed (all of Esther's windows share one zoom), so scale.
  const k = W / g.area!.width;
  const sc = (r: Rect): Rect => ({ x: r.x * k, y: r.y * k, width: r.width * k, height: r.height * k });
  const a = sc(g.area!);
  g = { ...g, card: g.card && sc(g.card), others: g.others?.map(sc), lines: g.lines?.map((l) => ({ ...l, v: l.v * k })) };
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  const x = c.getContext('2d')!;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#d9a63a';
  const ink = '255,255,255';
  const px = (v: number) => Math.round(v) + 0.5; // crisp 1px lines

  // The grid: every 8 px faintly, every 32 px a little stronger.
  x.lineWidth = 1;
  for (const [step, alpha] of [[GRID * k, 0.045], [GRID * 4 * k, 0.09]] as const) {
    x.strokeStyle = `rgba(${ink},${alpha})`;
    x.beginPath();
    for (let gx = 0; gx <= W; gx += step) { x.moveTo(px(gx), 0); x.lineTo(px(gx), H); }
    for (let gy = 0; gy <= H; gy += step) { x.moveTo(0, px(gy)); x.lineTo(W, px(gy)); }
    x.stroke();
  }
  // The screen's centre, middle and quarters, dashed.
  x.setLineDash([6, 6]);
  for (const q of [0.25, 0.5, 0.75]) {
    x.strokeStyle = q === 0.5 ? `rgba(${ink},0.32)` : `rgba(${ink},0.18)`;
    x.beginPath();
    x.moveTo(px(W * q), 0); x.lineTo(px(W * q), H);
    x.moveTo(0, px(H * q)); x.lineTo(W, px(H * q));
    x.stroke();
  }
  x.setLineDash([]);
  // The other cards, outlined faintly; the one you're moving, in the highlight colour.
  x.strokeStyle = `rgba(${ink},0.22)`;
  for (const o of g.others ?? []) x.strokeRect(px(o.x - a.x), px(o.y - a.y), Math.round(o.width) - 1, Math.round(o.height) - 1);
  if (g.card) {
    x.strokeStyle = accent; x.globalAlpha = 0.7;
    x.strokeRect(px(g.card.x - a.x), px(g.card.y - a.y), Math.round(g.card.width) - 1, Math.round(g.card.height) - 1);
    x.globalAlpha = 1;
  }
  // Snapped guides, lit up, with a small label.
  for (const l of g.lines ?? []) {
    const v = l.v - (l.axis === 'x' ? a.x : a.y);
    x.save();
    x.strokeStyle = accent; x.lineWidth = 1.5; x.shadowColor = accent; x.shadowBlur = 8;
    x.beginPath();
    if (l.axis === 'x') { x.moveTo(px(v), 0); x.lineTo(px(v), H); } else { x.moveTo(0, px(v)); x.lineTo(W, px(v)); }
    x.stroke();
    x.restore();
    const text = LABEL[l.kind];
    x.font = '600 11px "Instrument Sans", "Segoe UI", system-ui, sans-serif';
    const tw = x.measureText(text).width + 14;
    const card = g.card!;
    const lx = l.axis === 'x' ? v + 6 : Math.min(W - tw - 6, card.x - a.x + card.width + 8);
    const ly = l.axis === 'x' ? Math.max(6, card.y - a.y - 26) : v - 22;
    x.fillStyle = accent;
    x.beginPath(); x.roundRect(lx, ly, tw, 18, 9); x.fill();
    x.fillStyle = css.getPropertyValue('--accent-ink').trim() || '#15110c';
    x.fillText(text, lx + 7, ly + 13);
  }
}
