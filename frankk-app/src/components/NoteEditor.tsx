import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';

/** Markdown out of the editor, with Obsidian's own syntax left as written ([[links]], #tags). */
function markdownOf(editor: Editor): string | undefined {
  if (editor.isDestroyed) return undefined;
  const md = (editor.storage as unknown as { markdown?: { getMarkdown(): string } }).markdown?.getMarkdown();
  if (md === undefined) return undefined;
  return md.replace(/\\\[\\\[/g, '[[').replace(/\\\]\\\]/g, ']]').replace(/\\\[(?=\[)|(?<=\[)\\\[/g, '[').replace(/\\#/g, '#').replace(/\\_/g, '_');
}

/** The wikilink under a click, if any: "[[Jing]]" → "Jing". */
function linkAt(editor: Editor, pos: number): string | undefined {
  const $pos = editor.state.doc.resolve(pos);
  const text = $pos.parent.textContent;
  const at = $pos.parentOffset;
  for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) if (m.index! <= at && at <= m.index! + m[0].length) return m[1].split('|')[0].trim();
  return undefined;
}

type Btn = { label: string; title: string; on: (e: Editor) => void; active?: (e: Editor) => boolean };
const TOOLS: (Btn | '|')[] = [
  { label: 'H1', title: 'Heading 1', on: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), active: (e) => e.isActive('heading', { level: 1 }) },
  { label: 'H2', title: 'Heading 2', on: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive('heading', { level: 2 }) },
  { label: 'H3', title: 'Heading 3', on: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive('heading', { level: 3 }) },
  '|',
  { label: 'B', title: 'Bold (Ctrl+B)', on: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
  { label: 'I', title: 'Italic (Ctrl+I)', on: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
  { label: 'U', title: 'Underline (Ctrl+U)', on: (e) => e.chain().focus().toggleUnderline().run(), active: (e) => e.isActive('underline') },
  { label: 'S', title: 'Strikethrough', on: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive('strike') },
  { label: 'Hi', title: 'Highlight', on: (e) => e.chain().focus().toggleHighlight().run(), active: (e) => e.isActive('highlight') },
  '|',
  { label: '•', title: 'Bullet list', on: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
  { label: '1.', title: 'Numbered list', on: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
  { label: '☑', title: 'Checklist', on: (e) => e.chain().focus().toggleTaskList().run(), active: (e) => e.isActive('taskList') },
  '|',
  { label: '❝', title: 'Quote', on: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive('blockquote') },
  { label: '</>', title: 'Code', on: (e) => e.chain().focus().toggleCodeBlock().run(), active: (e) => e.isActive('codeBlock') },
  { label: '—', title: 'Divider', on: (e) => e.chain().focus().setHorizontalRule().run() },
  { label: '🔗', title: 'Web link (select text first)', on: () => {}, active: (e) => e.isActive('link') },
  { label: '[[ ]]', title: 'Link a note, person or project', on: (e) => e.chain().focus().insertContent('[[]]').setTextSelection(e.state.selection.from + 2).run() },
  '|',
  { label: '↶', title: 'Undo (Ctrl+Z)', on: (e) => e.chain().focus().undo().run() },
  { label: '↷', title: 'Redo (Ctrl+Shift+Z)', on: (e) => e.chain().focus().redo().run() },
];

/**
 * A word-processor for notes and journal pages that saves Markdown, so every page stays an ordinary Obsidian file.
 * Saves as you type (after a short pause). Ctrl+click a [[link]] to open it.
 */
/** Give it key={note.id}: each note gets its own editor. */
export function NoteEditor({ markdown, onChange, onLink, placeholder }: { markdown: string; onChange: (md: string) => void; onLink: (target: string) => void; placeholder?: string }) {
  const changeRef = useRef(onChange); changeRef.current = onChange;
  const linkRef = useRef(onLink); linkRef.current = onLink;
  const timer = useRef<number | undefined>(undefined);
  // The latest unsaved text and where it belongs, taken while the editor is alive, so leaving a note never loses it.
  const pending = useRef<{ md: string; save: (md: string) => void } | null>(null);
  const flush = () => { window.clearTimeout(timer.current); const p = pending.current; pending.current = null; if (p) p.save(p.md); };
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      TaskList, TaskItem.configure({ nested: true }),
      Highlight,
      Placeholder.configure({ placeholder: placeholder ?? 'Write… Type # for a heading, - for a list, [ ] for a checklist, [[ to link.' }),
      Markdown.configure({ html: false, tightLists: true, bulletListMarker: '-', linkify: true, breaks: false, transformPastedText: true }),
    ],
    content: markdown,
    editorProps: {
      attributes: { class: 'md note-doc', 'aria-label': 'Note text', spellcheck: 'true' },
      handleClick: (view, pos, ev) => {
        if (!(ev.ctrlKey || ev.metaKey)) return false;
        const ed = (view as unknown as { editor?: Editor }).editor ?? editorRef.current;
        const target = ed && linkAt(ed, pos);
        if (target) { linkRef.current(target); return true; }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = markdownOf(ed);
      if (md === undefined) return;
      pending.current = { md, save: changeRef.current };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 500);
    },
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // Save straight away when leaving the note.
  useEffect(() => flush, []);

  // If the page changes from elsewhere (a phone capture lands in today's journal), show it unless you're typing.
  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isFocused || pending.current) return;
    const now = markdownOf(editor);
    if (now !== undefined && now.trim() !== markdown.trim()) editor.commands.setContent(markdown, { emitUpdate: false });
  }, [markdown, editor]);

  const [linking, setLinking] = useState<string | null>(null);
  const applyLink = () => {
    if (!editor || linking === null) return;
    const url = linking.trim();
    if (!url) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` }).run();
    setLinking(null);
  };
  const state = useEditorState({ editor, selector: ({ editor: e }) => (e ? TOOLS.map((t) => (t !== '|' && t.active ? t.active(e) : false)) : []) });
  if (!editor) return null;
  return (
    <div className="note-editor-wrap">
      <div className="note-toolbar" role="toolbar" aria-label="Formatting">
        {TOOLS.map((t, i) => (t === '|' ? <span key={i} className="tb-sep" /> : (
          <button key={i} type="button" className={`tb-btn${state?.[i] ? ' on' : ''}`} title={t.title} aria-label={t.title} aria-pressed={!!state?.[i]}
            onMouseDown={(e) => e.preventDefault()} onClick={() => (t.label === '🔗' ? setLinking((editor.getAttributes('link').href as string | undefined) ?? '') : t.on(editor))}>{t.label}</button>
        )))}
        {linking !== null && (
          <span className="tb-link">
            <input autoFocus value={linking} placeholder="Paste a web address, or leave empty to remove the link" aria-label="Link address"
              onChange={(e) => setLinking(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') setLinking(null); }} />
            <button type="button" className="tb-btn" onClick={applyLink}>Link</button>
          </span>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
