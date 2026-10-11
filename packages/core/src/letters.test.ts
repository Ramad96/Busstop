import { describe, expect, it } from 'vitest';
import { HARD_LETTERS, ROOM_CODE_LENGTH } from './constants';
import { allowedLetters, generateRoomCode, normaliseRoomCode, pickLetter } from './letters';
import { seq } from './testUtils';

describe('allowedLetters', () => {
  it('skips hard letters by default', () => {
    const letters = allowedLetters({ includeHardLetters: false });
    expect(letters).toHaveLength(20);
    for (const hard of HARD_LETTERS) expect(letters).not.toContain(hard);
  });

  it('includes all 26 when hard letters are on', () => {
    expect(allowedLetters({ includeHardLetters: true })).toHaveLength(26);
  });
});

describe('pickLetter', () => {
  it('is repeatable with the same random function', () => {
    const settings = { includeHardLetters: false };
    expect(pickLetter(settings, seq(0.5))).toBe(pickLetter(settings, seq(0.5)));
  });

  it('picks the first and last allowed letters at the edges', () => {
    const settings = { includeHardLetters: false };
    expect(pickLetter(settings, seq(0))).toBe('A');
    expect(pickLetter(settings, seq(0.9999))).toBe('W');
  });

  it('never returns a hard letter by default', () => {
    for (let r = 0; r < 1; r += 0.01) {
      expect(HARD_LETTERS).not.toContain(pickLetter({ includeHardLetters: false }, seq(r)));
    }
  });

  it('can return Z when hard letters are on', () => {
    expect(pickLetter({ includeHardLetters: true }, seq(0.9999))).toBe('Z');
  });

  it('skips letters already used this game', () => {
    expect(pickLetter({ includeHardLetters: false }, seq(0), ['A', 'B'])).toBe('C');
  });

  it('starts again once every letter is used', () => {
    const used = allowedLetters({ includeHardLetters: false });
    expect(pickLetter({ includeHardLetters: false }, seq(0), used)).toBe('A');
  });

  it('does not overflow if random returns 1', () => {
    expect(pickLetter({ includeHardLetters: false }, seq(1))).toBe('W');
  });
});

describe('generateRoomCode', () => {
  it('makes a 4-letter code without O, I or L', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const code = generateRoomCode(seq(r, (r * 7) % 1, (r * 13) % 1, (r * 3) % 1));
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(code).toMatch(/^[A-Z]+$/);
      expect(code).not.toMatch(/[OIL]/);
    }
  });

  it('avoids codes already taken', () => {
    const random = seq(0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5);
    expect(generateRoomCode(random, ['AAAA'])).not.toBe('AAAA');
  });
});

describe('normaliseRoomCode', () => {
  it('uppercases and strips junk', () => {
    expect(normaliseRoomCode(' ab-cd ')).toBe('ABCD');
  });
});
