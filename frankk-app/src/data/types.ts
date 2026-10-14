import type { ISODate } from '../lib/dates';

export type Area = 'general' | 'music' | 'seround' | 'house';
export type TaskArea = 'general' | 'seround' | 'house';

export interface Step {
  id: string;
  text: string;
  done: boolean;
}

export type Priority = 'high' | 'normal' | 'low';

export interface ContentInfo {
  clip?: string;
  source?: string;
  destination?: string;
  caption?: string;
  repostStatus?: 'queued' | 'ready' | 'posted';
  publishOn?: ISODate;
}

export interface Task {
  id: string;
  title: string;
  area: TaskArea;
  done: boolean;
  /** When I intend to work on it. */
  plan?: ISODate;
  /** Deadline. */
  due?: ISODate;
  steps: Step[];
  priority: Priority;
  list?: string;
  brand?: string;
  workstream?: 'content' | 'backend' | 'brand';
  content?: ContentInfo;
  /** Path of the (fixture) note this task would live in. */
  notePath: string;
}

export interface Payment {
  paid: boolean;
  note?: string;
}

export interface Bill {
  id: string;
  title: string;
  recurrence: 'monthly';
  dueDay: number;
  reminderDays: number;
  /** First month ("YYYY-MM") this bill exists. */
  start: string;
  /** Per-month payment state. One month never affects another. */
  payments: Record<string, Payment>;
  notePath: string;
}

export interface StageItem {
  id: string;
  text: string;
  done: boolean;
  date?: ISODate;
}

export interface Stage {
  id: string;
  name: string;
  inScope: boolean;
  done: boolean;
  start?: ISODate;
  end?: ISODate;
  items: StageItem[];
}

export interface MusicProject {
  id: string;
  /** own-release = whole release; artist-job = only the stages assigned to me. */
  kind: 'own-release' | 'artist-job';
  artist: string;
  title: string;
  label?: string;
  client?: string;
  roles: string[];
  releaseType?: 'single' | 'album' | 'other';
  targetRelease?: ISODate;
  stages: Stage[];
  notePath: string;
}

export interface AppData {
  version: 1;
  tasks: Task[];
  bills: Bill[];
  projects: MusicProject[];
  /** Seround brands, in display order. Renaming one renames it on its tasks. */
  brands: string[];
}

export const STAGE_LIBRARY = ['Concept', 'Produce', 'Record', 'Lyrics', 'Mix', 'Master', 'Art', 'MV', 'Marketing', 'Streaming', 'Release'];

export const BRANDS = ['sundey ສະບາຍດີຈຸເຈົ້າ', 'Eli Lao Origin', 'Reva Gem Cosmentics'];
