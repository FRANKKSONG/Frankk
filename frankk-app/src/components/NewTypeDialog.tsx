import { useState } from 'react';
import { Modal } from './Modal';
import { Icon, type IconName } from './Icons';
import { ColorSelect } from './ColorSelect';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { PIGMENTS } from '../data/types';
import { fieldKey, inferKind, KIND_ICON, KIND_LABEL, type FieldDef } from '../data/schema';

const ICONS: IconName[] = ['person', 'idea', 'library', 'music', 'house', 'tasks', 'calendar', 'link', 'note', 'tag', 'image', 'bolt', 'shield', 'database'];

/** Suggested starter fields by what the type sounds like. */
function suggest(name: string): string[] {
  const n = name.toLowerCase();
  if (/client|customer|contact|person|people|friend/.test(n)) return ['Email', 'Phone', 'Company', 'Rate', 'Birthday', 'Status'];
  if (/book|read|course|learn/.test(n)) return ['Author', 'Status', 'Rating', 'Started date', 'Finished date', 'Link'];
  if (/song|track|beat|sample/.test(n)) return ['BPM', 'Key', 'Genre', 'Status', 'Length minutes', 'Link'];
  if (/gear|equipment|asset|item/.test(n)) return ['Price', 'Purchase date', 'Status', 'Serial number', 'Link'];
  if (/expense|income|payment|invoice|money/.test(n)) return ['Amount', 'Date', 'Category', 'Paid', 'Client'];
  if (/habit|routine|health|workout/.test(n)) return ['Frequency', 'Status', 'Streak count', 'Last date'];
  return ['Status', 'Date', 'Notes', 'Link'];
}

export function NewTypeDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { dispatch, data } = useStore();
  const { say } = useUi();
  const [name, setName] = useState('');
  const [plural, setPlural] = useState('');
  const [icon, setIcon] = useState<IconName>('database');
  const [color, setColor] = useState(PIGMENTS[5].color);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const sugg = suggest(name);
  const id = fieldKey(name || 'type');
  const taken = data.types.some((t) => t.id === id);

  const create = () => {
    if (!name.trim() || taken) return;
    const fields: FieldDef[] = [...picked].map((n) => {
      const kind = inferKind(n);
      return { key: fieldKey(n), name: n, kind, ...(kind === 'select' || kind === 'multiselect' ? { options: [] } : {}), ...(kind === 'currency' ? { currency: 'LAK' } : {}), ...(kind === 'relation' ? { relationType: 'person' } : {}) };
    });
    const pl = plural.trim() || `${name.trim()}s`;
    dispatch({ type: 'type/add', def: { id, name: name.trim(), plural: pl, icon, color, folder: pl, fields } });
    dispatch({ type: 'view/save', view: { id: `v-${id}`, typeId: id, name: `All ${pl.toLowerCase()}`, layout: 'table', filters: [], fields: fields.map((f) => f.key) } });
    say(`Type “${name.trim()}” created. Its notes will live in “${pl}/”.`, true);
    onCreated(id);
  };

  return (
    <Modal title="New type" onClose={onClose} wide>
      <form className="dialog-form" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <div className="form-row">
          <label className="field big">Name<input id="nty-name" autoFocus value={name} placeholder="e.g. Client, Book, Song, Gear…" onChange={(e) => { setName(e.target.value); setPicked(new Set()); }} /></label>
          <label className="field big">Plural<input id="nty-plural" value={plural} placeholder={name ? `${name}s` : 'Clients'} onChange={(e) => setPlural(e.target.value)} /></label>
        </div>
        {taken && <p className="hint warn-text">A type with this name already exists.</p>}
        <div className="field">Icon<span className="icon-row">{ICONS.map((i) => (
          <button key={i} type="button" className={`icon-pick${icon === i ? ' on' : ''}`} aria-label={`Icon ${i}`} onClick={() => setIcon(i)}><Icon name={i} size={16} /></button>
        ))}</span></div>
        <div className="field">Colour<ColorSelect label="Type colour" value={color} onChange={setColor} /></div>
        <fieldset>
          <legend>Starter fields {name && <span className="muted">· suggested for “{name}”</span>}</legend>
          <div className="chips">
            {sugg.map((s) => {
              const k = inferKind(s);
              return (
                <label key={s} className={`chip-check${picked.has(s) ? ' on' : ''}`}>
                  <input type="checkbox" checked={picked.has(s)} onChange={() => setPicked((p) => { const n = new Set(p); if (!n.delete(s)) n.add(s); return n; })} />
                  {KIND_ICON[k]} {s} <small>{KIND_LABEL[k]}</small>
                </label>
              );
            })}
          </div>
          <p className="hint">You can add, rename and change fields any time. Each field becomes a property in the type’s Obsidian notes.</p>
        </fieldset>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!name.trim() || taken}>Create type</button>
        </div>
      </form>
    </Modal>
  );
}
