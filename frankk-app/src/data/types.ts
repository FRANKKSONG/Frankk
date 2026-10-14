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
  /** progress = has steps and a progress bar; simple = a plain to-do (e.g. the repost queue). */
  mode: 'progress' | 'simple';
  tags: string[];
  notes?: string;
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
  /** main = part of the release step bar; side = its own track (Marketing, MV...), never in release progress. */
  track?: 'main' | 'side';
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
  releaseType?: 'single' | 'ep' | 'album' | 'other';
  targetRelease?: ISODate;
  start?: ISODate;
  stages: Stage[];
  tags: string[];
  /** Colour used for this project's row stripe. */
  color?: string;
  notes?: string;
  notePath: string;
}

export interface TagDef { name: string; color: string }

export interface AppData {
  version: 1;
  tasks: Task[];
  bills: Bill[];
  projects: MusicProject[];
  /** Seround brands, in display order. Renaming one renames it on its tasks. */
  brands: string[];
  brandColors: Record<string, string>;
  tags: TagDef[];
}

export const STAGE_LIBRARY = ['Concept', 'Lyrics', 'Produce', 'Record', 'Mix', 'Master', 'Mix & Master', 'Art (Design)', 'MV', 'Marketing', 'Streaming', 'Release'];
/** Default step bar for my own release, in order. */
export const RELEASE_STEPS = ['Concept', 'Lyrics', 'Produce', 'Record', 'Mix & Master', 'Art (Design)'];
/** Separate tracks: tracked, but never part of the release step bar or its progress. */
export const SIDE_STAGES = ['MV', 'Marketing', 'Streaming', 'Release'];

/** Colours drawn from medieval manuscript pigments; used for tags, brands and projects. */
export const PIGMENTS: { name: string; color: string }[] = [
  { name: 'Vermilion', color: '#c8553a' }, { name: 'Lapis', color: '#4c6fb8' }, { name: 'Verdigris', color: '#3f9a80' },
  { name: 'Orpiment', color: '#d4a03c' }, { name: 'Madder', color: '#b44a6e' }, { name: 'Tyrian', color: '#8a4f8f' },
  { name: 'Azurite', color: '#5a93c4' }, { name: 'Malachite', color: '#6aa452' }, { name: 'Red lead', color: '#dd7a45' },
  { name: 'Ochre', color: '#b98a3e' }, { name: 'Umber', color: '#8c6a4a' }, { name: 'Slate', color: '#7f8a96' },
];

export const BRANDS = ['sundey ສະບາຍດີຈຸເຈົ້າ', 'Eli Lao Origin', 'Reva Gem Cosmentics'];
