import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { Icon } from './Icons';
import { KNIGHT_FRAMES, type KnightFrame } from './knightSprite';

/* Esther's knight patrols the bottom of the window with his sword held upright. Click him to ask something
   (he isn't connected to an AI yet and says so; meanwhile he searches your Esther data). Drag him around:
   he dangles while held; drop him from high up and he falls, gets hurt, lies dizzy, gets up and brushes
   himself off before resuming his patrol. Motion modelled on desktop-pet sprites (Shimeji-style). */
const PALETTE: Record<string, string> = {
  k: '#181411', H: '#e8ebf0', h: '#b8bfc8', d: '#7a828d', v: '#141216', e: '#82c8ff', x: '#e65046',
  g: '#e8ba4c', G: '#aa7828', w: '#f4ecd8', W: '#cec2a8', r: '#ce4234',
  b: '#385eaa', B: '#223a70', s: '#9ca4ae', S: '#6c747f', n: '#76503a', N: '#503622', y: '#fadc82',
};
const WALK: KnightFrame[] = ['lup', 'stand', 'rup', 'stand'];
type Mode = 'patrol' | 'drag' | 'fall' | 'hurt' | 'down' | 'getup' | 'brush';
const HURT_HEIGHT = 70;   // px above the ground; dropped from higher than this, he takes a tumble
const GRAVITY = 2600;     // px/s²

function Sprite({ frame, blink }: { frame: KnightFrame; blink?: boolean }) {
  const rows = KNIGHT_FRAMES[frame];
  return (
    <svg viewBox="0 0 32 32" width="64" height="64" shapeRendering="crispEdges" aria-hidden="true">
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
  const [y, setY] = useState(0);
  const [dir, setDir] = useState<1 | -1>(-1);
  const [mode, setModeState] = useState<Mode>('patrol');
  const [moving, setMoving] = useState(false);
  const [tick, setTick] = useState(0);
  const [blink, setBlink] = useState(false);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const state = useRef({ x, y: 0, vy: 0, dir, target: x, pauseUntil: 0, mode: 'patrol' as Mode, dropHeight: 0 });
  const press = useRef<{ px: number; py: number; dx: number; dy: number; dragged: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setMode = (m: Mode) => { state.current.mode = m; setModeState(m); };
  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // After a hard landing: hurt → lying dizzy → crouch → brush off → back on patrol.
  const tumble = () => {
    setMode('hurt');
    later(380, () => setMode('down'));
    later(1900, () => setMode('getup'));
    later(2350, () => setMode('brush'));
    later(3800, () => { setMode('patrol'); state.current.pauseUntil = performance.now() + 900; });
  };

  // One loop drives patrolling and falling.
  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const s = state.current;
      if (s.mode === 'fall') {
        s.vy += GRAVITY * dt;
        s.y = Math.max(0, s.y - s.vy * dt);
        setY(s.y);
        if (s.y === 0) {
          s.vy = 0;
          if (s.dropHeight > HURT_HEIGHT) tumble(); else { setMode('patrol'); s.pauseUntil = now + 600; }
        }
      } else if (s.mode === 'patrol' && !still) {
        const min = 90, max = window.innerWidth - 70;
        if (open || hover || now < s.pauseUntil) setMoving(false);
        else if (Math.abs(s.target - s.x) < 2) { s.pauseUntil = now + 2000 + Math.random() * 4000; s.target = min + Math.random() * (max - min); setMoving(false); }
        else {
          s.dir = s.target > s.x ? 1 : -1;
          s.x = Math.max(min, Math.min(max, s.x + s.dir * 30 * dt));
          setX(s.x); setDir(s.dir as 1 | -1); setMoving(true);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hover, still]);

  // Animation clock for walk cycles, dangling and brushing.
  useEffect(() => {
    const active = (mode === 'patrol' && moving) || mode === 'drag' || mode === 'brush';
    if (!active) return;
    const t = window.setInterval(() => setTick((n) => n + 1), mode === 'patrol' ? 150 : 190);
    return () => window.clearInterval(t);
  }, [mode, moving]);

  // A little blink now and then while he stands guard.
  useEffect(() => {
    if (moving || mode !== 'patrol') return;
    let t = 0;
    const loop = () => { t = window.setTimeout(() => { setBlink(true); window.setTimeout(() => setBlink(false), 140); loop(); }, 2500 + Math.random() * 3000); };
    loop();
    return () => window.clearTimeout(t);
  }, [moving, mode]);

  // Dragging: pick him up by the helm; release to drop him.
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !['patrol', 'brush', 'getup'].includes(state.current.mode)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const groundY = window.innerHeight - 4;
    press.current = { px: e.clientX, py: e.clientY, dx: e.clientX - state.current.x, dy: (groundY - state.current.y) - e.clientY, dragged: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const pr = press.current;
    if (!pr) return;
    if (!pr.dragged && Math.hypot(e.clientX - pr.px, e.clientY - pr.py) < 5) return;
    if (!pr.dragged) { pr.dragged = true; setOpen(false); timers.current.forEach(window.clearTimeout); setMode('drag'); setMoving(false); }
    const s = state.current;
    const nx = Math.max(40, Math.min(window.innerWidth - 40, e.clientX - pr.dx));
    if (nx !== s.x) setDir(nx > s.x ? 1 : -1);
    s.x = nx; s.target = nx;
    s.y = Math.max(0, Math.min(window.innerHeight - 80, window.innerHeight - 4 - e.clientY - pr.dy));
    setX(s.x); setY(s.y);
  };
  const onPointerUp = () => {
    const pr = press.current; press.current = null;
    if (!pr) return;
    if (!pr.dragged) { setOpen((o) => !o); return; }
    const s = state.current;
    s.dropHeight = s.y; s.vy = 0;
    setMode('fall');
  };

  const frame: KnightFrame =
    mode === 'drag' || mode === 'fall' ? (tick % 2 ? 'dangleA' : 'dangleB')
    : mode === 'hurt' || mode === 'down' ? 'hurt'
    : mode === 'getup' ? 'crouch'
    : mode === 'brush' ? (tick % 2 ? 'brushA' : 'brushB')
    : moving ? WALK[tick % WALK.length] : 'stand';

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
  const bubbleBottom = 78 + y;

  return (
    <>
      <button type="button" className={`knight m-${mode}${moving ? ' walking' : ''}${open ? ' talking' : ''}`}
        style={{ left: x, bottom: 4 + y, transform: `translateX(-50%) scaleX(${dir === 1 ? 1 : -1})` }}
        aria-label="Ask Esther's knight (drag to move him)" title="Click to ask · drag to carry him" aria-expanded={open}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}>
        <span className="knight-body"><Sprite frame={frame} blink={blink && mode === 'patrol' && !moving} /></span>
        {mode === 'down' && <span className="knight-stars" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i></span>}
        {mode === 'brush' && <span className="knight-dust" aria-hidden="true"><i /><i /><i /><i /></span>}
        {mode === 'hurt' && <span className="knight-ouch" aria-hidden="true">!</span>}
      </button>
      {open && (
        <div className="knight-bubble" role="dialog" aria-label="Ask the knight" style={{ left: bubbleLeft, bottom: bubbleBottom }}>
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
