import lion from '../assets/drollery-lion.jpg';

/**
 * Illuminated initial: a gold letter on a lapis field inside a vermilion frame,
 * with white penwork dots — the way chapter openings are decorated in Gothic books.
 */
export function Initial({ letter, size = 46 }: { letter: string; size?: number }) {
  const dots = [[7, 7], [39, 7], [7, 39], [39, 39], [23, 4.5], [4.5, 23], [41.5, 23], [23, 41.5]];
  return (
    <svg className="initial" width={size} height={size} viewBox="0 0 46 46" aria-hidden="true">
      <rect x="0.5" y="0.5" width="45" height="45" style={{ fill: 'var(--general)' }} />
      <rect x="3.5" y="3.5" width="39" height="39" style={{ fill: 'var(--music)' }} />
      <path d="M3.5 3.5h39v39h-39z" fill="none" style={{ stroke: 'var(--gold)' }} strokeWidth="1.2" />
      {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.1" fill="#f6efdc" />)}
      <path d="M9 37c5-3 6-9 3-12M37 9c-5 3-6 9-3 12" fill="none" stroke="#f6efdc" strokeWidth=".7" opacity=".8" />
      <text x="23" y="33" textAnchor="middle" style={{ fill: 'var(--gold)', font: '30px var(--font-cap)' }} stroke="#3a2a1c" strokeWidth=".6">{letter}</text>
    </svg>
  );
}

/** Pointed Gothic arch with a starred lapis sky, used as the Esther emblem. */
export function ArchEmblem() {
  const stars = [[16, 14], [27, 10], [21, 22], [11, 26], [30, 24]];
  return (
    <svg className="arch-emblem" width="44" height="54" viewBox="0 0 44 54" aria-hidden="true">
      <path d="M3 53V22C3 10 14 2 22 1c8 1 19 9 19 21v31z" style={{ fill: 'var(--gold)' }} stroke="#3a2a1c" strokeWidth=".8" />
      <path d="M7 50V23C7 13 15 6 22 5c7 1 15 8 15 18v27z" style={{ fill: 'var(--music)' }} />
      {stars.map(([x, y], i) => (
        <path key={i} transform={`translate(${x} ${y})`} d="M0-3.2L.8-.8 3.2 0 .8.8 0 3.2-.8.8-3.2 0-.8-.8z" style={{ fill: 'var(--gold)' }} />
      ))}
      <path d="M7 42h30v8H7z" style={{ fill: 'var(--general)' }} />
      <path d="M7 42h30" style={{ stroke: 'var(--gold)' }} strokeWidth="1" />
      <text x="22" y="49" textAnchor="middle" style={{ fill: 'var(--gold)', font: '8px var(--font-cap)' }}>E</text>
    </svg>
  );
}

/** Marginal drollery: a lion playing the vielle, from a medieval manuscript margin (image supplied by the user). */
export function Drollery({ className = '' }: { className?: string }) {
  return <img className={`drollery ${className}`} src={lion} alt="Marginal drawing of a lion playing a vielle, from a medieval manuscript" draggable={false} />;
}
