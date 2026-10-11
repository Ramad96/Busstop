import { ALPHABET, HARD_LETTERS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants';
import type { RandomFn, Settings } from './types';

export function allowedLetters(settings: Pick<Settings, 'includeHardLetters'>): string[] {
  return settings.includeHardLetters
    ? [...ALPHABET]
    : ALPHABET.filter((l) => !HARD_LETTERS.includes(l));
}

function pickFrom<T>(items: T[], random: RandomFn): T {
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index];
}

/**
 * Picks a letter for the next round. Letters already used this game are skipped
 * until every allowed letter has been used.
 */
export function pickLetter(
  settings: Pick<Settings, 'includeHardLetters'>,
  random: RandomFn,
  usedLetters: string[] = [],
): string {
  const allowed = allowedLetters(settings);
  const fresh = allowed.filter((l) => !usedLetters.includes(l));
  return pickFrom(fresh.length > 0 ? fresh : allowed, random);
}

/** Generates a room code that isn't in `taken`. */
export function generateRoomCode(random: RandomFn, taken: Iterable<string> = []): string {
  const takenSet = new Set(taken);
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += pickFrom(ROOM_CODE_ALPHABET, random);
    if (!takenSet.has(code)) return code;
  }
  throw new Error('Could not generate a unique room code');
}

export function normaliseRoomCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}
