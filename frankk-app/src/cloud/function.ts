/**
 * Esther cloud: one Supabase Edge Function (Deno). Bundled into supabase/functions/esther/index.ts by
 * `npm run build:cloud`, so it reads sentences with exactly the same rules as the app.
 *
 *   POST /esther/telegram   Telegram webhook: your private chat with the Esther bot (only your Telegram id is heard)
 *   POST /esther/sort       the app asks where a sentence belongs (rules first, then Jev when unsure)
 *   GET  /esther/inbox      the app collects phone captures it hasn't taken yet
 *   PUT  /esther/context    the app shares your brands and projects, so the phone and Jev choose from real lists
 *   GET  /esther/health     what's connected
 *
 * Secrets (Supabase → Edge Functions → Secrets), pasted by you, never written here:
 *   TELEGRAM_BOT_TOKEN, ALLOWED_TELEGRAM_ID, ESTHER_APP_KEY, JEV_API_KEY (optional)
 *   Optional: JEV_URL, JEV_MODEL, TIMEZONE (default Asia/Vientiane), TELEGRAM_WEBHOOK_SECRET (default: made from the app key)
 * The Telegram webhook connects itself the first time the app checks the connection (GET /health).
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
 */
import { parseCommand, type Parsed, type ProjectRef } from '../lib/parse';
import { describe, needsSort } from '../lib/sortRules';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Response | Promise<Response>): void };
const env = (k: string, d = '') => Deno.env.get(k) ?? d;

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-esther-key', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...CORS } });

/** Today's date where you live, so "tomorrow" means your tomorrow. */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: env('TIMEZONE', 'Asia/Vientiane'), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/* ---------- database (Supabase REST, service role: only this function can read or write) ---------- */

async function db(path: string, init: RequestInit = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', prefer: 'return=representation', ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`db ${res.status}: ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

interface Ctx { brands: string[]; projects: ProjectRef[] }
async function context(): Promise<Ctx> {
  const rows = await db('esther_context?id=eq.1&select=data');
  return rows?.[0]?.data ?? { brands: [], projects: [] };
}

/* ---------- Jev: typed choices ---------- */

/** Finds which of `labels` Jev picked, whatever shape its answer comes in (a label, {choice}, or a score per label). */
function pickLabel(x: unknown, labels: string[]): string | undefined {
  if (typeof x === 'string') return labels.includes(x) ? x : undefined;
  if (Array.isArray(x)) { for (const v of x) { const f = pickLabel(v, labels); if (f) return f; } return undefined; }
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    const scored = labels.filter((l) => typeof o[l] === 'number');
    if (scored.length === labels.length) return scored.sort((a, b) => (o[b] as number) - (o[a] as number))[0];
    for (const k of ['choice', 'answer', 'label', 'decision', 'result', 'value', 'selected']) { const f = pickLabel(o[k], labels); if (f) return f; }
    for (const v of Object.values(o)) { const f = pickLabel(v, labels); if (f) return f; }
  }
  return undefined;
}

async function jevRaw(state: string, name: string, instructions: string, criteria: Record<string, string>) {
  const res = await fetch(env('JEV_URL', 'https://api.typesafe.ai/v1/systemone'), {
    method: 'POST',
    headers: { authorization: `Bearer ${env('JEV_API_KEY')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: env('JEV_MODEL', 'jev-latest'), state, questions: { [name]: { type: 'choice', instructions, criteria } } }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function jevChoose(state: string, name: string, instructions: string, criteria: Record<string, string>) {
  const r = await jevRaw(state, name, instructions, criteria);
  if (!r.ok) throw new Error(`jev ${r.status}`);
  return pickLabel((r.body as Record<string, unknown>)?.answers ?? r.body, Object.keys(criteria));
}

/** Rules first; when they found no place for a task, Jev chooses the area, then the project and stage for music. */
async function sortCapture(text: string, day: string): Promise<{ parsed: Parsed; sortedBy: string }> {
  const ctx = await context();
  const p = parseCommand(text, day, ctx.brands, ctx.projects);
  if (!needsSort(p) || !env('JEV_API_KEY')) return { parsed: p, sortedBy: 'rules' };
  try {
    const area = await jevChoose(text, 'area', 'Which part of Frankk’s life does this task belong to?', {
      general: 'Personal errands, admin, learning, health, anything else',
      byou: 'B-YOU: his weekday office job as a graphic designer (posters, layouts, Illustrator work)',
      seround: `Seround: his content-marketing business with a partner; brands: ${ctx.brands.join(', ')}`,
      house: 'The house and family home: bills, repairs, chores, the dogs Goose and Miko',
      music: 'Music production: studio sessions, artists, recording, mixing, mastering, releases',
    });
    if (area === 'byou') return { parsed: { ...p, list: 'B-YOU', tags: ['byou'] }, sortedBy: 'jev' };
    if (area === 'house') return { parsed: { ...p, area: 'house' }, sortedBy: 'jev' };
    if (area === 'seround') {
      const crit = Object.fromEntries(ctx.brands.map((b) => [b, `Work for the brand ${b}`]));
      const brand = ctx.brands.length ? await jevChoose(text, 'brand', 'Which Seround brand is this for?', crit) : undefined;
      return { parsed: { ...p, area: 'seround', brand: brand ?? ctx.brands[0] }, sortedBy: 'jev' };
    }
    if (area === 'music' && ctx.projects.length) {
      const crit = Object.fromEntries(ctx.projects.map((x) => [x.id, `${x.artist} — ${x.title}`]));
      const pid = await jevChoose(text, 'project', 'Which music project is this work for? Choose the closest.', crit);
      const proj = ctx.projects.find((x) => x.id === pid);
      if (proj) {
        const sc = Object.fromEntries(proj.stages.map((s) => [s.id, `${s.name} stage${s.inScope ? '' : ' (currently outside his scope)'}`]));
        const sid = await jevChoose(text, 'stage', 'Which stage of this project is the work part of?', sc);
        const st = proj.stages.find((s) => s.id === sid) ?? proj.stages.find((s) => s.inScope);
        if (st) return { parsed: { ...p, music: { projectId: proj.id, stageId: st.id, stage: st.name, artist: proj.artist, title: proj.title, addsScope: !st.inScope } }, sortedBy: 'jev' };
      }
      return { parsed: { ...p, tags: ['music'] }, sortedBy: 'jev' };
    }
    return { parsed: p, sortedBy: 'jev' };
  } catch {
    return { parsed: p, sortedBy: 'rules' };
  }
}

/* ---------- Telegram ---------- */

/** The secret Telegram sends with every message. Made from your app key unless you set one, so it's one less secret to add. */
async function hookSecret() {
  if (env('TELEGRAM_WEBHOOK_SECRET')) return env('TELEGRAM_WEBHOOK_SECRET');
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`esther-telegram:${env('ESTHER_APP_KEY')}`)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}

/** Points the Telegram bot at this function if it isn't already, so you never paste a webhook link yourself. */
async function ensureWebhook(): Promise<boolean> {
  const token = env('TELEGRAM_BOT_TOKEN');
  if (!token) return false;
  const want = `${env('SUPABASE_URL')}/functions/v1/esther/telegram`;
  const info = await (await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)).json().catch(() => ({}));
  if (info?.result?.url === want) return true;
  const r = await (await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: want, secret_token: await hookSecret(), allowed_updates: ['message', 'edited_message'] }) })).json().catch(() => ({}));
  return !!r?.ok;
}

async function tg(method: string, body: unknown) {
  await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

const HELP = [
  'Tell me anything and I’ll keep it for Esther:',
  '• a task: "poster for B-YOU due 5 Dec", "record Just vocal friday"',
  '• i: an idea  • p: progress  • c: context  • j: a journal line',
  'It reaches Esther on your PC the next time Esther is open.',
  '/jevtest checks the Jev connection.',
].join('\n');

async function onTelegram(req: Request) {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== await hookSecret()) return new Response('forbidden', { status: 403 });
  const u = await req.json();
  const msg = u.message ?? u.edited_message;
  if (!msg) return json({ ok: true });
  const chat = msg.chat.id;
  // Only you: anyone else who finds the bot gets nothing.
  if (String(msg.from?.id) !== env('ALLOWED_TELEGRAM_ID')) return json({ ok: true });
  const text: string = (msg.text ?? msg.caption ?? '').trim();
  if (!text) { await tg('sendMessage', { chat_id: chat, text: 'For now I read text. Voice notes and photos come next.' }); return json({ ok: true }); }
  if (text === '/start' || text === '/help') { await tg('sendMessage', { chat_id: chat, text: `Shlama. ${HELP}` }); return json({ ok: true }); }
  if (text === '/jevtest') {
    if (!env('JEV_API_KEY')) { await tg('sendMessage', { chat_id: chat, text: 'Jev is not set up: add JEV_API_KEY in Supabase secrets.' }); return json({ ok: true }); }
    const r = await jevRaw('buy dog medicine for Goose', 'area', 'Which part of life?', { house: 'home and family', music: 'music work' }).catch((e) => ({ ok: false, status: 0, body: String(e) }));
    await tg('sendMessage', { chat_id: chat, text: `Jev ${r.ok ? 'answered' : 'failed'} (${r.status}):\n${JSON.stringify(r.body).slice(0, 3000)}` });
    return json({ ok: true });
  }
  const day = today();
  const { parsed, sortedBy } = await sortCapture(text, day);
  await db('esther_inbox', { method: 'POST', body: JSON.stringify({ source: 'telegram', raw: text, parsed, sorted_by: sortedBy }) });
  await tg('sendMessage', { chat_id: chat, text: `Kept: ${describe(parsed, day).join(' · ')}${sortedBy === 'jev' ? ' ✦ sorted by Jev' : ''}` });
  return json({ ok: true });
}

/* ---------- the app ---------- */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  try {
    if (path.endsWith('/telegram')) return await onTelegram(req);
    if (req.headers.get('x-esther-key') !== env('ESTHER_APP_KEY') || !env('ESTHER_APP_KEY')) return json({ error: 'wrong app key' }, 401);
    if (path.endsWith('/health')) {
      const waiting = await db('esther_inbox?taken_at=is.null&select=id');
      const ctx = await db('esther_context?id=eq.1&select=id');
      const telegram = await ensureWebhook().catch(() => false);
      return json({ ok: true, telegram, jev: !!env('JEV_API_KEY'), inbox: waiting?.length ?? 0, context: !!ctx?.length });
    }
    if (path.endsWith('/sort') && req.method === 'POST') {
      const { text, today: day } = await req.json();
      return json(await sortCapture(String(text ?? ''), String(day ?? today())));
    }
    if (path.endsWith('/inbox')) {
      const rows = await db('esther_inbox?taken_at=is.null&order=created_at.asc&select=id,created_at,source,raw,parsed,sorted_by');
      // Little stays online: captures taken more than a week ago are deleted.
      await db(`esther_inbox?taken_at=lt.${new Date(Date.now() - 7 * 86_400_000).toISOString()}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
      if (rows?.length) await db(`esther_inbox?id=in.(${rows.map((r: { id: string }) => r.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ taken_at: new Date().toISOString() }) });
      return json({ rows: rows ?? [] });
    }
    if (path.endsWith('/context') && req.method === 'PUT') {
      const data = await req.json();
      await db('esther_context', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, data, updated_at: new Date().toISOString() }) });
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
