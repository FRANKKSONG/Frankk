import { addDays, monthKey, addMonths, type ISODate } from '../lib/dates';
import type { AppData, Stage, Task } from './types';
import { BRANDS } from './types';
import { defaultDashboard, defaultEntries, defaultNotes, defaultTypes, defaultViews } from './defaults';

let seq = 0;
export const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const steps = (id: string, items: [string, boolean][]) =>
  items.map(([text, done], i) => ({ id: `${id}-s${i}`, text, done }));

const stage = (id: string, name: string, p: Partial<Stage> = {}): Stage => ({
  id: `${id}-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
  name,
  inScope: true,
  done: false,
  items: [],
  ...p,
});

type T = Omit<Task, 'mode' | 'tags' | 'priority' | 'steps'> & Partial<Pick<Task, 'mode' | 'tags' | 'priority' | 'steps'>>;
const task = (t: T): Task => ({ mode: 'progress', tags: [], priority: 'normal', steps: [], ...t });

/** Sample data, with dates relative to `today` so the board always looks alive. SAMPLE ONLY. */
export function buildFixtures(today: ISODate): AppData {
  const d = (n: number) => addDays(today, n);
  const thisMonth = monthKey(today);
  const lastMonth = addMonths(thisMonth, -1);
  const [sundey, eli, reva] = BRANDS;
  const repost = (id: string, title: string, plan: number, done = false): Task => task({
    id, title, area: 'seround', done, plan: d(plan), mode: 'simple', brand: sundey, workstream: 'content',
    content: { destination: 'Facebook page', repostStatus: done ? 'posted' : 'queued' }, notePath: `Seround/sundey/Reposts/${title}.md`,
  });

  const tasks: Task[] = [
    task({ id: 't-food', title: 'Clean food box', notes: 'The blue lunch box from the office fridge', props: { energy: 'Errand' }, area: 'general', done: false, plan: today, due: d(1), list: 'Home admin', tags: ['home'],
      steps: steps('t-food', [['Empty box', true], ['Wash & dry', true], ['Put away', false]]), notePath: 'Planning/Tasks/Clean food box.md' }),
    task({ id: 't-dentist', title: 'Book dentist', notes: 'Check-up and cleaning; ask about the back molar', area: 'general', done: false, plan: d(2), due: d(4), mode: 'simple', tags: ['health'], notePath: 'Planning/Tasks/Book dentist.md' }),
    task({ id: 't-budget', title: 'Review budget', notes: 'October statements; flag subscriptions to cancel', props: { energy: 'Deep work' }, area: 'general', done: false, plan: d(2), due: d(6), priority: 'high', list: 'Admin', tags: ['money'],
      steps: steps('t-budget', [['Export statements', true], ['Categorise spending', false], ['Compare with last month', false], ['Note changes', false]]), notePath: 'Planning/Tasks/Review budget.md' }),
    task({ id: 't-landlord', title: 'Call landlord about the gate', area: 'general', done: false, due: d(-2), priority: 'high', mode: 'simple', tags: ['home', 'urgent'], notePath: 'Planning/Tasks/Call landlord about the gate.md' }),
    task({ id: 't-course', title: 'Finish colour theory course', area: 'general', done: false, plan: d(5), tags: ['learning'],
      steps: steps('t-course', [['Module 1', true], ['Module 2', true], ['Module 3', false], ['Module 4', false], ['Final project', false]]), notePath: 'Planning/Tasks/Finish colour theory course.md' }),
    task({ id: 't-photos', title: 'Renew passport photos', area: 'general', done: true, plan: d(-3), due: d(-1), priority: 'low',
      steps: steps('t-photos', [['Find studio', true], ['Print copies', true]]), notePath: 'Planning/Tasks/Renew passport photos.md' }),

    repost('s-rp1', 'Market morning clip', -1, true),
    repost('s-rp2', 'Noodle stall clip', 0),
    repost('s-rp3', 'Weekend promo clip', 1),
    repost('s-rp4', 'Customer review clip', 3),
    task({ id: 's-backend', title: 'Build operations backend', notes: 'Order tracking + repost schedule in one sheet for the team', area: 'seround', done: false, due: d(11), brand: sundey, workstream: 'backend', tags: ['systems'],
      steps: steps('s-backend', [['List current manual jobs', true], ['Choose data model', false], ['Prototype order sheet', false], ['Test with team', false], ['Roll out', false]]),
      notePath: 'Seround/sundey/Build operations backend.md' }),
    task({ id: 's-pack', title: 'Review packaging', notes: 'Final proofs from the printer; match the green to the logo', area: 'seround', done: false, due: d(7), brand: eli, workstream: 'brand', tags: ['design'],
      steps: steps('s-pack', [['Check proofs', true], ['Confirm colours', false], ['Approve print', false]]), notePath: 'Seround/Eli Lao Origin/Review packaging.md' }),
    task({ id: 's-campaign', title: 'Prepare next campaign', notes: 'Holiday gift sets: shoot list, captions, launch date', area: 'seround', done: false, due: d(11), brand: reva, workstream: 'brand', tags: ['design'],
      steps: steps('s-campaign', [['Define goal', false], ['Moodboard', false], ['Shot list', false], ['Copy draft', false], ['Review', false]]), notePath: 'Seround/Reva Gem Cosmentics/Prepare next campaign.md' }),

    task({ id: 'h-reset', title: 'House reset', area: 'house', done: false, plan: d(((7 - new Date(today + 'T00:00').getDay()) % 7) || 7), tags: ['home'],
      steps: steps('h-reset', [['Laundry', true], ['Floors', false], ['Bins', false], ['Fridge check', false]]), notePath: 'House/House reset.md' }),
    task({ id: 'h-bulb', title: 'Replace hallway bulb', area: 'house', done: false, plan: d(1), mode: 'simple', notePath: 'House/Replace hallway bulb.md' }),
  ];

  const bills = [
    { id: 'b-elec', title: 'Electricity bill', dueDay: 18, reminderDays: 2, start: lastMonth, payments: { [lastMonth]: { paid: true } } },
    { id: 'b-net', title: 'Internet bill', dueDay: 14, reminderDays: 3, start: lastMonth, payments: { [lastMonth]: { paid: true }, [thisMonth]: { paid: true, note: 'Paid by transfer' } } },
    { id: 'b-water', title: 'Water bill', dueDay: 5, reminderDays: 2, start: lastMonth, payments: { [thisMonth]: { paid: true } } },
  ].map((b) => ({ ...b, recurrence: 'monthly' as const, notePath: `House/Bills/${b.title}.md` }));

  const projects = [
    { id: 'p-jzero', kind: 'artist-job' as const, artist: 'JZero', title: 'Untitled single', client: 'JZero', roles: ['Mixing', 'Mastering'], color: '#4c6fb8', tags: ['client'],
      notePath: 'Music/Jobs/JZero – Untitled single.md',
      stages: [
        stage('p-jzero', 'Mix', { end: d(2), done: true }),
        stage('p-jzero', 'Master', { end: d(6) }),
        ...['Concept', 'Produce', 'Record', 'Art (Design)', 'Marketing', 'Streaming'].map((n) => stage('p-jzero', n, { inScope: false })),
      ] },
    { id: 'p-just', kind: 'artist-job' as const, artist: 'Just', title: 'Debut EP', client: 'Just', roles: ['Producer'], color: '#3f9a80', tags: ['client'],
      notePath: 'Music/Jobs/Just – Debut EP.md',
      stages: [
        stage('p-just', 'Produce', { end: d(10), items: [{ id: 'p-just-1', text: 'Beat 1', done: true }, { id: 'p-just-2', text: 'Beat 2', done: false, date: d(5) }, { id: 'p-just-3', text: 'Beat 3', done: false }, { id: 'p-just-4', text: 'Arrangement pass', done: false, date: d(10) }] }),
        ...['Record', 'Mix', 'Master'].map((n) => stage('p-just', n, { inScope: false })),
      ] },
    { id: 'p-jing', kind: 'artist-job' as const, artist: 'Jing', title: 'First single', client: 'Jing', roles: ['Recording', 'Production', 'Mixing', 'Mastering'], color: '#b44a6e', tags: ['client'],
      notePath: 'Music/Jobs/Jing – First single.md',
      stages: [
        stage('p-jing', 'Record', { end: d(5), items: [{ id: 'p-jing-1', text: 'Record vocals', done: false, date: today }, { id: 'p-jing-2', text: 'Comp takes', done: false, date: d(3) }] }),
        stage('p-jing', 'Produce', { end: d(12), items: [{ id: 'p-jing-3', text: 'Sketch arrangement', done: true }, { id: 'p-jing-4', text: 'Layer instruments', done: false }] }),
        stage('p-jing', 'Mix', { end: d(20) }), stage('p-jing', 'Master', { end: d(24) }),
        stage('p-jing', 'Concept', { inScope: false }), stage('p-jing', 'Art (Design)', { inScope: false }),
      ] },
    { id: 'p-single', kind: 'own-release' as const, artist: 'FRANKK', title: 'My next single', label: 'Surftape', roles: ['Artist', 'Producer'], releaseType: 'single' as const, notes: 'Warm, late-night synth-pop. Jing on the hook; reference: city lights at 2am.',
      targetRelease: d(47), start: d(-14), color: '#d4a03c', tags: ['surftape'],
      notePath: 'Music/Releases/My next single.md',
      stages: [
        stage('p-single', 'Concept', { track: 'main', done: true, start: d(-14), end: d(-7) }),
        stage('p-single', 'Lyrics', { track: 'main', done: true, start: d(-8), end: d(-2) }),
        stage('p-single', 'Produce', { track: 'main', start: d(-5), end: d(18), items: [{ id: 'p-s-1', text: 'Drum programming', done: true }, { id: 'p-s-2', text: 'Bassline', done: false, date: d(8) }, { id: 'p-s-3', text: 'Hook', done: false }] }),
        stage('p-single', 'Record', { track: 'main', start: d(14), end: d(26), items: [{ id: 'p-s-4', text: 'Book room', done: false, date: d(12) }] }),
        stage('p-single', 'Mix & Master', { track: 'main', start: d(26), end: d(34) }),
        stage('p-single', 'Art (Design)', { track: 'main', start: d(25), end: d(40) }),
        stage('p-single', 'Marketing', { track: 'side', start: d(35), end: d(46) }),
        stage('p-single', 'MV', { track: 'side', inScope: false }),
        stage('p-single', 'Streaming', { track: 'side', start: d(44), end: d(47) }),
      ] },
  ];

  const tags = [
    { name: 'urgent', color: '#c8553a' }, { name: 'home', color: '#b98a3e' }, { name: 'health', color: '#3f9a80' },
    { name: 'money', color: '#d4a03c' }, { name: 'learning', color: '#8a4f8f' }, { name: 'design', color: '#b44a6e' },
    { name: 'systems', color: '#5a93c4' }, { name: 'client', color: '#4c6fb8' }, { name: 'surftape', color: '#dd7a45' },
  ];

  return {
    version: 1, tasks, bills, projects, tags,
    brands: [...BRANDS],
    types: defaultTypes(BRANDS), entries: defaultEntries(today), notes: defaultNotes(today), views: defaultViews(), dashboards: [defaultDashboard()],
    brandColors: { [sundey]: '#d4a03c', [eli]: '#3f9a80', [reva]: '#b44a6e' },
  };
}
