import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { Icon } from './Icons';

/* A little pixel-art knight that patrols the bottom of the window. Click him to ask something.
   He isn't connected to an AI yet, and says so; meanwhile he searches your Esther data. */

/* Esther's crusader: great helm with a red cross, white tabard, an upright sword, and a lapis shield
   with Esther's gold cross. 24×24 pixels; four-frame walk (step, pass, step, pass) and a blink. */
const PALETTE: Record<string, string> = {
  k: '#1b1612', H: '#e2e6eb', h: '#acb4be', d: '#707983', v: '#121014', e: '#78beff',
  g: '#e2b64e', G: '#aa7a2c', w: '#f0e8d4', W: '#ccc0a6', r: '#cc4838',
  b: '#3a5fa8', B: '#243c70', s: '#969ea8', S: '#6e7680', n: '#6e4c30', N: '#4c3421', y: '#f6d680',
};
const FRAMES = {
  stand: [
  '...k.......kgk..........',
  '..kHk.....kgygk.........',
  '..kHk...kkkkgkkkk.......',
  '..kHk..kHHHHHHHHhdk.....',
  '..kHk.kHHHHHHHHHhhdk....',
  '..kHk.kHHHHHHHHhhhdk....',
  '..kHk.kgggggggggggGk....',
  '..kHk.kHvevHHHvevhdk....',
  '..kHk.kHHHHHrHHHhhdk....',
  '..kHk.kHHHHrrrHHhhdk....',
  '..kHk.kHkHHHrHHkhhdk....',
  '..kHk..kkkkkkkkkkkk.....',
  '.kgggk.kwwwwrwwww.......',
  '..knk.kswwwrrrwkkkkkkkkk',
  '..ksSkkswwwwrwwkgggggggk',
  '..kgk.kggggggggkgbbybbgk',
  '...k..kwwwwwwwwkgyyyyygk',
  '......kwwwwwwwwkgbbybbgk',
  '.......kkkkkkkkkgbbybbgk',
  '........ksk.ksk.kgbybgk.',
  '........ksk.ksk..kgygk..',
  '........kNk.kNk...kgk...',
  '.......kNNk.kNNk...k....',
  '.......kkkk.kkkk........',
],
  lup: [
  '..kHk.....kgygk.........',
  '..kHk...kkkkgkkkk.......',
  '..kHk..kHHHHHHHHhdk.....',
  '..kHk.kHHHHHHHHHhhdk....',
  '..kHk.kHHHHHHHHhhhdk....',
  '..kHk.kgggggggggggGk....',
  '..kHk.kHvevHHHvevhdk....',
  '..kHk.kHHHHHrHHHhhdk....',
  '..kHk.kHHHHrrrHHhhdk....',
  '..kHk.kHkHHHrHHkhhdk....',
  '..kHk..kkkkkkkkkkkk.....',
  '.kgggk.kwwwwrwwww.......',
  '..knk.kswwwrrrwkkkkkkkkk',
  '..ksSkkswwwwrwwkgggggggk',
  '..kgk.kggggggggkgbbybbgk',
  '...k..kwwwwwwwwkgyyyyygk',
  '......kwwwwwwwwkgbbybbgk',
  '.......kkkkkkkkkgbbybbgk',
  '.......kkkkkkkkkgbbybbgk',
  '........kNk.ksk.kgbybgk.',
  '.......kNNk.ksk..kgygk..',
  '.......kkkk.kNk...kgk...',
  '............kNNk...k....',
  '............kkkk........',
],
  rup: [
  '..kHk.....kgygk.........',
  '..kHk...kkkkgkkkk.......',
  '..kHk..kHHHHHHHHhdk.....',
  '..kHk.kHHHHHHHHHhhdk....',
  '..kHk.kHHHHHHHHhhhdk....',
  '..kHk.kgggggggggggGk....',
  '..kHk.kHvevHHHvevhdk....',
  '..kHk.kHHHHHrHHHhhdk....',
  '..kHk.kHHHHrrrHHhhdk....',
  '..kHk.kHkHHHrHHkhhdk....',
  '..kHk..kkkkkkkkkkkk.....',
  '.kgggk.kwwwwrwwww.......',
  '..knk.kswwwrrrwkkkkkkkkk',
  '..ksSkkswwwwrwwkgggggggk',
  '..kgk.kggggggggkgbbybbgk',
  '...k..kwwwwwwwwkgyyyyygk',
  '......kwwwwwwwwkgbbybbgk',
  '.......kkkkkkkkkgbbybbgk',
  '.......kkkkkkkkkgbbybbgk',
  '........ksk.kNk.kgbybgk.',
  '........ksk.kNNk.kgygk..',
  '........kNk.kkkk..kgk...',
  '.......kNNk........k....',
  '.......kkkk.............',
],
};
type FrameName = keyof typeof FRAMES;
const WALK: FrameName[] = ['lup', 'stand', 'rup', 'stand'];

function Sprite({ frame, blink }: { frame: FrameName; blink?: boolean }) {
  const rows = FRAMES[frame];
  return (
    <svg viewBox="0 0 24 24" width="60" height="60" shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) => [...row].map((c, x) => {
        const ch = blink && c === 'e' ? 'v' : c;
        return PALETTE[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={PALETTE[ch]} /> : null;
      }))}
    </svg>
  );
}

interface Hit { key: string; label: string; sub: string; go: () => void }

export function Knight() {
  const { data } = useStore();
  const { openTask, revealRow, go } = useUi();
  const [x, setX] = useState(() => Math.max(120, window.innerWidth - 220));
  const [dir, setDir] = useState<1 | -1>(-1);
  const [moving, setMoving] = useState(false);
  const [step, setStep] = useState(0);
  const [blink, setBlink] = useState(false);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const state = useRef({ x, dir, target: x, pauseUntil: 0 });
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Patrol: walk to a random spot, rest a few seconds, repeat. Stops while hovered or talking.
  useEffect(() => {
    if (still) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const s = state.current;
      const min = 90, max = window.innerWidth - 70;
      if (open || hover || now < s.pauseUntil) { setMoving(false); raf = requestAnimationFrame(tick); return; }
      if (Math.abs(s.target - s.x) < 2) {
        s.pauseUntil = now + 2000 + Math.random() * 4000;
        s.target = min + Math.random() * (max - min);
      } else {
        s.dir = s.target > s.x ? 1 : -1;
        s.x = Math.max(min, Math.min(max, s.x + s.dir * 30 * dt));
        setX(s.x); setDir(s.dir as 1 | -1); setMoving(true);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, hover, still]);

  useEffect(() => {
    if (!moving) return;
    const t = window.setInterval(() => setStep((n) => (n + 1) % WALK.length), 150);
    return () => window.clearInterval(t);
  }, [moving]);

  // A little blink now and then while he stands guard.
  useEffect(() => {
    if (moving) return;
    let t = 0;
    const loop = () => { t = window.setTimeout(() => { setBlink(true); window.setTimeout(() => setBlink(false), 140); loop(); }, 2500 + Math.random() * 3000); };
    loop();
    return () => window.clearTimeout(t);
  }, [moving]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const t = asked.trim().toLowerCase();
    if (!t) return [];
    const words = t.split(/\s+/).filter((w) => w.length > 1);
    const match = (s: string) => words.some((w) => s.toLowerCase().includes(w));
    const out: Hit[] = [];
    for (const task of data.tasks) if (match(`${task.title} ${task.notes ?? ''} ${task.tags.join(' ')}`)) out.push({ key: task.id, label: task.title, sub: `Task · ${task.area}${task.done ? ' · done' : ''}`, go: () => openTask(task.id) });
    for (const p of data.projects) if (match(`${p.artist} ${p.title} ${p.notes ?? ''}`)) out.push({ key: p.id, label: `${p.artist} · ${p.title}`, sub: p.kind === 'own-release' ? 'Release' : 'Artist job', go: () => { go('tasks'); revealRow('project', p.id); } });
    for (const p of data.projects) for (const st of p.stages) {
      if (match(st.name)) out.push({ key: st.id, label: `${st.name} · ${p.title}`, sub: `Stage · ${p.artist}`, go: () => { go('tasks'); revealRow('project', p.id); } });
      for (const it of st.items) if (match(it.text)) out.push({ key: it.id, label: it.text, sub: `${st.name} · ${p.artist} – ${p.title}`, go: () => { go('tasks'); revealRow('project', p.id); } });
    }
    for (const n of data.notes) if (match(`${n.title} ${n.body}`)) out.push({ key: n.id, label: n.title, sub: `Note · ${n.folder}`, go: () => go('notes', { noteId: n.id }) });
    return out.slice(0, 8);
  }, [asked, data, openTask, revealRow, go]);

  const bubbleLeft = Math.max(12, Math.min(window.innerWidth - 332, x - 150));

  return (
    <>
      <button type="button" className={`knight${moving ? ' walking' : ''}${open ? ' talking' : ''}`} style={{ left: x, transform: `translateX(-50%) scaleX(${dir === 1 ? 1 : -1})` }}
        aria-label="Ask Esther's knight" title="Ask me something" aria-expanded={open}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={() => setOpen((o) => !o)}>
        <Sprite frame={moving ? WALK[step] : 'stand'} blink={blink && !moving} />
      </button>
      {open && (
        <div className="knight-bubble" role="dialog" aria-label="Ask the knight" style={{ left: bubbleLeft }}>
          <div className="kb-head"><strong>At your service!</strong><button className="icon-btn tiny" aria-label="Close" onClick={() => setOpen(false)}><Icon name="close" size={12} /></button></div>
          <p className="kb-note">I'm not connected to an AI yet, so I can't answer questions. I can search everything in Esther for you.</p>
          <form onSubmit={(e) => { e.preventDefault(); setAsked(q); }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. vocals, bills, Jing…" aria-label="Ask the knight" />
          </form>
          {asked && (
            <div className="kb-results">
              {hits.length === 0 ? <p className="muted">Nothing found for “{asked}”.</p> : hits.map((h) => (
                <button key={h.key} className="kb-hit" onClick={() => { h.go(); setOpen(false); }}><b>{h.label}</b><span>{h.sub}</span></button>
              ))}
            </div>
          )}
          <span className="kb-tail" style={{ left: Math.max(16, Math.min(300, x - bubbleLeft)) }} />
        </div>
      )}
    </>
  );
}
