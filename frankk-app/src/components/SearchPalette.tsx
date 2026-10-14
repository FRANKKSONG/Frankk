import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { AREA_ICON } from './TodayStrip';
import type { Area } from '../data/types';

interface Hit { key: string; title: string; sub: string; area: Area; run: () => void }

export function SearchPalette() {
  const { paletteOpen, setPalette } = useUi();
  if (!paletteOpen) return null;
  return createPortal(<Palette onClose={() => setPalette(false)} />, document.body);
}

function Palette({ onClose }: { onClose: () => void }) {
  const { data } = useStore();
  const { openTask, revealRow, setFocusArea } = useUi();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  const hits = useMemo<Hit[]>(() => {
    const all: Hit[] = [
      ...data.tasks.map((t) => ({ key: t.id, title: t.title, sub: `${t.area}${t.brand ? ' · ' + t.brand : ''}${t.done ? ' · done' : ''}`, area: t.area as Area, run: () => { setFocusArea(null); openTask(t.id); } })),
      ...data.projects.map((p) => ({ key: p.id, title: `${p.artist} · ${p.title}`, sub: `music · ${p.kind === 'artist-job' ? 'artist job' : 'own release'}`, area: 'music' as Area, run: () => { setFocusArea(null); revealRow('project', p.id); } })),
      ...data.bills.map((b) => ({ key: b.id, title: b.title, sub: 'house · bill', area: 'house' as Area, run: () => setFocusArea('house') })),
    ];
    const n = q.trim().toLowerCase();
    return (n ? all.filter((h) => `${h.title} ${h.sub}`.toLowerCase().includes(n)) : all).slice(0, 30);
  }, [data, q, openTask, revealRow, setFocusArea]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => { list.current?.children[sel]?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  const go = (h?: Hit) => { if (!h) return; onClose(); h.run(); };
  return (
    <div className="scrim top" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette-input">
          <Icon name="search" />
          <input autoFocus role="combobox" aria-expanded aria-controls="palette-list" aria-activedescendant={hits[sel] ? `hit-${hits[sel].key}` : undefined}
            placeholder="Search tasks, projects and bills…" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === 'Enter') go(hits[sel]);
            }} />
          <kbd>Esc</kbd>
        </div>
        <ul id="palette-list" ref={list} role="listbox">
          {hits.length === 0 && <li className="empty">No results.</li>}
          {hits.map((h, i) => (
            <li key={h.key} id={`hit-${h.key}`} role="option" aria-selected={i === sel} className={i === sel ? 'sel' : ''} onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
              <Icon name={AREA_ICON[h.area]} size={14} /><span>{h.title}</span><small>{h.sub}</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
