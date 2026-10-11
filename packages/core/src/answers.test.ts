import { describe, expect, it } from 'vitest';
import { allAnswersValid, isValidAnswer, normaliseAnswer, sanitiseAnswers } from './answers';

describe('normaliseAnswer', () => {
  it.each([
    ['Gap', 'gap'],
    ['The Gap', 'gap'],
    ['the   gap', 'gap'],
    ['  GAP  ', 'gap'],
    ['New Zealand', 'newzealand'],
    ['Émile', 'emile'],
    ['Crème brûlée', 'cremebrulee'],
    ["McDonald's", 'mcdonalds'],
    ['Coca-Cola', 'cocacola'],
    ['Theo', 'theo'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(normaliseAnswer(input)).toBe(expected);
  });
});

describe('isValidAnswer', () => {
  it('accepts an answer starting with the letter, any case', () => {
    expect(isValidAnswer('banana', 'B')).toBe(true);
    expect(isValidAnswer('Banana', 'b')).toBe(true);
  });

  it('rejects blanks and whitespace', () => {
    expect(isValidAnswer('', 'B')).toBe(false);
    expect(isValidAnswer('   ', 'B')).toBe(false);
  });

  it('rejects the wrong first letter', () => {
    expect(isValidAnswer('apple', 'B')).toBe(false);
  });

  it('ignores accents and a leading "the"', () => {
    expect(isValidAnswer('Éclair', 'E')).toBe(true);
    expect(isValidAnswer('The Gap', 'G')).toBe(true);
  });

  it('only checks the first letter, not whether the word is real', () => {
    expect(isValidAnswer('Bxyz', 'B')).toBe(true);
  });
});

describe('allAnswersValid', () => {
  const categories = ['Food', 'Country'];

  it('is true when every category is valid', () => {
    expect(allAnswersValid({ Food: 'Bread', Country: 'Brazil' }, categories, 'B')).toBe(true);
  });

  it('is false when one is missing or wrong', () => {
    expect(allAnswersValid({ Food: 'Bread' }, categories, 'B')).toBe(false);
    expect(allAnswersValid({ Food: 'Bread', Country: 'Chad' }, categories, 'B')).toBe(false);
  });
});

describe('sanitiseAnswers', () => {
  it('keeps known categories, trims and caps length', () => {
    const result = sanitiseAnswers(
      { Food: '  Bread ', Hacker: 'x', Country: 'B'.repeat(100), Place: 42 },
      ['Food', 'Country', 'Place'],
    );
    expect(result).toEqual({ Food: 'Bread', Country: 'B'.repeat(40) });
  });

  it('handles junk input', () => {
    expect(sanitiseAnswers(null, ['Food'])).toEqual({});
    expect(sanitiseAnswers('hello', ['Food'])).toEqual({});
  });
});
