import type { AppData } from '../data/types';
import type { Parsed, ProjectRef } from './parse';

/**
 * Esther cloud: the small Supabase function that catches captures from your phone (Telegram) and asks Jev to sort
 * what the local reader isn't sure about. Its address and app key are kept only in this browser. The app key only
 * opens your own inbox; the Telegram, Jev and database keys live in Supabase, never here.
 */
export interface CloudCfg { url: string; key: string }
const STORE = 'esther.cloud';

export function cloudCfg(): CloudCfg | null {
  try { const c = JSON.parse(localStorage.getItem(STORE) ?? 'null'); return c?.url && c?.key ? c : null; } catch { return null; }
}
export function saveCloud(c: CloudCfg | null) {
  try { if (c) localStorage.setItem(STORE, JSON.stringify(c)); else localStorage.removeItem(STORE); } catch { /* storage blocked: stays off */ }
}

async function call<T>(path: string, init: RequestInit = {}, ms = 4000, cfg = cloudCfg()): Promise<T> {
  if (!cfg) throw new Error('Esther cloud is not set up');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(`${cfg.url.replace(/\/+$/, '')}/${path}`, { ...init, signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-esther-key': cfg.key, ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`.trim());
    return (await res.json()) as T;
  } finally { clearTimeout(t); }
}

export interface Health { ok: boolean; telegram: boolean; jev: boolean; inbox: number; context: boolean }
export interface InboxRow { id: string; created_at: string; source: string; raw: string; parsed: Parsed; sorted_by: string }

export const cloud = {
  health: (cfg?: CloudCfg) => call<Health>('health', {}, 25000, cfg ?? cloudCfg()),
  /** Ask the cloud (Jev) to place a sentence the local reader wasn't sure about. */
  sort: (text: string, today: string) => call<{ parsed: Parsed; sortedBy: string }>('sort', { method: 'POST', body: JSON.stringify({ text, today }) }, 3500),
  /** Captures from your phone that haven't been brought in yet; the cloud marks them as taken. */
  pull: () => call<{ rows: InboxRow[] }>('inbox', {}, 15000),
  /** Tells the cloud your brands and projects, so phone captures and Jev choose from your real lists. */
  pushContext: (data: AppData) => call<{ ok: boolean }>('context', { method: 'PUT', body: JSON.stringify(contextOf(data)) }, 6000),
};

export function contextOf(data: AppData): { brands: string[]; projects: ProjectRef[] } {
  return {
    brands: data.brands,
    projects: data.projects.map((p) => ({ id: p.id, artist: p.artist, title: p.title, stages: p.stages.map((s) => ({ id: s.id, name: s.name, inScope: s.inScope, done: s.done, track: s.track, items: s.items.map((i) => ({ done: i.done })) })) })),
  };
}
