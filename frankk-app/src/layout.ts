import type { LayoutItem } from 'react-grid-layout';

export const COLS = 48;
export const MARGIN: [number, number] = [8, 8];
/** Below this container width the board keeps its proportions and scrolls sideways instead of squashing text. */
export const MIN_BOARD_WIDTH = 960;
/** Rows in the default layout; the row height is sized so these fill the window. */
export const DEFAULT_ROWS = 28;

export type WidgetId = 'today' | 'general' | 'music' | 'seround' | 'house' | 'capture' | 'coming' | 'calendar';
export const WIDGETS: { id: WidgetId; label: string; secondary: boolean }[] = [
  { id: 'today', label: 'Today strip', secondary: true },
  { id: 'general', label: 'General', secondary: false },
  { id: 'music', label: 'Music', secondary: false },
  { id: 'seround', label: 'Seround', secondary: false },
  { id: 'house', label: 'House', secondary: false },
  { id: 'capture', label: 'Quick capture', secondary: true },
  { id: 'coming', label: 'Coming up', secondary: true },
  { id: 'calendar', label: 'Calendar', secondary: true },
];

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'today', x: 0, y: 0, w: 48, h: 2, minW: 16, minH: 2, maxH: 14 },
  { i: 'general', x: 0, y: 2, w: 13, h: 18, minW: 8, minH: 9 },
  { i: 'music', x: 13, y: 2, w: 14, h: 18, minW: 10, minH: 9 },
  { i: 'seround', x: 27, y: 2, w: 11, h: 18, minW: 8, minH: 9 },
  { i: 'house', x: 38, y: 2, w: 10, h: 18, minW: 7, minH: 9 },
  { i: 'capture', x: 0, y: 20, w: 20, h: 8, minW: 10, minH: 8 },
  { i: 'coming', x: 20, y: 20, w: 15, h: 8, minW: 9, minH: 7 },
  { i: 'calendar', x: 35, y: 20, w: 13, h: 8, minW: 10, minH: 8 },
];

export const defaultItem = (id: string): LayoutItem => ({ ...(DEFAULT_LAYOUT.find((l) => l.i === id) as LayoutItem) });

/**
 * Drop rule for panels: dropping onto another widget swaps the two slots (position and size);
 * dropping on empty space just moves it there.
 */
export function swapOnDrop(before: LayoutItem[], dropped: LayoutItem): LayoutItem[] {
  const cx = dropped.x + dropped.w / 2;
  const cy = dropped.y + Math.min(dropped.h, 4) / 2;
  const origin = before.find((l) => l.i === dropped.i);
  const target = before.find((l) => l.i !== dropped.i && cx >= l.x && cx < l.x + l.w && cy >= l.y && cy < l.y + l.h);
  if (!origin) return before;
  if (!target) return before.map((l) => (l.i === dropped.i ? { ...l, x: dropped.x, y: dropped.y } : l));
  const slot = (l: LayoutItem) => ({ x: l.x, y: l.y, w: l.w, h: l.h });
  return before.map((l) => {
    if (l.i === dropped.i) return { ...l, ...slot(target), w: Math.max(target.w, l.minW ?? 1), h: Math.max(target.h, l.minH ?? 1) };
    if (l.i === target.i) return { ...l, ...slot(origin), w: Math.max(origin.w, l.minW ?? 1), h: Math.max(origin.h, l.minH ?? 1) };
    return l;
  });
}
