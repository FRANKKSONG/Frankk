import { relLabel, type ISODate } from './dates';
import type { Parsed } from './parse';

/**
 * The local reader is sure when it found a place for the task: a project, a list, a brand or area, or #tags.
 * When it found none, the task would fall into General by default, so Jev (if connected) is asked to choose.
 */
export function needsSort(p: Parsed): boolean {
  return p.kind === 'task' && !p.music && !p.list && p.area === 'general' && !p.tags.length;
}

const AREA: Record<string, string> = { general: 'General', seround: 'Seround', house: 'House' };

/** What a capture will do, as short phrases: shown under the bar before Enter, and sent back on Telegram. */
export function describe(p: Parsed, today: ISODate): string[] {
  const m = p.kind === 'task' ? p.music : undefined;
  const when = p.due ?? p.plan;
  if (m) return [`“${p.title}”`, `${m.artist} · ${m.title}`, `${m.stage} stage`, m.addsScope ? `adds ${m.stage} to your scope` : '', when ? `${p.due ? 'due' : 'on'} ${relLabel(when, today)}` : '', '+ today’s journal'].filter(Boolean);
  if (p.kind === 'task') {
    const where = p.list ? p.list : p.area === 'seround' ? `Seround · ${p.brand?.split(' ')[0] ?? ''}` : AREA[p.area];
    return [`“${p.title}”`, where, p.due ? `due ${relLabel(p.due, today)}` : '', p.plan ? `on ${relLabel(p.plan, today)}` : '', p.priority === 'high' ? 'urgent' : p.priority === 'low' ? 'low priority' : '', p.tags.length ? p.tags.map((t) => `#${t}`).join(' ') : '', '+ today’s journal'].filter(Boolean);
  }
  return [`“${p.title}”`, p.kind === 'idea' ? 'Ideas board' : 'today’s journal'];
}

