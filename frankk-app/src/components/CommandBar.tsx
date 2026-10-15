import { useRef, useState } from 'react';
import { Icon } from './Icons';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { KINDS, detectKind, journalLine, newJournal, type Kind } from '../lib/journal';
import { parseCommand } from '../lib/parse';
import { describe, needsSort, useApplyCapture } from '../lib/capture';
import { cloud, cloudCfg } from '../lib/cloud';

/** Adds a timestamped line to today's journal page, starting the page if it's the first line of the day. */
export function useJournal() {
  const { today, dispatch } = useStore();
  return (kind: Kind, text: string) => {
    const d = new Date();
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const line = journalLine(time, kind, text);
    // The page to start if today has none yet; the store appends to the existing page otherwise.
    dispatch({ type: 'journal/append', day: today, line, page: newJournal(today, line, `${today}T${time}:00`) });
  };
}

/**
 * One line for everything, like Raycast. Enter keeps what you wrote: a task by default, or an idea, progress, context
 * or a journal line (pick it, or start with i:, p:, c:, j:). Tab switches to asking Esther instead.
 */
export function CommandBar() {
  const { today, data } = useStore();
  const { say, setPalette } = useUi();
  const apply = useApplyCapture();
  const [text, setText] = useState('');
  const [ai, setAi] = useState(false);
  const [chosen, setChosen] = useState<Kind | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // Reads the sentence as you type. A kind you pick re-reads it as that kind; otherwise a prefix, otherwise Esther's guess.
  const pick = chosen ? KINDS.find((k) => k.id === chosen)! : null;
  const p = parseCommand(pick ? `${pick.prefix} ${detectKind(text).text}` : text, today, data.brands, data.projects);
  const kind = p.kind;

  const q = { ...p, kind };
  const sorter = !!cloudCfg() && needsSort(q);
  /** What Enter will do, shown under the bar before you press it. */
  const preview: string[] = !text.trim() || ai ? [] : sorter ? [`“${p.title}”`, '✦ Jev will place it', '+ today’s journal'] : describe(q, today);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!p.title.trim() || busy) return;
    if (ai) {
      say('Esther’s AI isn’t connected yet, so this opens search instead.');
      setPalette(true);
      setText(''); setAi(false);
      return;
    }
    let final = q, via = '';
    // Not sure where it goes? Ask Jev (through Esther cloud). If it can't be reached, the local reading is used.
    if (sorter) {
      setBusy(true);
      try { const r = await cloud.sort(text, today); final = { ...r.parsed, kind: q.kind }; via = r.sortedBy === 'jev' ? 'sorted by Jev' : ''; }
      catch { via = ''; }
      setBusy(false);
    }
    say(`${apply(final, via).summary}${via ? ' ✦ Sorted by Jev.' : sorter ? ' (Jev not reached: kept in General.)' : ''}`, true);
    setText(''); setChosen(null);
  };


  return (
    <div className={`ask-bar cmd${ai ? ' ai' : ''}${busy ? ' busy' : ''}`} onClick={() => input.current?.focus()}>
      {text.trim() && !ai && (
        <div className="cmd-under" onClick={(e) => e.stopPropagation()}>
          <span className="cmd-saveas" role="radiogroup" aria-label="Save as">
            <span className="cmd-lbl">Save as</span>
            <button type="button" role="radio" aria-checked={!chosen} className="cmd-chip auto" onClick={() => { setChosen(null); input.current?.focus(); }}
              title="Esther reads what kind of thing it is from how you wrote it">Auto{!chosen ? ` · ${KINDS.find((k) => k.id === p.kind)!.label}` : ''}</button>
            {KINDS.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={chosen === k.id} className={`cmd-chip k-${k.id}`} title={k.hint}
                onClick={() => { setChosen(k.id); input.current?.focus(); }}>{k.label}</button>
            ))}
          </span>
          <span className="cmd-preview" aria-live="polite">{preview.map((x, i) => <b key={i}>{x}</b>)}</span>
        </div>
      )}
      <Icon name={ai ? 'sparkle' : 'bolt'} size={16} />
      <input ref={input} value={text} aria-label="Tell Esther"
        placeholder={ai ? 'Ask Esther… (AI not connected yet)' : 'Say it plainly: “poster for B-YOU due 5 Dec, journal it” · Enter keeps it · Tab asks Esther'}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void submit(); }
          // Tab switches to asking only while there's something written, so Tab still moves focus on an empty bar.
          else if (e.key === 'Tab' && !e.shiftKey && (text || ai)) { e.preventDefault(); setAi((a) => !a); }
          else if (e.key === 'Escape') { setText(''); setAi(false); setChosen(null); }
        }} />
      {ai && <span className="cmd-kind ai" title="Tab again to go back">Ask Esther</span>}
    </div>
  );
}
