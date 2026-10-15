import { useMemo, useState } from 'react';
import { Icon } from './Icons';
import { useStore } from '../data/store';
import { usePersistentState } from '../hooks/usePersistentState';
import { LOAD_MAX, MOODS, blessing, dayLoad } from '../lib/mood';
import { longToday } from '../lib/dates';
import type { Mood } from '../data/verses';

const R = 78, CX = 100, CY = 100;
const pt = (deg: number) => [CX + R * Math.cos((deg * Math.PI) / 180), CY - R * Math.sin((deg * Math.PI) / 180)] as const;
/** One quarter of the half-circle dial, from the left (chill) round to the right (locked in). */
function arc(i: number) {
  const a0 = 180 - i * 45 - 1.5, a1 = 180 - (i + 1) * 45 + 1.5;
  const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

/**
 * Matins, the morning check: how heavy today is (the dial), the mood that asks for, and a blessing to start on.
 * The dial reads Esther's own data; tap a mood to set it yourself for today.
 */
export function Matins() {
  const { data, today } = useStore();
  const load = useMemo(() => dayLoad(data, today), [data, today]);
  const [override, setOverride] = usePersistentState<{ day: string; mood: Mood } | null>('matins.mood', null);
  const [collapsed, setCollapsed] = usePersistentState('matins.collapsed', false);
  const [turn, setTurn] = useState(0);
  const mine = override?.day === today ? override.mood : null;
  const mood = mine ?? load.mood;
  const idx = MOODS.findIndex((m) => m.id === mood);
  const frac = mine ? (idx + 0.5) / 4 : Math.min(load.score, LOAD_MAX) / LOAD_MAX;
  const b = blessing(today, mood, turn, 'Frankk', load.overdue >= 2);
  const label = MOODS[idx].label;

  if (collapsed) {
    return (
      <section className={`matins collapsed mood-${mood}`} aria-label="Matins">
        <button className="mt-open" onClick={() => setCollapsed(false)} aria-expanded="false">
          <span className="mt-title">Matins</span><b className="mt-pill">{label}</b><span className="mt-short">“{b.verse.text}”</span><Icon name="down" size={13} />
        </button>
      </section>
    );
  }

  return (
    <section className={`matins mood-${mood}`} aria-label="Matins">
      <div className="mt-gauge">
        <svg viewBox="0 0 200 112" role="img" aria-label={`Today needs: ${label}`}>
          {MOODS.map((m, i) => <path key={m.id} d={arc(i)} className={`mt-arc m-${m.id}${i === idx ? ' on' : ''}`} />)}
          {[0, 1, 2, 3, 4].map((i) => { const [x, y] = pt(180 - i * 45); const [x2, y2] = [CX + (R - 14) * Math.cos(((180 - i * 45) * Math.PI) / 180), CY - (R - 14) * Math.sin(((180 - i * 45) * Math.PI) / 180)]; return <line key={i} x1={x2} y1={y2} x2={x} y2={y} className="mt-tick" />; })}
          <g className="mt-needle" style={{ transform: `rotate(${(frac * 180).toFixed(1)}deg)` }}>
            <path d={`M ${CX} ${CY - 3} L ${CX - R + 8} ${CY} L ${CX} ${CY + 3} Z`} />
          </g>
          <circle cx={CX} cy={CY} r="6" className="mt-hub" />
        </svg>
        <div className="mt-moods" role="radiogroup" aria-label="Mood for today">
          {MOODS.map((m) => (
            <button key={m.id} role="radio" aria-checked={m.id === mood} className={`mt-mood m-${m.id}`} title={m.hint}
              onClick={() => setOverride(m.id === load.mood && !mine ? null : { day: today, mood: m.id })}>{m.label}</button>
          ))}
        </div>
        <p className="mt-why">
          {mine
            ? <>Set by you · <button className="link-btn" onClick={() => setOverride(null)}>use Esther’s reading ({MOODS.find((m) => m.id === load.mood)!.label})</button></>
            : load.reasons.join(' · ')}
        </p>
      </div>

      <div className="mt-words">
        <header className="mt-head">
          <span className="mt-title">Matins</span><span className="mt-date">{longToday(today)}</span>
          <button className="icon-btn tiny" aria-label="Fold Matins away" title="Fold away" onClick={() => setCollapsed(true)}><Icon name="up" size={13} /></button>
        </header>
        <p className="mt-word"><b>{b.word.word}</b> <span>· {b.word.gloss}{b.word.ref ? ` (${b.word.ref})` : ''}</span></p>
        <p className="mt-line">{b.line}</p>
        <blockquote className="mt-verse">
          <p>“{b.verse.text}”</p>
          <cite>{b.verse.ref} <span>· {b.verse.from} · {b.verse.tr}</span></cite>
        </blockquote>
        <div className="mt-foot">
          <button className="link-btn" onClick={() => setTurn((t) => t + 1)}><Icon name="sparkle" size={12} /> Another verse</button>
          <span className="muted" title="The verse is quoted as written; the blessing line is one of Esther's own. No AI is connected yet.">Verses quoted as written · no AI connected</span>
        </div>
      </div>
    </section>
  );
}
