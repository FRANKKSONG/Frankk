// Runs the bundled Esther cloud function with fake Supabase, Telegram and Jev. Run: npm run test:cloud
const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'svc', TELEGRAM_BOT_TOKEN: 'tok', ALLOWED_TELEGRAM_ID: '42', ESTHER_APP_KEY: 'app', JEV_API_KEY: 'jev', TIMEZONE: 'Asia/Vientiane' };
let handler; globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
const inbox = []; let ctx = null; let hookUrl = '', hookSecret = ''; const sent = []; const markups = []; const answers = []; const edits = []; const jevCalls = []; let hookUpdates = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url); const body = init.body ? JSON.parse(init.body) : undefined;
  const ok = (b) => new Response(JSON.stringify(b), { status: 200 });
  if (url.includes('/getWebhookInfo')) return ok({ ok: true, result: { url: hookUrl, allowed_updates: hookUpdates } });
  if (url.includes('/setWebhook')) { hookUrl = body.url; hookSecret = body.secret_token; hookUpdates = body.allowed_updates; return ok({ ok: true }); }
  if (url.includes('/answerCallbackQuery')) { answers.push(body.text); return ok({ ok: true }); }
  if (url.includes('/editMessageText')) { edits.push(body); return ok({ ok: true }); }
  if (url.startsWith('https://api.telegram.org/')) { sent.push(body.text); markups.push(body.reply_markup); return ok({ ok: true }); }
  if (url.includes('typesafe')) { jevCalls.push(body); const q = Object.keys(body.questions)[0]; const keys = Object.keys(body.questions[q].criteria);
    const pick = q === 'kind' ? (/what if|someday/i.test(body.state) ? 'idea' : /^(mixed|finished|sent)\b/i.test(body.state) ? 'progress' : 'task') : q === 'area' ? (/poster|illustrator/i.test(body.state) ? 'byou' : /mix|vocal|beat/i.test(body.state) ? 'music' : /goose|tap/i.test(body.state) ? 'house' : 'general') : q === 'project' ? keys.find((k) => k === 'p-jing') ?? keys[0] : q === 'stage' ? keys.find((k) => /mix/i.test(body.questions[q].criteria[k])) ?? keys[0] : keys[0];
    return ok({ answers: { [q]: { choice: pick, confidence: 0.9 } } }); }
  if (url.startsWith('https://db.test/rest/v1/esther_context')) { if (init.method === 'POST') { ctx = body; return ok([]); } return ok(ctx ? [{ id: 1, data: ctx.data }] : []); }
  if (url.startsWith('https://db.test/rest/v1/esther_inbox')) {
    if (init.method === 'POST') { const r = { id: String(inbox.length + 1), created_at: new Date().toISOString(), taken_at: null, ...body }; inbox.push(r); return ok([r]); }
    if (init.method === 'DELETE') return new Response('', { status: 200 });
    if (init.method === 'PATCH') { const one = url.match(/id=eq\.([^&]+)/); const ids = one ? [one[1]] : url.match(/in\.\(([^)]*)\)/)[1].split(','); inbox.forEach((r) => { if (ids.includes(r.id)) Object.assign(r, body); }); return ok([]); }
    const one = url.match(/id=eq\.([^&]+)/); if (one) return ok(inbox.filter((r) => r.id === one[1]));
    if (url.includes('source=eq.example')) return ok(inbox.filter((r) => r.source === 'example').reverse());
    return ok(inbox.filter((r) => !r.taken_at && r.source !== 'example'));
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
const tgMsg = (text, from = 42) => call('/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': hookSecret }, body: JSON.stringify({ message: { chat: { id: 1 }, from: { id: from }, text } }) });
const check = (n, c, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  → ' + x}`);

check('health needs the app key', (await call('/health')).status === 401);
await call('/context', { method: 'PUT', headers: app, body: JSON.stringify({ brands: ['sundey ສະບາຍດີຈຸເຈົ້າ', 'Eli Lao Origin'], projects: [{ id: 'p-just', artist: 'Just', title: 'Debut EP', stages: [{ id: 's1', name: 'Produce', inScope: true, done: false, items: [] }, { id: 's2', name: 'Record', inScope: false, done: false, items: [] }] }, { id: 'p-jing', artist: 'Jing', title: 'First single', stages: [{ id: 's3', name: 'Record', inScope: true, done: false, items: [] }, { id: 's4', name: 'Mix', inScope: true, done: false, items: [] }] }] }) });
const h = await (await call('/health?base=' + encodeURIComponent('https://db.test/functions/v1/Esther'), { headers: app })).json();
check('health reports Telegram, Jev and the saved context', h.ok && h.telegram && h.jev && h.context, JSON.stringify(h));
check('health connects the Telegram webhook by itself to the exact address the app uses (Esther with a capital E), with a secret made from the app key', hookUrl === 'https://db.test/functions/v1/Esther/telegram' && /^[0-9a-f]{48}$/.test(hookSecret), hookUrl + ' ' + hookSecret);
await tgMsg('record just vocal on friday this week');
check('health asks Telegram to send button taps too', hookUpdates.includes('callback_query'), JSON.stringify(hookUpdates));
check('Telegram: rules place Just\'s vocal on the Record stage; Jev only confirms it is a task', inbox[0]?.parsed.music?.stage === 'Record' && inbox[0].sorted_by === 'rules' && jevCalls.every((c) => Object.keys(c.questions)[0] === 'kind'), JSON.stringify(inbox[0]));
check('Telegram: replies with what it kept', /^Task: “Record vocal” · Just · Debut EP · Record stage/.test(sent.at(-1)), sent.at(-1));
check('Telegram: the reply carries re-file buttons for the other kinds', JSON.stringify(markups.at(-1)) === JSON.stringify({ inline_keyboard: [['Idea', 'Progress', 'Context', 'Journal'].map((l) => ({ text: l, callback_data: `k:1:${l.toLowerCase()}` }))] }), JSON.stringify(markups.at(-1)));
await tgMsg('finish the event poster by friday');
check('Telegram: unsure task → Jev chooses B-YOU', inbox[1]?.parsed.list === 'B-YOU' && inbox[1].sorted_by === 'jev' && /sorted by Jev/.test(sent.at(-1)), JSON.stringify(inbox[1]) + sent.at(-1));
await tgMsg('second pass on the vocal mix');
check('Telegram: Jev picks music → project → stage', inbox[2]?.parsed.music?.projectId === 'p-jing' && inbox[2].parsed.music.stage === 'Mix', JSON.stringify(inbox[2]?.parsed));
await tgMsg('hello from a stranger', 7);
check('Telegram: strangers are not heard, and are told their id', inbox.length === 3 && /listens only to its owner\. Your Telegram id is 7/.test(sent.at(-1)), sent.at(-1));
const bad = await call('/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'nope' }, body: '{}' });
check('Telegram: wrong webhook secret is refused', bad.status === 403);
await tgMsg('/jevtest');
check('/jevtest shows Jev\'s raw answer', /Jev answered \(200\)/.test(sent.at(-1)), sent.at(-1));
const s = await (await call('/sort', { method: 'POST', headers: app, body: JSON.stringify({ text: 'fix the leaking tap for mom', today: '2026-10-14' }) })).json();
check('/sort from the app: Jev puts the tap in House', s.parsed.area === 'house' && s.sortedBy === 'jev', JSON.stringify(s));
await tgMsg('what if the EP had a lao folk interlude');
check('Telegram: no prefix, "what if…" is kept as an idea', inbox[3]?.parsed.kind === 'idea' && /^Idea:/.test(sent.at(-1)), JSON.stringify(inbox[3]?.parsed) + sent.at(-1));
const tap = (data, from = 42) => call('/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': hookSecret }, body: JSON.stringify({ callback_query: { id: 'cb', from: { id: from }, data, message: { chat: { id: 1 }, message_id: 9 } } }) });
await tap('k:4:task', 7);
check('Telegram: a stranger\'s button tap does nothing', inbox[3].parsed.kind === 'idea' && answers.at(-1) === 'Not your Esther.', answers.at(-1));
await tap('k:4:task');
check('Telegram: tapping Task re-files the waiting capture in place', inbox[3].parsed.kind === 'task' && inbox[3].sorted_by === 'you' && /Filed as Task/.test(answers.at(-1)) && /^Task:.*filed by you/.test(edits.at(-1)?.text), JSON.stringify(inbox[3]) + JSON.stringify(edits.at(-1)));
check('Telegram: the correction is kept as an example for Jev', inbox.some((r) => r.source === 'example' && r.parsed.kind === 'task' && r.taken_at), JSON.stringify(inbox.at(-1)));
const before = jevCalls.length; await tgMsg('what if we tried a choir');
const kindQ = jevCalls.slice(before).find((c) => Object.keys(c.questions)[0] === 'kind');
check('Telegram: Jev is shown your past corrections next time', /"what if the EP had a lao folk interlude" was a task/.test(kindQ?.questions.kind.instructions ?? ''), kindQ?.questions.kind.instructions);
const pulled = await (await call('/inbox', { headers: app })).json();
const again = await (await call('/inbox', { headers: app })).json();
check('/inbox hands over captures once, never the examples', pulled.rows.length === 5 && pulled.rows.every((r) => r.source !== 'example') && again.rows.length === 0, JSON.stringify(pulled).slice(0, 200));
await tap('k:1:journal');
const refile = inbox.find((r) => r.source === 'refile');
check('Telegram: re-filing something Esther already took sends a replacement', refile?.parsed.kind === 'journal' && refile.parsed.replaces === '1' && !refile.taken_at, JSON.stringify(refile));
env.JEV_API_KEY = ''; await tgMsg('book a haircut');
const hc = inbox.at(-1);
check('without Jev the rules still keep it (General)', hc?.sorted_by === 'rules' && hc.parsed.area === 'general', JSON.stringify(hc));
