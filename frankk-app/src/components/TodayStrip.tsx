import { useEffect, useMemo, useRef } from 'react';
import { Icon, type IconName } from './Icons';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { todayItems, type AgendaItem } from '../lib/agenda';
import { longToday, relLabel } from '../lib/dates';

export const AREA_ICON: Record<string, IconName> = { general: 'tasks', music: 'music', seround: 'seround', house: 'house' };

export function useToggleAgenda() {
  const { dispatch, data } = useStore();
  return (i: AgendaItem) => {
    const r = i.ref;
    if (r.type === 'task') dispatch({ type: 'task/toggle', id: r.id });
    else if (r.type === 'bill') dispatch({ type: 'bill/pay', billId: r.billId, month: r.month, paid: true });
    else {
      const stage = data.projects.find((p) => p.id === r.projectId)?.stages.find((s) => s.id === r.stageId);
      if (r.itemId) dispatch({ type: 'item/patch', projectId: r.projectId, stageId: r.stageId, itemId: r.itemId, patch: { done: true } });
      else if (stage) dispatch({ type: 'stage/patch', projectId: r.projectId, stageId: r.stageId, patch: { done: true } });
    }
  };
}

export function TodayStrip() {
  const { data, today } = useStore();
  const { openTask, revealRow, setFocusArea } = useUi();
  const toggle = useToggleAgenda();
  // One line, earliest on the left: the most overdue first, then today's.
  const items = useMemo(() => [...todayItems(data, today)].sort((a, b) => a.date.localeCompare(b.date)), [data, today]);
  const listRef = useRef<HTMLUListElement>(null);
  // The mouse wheel scrolls the line sideways.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [items.length]);

  const open = (i: AgendaItem) => {
    if (i.ref.type === 'task') openTask(i.ref.id);
    else if (i.ref.type === 'stage') revealRow('project', i.ref.projectId);
    else setFocusArea('house');
  };

  return (
    <section className="today" aria-label="Today">
      <div className="today-head"><strong>Today</strong><span>{longToday(today)}</span></div>
      {items.length === 0 ? <p className="today-empty">Nothing is due or planned for today.</p> : (
        <ul className="today-list" ref={listRef}>
          {items.map((i) => (
            <li key={i.key} className={`today-item area-${i.area}`}>
              <label className="check no-drag"><input type="checkbox" checked={false} aria-label={`Complete ${i.title}`} onChange={() => toggle(i)} /><span className="box" /></label>
              <Icon name={AREA_ICON[i.area]} size={14} />
              <button className="today-title" onClick={() => open(i)}>{i.title}{i.context && <span className="muted"> · {i.context}</span>}</button>
              <span className={`when${i.overdue ? ' overdue' : ''}`}>{i.overdue ? `Overdue · ${relLabel(i.date, today)}` : relLabel(i.date, today)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
