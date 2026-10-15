// Runs the bundled Esther cloud function with fake Supabase, Telegram and Jev. Run: npm run test:cloud
const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'svc', TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_WEBHOOK_SECRET: 'hook', ALLOWED_TELEGRAM_ID: '42', ESTHER_APP_KEY: 'app', JEV_API_KEY: 'jev', TIMEZONE: 'Asia/Vientiane' };
let handler; globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
const inbox = []; let ctx = null; const sent = []; const jevCalls = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url); const body = init.body ? JSON.parse(init.body) : undefined;
  const ok = (b) => new Response(JSON.stringify(b), { status: 200 });
  if (url.startsWith('https://api.telegram.org/')) { sent.push(body.text); return ok({ ok: true }); }
  if (url.includes('typesafe')) { jevCalls.push(body); const q = Object.keys(body.questions)[0]; const keys = Object.keys(body.questions[q].criteria);
    const pick = q === 'area' ? (/poster|illustrator/i.test(body.state) ? 'byou' : /mix|vocal|beat/i.test(body.state) ? 'music' : /goose|tap/i.test(body.state) ? 'house' : 'general') : q === 'project' ? keys.find((k) => k === 'p-jing') ?? keys[0] : q === 'stage' ? keys.find((k) => /mix/i.test(body.questions[q].criteria[k])) ?? keys[0] : keys[0];
    return ok({ answers: { [q]: { choice: pick, confidence: 0.9 } } }); }
  if (url.startsWith('https://db.test/rest/v1/esther_context')) { if (init.method === 'POST') { ctx = body; return ok([]); } return ok(ctx ? [{ id: 1, data: ctx.data }] : []); }
  if (url.startsWith('https://db.test/rest/v1/esther_inbox')) {
    if (init.method === 'POST') { const r = { id: String(inbox.length + 1), created_at: new Date().toISOString(), taken_at: null, ...body }; inbox.push(r); return ok([r]); }
    if (init.method === 'DELETE') return new Response('', { status: 200 });
    if (init.method === 'PATCH') { const ids = url.match(/in\.\(([^)]*)\)/)[1].split(','); inbox.forEach((r) => { if (ids.includes(r.id)) r.taken_at = body.taken_at; }); return ok([]); }
    return ok(inbox.filter((r) => !r.taken_at));
  }
  throw new Error('unexpected ' + url);
};
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const tmp = join(mkdtempSync(join(tmpdir(), 'esther-cloud-')), 'fn.mjs');
copyFileSync('supabase/functions/esther/index.ts', tmp);
await import(tmp);
const call = (path, init = {}) => handler(new Request('https://x.supabase.co/functions/v1/esther' + path, init));
const app = { 'x-esther-key': 'app', 'content-type': 'application/json' };
const tgMsg = (text, from = 42) => call('/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'hook' }, body: JSON.stringify({ message: { chat: { id: 1 }, from: { id: from }, text } }) });
const check = (n, c, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  → ' + x}`);

check('health needs the app key', (await call('/health')).status === 401);
await call('/context', { method: 'PUT', headers: app, body: JSON.stringify({ brands: ['sundey ສະບາຍດີຈຸເຈົ້າ', 'Eli Lao Origin'], projects: [{ id: 'p-just', artist: 'Just', title: 'Debut EP', stages: [{ id: 's1', name: 'Produce', inScope: true, done: false, items: [] }, { id: 's2', name: 'Record', inScope: false, done: false, items: [] }] }, { id: 'p-jing', artist: 'Jing', title: 'First single', stages: [{ id: 's3', name: 'Record', inScope: true, done: false, items: [] }, { id: 's4', name: 'Mix', inScope: true, done: false, items: [] }] }] }) });
const h = await (await call('/health', { headers: app })).json();
check('health reports Telegram, Jev and the saved context', h.ok && h.telegram && h.jev && h.context, JSON.stringify(h));
await tgMsg('record just vocal on friday this week');
check('Telegram: rules place Just\'s vocal on the Record stage without asking Jev', inbox[0]?.parsed.music?.stage === 'Record' && inbox[0].sorted_by === 'rules' && jevCalls.length === 0, JSON.stringify(inbox[0]));
check('Telegram: replies with what it kept', /Kept: “Record vocal” · Just · Debut EP · Record stage/.test(sent.at(-1)), sent.at(-1));
await tgMsg('finish the event poster by friday');
check('Telegram: unsure task → Jev chooses B-YOU', inbox[1]?.parsed.list === 'B-YOU' && inbox[1].sorted_by === 'jev' && /sorted by Jev/.test(sent.at(-1)), JSON.stringify(inbox[1]) + sent.at(-1));
await tgMsg('second pass on the vocal mix');
check('Telegram: Jev picks music → project → stage', inbox[2]?.parsed.music?.projectId === 'p-jing' && inbox[2].parsed.music.stage === 'Mix', JSON.stringify(inbox[2]?.parsed));
await tgMsg('hello from a stranger', 7);
check('Telegram: strangers are ignored', inbox.length === 3 && !sent.at(-1).includes('stranger'));
const bad = await call('/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'nope' }, body: '{}' });
check('Telegram: wrong webhook secret is refused', bad.status === 403);
await tgMsg('/jevtest');
check('/jevtest shows Jev\'s raw answer', /Jev answered \(200\)/.test(sent.at(-1)), sent.at(-1));
const s = await (await call('/sort', { method: 'POST', headers: app, body: JSON.stringify({ text: 'fix the leaking tap for mom', today: '2026-10-14' }) })).json();
check('/sort from the app: Jev puts the tap in House', s.parsed.area === 'house' && s.sortedBy === 'jev', JSON.stringify(s));
const pulled = await (await call('/inbox', { headers: app })).json();
const again = await (await call('/inbox', { headers: app })).json();
check('/inbox hands over captures once', pulled.rows.length === 3 && again.rows.length === 0, JSON.stringify(pulled).slice(0, 200));
env.JEV_API_KEY = ''; await tgMsg('book a haircut');
check('without Jev the rules still keep it (General)', inbox[3]?.sorted_by === 'rules' && inbox[3].parsed.area === 'general');
