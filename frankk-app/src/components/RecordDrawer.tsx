import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons';
import { FieldValue } from './FieldValue';
import { TagChips, TagPicker } from './Tags';
import { Editable } from './Editable';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { recordsOf } from '../lib/records';
import { KIND_ICON, toMarkdown } from '../data/schema';

/** Detail panel for any record: every field with its smart editor, plus the exact file it maps to in the vault. */
export function RecordDrawer({ typeId, id, onClose }: { typeId: string; id: string; onClose: () => void }) {
  const { data, today, dispatch } = useStore();
  const { openNote } = useUi();
  const type = data.types.find((t) => t.id === typeId);
  const rec = type ? recordsOf(data, typeId, today).find((r) => r.id === id) : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!type || !rec) return null;
  const entry = data.entries.find((e) => e.id === id);
  const props: Record<string, unknown> = { type: type.id };
  for (const f of type.fields) if (!f.computed) props[f.key] = rec.get(f.key);
  if (rec.tags.length) props.tags = rec.tags;

  return createPortal(
    <aside className="drawer" role="dialog" aria-label={`Details: ${rec.title}`} style={{ '--area': type.color } as React.CSSProperties}>
      <header>
        <span className="area-tag"><Icon name={type.icon} size={14} /> {type.name}</span>
        <button className="icon-btn" aria-label="Close details" onClick={onClose}><Icon name="close" /></button>
      </header>
      <div className="drawer-body">
        <div className="rec-head"><Editable className="rec-big-title" label="Name" value={rec.title} onSave={(v) => dispatch({ type: 'record/set', typeId, id, key: 'title', value: v })} /></div>
        <div className="prop-grid">
          {type.fields.filter((f) => f.key !== 'tags').map((f) => (
            <div key={f.key} className="prop-row">
              <span className="prop-name"><span className="kind-ico">{KIND_ICON[f.kind]}</span>{f.name}</span>
              <span className="prop-val"><FieldValue type={type} field={f} recId={id} value={rec.get(f.key)} /></span>
            </div>
          ))}
          <div className="prop-row"><span className="prop-name"><span className="kind-ico">#</span>Tags</span>
            <span className="prop-val tag-line"><TagChips names={rec.tags} small /><TagPicker compact value={rec.tags} onChange={(tags) => dispatch({ type: 'record/set', typeId, id, key: 'tags', value: tags })} /></span></div>
        </div>
        {entry && (
          <label className="field">Notes
            <textarea rows={5} defaultValue={entry.body ?? ''} placeholder="Write anything about this…"
              onBlur={(e) => dispatch({ type: 'record/set', typeId, id, key: 'body', value: e.target.value })} />
          </label>
        )}
        <div className="file-preview">
          <div className="file-head"><Icon name="note" size={12} /> <code>{rec.path}</code>
            <button className="btn small" onClick={() => openNote(rec.path)}><Icon name="external" size={12} /> Open in Obsidian</button></div>
          <pre>{toMarkdown(props, entry?.props.body ? String(entry.props.body) : '')}</pre>
          <p className="hint">This is exactly how this record is stored in your vault: one Markdown note with properties Obsidian and Bases can read.</p>
        </div>
        {entry && <button className="btn small ghost" onClick={() => { dispatch({ type: 'entry/archive', id, archived: true }); onClose(); }}>Archive (keeps the file)</button>}
      </div>
    </aside>,
    document.body,
  );
}
