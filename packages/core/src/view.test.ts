import { describe, expect, it } from 'vitest';
import { REVEAL_MS, SUBMIT_GRACE_MS } from './constants';
import { createGame, reduce } from './state';
import { seq } from './testUtils';
import { toPlayerView } from './view';

function inPlay() {
  let s = createGame('ABCD', { id: 'a', name: 'A', character: 'fox' });
  s = reduce(s, { type: 'join', playerId: 'b', name: 'B', character: 'fox' });
  s = reduce(s, { type: 'start', playerId: 'a', now: 0, random: seq(0) });
  s = reduce(s, { type: 'tick', now: REVEAL_MS });
  s = reduce(s, { type: 'updateAnswers', playerId: 'a', answers: { Food: 'Apple' } });
  return reduce(s, { type: 'updateAnswers', playerId: 'b', answers: { Food: 'Avocado' } });
}

describe('toPlayerView', () => {
  it('hides other players answers during the round', () => {
    expect(toPlayerView(inPlay(), 'a').round!.answers).toEqual({ a: { Food: 'Apple' } });
    expect(toPlayerView(inPlay(), null).round!.answers).toEqual({});
  });

  it('shows everything at results', () => {
    const s = reduce(inPlay(), { type: 'tick', now: 10 * 60_000 + SUBMIT_GRACE_MS });
    expect(s.phase).toBe('results');
    expect(Object.keys(toPlayerView(s, 'a').round!.answers)).toEqual(['a', 'b']);
  });
});
