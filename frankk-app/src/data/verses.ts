/**
 * Old words for the morning blessing. Quoted only from public-domain translations, with the reference beside every line,
 * so Esther never invents scripture. The AI (when one is connected) may write the blessing around a verse, never the verse.
 * Where a verse is an excerpt, it starts or stops mid-verse; the words themselves are unchanged.
 */
export type Mood = 'chill' | 'steady' | 'focused' | 'locked';

export interface Verse {
  id: string;
  text: string;
  ref: string;
  /** Tradition, shown small beside the reference. */
  from: string;
  /** Translation it is quoted from. */
  tr: string;
  moods: Mood[];
  /** Good for a day with a lot already late. */
  hard?: boolean;
}

const KJV = 'King James Version, 1611';
const YA = 'trans. Yusuf Ali, 1934';

export const VERSES: Verse[] = [
  { id: 'eccl-9-10', text: 'Whatsoever thy hand findeth to do, do it with thy might.', ref: 'Ecclesiastes 9:10', from: 'Bible', tr: KJV, moods: ['locked', 'focused'] },
  { id: 'esth-4-14', text: 'And who knoweth whether thou art come to the kingdom for such a time as this?', ref: 'Esther 4:14', from: 'Bible', tr: KJV, moods: ['locked', 'focused'] },
  { id: 'prov-13-4', text: 'The soul of the sluggard desireth, and hath nothing: but the soul of the diligent shall be made fat.', ref: 'Proverbs 13:4', from: 'Bible', tr: KJV, moods: ['locked', 'focused'] },
  { id: 'deut-31-6', text: 'Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.', ref: 'Deuteronomy 31:6', from: 'Torah', tr: KJV, moods: ['locked'], hard: true },
  { id: 'josh-1-9', text: 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.', ref: 'Joshua 1:9', from: 'Bible', tr: KJV, moods: ['locked', 'focused'], hard: true },
  { id: 'isa-40-31', text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.', ref: 'Isaiah 40:31', from: 'Bible', tr: KJV, moods: ['locked', 'steady'], hard: true },
  { id: 'gal-6-9', text: 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.', ref: 'Galatians 6:9', from: 'Bible', tr: KJV, moods: ['focused', 'steady'], hard: true },
  { id: 'prov-6-6', text: 'Go to the ant, thou sluggard; consider her ways, and be wise.', ref: 'Proverbs 6:6', from: 'Bible', tr: KJV, moods: ['focused', 'steady'] },
  { id: 'prov-16-3', text: 'Commit thy works unto the LORD, and thy thoughts shall be established.', ref: 'Proverbs 16:3', from: 'Bible', tr: KJV, moods: ['focused', 'steady'] },
  { id: 'gen-1-3', text: 'And God said, Let there be light: and there was light.', ref: 'Genesis 1:3', from: 'Torah', tr: KJV, moods: ['steady', 'focused'] },
  { id: 'ps-118-24', text: 'This is the day which the LORD hath made; we will rejoice and be glad in it.', ref: 'Psalm 118:24', from: 'Bible', tr: KJV, moods: ['chill', 'steady'] },
  { id: 'eccl-3-1', text: 'To every thing there is a season, and a time to every purpose under the heaven.', ref: 'Ecclesiastes 3:1', from: 'Bible', tr: KJV, moods: ['chill', 'steady'] },
  { id: 'ps-46-10', text: 'Be still, and know that I am God.', ref: 'Psalm 46:10', from: 'Bible', tr: KJV, moods: ['chill'] },
  { id: 'matt-6-34', text: 'Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself. Sufficient unto the day is the evil thereof.', ref: 'Matthew 6:34', from: 'Bible', tr: KJV, moods: ['chill', 'steady'], hard: true },
  { id: 'lam-3-22', text: 'It is of the LORD’s mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.', ref: 'Lamentations 3:22–23', from: 'Bible', tr: KJV, moods: ['chill', 'steady'], hard: true },
  { id: 'ps-30-5', text: 'Weeping may endure for a night, but joy cometh in the morning.', ref: 'Psalm 30:5', from: 'Bible', tr: KJV, moods: ['chill'], hard: true },
  { id: 'q-94-5', text: 'So, verily, with every difficulty, there is relief: Verily, with every difficulty there is relief.', ref: 'Qur’an 94:5–6', from: 'Qur’an', tr: YA, moods: ['steady', 'locked'], hard: true },
  { id: 'q-2-286', text: 'On no soul doth Allah place a burden greater than it can bear.', ref: 'Qur’an 2:286', from: 'Qur’an', tr: YA, moods: ['locked', 'focused'], hard: true },
  { id: 'q-13-11', text: 'Verily never will Allah change the condition of a people until they change it themselves (with their own souls).', ref: 'Qur’an 13:11', from: 'Qur’an', tr: YA, moods: ['focused', 'locked'] },
  { id: 'avot-1-14', text: 'If I am not for myself, who will be for me? And when I am for myself, what am I? And if not now, when?', ref: 'Pirkei Avot 1:14 (Hillel)', from: 'Mishnah', tr: 'traditional English rendering', moods: ['locked', 'focused'] },
  { id: 'med-5-1', text: 'In the morning when thou risest unwillingly, let this thought be present—I am rising to the work of a human being.', ref: 'Meditations 5.1', from: 'Marcus Aurelius', tr: 'trans. George Long, 1862', moods: ['steady', 'focused'] },
  { id: 'sen-ep-1', text: 'Hold every hour in your grasp. Lay hold of to-day’s task, and you will not need to depend so much upon to-morrow’s.', ref: 'Letters to Lucilius 1', from: 'Seneca', tr: 'trans. R. M. Gummere, 1917', moods: ['focused', 'locked'] },
  { id: 'tao-64', text: 'The journey of a thousand li commences with a single step.', ref: 'Tao Te Ching 64', from: 'Laozi', tr: 'trans. James Legge, 1891', moods: ['steady', 'chill'], hard: true },
  { id: 'tao-8', text: 'The highest excellence is like (that of) water.', ref: 'Tao Te Ching 8', from: 'Laozi', tr: 'trans. James Legge, 1891', moods: ['chill'] },
  { id: 'dhp-21', text: 'Earnestness is the path of immortality (Nirvana), thoughtlessness the path of death.', ref: 'Dhammapada 21', from: 'Dhammapada', tr: 'trans. F. Max Müller, 1881', moods: ['focused', 'locked'] },
];

/** Aramaic words of greeting, with what they mean. */
export const ARAMAIC: { word: string; gloss: string; ref?: string; moods: Mood[] }[] = [
  { word: 'Shlama', gloss: 'peace be with thee', moods: ['chill', 'steady'] },
  { word: 'Ephphatha', gloss: 'be opened', ref: 'Mark 7:34', moods: ['steady', 'focused'] },
  { word: 'Maranatha', gloss: 'our Lord, come', ref: '1 Corinthians 16:22', moods: ['locked', 'focused'] },
];

/** Your own saved sayings, kept exactly as you wrote them. They join the blessing on any day. */
export const SAYINGS: string[] = [
  'The moment you\u2019re disturbed by insult or pleased by praise, you\u2019re still slave',
];

/** Your motto: written above Matins every day. */
export const MOTTO = 'An ancient dreams in a modern land';
