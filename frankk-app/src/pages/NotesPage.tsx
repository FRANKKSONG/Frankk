import { useMemo, useState } from 'react';
import { Icon } from '../components/Icons';
import { Editable } from '../components/Editable';
import { TagChips, TagPicker } from '../components/Tags';
import { RecordDrawer } from '../components/RecordDrawer';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { renderMarkdown, wikilinksIn } from '../lib/markdown';
import { recordsOf } from '../lib/records';
import { newId } from '../data/fixtures';
import { toMarkdown, type Note } from '../data/schema';

const AI_FOLDER = 'Esther/Knowledge';

/** Notes: your writing and the librarian's knowledge pages, mirrored 1:1 with Obsidian files. */
export function NotesPage() {
  const { data, today, dispatch } = useStore();
  const { noteId, setNoteId, openNote, say } = useUi();
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'edit' | 'read'>('read');
  const [openRec, setOpenRec] = useState<{ typeId: string; id: string } | null>(null);
  const note = data.notes.find((n) => n.id === noteId) ?? data.notes.find((n) => n.pinned) ?? data.notes[0];
  const titles = data.notes.map((n) => n.title);
  const people = useMemo(() => data.types.filter((t) => !['note', 'bill'].includes(t.id)).flatMap((t) => recordsOf(data, t.id, today)), [data, today]);

  const folders = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of data.notes.filter((x) => !q || `${x.title} ${x.body}`.toLowerCase().includes(q.toLowerCase()))) m.set(n.folder || '/', [...(m.get(n.folder || '/') ?? []), n]);
    return [...m.entries()].sort(([a], [b]) => (a === AI_FOLDER ? -1 : b === AI_FOLDER ? 1 : a.localeCompare(b)));
  }, [data.notes, q]);

  const create = (folder: string, title: string, body = '') => {
    const now = new Date().toISOString().slice(0, 19);
    const id = newId('n');
    dispatch({ type: 'note/add', note: { id, title, folder, body, tags: [], props: {}, author: 'me', created: now, updated: now, path: `${folder}/${title}.md` } });
    setNoteId(id); setMode('edit');
  };

  if (!note) return <div className="page"><p>No notes yet.</p><button className="btn" onClick={() => create('Inbox', 'First note')}>New note</button></div>;

  const backlinks = data.notes.filter((n) => n.id !== note.id && wikilinksIn(n.body).some((l) => l.toLowerCase() === note.title.toLowerCase()));
  const outgoing = wikilinksIn(note.body);
  const linkedRecords = people.filter((r) => outgoing.some((l) => l.toLowerCase() === r.title.toLowerCase()));
  const isAi = note.author === 'ai';

  const followLink = (target: string) => {
    const n = data.notes.find((x) => x.title.toLowerCase() === target.toLowerCase());
    if (n) { setNoteId(n.id); setMode('read'); return; }
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
          <button className="btn small" onClick={() => { const ex = data.notes.find((n) => n.folder === 'Journal' && n.title === today); if (ex) setNoteId(ex.id); else create('Journal', today, `# ${today}\n\n- `); }}><Icon name="calendar" size={12} /> Today</button>
        </div>
        {folders.map(([folder, list]) => (
          <div key={folder} className={`tree-folder${folder === AI_FOLDER ? ' ai' : ''}`}>
            <div className="tree-name"><Icon name={folder === AI_FOLDER ? 'bot' : 'folder'} size={13} /> {folder}{folder === AI_FOLDER && <span className="pill ai-pill">Librarian</span>}</div>
            {list.map((n) => (
              <button key={n.id} className={`tree-note${n.id === note.id ? ' on' : ''}`} onClick={() => { setNoteId(n.id); setMode('read'); }}>
                {n.pinned && <span title="Pinned">✦</span>}{n.title}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <article className="note-main">
        <header className="note-head">
          <Editable className="note-title" label="Note title" value={note.title} onSave={(v) => dispatch({ type: 'note/update', id: note.id, patch: { title: v.trim() } })} />
          <div className="seg slim" role="tablist" aria-label="Mode">
            <button role="tab" aria-selected={mode === 'read'} onClick={() => setMode('read')}>Read</button>
            <button role="tab" aria-selected={mode === 'edit'} onClick={() => setMode('edit')}>Edit</button>
          </div>
        </header>
        <div className="note-meta">
          {isAi ? <span className="pill ai-pill"><Icon name="bot" size={11} /> Written by the librarian</span> : <span className="pill">Written by you</span>}
          <span className="tag-line"><TagChips names={note.tags} small /><TagPicker compact value={note.tags} onChange={(tags) => dispatch({ type: 'note/update', id: note.id, patch: { tags } })} /></span>
          <button className="link-btn" onClick={() => dispatch({ type: 'note/update', id: note.id, patch: { pinned: !note.pinned } })}>{note.pinned ? 'Unpin' : 'Pin'}</button>
          <span className="muted">Updated {note.updated.slice(0, 10)}</span>
        </div>
        {mode === 'edit' ? (
          <textarea className="note-editor" aria-label="Note text" defaultValue={note.body} key={note.id}
            placeholder="Write in Markdown. Link anything with [[double brackets]]."
            onBlur={(e) => { if (e.target.value !== note.body) dispatch({ type: 'note/update', id: note.id, patch: { body: e.target.value } }); }} />
        ) : (
          <div className="md note-read" onClick={(e) => {
            const t = (e.target as HTMLElement).closest('[data-wikilink]') as HTMLElement | null;
            if (t) { e.preventDefault(); followLink(t.dataset.wikilink!); }
          }} onDoubleClick={() => setMode('edit')}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body, [...titles, ...people.map((p) => p.title)]) || '<p class="muted">Empty note. Double-click to write.</p>' }} />
        )}
      </article>

      <aside className="note-side">
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
