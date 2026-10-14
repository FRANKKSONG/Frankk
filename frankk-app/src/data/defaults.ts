import { addDays, type ISODate } from '../lib/dates';
import type { Dashboard, Entry, Note, TypeDef, ViewDef } from './schema';

const opt = (value: string, color: string) => ({ value, color });

/** Built-in types map onto Esther's own models; custom fields you add are stored alongside. */
export function defaultTypes(brands: string[]): TypeDef[] {
  return [
    {
      id: 'task', name: 'Task', plural: 'Tasks', icon: 'tasks', color: '#c8553a', folder: 'Planning/Tasks', builtin: true,
      fields: [
        { key: 'done', name: 'Done', kind: 'checkbox', builtin: true },
        { key: 'area', name: 'Area', kind: 'select', builtin: true, options: [opt('general', '#c8553a'), opt('seround', '#d4a03c'), opt('house', '#3f9a80')] },
        { key: 'brand', name: 'Brand', kind: 'select', builtin: true, options: brands.map((b, i) => opt(b, ['#d4a03c', '#3f9a80', '#b44a6e', '#4c6fb8'][i % 4])) },
        { key: 'plan', name: 'Task date', kind: 'date', builtin: true },
        { key: 'due', name: 'Due date', kind: 'date', builtin: true },
        { key: 'priority', name: 'Priority', kind: 'select', builtin: true, options: [opt('high', '#c8553a'), opt('normal', '#7f8a96'), opt('low', '#5a93c4')] },
        { key: 'list', name: 'List', kind: 'text', builtin: true },
        { key: 'tags', name: 'Tags', kind: 'multiselect', builtin: true },
        { key: 'progress', name: 'Progress', kind: 'percent', builtin: true, computed: true },
        { key: 'energy', name: 'Energy', kind: 'select', options: [opt('Deep work', '#4c6fb8'), opt('Light', '#3f9a80'), opt('Errand', '#d4a03c')] },
      ],
    },
    {
      id: 'project', name: 'Music project', plural: 'Music projects', icon: 'music', color: '#4c6fb8', folder: 'Music', builtin: true,
      fields: [
        { key: 'artist', name: 'Artist', kind: 'text', builtin: true },
        { key: 'kind', name: 'Type', kind: 'select', builtin: true, options: [opt('own-release', '#d4a03c'), opt('artist-job', '#4c6fb8')] },
        { key: 'roles', name: 'Roles', kind: 'multiselect', builtin: true },
        { key: 'targetRelease', name: 'Release date', kind: 'date', builtin: true },
        { key: 'progress', name: 'Progress', kind: 'percent', builtin: true, computed: true },
        { key: 'tags', name: 'Tags', kind: 'multiselect', builtin: true },
        { key: 'bpm', name: 'BPM', kind: 'number' },
        { key: 'key', name: 'Key', kind: 'select', options: [opt('A minor', '#4c6fb8'), opt('C major', '#d4a03c'), opt('F# minor', '#8a4f8f')] },
        { key: 'fee', name: 'Fee', kind: 'currency', currency: 'LAK' },
      ],
    },
    {
      id: 'bill', name: 'Bill', plural: 'Bills', icon: 'house', color: '#3f9a80', folder: 'House/Bills', builtin: true,
      fields: [
        { key: 'dueDay', name: 'Due day', kind: 'number', builtin: true },
        { key: 'reminderDays', name: 'Remind (days before)', kind: 'number', builtin: true },
        { key: 'paid', name: 'Paid this month', kind: 'checkbox', builtin: true, computed: true },
        { key: 'provider', name: 'Provider', kind: 'text' },
      ],
    },
    {
      id: 'note', name: 'Note', plural: 'Notes', icon: 'note', color: '#b98a3e', folder: '', builtin: true,
      fields: [
        { key: 'folder', name: 'Folder', kind: 'text', builtin: true, computed: true },
        { key: 'author', name: 'Written by', kind: 'select', builtin: true, computed: true, options: [opt('me', '#7f8a96'), opt('ai', '#8a4f8f')] },
        { key: 'tags', name: 'Tags', kind: 'multiselect', builtin: true },
        { key: 'updated', name: 'Updated', kind: 'date', builtin: true, computed: true },
      ],
    },
    {
      id: 'person', name: 'Person', plural: 'People', icon: 'person', color: '#8a4f8f', folder: 'People',
      fields: [
        { key: 'role', name: 'Role', kind: 'select', options: [opt('Artist', '#4c6fb8'), opt('Client', '#d4a03c'), opt('Team', '#3f9a80'), opt('Family', '#b44a6e'), opt('Friend', '#8a4f8f')] },
        { key: 'phone', name: 'Phone', kind: 'phone' },
        { key: 'email', name: 'Email', kind: 'email' },
        { key: 'birthday', name: 'Birthday', kind: 'date' },
        { key: 'rate', name: 'Rate', kind: 'currency', currency: 'LAK' },
        { key: 'instagram', name: 'Instagram', kind: 'url' },
      ],
    },
    {
      id: 'idea', name: 'Idea', plural: 'Ideas', icon: 'idea', color: '#d4a03c', folder: 'Ideas',
      fields: [
        { key: 'status', name: 'Status', kind: 'select', options: [opt('Spark', '#d4a03c'), opt('Exploring', '#4c6fb8'), opt('Doing', '#3f9a80'), opt('Shelved', '#7f8a96')] },
        { key: 'space', name: 'Space', kind: 'select', options: [opt('Music', '#4c6fb8'), opt('Seround', '#d4a03c'), opt('Design', '#b44a6e'), opt('Life', '#3f9a80')] },
        { key: 'rating', name: 'Excitement', kind: 'rating' },
        { key: 'link', name: 'Reference link', kind: 'url' },
        { key: 'captured', name: 'Captured', kind: 'date' },
      ],
    },
  ];
}

export function defaultEntries(today: ISODate): Entry[] {
  const now = `${today}T09:00:00`;
  const p = (id: string, title: string, props: Record<string, unknown>, tags: string[] = []): Entry =>
    ({ id, typeId: 'person', title, props, tags, created: now, updated: now, path: `People/${title}.md` });
  const i = (id: string, title: string, props: Record<string, unknown>, tags: string[] = []): Entry =>
    ({ id, typeId: 'idea', title, props, tags, created: now, updated: now, path: `Ideas/${title}.md` });
  return [
    p('e-jing', 'Jing', { role: 'Artist', phone: '+856 20 5555 0101', rate: 1500000, birthday: addDays(today, 40) }, ['client']),
    p('e-just', 'Just', { role: 'Artist', instagram: 'https://instagram.com/' }, ['client']),
    p('e-jzero', 'JZero', { role: 'Client', email: 'jzero@example.com', rate: 1200000 }, ['client']),
    p('e-mom', 'Mum', { role: 'Family', birthday: addDays(today, 9) }),
    i('e-lao-pack', 'Lao folk sample pack', { status: 'Exploring', space: 'Music', rating: 5, captured: addDays(today, -6) }, ['surftape']),
    i('e-merch', 'sundey sticker merch', { status: 'Spark', space: 'Seround', rating: 3, captured: addDays(today, -2) }, ['design']),
    i('e-studio', 'Treat the home studio walls', { status: 'Doing', space: 'Life', rating: 4, captured: addDays(today, -14) }, ['home']),
  ];
}

export function defaultNotes(today: ISODate): Note[] {
  const at = (n: number) => `${addDays(today, n)}T10:00:00`;
  const n = (id: string, folder: string, title: string, body: string, extra: Partial<Note> = {}): Note => ({
    id, folder, title, body, tags: [], props: {}, author: 'me', created: at(-3), updated: at(-1),
    path: `${folder ? `${folder}/` : ''}${title}.md`, ...extra,
  });
  return [
    n('n-index', 'Esther/Knowledge', 'Knowledge index',
      '# Knowledge index\n\nMaintained by the Esther librarian. Each page summarises what you have captured and links to the sources.\n\n## Music\n- [[Vocal mixing notes]]\n- [[My next single]]\n\n## Business\n- [[sundey reposting playbook]]\n\n## Log\nSee [[Librarian log]].',
      { author: 'ai', pinned: true, tags: ['index'], updated: at(0) }),
    n('n-vocal', 'Esther/Knowledge', 'Vocal mixing notes',
      '# Vocal mixing notes\n\n> Compiled from your session notes for [[Jing]] and [[JZero]].\n\n- Start with **subtractive EQ** before compression.\n- Two compressors in series sound more natural than one heavy one.\n- De-ess after the compressors.\n\nRelated: [[My next single]], [[Lao folk sample pack]].',
      { author: 'ai', tags: ['music', 'mixing'], updated: at(0) }),
    n('n-playbook', 'Esther/Knowledge', 'sundey reposting playbook',
      '# sundey reposting playbook\n\n1. Pick clips with a clear first second.\n2. Caption in Lao first, then English.\n3. Post between 18:00 and 20:00.\n\nSource: [[2026-10-14]] daily note.',
      { author: 'ai', tags: ['seround'] }),
    n('n-log', 'Esther/Knowledge', 'Librarian log',
      '# Librarian log\n\n- Created [[Vocal mixing notes]] from 2 session notes.\n- Linked [[sundey reposting playbook]] to the daily note.\n- Proposed adding a "BPM" field to Music projects (waiting for approval).',
      { author: 'ai', updated: at(0) }),
    n('n-daily', 'Journal', '2026-10-14',
      '# Wednesday\n\n- [ ] Record vocals with [[Jing]]\n- Idea: a [[Lao folk sample pack]] for Surftape.\n- Reposting works better in the evening — tell Esther.',
      { tags: ['daily'], updated: at(0) }),
    n('n-single', 'Music/Releases', 'My next single',
      '# My next single\n\nWorking title. Bassline is the next step.\n\nReferences: warm Rhodes, lazy drums.\n\nSee [[Vocal mixing notes]].', { tags: ['surftape'] }),
    n('n-inbox', 'Inbox', 'Things to remember',
      '- Ask JZero for stems by Friday\n- Electricity provider changed account number\n- Book room for recording', { updated: at(0) }),
  ];
}

export function defaultViews(): ViewDef[] {
  return [
    { id: 'v-tasks-board', typeId: 'task', name: 'Tasks by priority', layout: 'board', filters: [{ field: 'done', op: 'is', value: 'false' }], groupBy: 'priority', fields: ['due', 'tags'] },
    { id: 'v-tasks-cal', typeId: 'task', name: 'Task calendar', layout: 'calendar', filters: [], dateField: 'due', fields: [] },
    { id: 'v-people', typeId: 'person', name: 'All people', layout: 'table', filters: [], sort: { field: 'title', dir: 'asc' }, fields: ['role', 'phone', 'birthday', 'rate'] },
    { id: 'v-ideas', typeId: 'idea', name: 'Idea board', layout: 'board', filters: [], groupBy: 'status', fields: ['space', 'rating'] },
    { id: 'v-projects', typeId: 'project', name: 'Projects gallery', layout: 'gallery', filters: [], fields: ['kind', 'progress', 'targetRelease'] },
  ];
}

export function defaultDashboard(): Dashboard {
  const W = (id: string, kind: Dashboard['widgets'][number]['kind'], title: string, config: Dashboard['widgets'][number]['config'] = {}, color?: string) => ({ id, kind, title, config, color });
  return {
    id: 'd-home', name: 'Home', background: 'millefleur', dim: 0.78,
    widgets: [
      W('w-due', 'stat', 'Due today', { metric: 'due-today' }, '#d4a03c'),
      W('w-over', 'stat', 'Overdue', { metric: 'overdue' }, '#c8553a'),
      W('w-bills', 'stat', 'Bills unpaid', { metric: 'bills-unpaid' }, '#3f9a80'),
      W('w-rel', 'stat', 'Next single', { metric: 'release-progress' }, '#4c6fb8'),
      W('w-today', 'today', 'Today'),
      W('w-week', 'week', 'This week'),
      W('w-music', 'music', 'Music'),
      W('w-money', 'money', 'Money & bills'),
      W('w-notes', 'notes-recent', 'From the library'),
      W('w-capture', 'capture', 'Quick capture'),
      W('w-ideas', 'view', 'Ideas', { viewId: 'v-ideas' }),
    ],
    layout: [
      { i: 'w-due', x: 0, y: 0, w: 6, h: 3 }, { i: 'w-over', x: 6, y: 0, w: 6, h: 3 }, { i: 'w-bills', x: 12, y: 0, w: 6, h: 3 }, { i: 'w-rel', x: 18, y: 0, w: 6, h: 3 },
      { i: 'w-today', x: 0, y: 3, w: 8, h: 9 }, { i: 'w-week', x: 8, y: 3, w: 16, h: 4 }, { i: 'w-music', x: 8, y: 7, w: 9, h: 5 }, { i: 'w-money', x: 17, y: 7, w: 7, h: 5 },
      { i: 'w-capture', x: 0, y: 12, w: 8, h: 5 }, { i: 'w-notes', x: 8, y: 12, w: 7, h: 5 }, { i: 'w-ideas', x: 15, y: 12, w: 9, h: 5 },
    ],
  };
}
