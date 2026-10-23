import type { CharacterId, Settings } from './types';

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const HARD_LETTERS = ['Q', 'U', 'V', 'X', 'Y', 'Z'];

/** Room codes avoid letters that are easy to confuse (O/0, I/L/1). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ'.split('');
export const ROOM_CODE_LENGTH = 4;

export const DEFAULT_CATEGORIES = [
  "Boy's name",
  "Girl's name",
  'Country',
  'Food',
  'Place',
  'Brand',
];

/** More categories the host can switch on. */
export const EXTRA_CATEGORIES = [
  'Animal',
  'Colour',
  'Fruit or veg',
  'Job',
  'Film or TV show',
  'Celebrity',
  'Football team',
  'Car brand',
  'Drink',
  'Sport',
  'Thing in a house',
  'Song',
];

export const CATEGORY_BANK = [...DEFAULT_CATEGORIES, ...EXTRA_CATEGORIES];

export const DEFAULT_SETTINGS: Settings = {
  roundSeconds: 120,
  categories: [...DEFAULT_CATEGORIES],
  includeHardLetters: false,
  totalRounds: 3,
};

export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 20;

export const MIN_ROUND_SECONDS = 30;
export const MAX_ROUND_SECONDS = 300;
export const MAX_CATEGORIES = 12;
export const MAX_CATEGORY_LENGTH = 24;
export const MAX_NAME_LENGTH = 16;
export const MAX_ANSWER_LENGTH = 40;
export const MAX_PLAYERS = 12;

/** Length of the letter-from-a-hat animation. */
export const REVEAL_MS = 3000;
/** Stop the clock drops the remaining time to this. */
export const STOP_CLOCK_MS = 10_000;
/** After time is up, how long the server waits for final answers before scoring. */
export const SUBMIT_GRACE_MS = 2000;

export const CHARACTERS: { id: CharacterId; emoji: string; label: string }[] = [
  { id: 'fox', emoji: '🦊', label: 'Fox' },
  { id: 'frog', emoji: '🐸', label: 'Frog' },
  { id: 'panda', emoji: '🐼', label: 'Panda' },
  { id: 'unicorn', emoji: '🦄', label: 'Unicorn' },
  { id: 'octopus', emoji: '🐙', label: 'Octopus' },
  { id: 'tiger', emoji: '🐯', label: 'Tiger' },
  { id: 'penguin', emoji: '🐧', label: 'Penguin' },
  { id: 'alien', emoji: '👽', label: 'Alien' },
];

export const CHARACTER_IDS = CHARACTERS.map((c) => c.id);
