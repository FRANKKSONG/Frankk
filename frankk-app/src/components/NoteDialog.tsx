import { Modal } from './Modal';
import { useUi } from '../ui';
import { obsidianUri } from '../lib/obsidian';

/** Milestone 1 never launches Obsidian: this only shows the link the real app would open. */
export function NoteDialog() {
  const { noteDialog, openNote, say } = useUi();
  if (!noteDialog) return null;
  const uri = obsidianUri(noteDialog);
  return (
    <Modal title="Open in Obsidian" onClose={() => openNote(null)}>
      <p><span className="pill sim">Simulated</span> This is sample data, so this note doesn’t exist in your vault. The connected app will open the real note with this official Obsidian link:</p>
      <code className="uri">{uri}</code>
      <div className="form-actions">
        <button className="btn ghost" onClick={() => openNote(null)}>Close</button>
        <button className="btn primary" onClick={() => { void navigator.clipboard?.writeText(uri).then(() => say('Link copied.'), () => say('Couldn’t copy — select the link and copy it.')); }}>Copy link</button>
      </div>
    </Modal>
  );
}
