import { useRef, useState } from 'react';
import { Icon } from './Icons';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { newId } from '../data/fixtures';
import { KINDS, detectKind, findJournal, journalLine, newJournal, type Kind } from '../lib/journal';

const TAG_RE = /#[\p{L}\p{N}_-]+/gu;

/** Adds a timestamped line to today's journal page, starting the page if it's the first line of the day. */
export function useJournal() {
  const { data, today, dispatch } = useStore();
  return (kind: Kind, text: string) => {
    const d = new Date();
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const now = `${today}T${time}:00`;
    const line = journalLine(time, kind, text);
    const page = findJournal(data.notes, today);
    if (page) dispatch({ type: 'note/update', id: page.id, patch: { body: `${page.body.trimEnd()}\n${line}` } });
    else dispatch({ type: 'note/add', note: newJournal(today, line, now) });
  };
}

/**
 * One line for everything, like Raycast. Enter keeps what you wrote: a task by default, or an idea, progress, context
 * or a journal line (pick it, or start with i:, p:, c:, j:). Tab switches to asking Esther instead.
 */
export function CommandBar() {
  const { dispatch, today } = useStore();
  const { say, setPalette } = useUi();
  const journal = useJournal();
  const [text, setText] = useState('');
  const [ai, setAi] = useState(false);
  const [chosen, setChosen] = useState<Kind | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const det = detectKind(text);
  const kind = det.explicit ? det.kind : chosen ?? 'task';
  const info = KINDS.find((k) => k.id === kind)!;

  const submit = () => {
    const body = det.text;
    if (!body) return;
    if (ai) {
      say('Esther’s AI isn’t connected yet, so this opens search instead.');
      setPalette(true);
      setText(''); setAi(false);
      return;
    }
    if (kind === 'task') {
      const tags = [...new Set((body.match(TAG_RE) ?? []).map((x) => x.slice(1)))];
      const title = body.replace(TAG_RE, '').replace(/\s+/g, ' ').trim() || body;
      dispatch({ type: 'task/add', title, area: 'general', extra: { tags, mode: 'simple' } });
      journal('task', title);
    } else if (kind === 'idea') {
      const now = `${today}T09:00:00`;
      dispatch({ type: 'entry/add', entry: { id: newId('e'), typeId: 'idea', title: body, props: { status: 'Spark', captured: today }, tags: [], created: now, updated: now, path: `Ideas/${body}.md` } });
      journal('idea', body);
    } else journal(kind, body);
    say(`Kept as ${info.label.toLowerCase()}${kind === 'task' ? ' in General' : kind === 'idea' ? ' on your Ideas board' : ' in today’s journal'}.`, true);
    setText(''); setChosen(null);
  };

  const cycle = () => { const i = KINDS.findIndex((k) => k.id === kind); setChosen(KINDS[(i + 1) % KINDS.length].id); input.current?.focus(); };

  return (
    <div className={`ask-bar cmd${ai ? ' ai' : ''}`} onClick={() => input.current?.focus()}>
      <Icon name={ai ? 'sparkle' : 'bolt'} size={16} />
      <input ref={input} value={text} aria-label="Tell Esther"
        placeholder={ai ? 'Ask Esther… (AI not connected yet)' : 'Write anything · Enter keeps it · Tab asks Esther'}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          // Tab switches to asking only while there's something written, so Tab still moves focus on an empty bar.
          else if (e.key === 'Tab' && !e.shiftKey && (text || ai)) { e.preventDefault(); setAi((a) => !a); }
          else if (e.key === 'Escape') { setText(''); setAi(false); setChosen(null); }
        }} />
      {ai
        ? <span className="cmd-kind ai" title="Tab again to go back">Ask Esther</span>
        : <button type="button" className={`cmd-kind k-${kind}`} title={`${info.hint}. Click to change, or start with ${KINDS.map((k) => k.prefix).join(' ')}`}
            onClick={(e) => { e.stopPropagation(); cycle(); }}>{info.label}</button>}
    </div>
  );
}
