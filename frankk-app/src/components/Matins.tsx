import { useMemo, useState } from 'react';
import { Icon } from './Icons';
import { useStore } from '../data/store';
import { usePersistentState } from '../hooks/usePersistentState';
import { LOAD_MAX, MOODS, blessing, dayLoad } from '../lib/mood';
import { longToday } from '../lib/dates';
import { MOTTO, type Mood } from '../data/verses';

const RAYS = 36;
/** Tiny fixed stars around the halo; more of them show as the chapel darkens. */
const STARS = Array.from({ length: 26 }, (_, i) => {
  const a = (i * 137.5 * Math.PI) / 180, r = 62 + ((i * 53) % 44);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.82, r: 0.5 + ((i * 7) % 3) * 0.35, at: (i % 9) / 9 };
});

/**
 * A monstrance-like glory: a host at the centre, four thin heavenly spheres (one lit per step of the day's weight)
 * and rays of light. The heavier the day, the longer and brighter the rays and the darker the chapel around them.
 */
function Glory({ glow, step, label }: { glow: number; step: number; label: string }) {
  const g = Math.max(0.08, glow);
  return (
    <svg className="mt-glory" viewBox="-110 -96 220 192" role="img" aria-label={`Today needs: ${label}`}>
      <defs>
        <radialGradient id="mt-aura">
          <stop offset="0" stopColor="#fff4cf" />
          <stop offset=".3" stopColor="#f6d27a" stopOpacity=".85" />
          <stop offset=".65" stopColor="#d9a641" stopOpacity=".3" />
          <stop offset="1" stopColor="#d9a641" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mt-host" cx=".4" cy=".35">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#ecd9ae" />
        </radialGradient>
      </defs>
      {STARS.map((st, i) => <circle key={i} cx={st.x} cy={st.y} r={st.r} className="mt-star" style={{ opacity: Math.max(0, (g - st.at * 0.7) * 0.9) }} />)}
      <circle r={40 + 52 * g} fill="url(#mt-aura)" className="mt-aura" style={{ opacity: 0.25 + 0.75 * g }} />
      <g className="mt-rays" style={{ opacity: 0.35 + 0.65 * g }}>
        {Array.from({ length: RAYS }, (_, i) => {
          const long = i % 2 === 0;
          const len = long ? 20 + 62 * g : 10 + 32 * g;
          const w = long ? 2.6 : 1.6;
          const a = (i * 360) / RAYS;
          return <path key={i} d={`M ${-w} -31 L 0 ${-31 - len} L ${w} -31 Z`} transform={`rotate(${a})`} className={long ? 'long' : 'short'} />;
        })}
      </g>
      {[21, 24, 27, 30].map((r, i) => <circle key={r} r={r} className={`mt-sphere${i <= step ? ' lit' : ''}`} />)}
      <circle r="17" fill="url(#mt-host)" className="mt-hostdisc" />
      <path d="M 0 -10 V 10 M -7 -3 H 7" className="mt-cross" />
    </svg>
  );
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
  const b = blessing(today, mood, turn, load.overdue >= 2);
  const label = MOODS[idx].label;

  if (collapsed) {
    return (
      <section className={`matins collapsed mood-${mood}`} aria-label="Matins">
        <button className="mt-open" style={{ '--glow': frac.toFixed(3) } as React.CSSProperties} onClick={() => setCollapsed(false)} aria-expanded="false">
          <span className="mt-title">Matins</span><b className="mt-pill">{label}</b><span className="mt-short">“{b.verse.text}”</span><Icon name="down" size={13} />
        </button>
      </section>
    );
  }

  return (
    <section className={`matins mood-${mood}`} aria-label="Matins" style={{ '--glow': frac.toFixed(3) } as React.CSSProperties}>
      <div className="mt-gauge">
        <Glory glow={frac} step={idx} label={label} />
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
          <span className="mt-title">Matins</span><span className="mt-date">{longToday(today)}</span><span className="mt-motto">{MOTTO}</span>
          <button className="icon-btn tiny" aria-label="Fold Matins away" title="Fold away" onClick={() => setCollapsed(true)}><Icon name="up" size={13} /></button>
        </header>
        <p className="mt-word"><b>{b.word.word}</b> <span>· {b.word.gloss}{b.word.ref ? ` (${b.word.ref})` : ''}</span></p>
        <p className="mt-line">{b.line}{b.yours && <span className="mt-yours">from your book</span>}</p>
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
