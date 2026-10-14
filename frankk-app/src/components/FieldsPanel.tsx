import { useState } from 'react';
import { Icon } from './Icons';
import { Editable } from './Editable';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { fieldKey, inferKind, KIND_ICON, KIND_LABEL, type FieldKind, type TypeDef } from '../data/schema';

const KINDS = Object.keys(KIND_LABEL) as FieldKind[];

/** Manage a type's fields. Typing a name (and optionally an example) suggests the right kind. */
export function FieldsPanel({ type }: { type: TypeDef }) {
  const { dispatch, data } = useStore();
  const { say } = useUi();
  const [name, setName] = useState('');
  const [sample, setSample] = useState('');
  const [kind, setKind] = useState<FieldKind | null>(null);
  const guess = inferKind(name, sample);
  const chosen = kind ?? guess;

  const add = () => {
    if (!name.trim()) return;
    const key = fieldKey(name);
    dispatch({ type: 'field/add', typeId: type.id, field: { key, name: name.trim(), kind: chosen, ...(chosen === 'currency' ? { currency: 'LAK' } : {}), ...(chosen === 'relation' ? { relationType: 'person' } : {}), ...(chosen === 'select' || chosen === 'multiselect' ? { options: [] } : {}) } });
    say(`Field “${name.trim()}” added as ${KIND_LABEL[chosen]}. It will be a property in every ${type.name} note.`, true);
    setName(''); setSample(''); setKind(null);
  };

  return (
    <div className="fields-panel">
      <ul className="field-list">
        {type.fields.map((f) => (
          <li key={f.key}>
            <span className="kind-ico big">{KIND_ICON[f.kind]}</span>
            <Editable label="Field name" value={f.name} onSave={(v) => dispatch({ type: 'field/update', typeId: type.id, key: f.key, patch: { name: v.trim() } })} />
            <code className="fkey">{f.key}</code>
            {f.builtin
              ? <span className="pill">{f.computed ? 'Automatic' : 'Built-in'} · {KIND_LABEL[f.kind]}</span>
              : (
                <select aria-label={`Kind of ${f.name}`} value={f.kind} onChange={(e) => dispatch({ type: 'field/update', typeId: type.id, key: f.key, patch: { kind: e.target.value as FieldKind } })}>
                  {KINDS.map((k) => <option key={k} value={k}>{KIND_ICON[k]} {KIND_LABEL[k]}</option>)}
                </select>
              )}
            {f.kind === 'relation' && !f.builtin && (
              <select aria-label="Links to" value={f.relationType ?? 'person'} onChange={(e) => dispatch({ type: 'field/update', typeId: type.id, key: f.key, patch: { relationType: e.target.value } })}>
                {data.types.map((t) => <option key={t.id} value={t.id}>→ {t.plural}</option>)}
              </select>
            )}
            {!f.builtin && <button className="icon-btn tiny" aria-label={`Remove field ${f.name}`} title="Remove field (values stay in your notes)" onClick={() => { dispatch({ type: 'field/remove', typeId: type.id, key: f.key }); say(`Field “${f.name}” removed. Values already in notes are kept.`, true); }}><Icon name="close" size={11} /></button>}
          </li>
        ))}
      </ul>
      <div className="field-add">
        <input aria-label="New field name" placeholder="New field, e.g. Budget, Release date, BPM…" value={name} onChange={(e) => { setName(e.target.value); setKind(null); }} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <input aria-label="Example value (optional)" placeholder="Example value (optional)" value={sample} onChange={(e) => { setSample(e.target.value); setKind(null); }} />
        <select aria-label="Field kind" value={chosen} onChange={(e) => setKind(e.target.value as FieldKind)}>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_ICON[k]} {KIND_LABEL[k]}{!kind && k === guess && name ? ' (detected)' : ''}</option>)}
        </select>
        <button className="btn primary small" disabled={!name.trim()} onClick={add}>Add field</button>
      </div>
      {name && !kind && <p className="hint">Detected: <b>{KIND_LABEL[guess]}</b>. Change it if that’s not right.</p>}
    </div>
  );
}
