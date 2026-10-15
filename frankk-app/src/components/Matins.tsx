import { useMemo, useState } from 'react';
import { Icon } from './Icons';
import { useStore } from '../data/store';
import { usePersistentState } from '../hooks/usePersistentState';
import { LOAD_MAX, MOODS, blessing, dayLoad } from '../lib/mood';
import { longToday } from '../lib/dates';
import { MOTTO, type Mood } from '../data/verses';

/** Fixed pseudo-random numbers, so the painting is the same every time it's drawn. */
const rnd = (i: number) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
const RAYS = Array.from({ length: 84 }, (_, i) => ({ a: (i * 360) / 84 + (rnd(i) - 0.5) * 3.5, len: 0.3 + 0.7 * rnd(i + 99) ** 1.4, w: 0.45 + 1.5 * rnd(i + 7), o: 0.35 + 0.65 * rnd(i + 3) }));
const BEAMS = Array.from({ length: 14 }, (_, i) => ({ a: (i * 360) / 14 + (rnd(i + 50) - 0.5) * 14, len: 0.55 + 0.45 * rnd(i + 61), w: 6 + 9 * rnd(i + 71) }));

/**
 * A painted glory, in the manner of a Baroque altarpiece: a host of lead-white light, a cross of light breaking from it,
 * soft beams and fine rays in Naples yellow and ochre, umber cloud gathering in the dark, and canvas grain over all.
 * The heavier the day, the longer and brighter the light and the deeper the dark around it.
 */
function Glory({ glow, label }: { glow: number; step: number; label: string }) {
  const g = Math.max(0.06, glow);
  const reach = 24 + 76 * g;
  return (
    <svg className="mt-glory" viewBox="-110 -110 220 220" role="img" aria-label={`Today needs: ${label}`}>
      <defs>
        <radialGradient id="mt-fadeg"><stop offset="0" stopColor="#fff" /><stop offset=".55" stopColor="#fff" /><stop offset="1" stopColor="#000" /></radialGradient>
        <mask id="mt-fade"><rect x="-110" y="-110" width="220" height="220" fill="url(#mt-fadeg)" /></mask>
        <filter id="mt-brush" x="-60%" y="-60%" width="220%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="0.8" result="soft" />
          <feGaussianBlur in="d" stdDeviation="4.5" result="bloom" />
          <feMerge><feMergeNode in="bloom" /><feMergeNode in="soft" /></feMerge>
        </filter>
        <filter id="mt-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="mt-haze" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="10" /></filter>
        <filter id="mt-flare" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="w" /><feGaussianBlur in="SourceGraphic" stdDeviation="0.7" result="c" />
          <feMerge><feMergeNode in="w" /><feMergeNode in="c" /></feMerge>
        </filter>
        <filter id="mt-cloud" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="11" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.26  0 0 0 0 0.16  0 0 0 0 0.08  2.6 0 0 0 -1.12" result="c" />
          <feComposite in="c" in2="SourceGraphic" operator="in" result="m" />
          <feGaussianBlur in="m" stdDeviation="2.2" />
        </filter>
        <filter id="mt-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.55 0.7" numOctaves="3" seed="2" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.42  0 0 0 0 0.3  0.9 0.9 0 0 -0.82" />
        </filter>
        <radialGradient id="mt-aura">
          <stop offset="0" stopColor="#fffbea" />
          <stop offset=".2" stopColor="#fbe7a8" stopOpacity=".9" />
          <stop offset=".5" stopColor="#e9b558" stopOpacity=".42" />
          <stop offset=".8" stopColor="#a8682a" stopOpacity=".12" />
          <stop offset="1" stopColor="#8a5420" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mt-hostg"><stop offset="0" stopColor="#fffef8" /><stop offset=".6" stopColor="#fff3d2" /><stop offset="1" stopColor="#f6d98e" stopOpacity="0" /></radialGradient>
        <radialGradient id="mt-ring"><stop offset=".25" stopColor="#000" stopOpacity="0" /><stop offset=".6" stopColor="#000" stopOpacity="1" /></radialGradient>
        <linearGradient id="mt-ray" gradientUnits="userSpaceOnUse" x1="0" y1="-10" x2="0" y2="-104">
          <stop offset="0" stopColor="#fffdf3" />
          <stop offset=".28" stopColor="#f8dc8c" stopOpacity=".85" />
          <stop offset=".65" stopColor="#e2a646" stopOpacity=".38" />
          <stop offset="1" stopColor="#c98a34" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mt-crossv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff6d6" stopOpacity="0" /><stop offset=".42" stopColor="#fffbea" /><stop offset="1" stopColor="#fff6d6" stopOpacity="0" /></linearGradient>
        <linearGradient id="mt-crossh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff6d6" stopOpacity="0" /><stop offset=".5" stopColor="#fffbea" /><stop offset="1" stopColor="#fff6d6" stopOpacity="0" /></linearGradient>
      </defs>
      <g mask="url(#mt-fade)">
        <circle r={30 + 75 * g} fill="url(#mt-aura)" filter="url(#mt-haze)" className="mt-aura" style={{ opacity: 0.3 + 0.7 * g }} />
        <g filter="url(#mt-soft)" style={{ opacity: 0.12 + 0.3 * g }}>
          {BEAMS.map((r, i) => <path key={i} d={`M ${-r.w} -8 L 0 ${-8 - reach * 1.1 * r.len} L ${r.w} -8 Z`} transform={`rotate(${r.a.toFixed(1)})`} fill="url(#mt-ray)" />)}
        </g>
        <g filter="url(#mt-brush)" style={{ opacity: 0.35 + 0.65 * g }}>
          <g className="mt-rays">
            {RAYS.map((r, i) => <path key={i} d={`M ${-r.w} -10 L 0 ${-10 - reach * r.len} L ${r.w} -10 Z`} transform={`rotate(${r.a.toFixed(2)})`} fill="url(#mt-ray)" opacity={r.o} />)}
          </g>
        </g>
        <circle r="110" fill="url(#mt-ring)" filter="url(#mt-cloud)" style={{ opacity: 0.35 + 0.25 * g }} />
        <g filter="url(#mt-flare)" style={{ opacity: 0.3 + 0.7 * g }}>
          <rect x="-1.6" y={-(22 + 70 * g)} width="3.2" height={(22 + 70 * g) + (16 + 46 * g)} fill="url(#mt-crossv)" />
          <rect x={-(14 + 34 * g)} y="-7" width={2 * (14 + 34 * g)} height="3" fill="url(#mt-crossh)" />
        </g>
        <circle r="22" fill="url(#mt-aura)" filter="url(#mt-haze)" />
        <circle r="13" fill="url(#mt-hostg)" className="mt-hostdisc" />
        <rect x="-110" y="-110" width="220" height="220" filter="url(#mt-grain)" className="mt-grain" />
      </g>
    </svg>
  );
}

/**
 * Matins, the morning check: how heavy today is (the dial), the mood that asks for, and a blessing to start on.
 * The dial reads Esther's own data; tap a mood to set it yourself for today.
 */
export function Matins({ actions }: { actions?: React.ReactNode }) {
  const { data, today } = useStore();
  const load = useMemo(() => dayLoad(data, today), [data, today]);
  const [override, setOverride] = usePersistentState<{ day: string; mood: Mood } | null>('matins.mood', null);
  const [turn, setTurn] = useState(0);
  const mine = override?.day === today ? override.mood : null;
  const mood = mine ?? load.mood;
  const idx = MOODS.findIndex((m) => m.id === mood);
  const frac = mine ? (idx + 0.5) / 4 : Math.min(load.score, LOAD_MAX) / LOAD_MAX;
  const b = blessing(today, mood, turn, load.overdue >= 2);
  const label = MOODS[idx].label;

  return (
    <header className={`matins mood-${mood}`} aria-label="Matins: today's mood and blessing" style={{ '--glow': frac.toFixed(3) } as React.CSSProperties}>
      <Glory glow={frac} step={idx} label={label} />
      <div className="mt-words">
        <div className="mt-head">
          <h1 className="mt-mood-title" title={MOODS[idx].hint}>{label}</h1>
          <span className="mt-date">{longToday(today)}</span>
          <span className="mt-motto">{MOTTO}</span>
          {actions && <span className="mt-actions">{actions}</span>}
        </div>
        <p className="mt-line"><b className="mt-word" title={`${b.word.gloss}${b.word.ref ? ` (${b.word.ref})` : ''}`}>{b.word.word}</b> {b.line}{b.yours && <span className="mt-yours">from your book</span>}</p>
        <blockquote className="mt-verse">
          <p>“{b.verse.text}” <cite>{b.verse.ref} <span>· {b.verse.from} · {b.verse.tr}</span></cite></p>
        </blockquote>
        <div className="mt-foot">
          <span className="mt-moods" role="radiogroup" aria-label="Mood for today">
            {MOODS.map((m) => (
              <button key={m.id} role="radio" aria-checked={m.id === mood} className={`mt-mood m-${m.id}`} title={m.hint}
                onClick={() => setOverride(m.id === load.mood && !mine ? null : { day: today, mood: m.id })}>{m.label}</button>
            ))}
          </span>
          <span className="mt-why">
            {mine
              ? <>Set by you · <button className="link-btn" onClick={() => setOverride(null)}>use Esther’s reading ({MOODS.find((m) => m.id === load.mood)!.label})</button></>
              : load.reasons.join(' · ')}
          </span>
          <button className="link-btn mt-another" onClick={() => setTurn((t) => t + 1)}><Icon name="sparkle" size={12} /> Another verse</button>
        </div>
      </div>
    </header>
  );
}
