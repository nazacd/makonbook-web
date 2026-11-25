// Every achievement the web knows how to show: its icon, the group it is
// listed under, and where it sits in the tree (grid cells, and the one it
// hangs from). The API decides which exist and which are earned (spec 27);
// one it sends that isn't here still shows, in the list, with the default
// icon. Icons are item names from `public/achievements/items/<name>.png`,
// the owner's set, and only from there: a new achievement picks one of those.

export type Group = 'start' | 'xp' | 'streak' | 'answers' | 'tests' | 'words' | 'clock' | 'quests' | 'world' | 'sharp';

export const GROUPS: { key: Group; label: string }[] = [
  { key: 'start', label: 'Getting started' },
  { key: 'xp', label: 'XP and levels' },
  { key: 'streak', label: 'The streak' },
  { key: 'answers', label: 'Right answers' },
  { key: 'tests', label: 'Tests and scores' },
  { key: 'words', label: 'Words' },
  { key: 'clock', label: 'The clock' },
  { key: 'quests', label: 'Quests' },
  { key: 'world', label: 'Out in the world' },
  { key: 'sharp', label: 'Sharpshooters' },
];

export type Entry = { code: string; icon: string; group: Group; col: number; row: number; parent?: string };

export const CATALOGUE: Entry[] = [
  { code: 'first_xp', icon: 'experience_bottle', group: 'start', col: 3, row: 5 },
  // XP and levels, straight up
  { code: 'xp_500', icon: 'gold_nugget', group: 'xp', col: 3, row: 4, parent: 'first_xp' },
  { code: 'xp_1000', icon: 'gold_ingot', group: 'xp', col: 3, row: 3, parent: 'xp_500' },
  { code: 'level_5', icon: 'emerald', group: 'xp', col: 3, row: 2, parent: 'xp_1000' },
  { code: 'level_10', icon: 'diamond', group: 'xp', col: 3, row: 1, parent: 'level_5' },
  // quests, up and left
  { code: 'quests_5', icon: 'map', group: 'quests', col: 2, row: 4, parent: 'xp_500' },
  { code: 'quests_25', icon: 'filled_map', group: 'quests', col: 1, row: 4, parent: 'quests_5' },
  { code: 'full_house', icon: 'oak_door', group: 'quests', col: 2, row: 3, parent: 'quests_5' },
  { code: 'clean_sweep', icon: 'brush', group: 'quests', col: 1, row: 3, parent: 'full_house' },
  // the clock, up and right
  { code: 'night_owl', icon: 'phantom_membrane', group: 'clock', col: 4, row: 3, parent: 'xp_1000' },
  { code: 'early_bird', icon: 'egg', group: 'clock', col: 5, row: 3, parent: 'night_owl' },
  // the streak, to the left
  { code: 'streak_3', icon: 'campfire', group: 'streak', col: 2, row: 5, parent: 'first_xp' },
  { code: 'streak_7', icon: 'blaze_rod', group: 'streak', col: 1, row: 5, parent: 'streak_3' },
  { code: 'streak_30', icon: 'lava_bucket', group: 'streak', col: 0, row: 5, parent: 'streak_7' },
  { code: 'streak_100', icon: 'netherite_ingot', group: 'streak', col: 0, row: 4, parent: 'streak_30' },
  { code: 'weekend_scholar', icon: 'cake', group: 'streak', col: 1, row: 6, parent: 'streak_7' },
  { code: 'comeback', icon: 'totem_of_undying', group: 'streak', col: 0, row: 6, parent: 'streak_30' },
  // answers, to the right
  { code: 'answers_100', icon: 'arrow', group: 'answers', col: 4, row: 5, parent: 'first_xp' },
  { code: 'answers_500', icon: 'bow', group: 'answers', col: 5, row: 5, parent: 'answers_100' },
  { code: 'answers_2000', icon: 'crossbow_standby', group: 'answers', col: 6, row: 5, parent: 'answers_500' },
  { code: 'answers_10000', icon: 'trident', group: 'answers', col: 7, row: 5, parent: 'answers_2000' },
  // tests and scores, right and up
  { code: 'pencil_age', icon: 'feather', group: 'start', col: 5, row: 4, parent: 'answers_100' },
  { code: 'tests_10', icon: 'golden_boots', group: 'tests', col: 6, row: 4, parent: 'pencil_age' },
  { code: 'on_target', icon: 'spectral_arrow', group: 'tests', col: 7, row: 4, parent: 'tests_10' },
  { code: 'club_1500', icon: 'diamond_helmet', group: 'tests', col: 7, row: 3, parent: 'on_target' },
  { code: 'full_marks', icon: 'nether_star', group: 'tests', col: 7, row: 2, parent: 'club_1500' },
  { code: 'perfect_set', icon: 'golden_apple', group: 'tests', col: 6, row: 3, parent: 'tests_10' },
  // words and reading, down
  { code: 'getting_words', icon: 'paper', group: 'start', col: 3, row: 6, parent: 'first_xp' },
  { code: 'reviews_500', icon: 'writable_book', group: 'words', col: 3, row: 7, parent: 'getting_words' },
  { code: 'reviews_2000', icon: 'enchanted_book', group: 'words', col: 3, row: 8, parent: 'reviews_500' },
  { code: 'open_book', icon: 'book', group: 'start', col: 4, row: 6, parent: 'getting_words' },
  { code: 'bookworm', icon: 'knowledge_book', group: 'world', col: 5, row: 6, parent: 'open_book' },
  { code: 'pair_of_aces', icon: 'rabbit_foot', group: 'sharp', col: 4, row: 7, parent: 'getting_words' },
  // school life, down and left
  { code: 'dream_set', icon: 'compass_16', group: 'start', col: 2, row: 6, parent: 'first_xp' },
  { code: 'front_row', icon: 'bell', group: 'start', col: 2, row: 7, parent: 'dream_set' },
  { code: 'regular', icon: 'name_tag', group: 'world', col: 1, row: 7, parent: 'front_row' },
  { code: 'graduation', icon: 'elytra', group: 'world', col: 0, row: 7, parent: 'regular' },
  { code: 'contender', icon: 'iron_sword', group: 'world', col: 2, row: 8, parent: 'front_row' },
  { code: 'podium', icon: 'golden_helmet', group: 'world', col: 1, row: 8, parent: 'contender' },
  // the sharpshooters
  { code: 'sniper', icon: 'spyglass', group: 'sharp', col: 6, row: 6, parent: 'answers_2000' },
];

const BY_CODE = new Map(CATALOGUE.map((e) => [e.code, e]));

/** Icons with a job of their own. */
export const ICON = {
  /** An achievement the catalogue doesn't know yet. */
  fallback: 'experience_bottle',
  /** A secret, until it is earned. */
  secret: 'bundle',
  quest: 'trial_key',
  nudge: 'book',
  cobwebs: 'string',
  /** For when video lessons exist ("Watching the Video"). */
  video: 'heart_of_the_sea', room: 'painting',
} as const;

export const entryOf = (code: string): Entry | undefined => BY_CODE.get(code);
/** The item for an achievement; a secret not yet earned keeps its sack shut. */
export const iconOf = (code: string, hidden = false): string => (hidden ? ICON.secret : (BY_CODE.get(code)?.icon ?? ICON.fallback));
export const groupOf = (code: string): Group => BY_CODE.get(code)?.group ?? 'world';
