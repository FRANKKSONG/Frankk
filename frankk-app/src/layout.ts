import type { LayoutItem } from 'react-grid-layout';

export const COLS = 48;
export const ROW_H = 20;
export const MARGIN: [number, number] = [10, 10];
/** Below this container width the board keeps its proportions and scrolls sideways instead of squashing text. */
export const MIN_BOARD_WIDTH = 1240;

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
  { i: 'today', x: 0, y: 0, w: 48, h: 3, minW: 16, minH: 3, maxH: 14 },
  { i: 'general', x: 0, y: 3, w: 13, h: 17, minW: 8, minH: 9 },
  { i: 'music', x: 13, y: 3, w: 14, h: 17, minW: 10, minH: 9 },
  { i: 'seround', x: 27, y: 3, w: 11, h: 17, minW: 8, minH: 9 },
  { i: 'house', x: 38, y: 3, w: 10, h: 17, minW: 7, minH: 9 },
  { i: 'capture', x: 0, y: 20, w: 20, h: 8, minW: 10, minH: 8 },
  { i: 'coming', x: 20, y: 20, w: 15, h: 8, minW: 9, minH: 7 },
  { i: 'calendar', x: 35, y: 20, w: 13, h: 8, minW: 10, minH: 8 },
];

export const defaultItem = (id: string): LayoutItem => ({ ...(DEFAULT_LAYOUT.find((l) => l.i === id) as LayoutItem) });
