import { useMemo, useState } from 'react';
import { Icon } from '../components/Icons';
import { ColorSelect } from '../components/ColorSelect';
import { Editable } from '../components/Editable';
import { DataView } from '../components/DataView';
import { FieldsPanel } from '../components/FieldsPanel';
import { NewTypeDialog } from '../components/NewTypeDialog';
import { RecordDrawer } from '../components/RecordDrawer';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { recordsOf, type Rec } from '../lib/records';
import { newId } from '../data/fixtures';
import { PIGMENTS } from '../data/types';
import type { ViewDef } from '../data/schema';
import { usePersistentState } from '../hooks/usePersistentState';

/** Library: every type of thing in your life, with its fields and saved views. */
export function LibraryPage() {
  const { data, today, dispatch } = useStore();
  const { openTask, setNewTask, setProjectDialog, say } = useUi();
  const [sel, setSel] = usePersistentState<{ type: string; view: string }>('library.sel', { type: 'person', view: 'v-people' });
  const [tab, setTab] = useState<'records' | 'fields'>('records');
  const [newType, setNewType] = useState(false);
  const [open, setOpen] = useState<Rec | null>(null);
  const type = data.types.find((t) => t.id === sel.type) ?? data.types[0];
  const views = data.views.filter((v) => v.typeId === type.id);
  const fallback: ViewDef = useMemo(() => ({ id: `v-auto-${type.id}`, typeId: type.id, name: `All ${type.plural.toLowerCase()}`, layout: 'table', filters: [], fields: type.fields.slice(0, 5).map((f) => f.key) }), [type]);
  const view = views.find((v) => v.id === sel.view) ?? views[0] ?? fallback;

  const onOpen = (r: Rec) => (r.typeId === 'task' ? openTask(r.id) : setOpen(r));
  const addRecord = () => {
    if (type.id === 'task') return setNewTask({ area: 'general' });
    if (type.id === 'project') return setProjectDialog(true);
    if (type.id === 'bill') return setNewTask({ area: 'house' });
    const now = new Date().toISOString().slice(0, 19);
    const id = newId('e');
    if (type.id === 'note') {
      dispatch({ type: 'note/add', note: { id, title: 'Untitled note', folder: 'Inbox', body: '', tags: [], props: {}, author: 'me', created: now, updated: now, path: `Inbox/Untitled note ${id.slice(-4)}.md` } });
      return say('Note created in Inbox. Open the Notes page to write it.', true);
    }
    dispatch({ type: 'entry/add', entry: { id, typeId: type.id, title: `New ${type.name.toLowerCase()}`, props: {}, tags: [], created: now, updated: now, path: `${type.folder}/New ${type.name.toLowerCase()} ${id.slice(-4)}.md` } });
    setOpen({ id, typeId: type.id, title: '', tags: [], path: '', get: () => undefined });
  };

  return (
    <div className="page-wide library">
      <aside className="lib-types">
        <h2>Types</h2>
        {data.types.map((t) => (
          <button key={t.id} className={`lib-type${t.id === type.id ? ' on' : ''}`} style={{ '--c': t.color } as React.CSSProperties}
            onClick={() => setSel({ type: t.id, view: data.views.find((v) => v.typeId === t.id)?.id ?? '' })}>
            <Icon name={t.icon} size={15} /><span>{t.plural}</span><em>{recordsOf(data, t.id, today).length}</em>
          </button>
        ))}
        <button className="btn small" onClick={() => setNewType(true)}><Icon name="plus" size={13} /> New type</button>
        <p className="hint">Each type is a folder of Markdown notes in your vault. Fields are their properties.</p>
      </aside>
      <section className="lib-main" style={{ '--area': type.color } as React.CSSProperties}>
        <header className="lib-head">
          <span className="lib-icon"><Icon name={type.icon} size={20} /></span>
          <Editable className="lib-title" label="Type name" value={type.plural} onSave={(v) => dispatch({ type: 'type/update', id: type.id, patch: { plural: v.trim() } })} />
          <ColorSelect label="Type colour" value={type.color ?? PIGMENTS[0].color} onChange={(color) => dispatch({ type: 'type/update', id: type.id, patch: { color } })} />
          <code className="lib-folder" title="Vault folder">{type.folder || '(by folder)'}/</code>
          <span className="dv-spacer" />
          <div className="seg slim" role="tablist">
            <button role="tab" aria-selected={tab === 'records'} onClick={() => setTab('records')}>Records</button>
            <button role="tab" aria-selected={tab === 'fields'} onClick={() => setTab('fields')}>Fields · {type.fields.length}</button>
          </div>
          <button className="btn primary small" onClick={addRecord}><Icon name="plus" size={13} /> New {type.name.toLowerCase()}</button>
        </header>
        {tab === 'fields' ? <FieldsPanel type={type} /> : (
          <>
            <nav className="view-tabs" aria-label="Saved views">
              {(views.length ? views : [fallback]).map((v) => (
                <button key={v.id} className={v.id === view.id ? 'on' : ''} onClick={() => setSel({ type: type.id, view: v.id })}>{v.name}</button>
              ))}
              <button className="add" onClick={() => {
                const v: ViewDef = { ...fallback, id: newId('v'), name: `View ${views.length + 1}` };
                dispatch({ type: 'view/save', view: v }); setSel({ type: type.id, view: v.id });
              }}><Icon name="plus" size={12} /> View</button>
            </nav>
            <DataView key={view.id + type.id} type={type} view={view} onOpen={onOpen} />
          </>
        )}
      </section>
      {newType && <NewTypeDialog onClose={() => setNewType(false)} onCreated={(id) => { setNewType(false); setSel({ type: id, view: `v-${id}` }); setTab('fields'); }} />}
      {open && <RecordDrawer typeId={open.typeId} id={open.id} onClose={() => setOpen(null)} />}
    </div>
  );
}
