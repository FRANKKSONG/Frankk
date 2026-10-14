import { useMemo } from 'react';
import { Icon } from './Icons';
import { Dropdown } from './Dropdown';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { buildAgenda } from '../lib/agenda';
import { relLabel, shortDate, weekdayShort } from '../lib/dates';
import { usePersistentState } from '../hooks/usePersistentState';
import { AREA_ICON, useToggleAgenda } from './TodayStrip';

type F = 'all' | 'general' | 'music' | 'seround' | 'house';
const OPTS: { id: F; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'general', label: 'General' }, { id: 'music', label: 'Music' }, { id: 'seround', label: 'Seround' }, { id: 'house', label: 'House' }];

export function ComingUp({ day, clearDay }: { day: string | null; clearDay: () => void }) {
  const { data, today } = useStore();
  const { openTask, revealRow, setFocusArea } = useUi();
  const toggle = useToggleAgenda();
  const [prefs, setPrefs] = usePersistentState<{ f: F }>('prefs.comingup', { f: 'all' });

  const items = useMemo(() => buildAgenda(data, today)
    .filter((i) => (prefs.f === 'all' || i.area === prefs.f) && (day ? i.date === day : true))
    .slice(0, 40), [data, today, prefs.f, day]);

  return (
    <section className="coming" aria-label="Coming up">
      <header><h3><Icon name="filter" size={15} /> Coming up</h3><Dropdown ariaLabel="Area filter" value={prefs.f} options={OPTS} onChange={(f) => setPrefs({ f })} /></header>
      {day && <p className="day-chip">Showing {shortDate(day, today)} <button onClick={clearDay} aria-label="Show all dates">×</button></p>}
      {items.length === 0 ? <p className="empty">{day ? 'Nothing on this day.' : 'Nothing coming up.'}</p> : (
        <ul>
          {items.map((i) => (
            <li key={i.key}>
              <label className="check no-drag"><input type="checkbox" checked={false} aria-label={`Complete ${i.title}`} onChange={() => toggle(i)} /><span className="box" /></label>
              <span className={`dot area-${i.area}`}><Icon name={AREA_ICON[i.area]} size={11} /></span>
              <button className="today-title" onClick={() => (i.ref.type === 'task' ? openTask(i.ref.id) : i.ref.type === 'stage' ? revealRow('project', i.ref.projectId) : setFocusArea('house'))}>
                {i.title}{i.context && <span className="muted"> · {i.context}</span>}
              </button>
              <span className={`when${i.overdue ? ' overdue' : ''}`}>{i.overdue ? 'Overdue' : `${weekdayShort(i.date)}, ${relLabel(i.date, today)}`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
