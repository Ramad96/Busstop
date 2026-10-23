import { CATEGORY_BANK } from './constants';
import type { RandomFn } from './types';

/** Picks `count` different categories from the bank, in bank order. */
export function randomCategories(random: RandomFn, count = 6, bank = CATEGORY_BANK): string[] {
  const pool = [...bank];
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    picked.push(pool.splice(index, 1)[0]);
  }
  return bank.filter((c) => picked.includes(c));
}
