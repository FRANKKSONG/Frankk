import { diffDays, type ISODate } from './dates';
import type { AppData } from '../data/types';
import type { Entry } from '../data/schema';

const capturedOn = (e: Entry) => String(e.props.captured ?? e.created.slice(0, 10));
const live = (e: Entry) => e.typeId === 'idea' && !e.archived && !['Shelved', 'Doing', 'Done'].includes(String(e.props.status ?? 'Spark'));

/** "today", "3d", "2w", "4mo": how long ago an idea was caught. */
export function ideaAge(e: Entry, today: ISODate) {
  const d = Math.max(0, diffDays(today, capturedOn(e)));
  return d === 0 ? 'today' : d < 14 ? `${d}d` : d < 60 ? `${Math.round(d / 7)}w` : `${Math.round(d / 30)}mo`;
}

/**
 * Ideas come back instead of piling up. Revisit: the idea left alone longest (at least a week since it was caught
 * or last kept). Fresh: the newest sparks. Kept ideas rest three weeks before they can come back.
 */
export function pickSparks(data: AppData, today: ISODate) {
  const ideas = data.entries.filter(live);
  const touched = (e: Entry) => String(e.props.revisited ?? capturedOn(e));
  const due = ideas
    .filter((e) => diffDays(today, capturedOn(e)) >= 7 && (!e.props.revisited || diffDays(today, String(e.props.revisited)) >= 21))
    .sort((a, b) => touched(a).localeCompare(touched(b)));
  const revisit = due[0];
  const fresh = ideas
    .filter((e) => e.id !== revisit?.id && String(e.props.status ?? 'Spark') === 'Spark')
    .sort((a, b) => capturedOn(b).localeCompare(capturedOn(a)) || b.created.localeCompare(a.created))
    .slice(0, 4);
  const counts = {
    spark: ideas.filter((e) => String(e.props.status ?? 'Spark') === 'Spark').length,
    exploring: ideas.filter((e) => e.props.status === 'Exploring').length,
  };
  return { fresh, revisit, counts };
}
