import { describe, expect, it } from 'vitest';
import { randomCategories } from './categories';
import { CATEGORY_BANK, DEFAULT_CATEGORIES, EXTRA_CATEGORIES } from './constants';
import { seq } from './testUtils';

describe('category bank', () => {
  it('has the 6 defaults plus 12 extras, all unique', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(6);
    expect(EXTRA_CATEGORIES).toHaveLength(12);
    expect(new Set(CATEGORY_BANK.map((c) => c.toLowerCase())).size).toBe(18);
  });
});

describe('randomCategories', () => {
  it('picks 6 different categories in bank order', () => {
    const picked = randomCategories(seq(0.9, 0.1, 0.5, 0.3, 0.7, 0.2));
    expect(picked).toHaveLength(6);
    expect(new Set(picked).size).toBe(6);
    expect(picked).toEqual(CATEGORY_BANK.filter((c) => picked.includes(c)));
  });

  it('is repeatable and copes with a small bank', () => {
    expect(randomCategories(seq(0.4))).toEqual(randomCategories(seq(0.4)));
    expect(randomCategories(seq(0), 6, ['A', 'B'])).toEqual(['A', 'B']);
  });
});
