import { addDays, monthKey, addMonths, type ISODate } from '../lib/dates';
import type { AppData, Stage, Task } from './types';
import { BRANDS } from './types';

let seq = 0;
export const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const steps = (id: string, items: [string, boolean][]) =>
  items.map(([text, done], i) => ({ id: `${id}-s${i}`, text, done }));

const stage = (id: string, name: string, p: Partial<Stage> = {}): Stage => ({
  id: `${id}-${name.toLowerCase()}`,
  name,
  inScope: true,
  done: false,
  items: [],
  ...p,
});

/** Sample data, with dates relative to `today` so the board always looks alive. SAMPLE ONLY. */
export function buildFixtures(today: ISODate): AppData {
  const d = (n: number) => addDays(today, n);
  const thisMonth = monthKey(today);
  const lastMonth = addMonths(thisMonth, -1);
  const [sundey, eli, reva] = BRANDS;

  const tasks: Task[] = [
    { id: 't-food', title: 'Clean food box', area: 'general', done: false, plan: today, due: d(1), priority: 'normal', list: 'Home admin',
      steps: steps('t-food', [['Empty box', true], ['Wash & dry', true], ['Put away', false]]), notePath: 'Planning/Tasks/Clean food box.md' },
    { id: 't-dentist', title: 'Book dentist', area: 'general', done: false, plan: d(2), due: d(4), priority: 'normal', steps: [], notePath: 'Planning/Tasks/Book dentist.md' },
    { id: 't-budget', title: 'Review budget', area: 'general', done: false, plan: d(2), due: d(6), priority: 'high', list: 'Admin',
      steps: steps('t-budget', [['Export statements', true], ['Categorise spending', false], ['Compare with last month', false], ['Note changes', false]]), notePath: 'Planning/Tasks/Review budget.md' },
    { id: 't-landlord', title: 'Call landlord about the gate', area: 'general', done: false, due: d(-2), priority: 'high', steps: [], notePath: 'Planning/Tasks/Call landlord about the gate.md' },
    { id: 't-photos', title: 'Renew passport photos', area: 'general', done: true, plan: d(-3), due: d(-1), priority: 'low',
      steps: steps('t-photos', [['Find studio', true], ['Print copies', true]]), notePath: 'Planning/Tasks/Renew passport photos.md' },

    { id: 's-repost', title: 'Repost TikTok clips to Facebook', area: 'seround', done: false, due: d(4), plan: d(1), priority: 'normal', brand: sundey, workstream: 'content',
      steps: steps('s-repost', [['Pick clip 1', true], ['Pick clip 2', true], ['Write captions', false], ['Schedule on Facebook', false]]),
      content: { clip: 'Clip 3 – market morning', source: 'https://www.tiktok.com/', destination: 'Facebook page', caption: 'ສະບາຍດີຈຸເຈົ້າ ☀️', repostStatus: 'queued', publishOn: d(4) },
      notePath: 'Seround/sundey/Repost TikTok clips to Facebook.md' },
    { id: 's-backend', title: 'Build operations backend', area: 'seround', done: false, due: d(11), priority: 'normal', brand: sundey, workstream: 'backend',
      steps: steps('s-backend', [['List current manual jobs', true], ['Choose data model', false], ['Prototype order sheet', false], ['Test with team', false], ['Roll out', false]]),
      notePath: 'Seround/sundey/Build operations backend.md' },
    { id: 's-pack', title: 'Review packaging', area: 'seround', done: false, due: d(7), priority: 'normal', brand: eli,
      steps: steps('s-pack', [['Check proofs', true], ['Confirm colours', false], ['Approve print', false]]), notePath: 'Seround/Eli Lao Origin/Review packaging.md' },
    { id: 's-campaign', title: 'Prepare next campaign', area: 'seround', done: false, due: d(11), priority: 'normal', brand: reva,
      steps: steps('s-campaign', [['Define goal', false], ['Moodboard', false], ['Shot list', false], ['Copy draft', false], ['Review', false]]), notePath: 'Seround/Reva Gem Cosmentics/Prepare next campaign.md' },

    { id: 'h-reset', title: 'House reset', area: 'house', done: false, plan: d(((7 - new Date(today + 'T00:00').getDay()) % 7) || 7), priority: 'normal',
      steps: steps('h-reset', [['Laundry', true], ['Floors', false], ['Bins', false], ['Fridge check', false]]), notePath: 'House/House reset.md' },
  ];

  const bills = [
    { id: 'b-elec', title: 'Electricity bill', dueDay: 18, reminderDays: 2, start: lastMonth, payments: { [lastMonth]: { paid: true } } },
    { id: 'b-net', title: 'Internet bill', dueDay: 14, reminderDays: 3, start: lastMonth, payments: { [lastMonth]: { paid: true }, [thisMonth]: { paid: true, note: 'Paid by transfer' } } },
    { id: 'b-water', title: 'Water bill', dueDay: 5, reminderDays: 2, start: lastMonth, payments: { [thisMonth]: { paid: true } } },
  ].map((b) => ({ ...b, recurrence: 'monthly' as const, notePath: `House/Bills/${b.title}.md` }));

  const projects = [
    { id: 'p-jzero', kind: 'artist-job' as const, artist: 'JZero', title: 'Untitled single', client: 'JZero', roles: ['Mixing', 'Mastering'],
      notePath: 'Music/Jobs/JZero – Untitled single.md',
      stages: [
        stage('p-jzero', 'Mix', { end: d(2), done: true }),
        stage('p-jzero', 'Master', { end: d(6) }),
        stage('p-jzero', 'Concept', { inScope: false }), stage('p-jzero', 'Produce', { inScope: false }), stage('p-jzero', 'Record', { inScope: false }),
        stage('p-jzero', 'Art', { inScope: false }), stage('p-jzero', 'Marketing', { inScope: false }), stage('p-jzero', 'Streaming', { inScope: false }),
      ] },
    { id: 'p-just', kind: 'artist-job' as const, artist: 'Just', title: 'Debut EP', client: 'Just', roles: ['Producer'],
      notePath: 'Music/Jobs/Just – Debut EP.md',
      stages: [
        stage('p-just', 'Produce', { end: d(10), items: [{ id: 'p-just-1', text: 'Beat 1', done: true }, { id: 'p-just-2', text: 'Beat 2', done: false, date: d(5) }, { id: 'p-just-3', text: 'Beat 3', done: false }, { id: 'p-just-4', text: 'Arrangement pass', done: false, date: d(10) }] }),
        stage('p-just', 'Record', { inScope: false }), stage('p-just', 'Mix', { inScope: false }), stage('p-just', 'Master', { inScope: false }),
      ] },
    { id: 'p-jing', kind: 'artist-job' as const, artist: 'Jing', title: 'First single', client: 'Jing', roles: ['Recording', 'Production', 'Mixing', 'Mastering'],
      notePath: 'Music/Jobs/Jing – First single.md',
      stages: [
        stage('p-jing', 'Record', { end: d(5), items: [{ id: 'p-jing-1', text: 'Record vocals', done: false, date: today }, { id: 'p-jing-2', text: 'Comp takes', done: false, date: d(3) }] }),
        stage('p-jing', 'Produce', { end: d(12), items: [{ id: 'p-jing-3', text: 'Sketch arrangement', done: true }, { id: 'p-jing-4', text: 'Layer instruments', done: false }] }),
        stage('p-jing', 'Mix', { end: d(20) }), stage('p-jing', 'Master', { end: d(24) }),
        stage('p-jing', 'Concept', { inScope: false }), stage('p-jing', 'Art', { inScope: false }),
      ] },
    { id: 'p-single', kind: 'own-release' as const, artist: 'FRANKK', title: 'My next single', label: 'Surftape', roles: ['Artist', 'Producer'], releaseType: 'single' as const, targetRelease: d(47),
      notePath: 'Music/Releases/My next single.md',
      stages: [
        stage('p-single', 'Concept', { done: true, start: d(-14), end: d(-7) }),
        stage('p-single', 'Produce', { start: d(-5), end: d(18), items: [{ id: 'p-s-1', text: 'Drum programming', done: true }, { id: 'p-s-2', text: 'Bassline', done: false, date: d(8) }, { id: 'p-s-3', text: 'Hook', done: false }] }),
        stage('p-single', 'Record', { start: d(14), end: d(26), items: [{ id: 'p-s-4', text: 'Book room', done: false, date: d(12) }] }),
        stage('p-single', 'Lyrics', { start: d(0), end: d(20) }),
        stage('p-single', 'Art', { start: d(25), end: d(40) }),
        stage('p-single', 'MV', { inScope: false }),
        stage('p-single', 'Marketing', { start: d(35), end: d(46) }),
        stage('p-single', 'Streaming', { start: d(44), end: d(47) }),
      ] },
  ];

  return { version: 1, tasks, bills, projects };
}
