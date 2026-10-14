import { todayISO } from '../lib/dates';
import { buildFixtures } from './fixtures';
import type { AppData } from './types';
import type { FieldDef } from './schema';

/**
 * Milestone 1: the only repository. Data lives in browser localStorage and is
 * NEVER connected to the real vault. Later milestones add VaultReadRepository etc.
 */
export interface Repository {
  readonly kind: 'fixture' | 'vault-read' | 'vault-write';
  load(): AppData;
  save(data: AppData): void;
  reset(): AppData;
}

const KEY = 'esther.proto.data.v4';

/** Saved sample data: drop the old sample "Rate" field from People and add First name, Last name and Description. */
function migratePeople(d: AppData): AppData {
  const person = d.types.find((t) => t.id === 'person');
  if (!person) return d;
  const NAME_FIELDS: FieldDef[] = [
    { key: 'firstName', name: 'First name', kind: 'text' },
    { key: 'lastName', name: 'Last name', kind: 'text' },
    { key: 'description', name: 'Description', kind: 'longtext' },
  ];
  const hasRate = person.fields.some((f) => f.key === 'rate' && f.name === 'Rate');
  const missing = NAME_FIELDS.filter((f) => !person.fields.some((x) => x.key === f.key));
  if (!hasRate && !missing.length) return d;
  const keep = (k: string) => k !== 'rate' || !hasRate;
  return {
    ...d,
    types: d.types.map((t) => (t.id === 'person' ? { ...t, fields: [...missing, ...t.fields.filter((f) => keep(f.key))] } : t)),
    views: d.views.map((v) => (v.id === 'v-people' ? { ...v, fields: [...missing.map((f) => f.key), ...v.fields.filter((k) => keep(k) && !missing.some((f) => f.key === k))] } : v)),
  };
}

export class FixtureRepository implements Repository {
  readonly kind = 'fixture' as const;

  load(): AppData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppData;
        if (parsed.version === 1 && Array.isArray(parsed.tasks) && Array.isArray(parsed.tags) && Array.isArray(parsed.types)) return migratePeople(parsed);
      }
    } catch {
      /* corrupt or unavailable storage: fall back to the sample data */
    }
    return buildFixtures(todayISO());
  }

  save(data: AppData): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* storage full/blocked: app keeps working in memory */
    }
  }

  reset(): AppData {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return buildFixtures(todayISO());
  }
}
