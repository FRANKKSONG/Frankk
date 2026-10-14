import { useState } from 'react';
import { Icon, type IconName } from '../components/Icons';
import { AppearancePanel } from '../components/Appearance';
import { Editable } from '../components/Editable';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { clearPrefs, usePersistentState } from '../hooks/usePersistentState';
import { recordsOf } from '../lib/records';
import { toBaseFile } from '../lib/bases';
import { FIXTURE_VAULT_NAME } from '../lib/obsidian';
import type { ThemePrefs } from '../lib/theme';

type Section = 'profile' | 'appearance' | 'storage' | 'obsidian' | 'ai' | 'permissions' | 'tags' | 'history' | 'about';
const SECTIONS: { id: Section; label: string; icon: IconName }[] = [
  { id: 'profile', label: 'Profile', icon: 'person' }, { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'storage', label: 'Vault & storage', icon: 'database' }, { id: 'obsidian', label: 'Obsidian bridge', icon: 'plug' },
  { id: 'ai', label: 'AI & models', icon: 'bot' }, { id: 'permissions', label: 'AI permissions', icon: 'shield' },
  { id: 'tags', label: 'Tags', icon: 'tag' }, { id: 'history', label: 'History & backups', icon: 'history' }, { id: 'about', label: 'Status', icon: 'info' },
];

export function SettingsPage({ theme, setTheme }: { theme: ThemePrefs; setTheme: (t: ThemePrefs) => void }) {
  const [sec, setSec] = usePersistentState<{ s: Section }>('settings.section', { s: 'storage' });
  return (
    <div className="page-wide settings">
      <nav className="set-nav" aria-label="Settings sections">
        <h1>Settings</h1>
        {SECTIONS.map((s) => (
          <button key={s.id} className={sec.s === s.id ? 'on' : ''} aria-current={sec.s === s.id ? 'page' : undefined} onClick={() => setSec({ s: s.id })}><Icon name={s.icon} size={15} />{s.label}</button>
        ))}
      </nav>
      <div className="set-body">
        {sec.s === 'profile' && <Profile />}
        {sec.s === 'appearance' && <section className="set-card"><h2>Appearance</h2><p className="lead">Pick a look and tune its colours. Backgrounds are chosen per dashboard on Home → Customize.</p><AppearancePanel prefs={theme} setPrefs={setTheme} /></section>}
        {sec.s === 'storage' && <Storage />}
        {sec.s === 'obsidian' && <Bridge />}
        {sec.s === 'ai' && <Ai />}
        {sec.s === 'permissions' && <Permissions />}
        {sec.s === 'tags' && <Tags />}
        {sec.s === 'history' && <History />}
        {sec.s === 'about' && <About />}
      </div>
    </div>
  );
}

function Profile() {
  const [p, setP] = usePersistentState('profile', { name: 'FRANKK', timezone: 'Asia/Vientiane', weekStart: 'Monday', currency: 'LAK' });
  return (
    <section className="set-card">
      <h2>Profile</h2>
      <div className="set-grid">
        <label>Name in greetings<input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
        <label>Time zone<select value={p.timezone} onChange={(e) => setP({ ...p, timezone: e.target.value })}><option>Asia/Vientiane</option><option>Asia/Bangkok</option><option>UTC</option></select></label>
        <label>Week starts<select value={p.weekStart} onChange={(e) => setP({ ...p, weekStart: e.target.value })}><option>Monday</option><option>Sunday</option></select></label>
        <label>Default currency<select value={p.currency} onChange={(e) => setP({ ...p, currency: e.target.value })}><option>LAK</option><option>THB</option><option>USD</option></select></label>
      </div>
      <p className="hint">These are stored with your Esther settings in the vault (Esther/settings.json) so they follow you between computers.</p>
    </section>
  );
}

function Storage() {
  const { data, today, dispatch } = useStore();
  const { say } = useUi();
  const total = data.types.reduce((n, t) => n + recordsOf(data, t.id, today).length, 0);
  return (
    <>
      <section className="set-card">
        <h2>Where your life is stored</h2>
        <p className="lead">Your vault is the single source of truth. Every task, project, person, idea and note is an ordinary Markdown file with properties. Esther keeps a fast index on this computer that it can rebuild from the files at any time.</p>
        <div className="flow">
          <div className="flow-box"><Icon name="layout" size={18} /><b>Esther</b><small>Dashboards, views, editing</small></div>
          <span className="flow-arrow">⇄</span>
          <div className="flow-box"><Icon name="database" size={18} /><b>Local index</b><small>Search, counts, links. Rebuildable</small></div>
          <span className="flow-arrow">⇄</span>
          <div className="flow-box gold"><Icon name="folder" size={18} /><b>Obsidian vault</b><small>Markdown + properties. The truth</small></div>
          <span className="flow-arrow">⇄</span>
          <div className="flow-box"><Icon name="link" size={18} /><b>Google Drive · phone</b><small>Your existing sync</small></div>
        </div>
        <div className="set-grid">
          <label>Vault<input readOnly value={`G:\\My Drive\\${FIXTURE_VAULT_NAME}`} /></label>
          <label>Mode<select disabled defaultValue="sample"><option value="sample">Sample data (prototype)</option><option>Read only</option><option>Read + approved writes</option></select></label>
        </div>
        <p className="status-line off"><i />Not connected. This prototype keeps sample records in your browser only. Your real vault is untouched.</p>
      </section>
      <section className="set-card">
        <h2>Types → folders</h2>
        <p className="lead">Each type is a folder in the vault. Click a folder to change where new notes of that type are created. Existing files are never moved without your approval.</p>
        <table className="set-table">
          <thead><tr><th>Type</th><th>Folder</th><th>Records</th><th>Fields</th><th>Index</th></tr></thead>
          <tbody>
            {data.types.map((t) => (
              <tr key={t.id}>
                <td><span className="type-dot" style={{ background: t.color }} /><Icon name={t.icon} size={13} /> {t.plural}</td>
                <td>{t.id === 'note' ? <code>(any folder)</code> : <Editable label={`Folder for ${t.plural}`} value={t.folder} onSave={(v) => dispatch({ type: 'type/update', id: t.id, patch: { folder: v.trim().replace(/^\/|\/$/g, '') } })} />}</td>
                <td>{recordsOf(data, t.id, today).length}</td>
                <td>{t.fields.length}</td>
                <td><span className="pill paid">Ready</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="form-actions left">
          <span className="muted">{total} records · {data.views.length} saved views · {data.tags.length} tags · {data.dashboards.length} dashboard</span>
          <button className="btn small" onClick={() => say('Index rebuilt from the sample files.')}><Icon name="history" size={12} /> Rebuild index</button>
          <button className="btn small" onClick={() => {
            void navigator.clipboard?.writeText(JSON.stringify(data, null, 2)).then(() => say('All data copied as JSON.'), () => say('Copy was blocked here. In the desktop app this exports to a file.'));
          }}><Icon name="copy" size={12} /> Copy all data (JSON)</button>
        </div>
      </section>
      <section className="set-card">
        <h2>What Esther writes, and where</h2>
        <ul className="plain">
          <li><code>Esther/settings.json</code>: profile, themes, types and fields, dashboards and views (portable between computers)</li>
          <li><code>Esther/Knowledge/</code>: the librarian’s pages and its log</li>
          <li><code>Esther/Assets/</code>: images you upload for dashboards</li>
          <li><code>Esther/Views/*.base</code>: Obsidian Bases files that mirror your saved views</li>
          <li>Records go in their type’s folder. Your existing notes stay where they are</li>
          <li>Never written: <code>.obsidian/</code> plugin settings, credentials, or anything outside the vault</li>
        </ul>
      </section>
    </>
  );
}

function Bridge() {
  const { data } = useStore();
  const [vid, setVid] = useState(data.views[0]?.id ?? '');
  const view = data.views.find((v) => v.id === vid);
  const type = data.types.find((t) => t.id === view?.typeId);
  return (
    <>
      <section className="set-card">
        <h2>Esther Bridge for Obsidian</h2>
        <p className="lead">A small plugin installed in your vault. It lets Esther and Obsidian talk safely while both are open.</p>
        <p className="status-line off"><i />Not installed · planned for the Windows app milestone</p>
        <ul className="feature-list">
          <li><b>Two-way, live</b>: edits in Obsidian appear in Esther at once, and Esther’s approved edits appear in Obsidian</li>
          <li><b>Safe writes</b>: every change is checked against the latest file, backed up, and rejected if the note changed in the meantime</li>
          <li><b>Bases views</b>: your saved views become <code>.base</code> files, so tasks and libraries look good in Obsidian and on your phone</li>
          <li><b>Open in Obsidian</b>: jumps straight to the note or heading</li>
          <li><b>Local only</b>: talks on this computer with a private key. No internet server, no remote pages</li>
        </ul>
      </section>
      <section className="set-card">
        <h2>Preview: a saved view as an Obsidian Base</h2>
        <label className="inline-label">View<select value={vid} onChange={(e) => setVid(e.target.value)}>{data.views.map((v) => <option key={v.id} value={v.id}>{data.types.find((t) => t.id === v.typeId)?.plural} · {v.name}</option>)}</select></label>
        {view && type && <pre className="code-block">{`# Esther/Views/${view.name}.base\n${toBaseFile(view, type)}`}</pre>}
        <p className="hint">Draft format based on Obsidian’s Bases documentation. Board and calendar layouts need a community Bases view and fall back to a table here.</p>
      </section>
    </>
  );
}

const PROVIDERS = [
  { id: 'claude', name: 'Claude', plan: 'Claude Pro (your subscription)', how: 'Connect Claude Desktop to Esther’s local MCP server. Claude can then read your library and propose changes. Nothing to pay beyond Pro.', role: 'Writing & librarian', kind: 'mcp' },
  { id: 'chatgpt', name: 'ChatGPT', plan: 'ChatGPT Plus (your subscription)', how: 'Add Esther as a custom connector in ChatGPT Developer Mode. ChatGPT needs a reachable address, so this needs a secure tunnel. Treat it as advanced.', role: 'Brainstorming', kind: 'mcp' },
  { id: 'gemini', name: 'Gemini', plan: 'Gemini Pro (your subscription)', how: 'Use Gemini through its own apps and tools that support MCP, or a free API key from Google AI Studio for automatic jobs.', role: 'Research & long documents', kind: 'mcp/key' },
  { id: 'deepseek', name: 'DeepSeek', plan: 'API key (pay per use, low cost)', how: 'A DeepSeek API key lets Esther run bulk jobs (tagging, summaries) cheaply in the background.', role: 'Bulk & cheap jobs', kind: 'key' },
  { id: 'jev', name: 'Jev · TypeSafe AI', plan: 'API (early access)', how: 'Jev returns fast typed decisions instead of text: which space and type a capture belongs to, which fields to fill, whether an AI page passes checks.', role: 'Decisions & routing', kind: 'key' },
] as const;

function Ai() {
  const [roles, setRoles] = usePersistentState('ai.roles', { write: 'claude', research: 'gemini', bulk: 'deepseek', decide: 'jev' });
  return (
    <>
      <section className="set-card">
        <h2>AI & models</h2>
        <p className="lead">Esther uses every AI you have, each for what it’s best at. Subscriptions (Claude Pro, ChatGPT Plus, Gemini Pro) connect through MCP, because subscriptions don’t include API keys for other apps. Pay-per-use models use an API key.</p>
        <div className="provider-grid">
          {PROVIDERS.map((p) => (
            <div key={p.id} className="provider">
              <div className="provider-head"><b>{p.name}</b><span className="status-line off"><i />Not connected</span></div>
              <small className="muted">{p.plan}</small>
              <p>{p.how}</p>
              <span className="pill">{p.role}</span>
              {p.kind !== 'mcp' && <input disabled placeholder="API key: entered in the desktop app" aria-label={`${p.name} API key`} />}
            </div>
          ))}
        </div>
        <p className="hint">Keys are stored in Windows Credential Manager by the desktop app, never in the vault, never in Esther’s settings file, and never in this preview.</p>
      </section>
      <section className="set-card">
        <h2>Who does what</h2>
        <div className="set-grid">
          {([['write', 'Writing knowledge pages'], ['research', 'Research'], ['bulk', 'Bulk tagging & summaries'], ['decide', 'Classify captures & check work']] as const).map(([k, label]) => (
            <label key={k}>{label}<select value={roles[k]} onChange={(e) => setRoles({ ...roles, [k]: e.target.value })}>{PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="off">Off</option></select></label>
          ))}
        </div>
      </section>
      <section className="set-card">
        <h2>How the librarian works</h2>
        <ol className="plain">
          <li><b>Capture</b>: anything you drop in Inbox, Journal or a web clip is raw material.</li>
          <li><b>Compile</b>: the librarian writes summary pages in Esther/Knowledge, with [[links]] to people, projects and sources.</li>
          <li><b>Maintain</b>: regular check-ups find contradictions, missing links and new page ideas.</li>
          <li><b>Log</b>: every action is appended to the Librarian log. Changes to your own notes wait for approval.</li>
        </ol>
      </section>
    </>
  );
}

function Permissions() {
  const [p, setP] = usePersistentState('ai.permissions', { policy: 'own-folder', read: ['Inbox', 'Journal', 'Music', 'Seround', 'House', 'People', 'Ideas', 'Planning'], never: ['.obsidian', 'Private'] });
  const folders = ['Inbox', 'Journal', 'Music', 'Seround', 'House', 'People', 'Ideas', 'Planning', 'Private'];
  return (
    <section className="set-card">
      <h2>AI permissions</h2>
      <div className="radio-list" role="radiogroup">
        {([['own-folder', 'Free in its own folder, approval for everything else', 'Recommended. The librarian writes Esther/Knowledge freely. Any change to your notes or tasks is a proposal with a diff.'],
          ['all-approval', 'Approval for every change', 'Nothing is written without your click.'],
          ['trusted', 'Trusted, with undo', 'Writes anywhere; every change is snapshotted and listed so you can undo.']] as const).map(([id, label, desc]) => (
          <label key={id} className={`radio-card${p.policy === id ? ' on' : ''}`}><input type="radio" name="policy" checked={p.policy === id} onChange={() => setP({ ...p, policy: id })} /><span><b>{label}</b><small>{desc}</small></span></label>
        ))}
      </div>
      <h3>Folders the AI may read</h3>
      <div className="chips">
        {folders.map((f) => (
          <label key={f} className={`chip-check${p.read.includes(f) ? ' on' : ''}`}><input type="checkbox" checked={p.read.includes(f)} onChange={() => setP({ ...p, read: p.read.includes(f) ? p.read.filter((x) => x !== f) : [...p.read, f] })} />{f}</label>
        ))}
      </div>
      <p className="hint">Always private: <code>.obsidian/</code>, plugin settings and anything with credentials. Sending note text to an online AI only happens for the folders above, and each provider is shown in the log.</p>
    </section>
  );
}

function Tags() {
  const { data, dispatch } = useStore();
  return (
    <section className="set-card">
      <h2>Tags</h2>
      <p className="hint">Click a name to rename it everywhere. Click a swatch to change its colour.</p>
      <div className="tag-admin">
        {data.tags.map((t) => (
          <span key={t.name} className="tag-admin-row" style={{ '--tag': t.color } as React.CSSProperties}>
            <label className="brand-swatch"><input type="color" aria-label={`Colour for ${t.name}`} value={t.color} onChange={(e) => dispatch({ type: 'tag/update', name: t.name, patch: { color: e.target.value } })} /></label>
            <span className="hash">#</span><Editable label="Tag name" value={t.name} onSave={(v) => dispatch({ type: 'tag/update', name: t.name, patch: { name: v } })} />
            <span className="muted">{data.tasks.filter((x) => x.tags.includes(t.name)).length + data.projects.filter((x) => x.tags.includes(t.name)).length + data.entries.filter((x) => x.tags.includes(t.name)).length + data.notes.filter((x) => x.tags.includes(t.name)).length}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

function History() {
  const { canUndo, undo, resetSampleData } = useStore();
  const { say } = useUi();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <section className="set-card">
        <h2>History & backups</h2>
        <ul className="feature-list">
          <li><b>Undo</b>: Ctrl+Z reverses your last 50 changes in this session.</li>
          <li><b>Snapshots</b>: in the desktop app, Esther copies a note before changing it (outside the sync folder) and can restore it, unless it was edited again since.</li>
          <li><b>Activity log</b>: every write, by you or the librarian, with time, file and source.</li>
        </ul>
        <div className="form-actions left">
          <button className="btn small" disabled={!canUndo} onClick={() => { undo(); say('Undone.'); }}><Icon name="history" size={12} /> Undo last change</button>
        </div>
      </section>
      <section className="set-card">
        <h2>Reset</h2>
        <div className="form-actions left">
          {confirm ? (
            <><span>Replace everything with the original sample data?</span>
              <button className="btn primary small" onClick={() => { resetSampleData(); setConfirm(false); say('Sample data restored.'); }}>Yes, reset</button>
              <button className="btn ghost small" onClick={() => setConfirm(false)}>Cancel</button></>
          ) : <button className="btn small" onClick={() => setConfirm(true)}>Reset sample data</button>}
          <button className="btn small" onClick={() => { clearPrefs(); location.reload(); }}>Reset layouts & preferences</button>
        </div>
      </section>
    </>
  );
}

function About() {
  return (
    <section className="set-card">
      <h2>Status</h2>
      <h3>Working in this prototype</h3>
      <ul className="plain">
        <li>Home dashboard: add, remove, configure, drag and resize widgets; background art; Customize mode</li>
        <li>Tasks board: General, Music (release step bars, artist jobs), Seround (brands, repost queue), House (bills)</li>
        <li>Library: types with smart fields, custom fields on built-in types, your own types, saved views (table, board, gallery, calendar, list)</li>
        <li>Notes: folders, Markdown, [[wikilinks]], backlinks, linked records, librarian proposals (sample)</li>
        <li>Tags, themes, undo, search (Ctrl+K)</li>
      </ul>
      <h3>Not connected yet</h3>
      <ul className="plain">
        <li>Your real vault (next milestone: read only), the Esther Bridge plugin, AI providers, Google Calendar, notifications</li>
        <li>Everything you see uses sample data stored in this browser</li>
      </ul>
    </section>
  );
}
