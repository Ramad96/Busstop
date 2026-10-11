import { describe, expect, it } from 'vitest';
import { pointsForShared, scoreRound, standings, winners } from './scoring';

describe('pointsForShared (scoring table)', () => {
  it.each([
    [0, 0],
    [1, 10],
    [2, 5],
    [3, 3],
    [4, 2],
    [7, 2],
  ])('%i players → %i points', (count, points) => {
    expect(pointsForShared(count)).toBe(points);
  });
});

describe('scoreRound', () => {
  const cats = ['Food'];
  const points = (answers: Record<string, string>) => {
    const all = Object.fromEntries(Object.entries(answers).map(([id, a]) => [id, { Food: a }]));
    const result = scoreRound(all, cats, 'B');
    return Object.fromEntries(
      Object.keys(answers).map((id) => [id, result.scores[id].Food.points]),
    );
  };

  it('unique answer = 10', () => {
    expect(points({ a: 'Bread', b: 'Banana', c: 'Bagel' })).toEqual({ a: 10, b: 10, c: 10 });
  });

  it('2 the same = 5 each', () => {
    expect(points({ a: 'Bread', b: 'bread', c: 'Bagel' })).toEqual({ a: 5, b: 5, c: 10 });
  });

  it('3 the same = 3 each', () => {
    expect(points({ a: 'Bread', b: 'BREAD', c: ' bread ', d: 'Bagel' })).toEqual({
      a: 3,
      b: 3,
      c: 3,
      d: 10,
    });
  });

  it('4 the same = 2 each', () => {
    expect(points({ a: 'Bread', b: 'bread', c: 'Bread', d: 'bread' })).toEqual({
      a: 2,
      b: 2,
      c: 2,
      d: 2,
    });
  });

  it('5 or more the same = 2 each', () => {
    expect(points({ a: 'B', b: 'b', c: 'b', d: 'b', e: 'b' })).toEqual({
      a: 2,
      b: 2,
      c: 2,
      d: 2,
      e: 2,
    });
  });

  it('blank = 0', () => {
    expect(points({ a: '', b: 'Bread' })).toEqual({ a: 0, b: 10 });
  });

  it('wrong letter = 0', () => {
    expect(points({ a: 'Apple', b: 'Bread' })).toEqual({ a: 0, b: 10 });
  });

  it('invalid answers do not count towards sharing', () => {
    expect(points({ a: 'Apple', b: 'Apple', c: 'Bread' })).toEqual({ a: 0, b: 0, c: 10 });
  });

  it('matches ignoring "the", accents and spaces', () => {
    const all = { a: { Brand: 'The Body Shop' }, b: { Brand: 'body shop' } };
    const result = scoreRound(all, ['Brand'], 'B');
    expect(result.scores.a.Brand.points).toBe(5);
    expect(result.scores.b.Brand.sharedWith).toBe(2);
  });

  it('treats a missing category as blank', () => {
    const result = scoreRound({ a: {}, b: { Food: 'Bread' } }, cats, 'B');
    expect(result.scores.a.Food).toMatchObject({ answer: '', valid: false, points: 0 });
  });

  it('adds up round totals across categories', () => {
    const result = scoreRound(
      {
        a: { Food: 'Bread', Country: 'Brazil' },
        b: { Food: 'Bread', Country: 'Belgium' },
      },
      ['Food', 'Country'],
      'B',
    );
    expect(result.roundTotals).toEqual({ a: 15, b: 15 });
  });

  it('scores rejected answers as 0 and stops them counting as shared', () => {
    const result = scoreRound({ a: { Food: 'Bxyz' }, b: { Food: 'Bxyz' } }, cats, 'B', {
      rejected: [{ playerId: 'a', category: 'Food' }],
    });
    expect(result.scores.a.Food).toMatchObject({ points: 0, rejected: true, valid: false });
    expect(result.scores.b.Food).toMatchObject({ points: 10, sharedWith: 1 });
  });

  it('handles a single player', () => {
    expect(points({ a: 'Bread' })).toEqual({ a: 10 });
  });
});

describe('standings and winners', () => {
  it('sorts by total and shares ranks on ties', () => {
    expect(standings({ a: 10, b: 30, c: 10 })).toEqual([
      { playerId: 'b', total: 30, rank: 1 },
      { playerId: 'a', total: 10, rank: 2 },
      { playerId: 'c', total: 10, rank: 2 },
    ]);
  });

  it('returns everyone tied for first', () => {
    expect(winners({ a: 20, b: 20, c: 5 })).toEqual(['a', 'b']);
    expect(winners({})).toEqual([]);
  });
});
