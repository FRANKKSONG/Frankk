import { todayISO } from '../lib/dates';
import { buildFixtures } from './fixtures';
import { BRANDS, type AppData } from './types';

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

const KEY = 'esther.proto.data.v1';

export class FixtureRepository implements Repository {
  readonly kind = 'fixture' as const;

  load(): AppData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppData;
        if (parsed.version === 1 && Array.isArray(parsed.tasks)) return { ...parsed, brands: parsed.brands ?? [...BRANDS] };
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
