import { useMemo, useState } from 'react';
import { Icon } from '../components/Icons';
import { Editable } from '../components/Editable';
import { TagChips, TagPicker } from '../components/Tags';
import { RecordDrawer } from '../components/RecordDrawer';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { wikilinksIn } from '../lib/markdown';
import { NoteEditor } from '../components/NoteEditor';
import { findJournal, isJournal, journalId, newJournal } from '../lib/journal';
import { longToday } from '../lib/dates';
import { recordsOf } from '../lib/records';
import { newId } from '../data/fixtures';
import { toMarkdown, type Note } from '../data/schema';

const AI_FOLDER = 'Esther/Knowledge';

/**
 * Notes: one place for everything you write. Journal days sit at the top (today first): the same pages the bar and your
 * phone write into. Below, your folders and the librarian's knowledge pages. Every page is an ordinary Obsidian file.
 */
export function NotesPage() {
  const { data, today, dispatch } = useStore();
  const { noteId, setNoteId, openNote, say } = useUi();
  const [q, setQ] = useState('');
  const [openRec, setOpenRec] = useState<{ typeId: string; id: string } | null>(null);
  const note = data.notes.find((n) => n.id === noteId) ?? findJournal(data.notes, today) ?? data.notes.find((n) => n.pinned) ?? data.notes[0];
  const people = useMemo(() => data.types.filter((t) => !['note', 'bill'].includes(t.id)).flatMap((t) => recordsOf(data, t.id, today)), [data, today]);

  const folders = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of data.notes.filter((x) => !isJournal(x.folder) && (!q || `${x.title} ${x.body}`.toLowerCase().includes(q.toLowerCase())))) m.set(n.folder || '/', [...(m.get(n.folder || '/') ?? []), n]);
    return [...m.entries()].sort(([a], [b]) => (a === AI_FOLDER ? -1 : b === AI_FOLDER ? 1 : a.localeCompare(b)));
  }, [data.notes, q]);

  const create = (folder: string, title: string, body = '') => {
    const now = new Date().toISOString().slice(0, 19);
    const id = newId('n');
    dispatch({ type: 'note/add', note: { id, title, folder, body, tags: [], props: {}, author: 'me', created: now, updated: now, path: `${folder}/${title}.md` } });
    setNoteId(id);
  };
  const days = useMemo(() => data.notes.filter((n) => isJournal(n.folder) && (!q || `${n.title} ${n.body}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.title.localeCompare(a.title)), [data.notes, q]);
  const openToday = () => {
    const ex = findJournal(data.notes, today);
    if (ex) return setNoteId(ex.id);
    const now = new Date().toISOString().slice(0, 19);
    dispatch({ type: 'note/add', note: { ...newJournal(today, '', now), body: `# ${longToday(today)}\n\n` } });
    setNoteId(journalId(today));
  };
  const dayLabel = (n: Note) => (/^\d{4}-\d{2}-\d{2}$/.test(n.title) ? (n.title === today ? `Today · ${longToday(n.title)}` : longToday(n.title)) : n.title);

  if (!note) return <div className="page"><p>No notes yet.</p><button className="btn" onClick={() => create('Inbox', 'First note')}>New note</button></div>;

  const backlinks = data.notes.filter((n) => n.id !== note.id && wikilinksIn(n.body).some((l) => l.toLowerCase() === note.title.toLowerCase()));
  const outgoing = wikilinksIn(note.body);
  const linkedRecords = people.filter((r) => outgoing.some((l) => l.toLowerCase() === r.title.toLowerCase()));
  const isAi = note.author === 'ai';

  const followLink = (target: string) => {
    const n = data.notes.find((x) => x.title.toLowerCase() === target.toLowerCase());
    if (n) { setNoteId(n.id); return; }
    const r = people.find((x) => x.title.toLowerCase() === target.toLowerCase());
    if (r) { if (r.typeId === 'task') return; setOpenRec({ typeId: r.typeId, id: r.id }); return; }
    create('Inbox', target);
    say(`Created “${target}” in Inbox.`, true);
  };

  return (
    <div className="page-wide notes">
      <aside className="notes-tree">
        <div className="notes-tools">
          <input aria-label="Search notes" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn small" onClick={() => create('Inbox', 'Untitled note')}><Icon name="plus" size={12} /> Note</button>
        </div>
        <div className="tree-folder tree-journal">
          <div className="tree-name"><Icon name="calendar" size={13} /> Journal</div>
          {!days.some((n) => n.id === journalId(today)) && <button className="tree-note today" onClick={openToday}><Icon name="plus" size={11} /> Today · {longToday(today)}</button>}
          {days.slice(0, 14).map((n) => (
            <button key={n.id} className={`tree-note${n.id === note.id ? ' on' : ''}${n.title === today ? ' today' : ''}`} onClick={() => setNoteId(n.id)}>{dayLabel(n)}</button>
          ))}
        </div>
        {folders.map(([folder, list]) => (
          <div key={folder} className={`tree-folder${folder === AI_FOLDER ? ' ai' : ''}`}>
            <div className="tree-name"><Icon name={folder === AI_FOLDER ? 'bot' : 'folder'} size={13} /> {folder}{folder === AI_FOLDER && <span className="pill ai-pill">Librarian</span>}</div>
            {list.map((n) => (
              <button key={n.id} className={`tree-note${n.id === note.id ? ' on' : ''}`} onClick={() => setNoteId(n.id)}>
                {n.pinned && <span title="Pinned">✦</span>}{n.title}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <article className="note-main">
        <header className="note-head">
          {isJournal(note.folder) && /^\d{4}-\d{2}-\d{2}$/.test(note.title)
            ? <h2 className="note-title">{dayLabel(note)}</h2>
            : <Editable className="note-title" label="Note title" value={note.title} onSave={(v) => dispatch({ type: 'note/update', id: note.id, patch: { title: v.trim() } })} />}
        </header>
        <div className="note-meta">
          {isAi ? <span className="pill ai-pill"><Icon name="bot" size={11} /> Written by the librarian</span> : isJournal(note.folder) ? <span className="pill">Journal</span> : <span className="pill">{note.folder}</span>}
          <span className="tag-line"><TagChips names={note.tags} small /><TagPicker compact value={note.tags} onChange={(tags) => dispatch({ type: 'note/update', id: note.id, patch: { tags } })} /></span>
          <button className="link-btn" onClick={() => dispatch({ type: 'note/update', id: note.id, patch: { pinned: !note.pinned } })}>{note.pinned ? 'Unpin' : 'Pin'}</button>
          <span className="muted">Saved {note.updated.slice(0, 16).replace('T', ' ')}</span>
        </div>
        <div className={isJournal(note.folder) ? 'journal-doc' : ''}><NoteEditor key={note.id} markdown={note.body} onLink={followLink}
          placeholder={isJournal(note.folder) ? 'How was today? Captures from the bar and your phone land here with their time.' : undefined}
          onChange={(md) => { if (md !== note.body) dispatch({ type: 'note/update', id: note.id, patch: { body: md } }); }} /></div>
      </article>

      <aside className="note-side">
        <section>
          <h4><Icon name="link" size={13} /> Links in this note · {outgoing.length}</h4>
          {outgoing.length ? outgoing.map((t) => <button key={t} className="side-link" onClick={() => followLink(t)}>{t}<small>{data.notes.some((n) => n.title.toLowerCase() === t.toLowerCase()) ? 'note' : people.some((r) => r.title.toLowerCase() === t.toLowerCase()) ? 'record' : 'new note'}</small></button>)
            : <p className="hint">Type [[ and a name to link a note, person or project. Ctrl+click a link in the text to open it.</p>}
        </section>
        <section>
          <h4><Icon name="link" size={13} /> Backlinks · {backlinks.length}</h4>
          {backlinks.length ? backlinks.map((n) => <button key={n.id} className="side-link" onClick={() => setNoteId(n.id)}>{n.title}<small>{n.folder}</small></button>) : <p className="hint">No notes link here yet.</p>}
        </section>
        <section>
          <h4><Icon name="person" size={13} /> Linked records · {linkedRecords.length}</h4>
          {linkedRecords.map((r) => <button key={r.id} className="side-link" onClick={() => setOpenRec({ typeId: r.typeId, id: r.id })}>{r.title}<small>{data.types.find((t) => t.id === r.typeId)?.name}</small></button>)}
          {!linkedRecords.length && <p className="hint">Type [[Jing]] to link a person, project or idea.</p>}
        </section>
        <Librarian note={note} />
        <section className="file-preview">
          <div className="file-head"><code>{note.path}</code><button className="btn small" onClick={() => openNote(note.path)}><Icon name="external" size={12} /> Obsidian</button></div>
          <pre>{toMarkdown({ tags: note.tags, author: note.author === 'ai' ? 'esther-librarian' : undefined, updated: note.updated.slice(0, 10) }, note.body.slice(0, 220) + (note.body.length > 220 ? '…' : ''))}</pre>
        </section>
      </aside>
      {openRec && <RecordDrawer typeId={openRec.typeId} id={openRec.id} onClose={() => setOpenRec(null)} />}
    </div>
  );
}

/** The AI librarian panel. Real providers are configured in Settings; nothing is sent until one is connected. */
function Librarian({ note }: { note: Note }) {
  const { dispatch, data } = useStore();
  const { say, go } = useUi();
  const [proposals, setProposals] = useState([
    { id: 'p1', text: 'Add a “Mood” choice field to Ideas (Calm, Hype, Sad, Dreamy)', apply: () => dispatch({ type: 'field/add', typeId: 'idea', field: { key: 'mood', name: 'Mood', kind: 'select', options: [{ value: 'Calm', color: '#3f9a80' }, { value: 'Hype', color: '#c8553a' }, { value: 'Sad', color: '#4c6fb8' }, { value: 'Dreamy', color: '#8a4f8f' }] } }) },
    { id: 'p2', text: 'Link “Things to remember” → JZero: “Ask JZero for stems by Friday” as a task', apply: () => dispatch({ type: 'task/add', title: 'Ask JZero for stems', area: 'general', extra: { tags: ['client'], mode: 'simple' } }) },
  ]);
  const connected = false;
  return (
    <section className="librarian">
      <h4><Icon name="bot" size={13} /> Librarian</h4>
      <p className={`status-line ${connected ? 'ok' : 'off'}`}><i />{connected ? 'Connected' : 'No AI connected yet'} · <button className="link-btn" onClick={() => go('settings')}>Set up AI</button></p>
      <div className="lib-actions">
        <button className="btn small" disabled title="Needs an AI connection">Summarise into Knowledge</button>
        <button className="btn small" disabled title="Needs an AI connection">Find connections</button>
        <button className="btn small" disabled title="Needs an AI connection">File this note</button>
      </div>
      <p className="hint">The librarian writes freely only inside {AI_FOLDER}. Changes to “{note.title}” or any of your notes come here as proposals first.</p>
      <h5>Waiting for your approval · {proposals.length} <span className="pill sim">Sample</span></h5>
      {proposals.map((p) => (
        <div key={p.id} className="proposal">
          <span>{p.text}</span>
          <span className="proposal-actions">
            <button className="btn small primary" onClick={() => { p.apply(); setProposals((x) => x.filter((y) => y.id !== p.id)); say('Approved and applied. Logged in the librarian log.', true); }}>Approve</button>
            <button className="btn small ghost" onClick={() => setProposals((x) => x.filter((y) => y.id !== p.id))}>Decline</button>
          </span>
        </div>
      ))}
      {!proposals.length && <p className="hint">Nothing waiting.</p>}
      <p className="hint">{data.notes.filter((n) => n.author === 'ai').length} knowledge pages so far.</p>
    </section>
  );
}
