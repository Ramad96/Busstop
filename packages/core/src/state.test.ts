import { describe, expect, it } from 'vitest';
import { REVEAL_MS, SUBMIT_GRACE_MS } from './constants';
import { createGame, GameError, nextDeadline, reduce, type Action } from './state';
import { seq } from './testUtils';
import type { GameState } from './types';

const T0 = 1_000_000;

function lobby(): GameState {
  let s = createGame('ABCD', { id: 'h', name: 'Hana', character: 'fox' });
  s = reduce(s, { type: 'join', playerId: 'p2', name: 'Bob', character: 'frog' });
  s = reduce(s, { type: 'join', playerId: 'p3', name: 'Cat', character: 'panda' });
  return reduce(s, {
    type: 'updateSettings',
    playerId: 'h',
    settings: { categories: ['Food', 'Country'], roundSeconds: 60 },
  });
}

/** Starts a round with letter A (random 0) and moves into playing. */
function playing(): GameState {
  const s = reduce(lobby(), { type: 'start', playerId: 'h', now: T0, random: seq(0) });
  return reduce(s, { type: 'tick', now: T0 + REVEAL_MS });
}

function expectError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    expect((e as GameError).code).toBe(code);
    return;
  }
  throw new Error(`Expected GameError ${code}`);
}

describe('createGame', () => {
  it('starts in the lobby with the creator as host', () => {
    const s = createGame('ABCD', { id: 'h', name: 'Hana', character: 'fox' });
    expect(s.phase).toBe('lobby');
    expect(s.hostId).toBe('h');
    expect(s.players).toHaveLength(1);
    expect(s.totals).toEqual({ h: 0 });
    expect(s.settings.roundSeconds).toBe(120);
    expect(s.settings.categories).toHaveLength(6);
  });
});

describe('join', () => {
  it('adds players in order', () => {
    expect(lobby().players.map((p) => p.name)).toEqual(['Hana', 'Bob', 'Cat']);
  });

  it('rejects duplicate names, ignoring case', () => {
    expectError(
      () => reduce(lobby(), { type: 'join', playerId: 'x', name: ' bob ', character: 'fox' }),
      'name_taken',
    );
  });

  it('rejects blank or long names and bad characters', () => {
    const s = lobby();
    expectError(
      () => reduce(s, { type: 'join', playerId: 'x', name: '  ', character: 'fox' }),
      'name_invalid',
    );
    expectError(
      () => reduce(s, { type: 'join', playerId: 'x', name: 'A'.repeat(17), character: 'fox' }),
      'name_invalid',
    );
    expectError(
      () => reduce(s, { type: 'join', playerId: 'x', name: 'Dan', character: 'dragon' as never }),
      'character_invalid',
    );
  });

  it('rejects joining twice and full rooms', () => {
    let s = lobby();
    expectError(
      () => reduce(s, { type: 'join', playerId: 'p2', name: 'Bobby', character: 'fox' }),
      'already_joined',
    );
    for (let i = 0; i < 9; i++) {
      s = reduce(s, { type: 'join', playerId: `x${i}`, name: `P${i}`, character: 'fox' });
    }
    expectError(
      () => reduce(s, { type: 'join', playerId: 'late', name: 'Late', character: 'fox' }),
      'room_full',
    );
  });

  it('late joiners watch until the next round', () => {
    const s = reduce(playing(), { type: 'join', playerId: 'late', name: 'Late', character: 'fox' });
    expect(s.players.find((p) => p.id === 'late')?.spectating).toBe(true);
    expect(s.round?.participants).not.toContain('late');
    expectError(
      () => reduce(s, { type: 'updateAnswers', playerId: 'late', answers: { Food: 'Apple' } }),
      'not_participant',
    );
  });
});

describe('settings', () => {
  it('only the host can change them', () => {
    expectError(
      () => reduce(lobby(), { type: 'updateSettings', playerId: 'p2', settings: {} }),
      'not_host',
    );
  });

  it('validates timer and categories', () => {
    const s = lobby();
    const bad: Action['type'] = 'updateSettings';
    expectError(
      () => reduce(s, { type: bad, playerId: 'h', settings: { roundSeconds: 5 } }),
      'invalid_settings',
    );
    expectError(
      () => reduce(s, { type: bad, playerId: 'h', settings: { categories: [] } }),
      'invalid_settings',
    );
  });

  it('trims and de-duplicates categories', () => {
    const s = reduce(lobby(), {
      type: 'updateSettings',
      playerId: 'h',
      settings: { categories: [' Food ', 'food', 'Animal'] },
    });
    expect(s.settings.categories).toEqual(['Food', 'Animal']);
  });

  it("can't be changed mid-round", () => {
    expectError(
      () => reduce(playing(), { type: 'updateSettings', playerId: 'h', settings: {} }),
      'wrong_phase',
    );
  });
});

describe('start and timing', () => {
  it('only the host can start', () => {
    expectError(
      () => reduce(lobby(), { type: 'start', playerId: 'p2', now: T0, random: seq(0) }),
      'not_host',
    );
  });

  it('moves to reveal with a letter and end time', () => {
    const s = reduce(lobby(), { type: 'start', playerId: 'h', now: T0, random: seq(0) });
    expect(s.phase).toBe('reveal');
    expect(s.round).toMatchObject({
      number: 1,
      letter: 'A',
      categories: ['Food', 'Country'],
      participants: ['h', 'p2', 'p3'],
      revealEndsAt: T0 + REVEAL_MS,
      endsAt: T0 + REVEAL_MS + 60_000,
    });
    expect(s.usedLetters).toEqual(['A']);
    expect(nextDeadline(s)).toBe(T0 + REVEAL_MS);
  });

  it('ticks through reveal → playing → scoring → results', () => {
    let s = reduce(lobby(), { type: 'start', playerId: 'h', now: T0, random: seq(0) });
    s = reduce(s, { type: 'tick', now: T0 + 100 });
    expect(s.phase).toBe('reveal');
    s = reduce(s, { type: 'tick', now: T0 + REVEAL_MS });
    expect(s.phase).toBe('playing');
    const endsAt = s.round!.endsAt;
    expect(nextDeadline(s)).toBe(endsAt);
    s = reduce(s, { type: 'tick', now: endsAt });
    expect(s.phase).toBe('scoring');
    expect(nextDeadline(s)).toBe(endsAt + SUBMIT_GRACE_MS);
    s = reduce(s, { type: 'tick', now: endsAt + SUBMIT_GRACE_MS });
    expect(s.phase).toBe('results');
    expect(nextDeadline(s)).toBeNull();
  });

  it('a very late tick jumps straight to results', () => {
    const s = reduce(lobby(), { type: 'start', playerId: 'h', now: T0, random: seq(0) });
    expect(reduce(s, { type: 'tick', now: T0 + 10 * 60_000 }).phase).toBe('results');
  });

  it("can't start twice", () => {
    expectError(
      () => reduce(playing(), { type: 'start', playerId: 'h', now: T0, random: seq(0) }),
      'wrong_phase',
    );
  });
});

describe('answers', () => {
  it('saves drafts during playing', () => {
    const s = reduce(playing(), {
      type: 'updateAnswers',
      playerId: 'p2',
      answers: { Food: 'Apple' },
    });
    expect(s.round!.answers.p2).toEqual({ Food: 'Apple' });
  });

  it('rejects drafts during the reveal', () => {
    const s = reduce(lobby(), { type: 'start', playerId: 'h', now: T0, random: seq(0) });
    expectError(
      () => reduce(s, { type: 'updateAnswers', playerId: 'p2', answers: {} }),
      'wrong_phase',
    );
  });

  it('scores once every connected player has submitted', () => {
    let s = playing();
    s = reduce(s, { type: 'tick', now: s.round!.endsAt });
    s = reduce(s, {
      type: 'submitAnswers',
      playerId: 'h',
      answers: { Food: 'Apple', Country: 'Angola' },
    });
    s = reduce(s, {
      type: 'submitAnswers',
      playerId: 'p2',
      answers: { Food: 'apple', Country: 'Austria' },
    });
    expect(s.phase).toBe('scoring');
    expectError(
      () => reduce(s, { type: 'submitAnswers', playerId: 'p2', answers: {} }),
      'already_submitted',
    );
    s = reduce(s, { type: 'submitAnswers', playerId: 'p3', answers: { Food: 'Banana' } });
    expect(s.phase).toBe('results');
    expect(s.round!.result!.roundTotals).toEqual({ h: 15, p2: 15, p3: 0 });
    expect(s.totals).toEqual({ h: 15, p2: 15, p3: 0 });
  });

  it('uses saved drafts for players who never submit', () => {
    let s = playing();
    s = reduce(s, { type: 'updateAnswers', playerId: 'p3', answers: { Food: 'Avocado' } });
    s = reduce(s, { type: 'tick', now: s.round!.endsAt + SUBMIT_GRACE_MS });
    expect(s.phase).toBe('results');
    expect(s.round!.result!.roundTotals.p3).toBe(10);
  });

  it('does not wait for disconnected players', () => {
    let s = playing();
    s = reduce(s, { type: 'disconnect', playerId: 'p3' });
    s = reduce(s, { type: 'tick', now: s.round!.endsAt });
    s = reduce(s, { type: 'submitAnswers', playerId: 'h', answers: {} });
    s = reduce(s, { type: 'submitAnswers', playerId: 'p2', answers: {} });
    expect(s.phase).toBe('results');
  });

  it('accumulates totals across rounds', () => {
    let s = playing();
    s = reduce(s, { type: 'updateAnswers', playerId: 'h', answers: { Food: 'Apple' } });
    s = reduce(s, { type: 'tick', now: s.round!.endsAt + SUBMIT_GRACE_MS });
    s = reduce(s, { type: 'start', playerId: 'h', now: T0 + 100_000, random: seq(0) });
    expect(s.round!.letter).toBe('B');
    expect(s.round!.number).toBe(2);
    s = reduce(s, { type: 'tick', now: T0 + 100_000 + REVEAL_MS });
    s = reduce(s, { type: 'updateAnswers', playerId: 'h', answers: { Food: 'Bread' } });
    s = reduce(s, { type: 'tick', now: s.round!.endsAt + SUBMIT_GRACE_MS });
    expect(s.totals.h).toBe(20);
  });
});

describe('stop the clock', () => {
  it('is locked until every answer is valid', () => {
    expectError(
      () =>
        reduce(playing(), {
          type: 'stopClock',
          playerId: 'p2',
          answers: { Food: 'Apple' },
          now: T0 + REVEAL_MS + 1000,
        }),
      'answers_incomplete',
    );
  });

  it('drops the timer to 10 seconds', () => {
    const now = T0 + REVEAL_MS + 5000;
    const s = reduce(playing(), {
      type: 'stopClock',
      playerId: 'p2',
      answers: { Food: 'Apple', Country: 'Angola' },
      now,
    });
    expect(s.round!.endsAt).toBe(now + 10_000);
    expect(s.round!.stoppedBy).toBe('p2');
    expect(s.round!.answers.p2).toEqual({ Food: 'Apple', Country: 'Angola' });
  });

  it('does nothing with 10 seconds or less left', () => {
    const before = playing();
    const now = before.round!.endsAt - 8000;
    const s = reduce(before, {
      type: 'stopClock',
      playerId: 'p2',
      answers: { Food: 'Apple', Country: 'Angola' },
      now,
    });
    expect(s.round!.endsAt).toBe(before.round!.endsAt);
    expect(s.round!.stoppedBy).toBeNull();
  });
});

describe('host, leaving and reconnecting', () => {
  it('passes host to the next connected player when the host disconnects', () => {
    const s = reduce(lobby(), { type: 'disconnect', playerId: 'h' });
    expect(s.hostId).toBe('p2');
    expect(s.players[0].connected).toBe(false);
  });

  it('passes host when the host leaves', () => {
    const s = reduce(lobby(), { type: 'leave', playerId: 'h' });
    expect(s.hostId).toBe('p2');
    expect(s.players).toHaveLength(2);
    expect(s.totals).not.toHaveProperty('h');
  });

  it('keeps the old host id if nobody is connected, then fixes it on reconnect', () => {
    let s = lobby();
    s = reduce(s, { type: 'disconnect', playerId: 'p2' });
    s = reduce(s, { type: 'disconnect', playerId: 'p3' });
    s = reduce(s, { type: 'disconnect', playerId: 'h' });
    expect(s.players.every((p) => !p.connected)).toBe(true);
    s = reduce(s, { type: 'reconnect', playerId: 'p3' });
    expect(s.hostId).toBe('p3');
  });

  it('removes a leaving player from the round', () => {
    let s = playing();
    s = reduce(s, { type: 'updateAnswers', playerId: 'p3', answers: { Food: 'Apple' } });
    s = reduce(s, { type: 'leave', playerId: 'p3' });
    expect(s.round!.participants).toEqual(['h', 'p2']);
    expect(s.round!.answers).not.toHaveProperty('p3');
  });

  it('empties the room when the last player leaves', () => {
    let s = createGame('ABCD', { id: 'h', name: 'Hana', character: 'fox' });
    s = reduce(s, { type: 'leave', playerId: 'h' });
    expect(s.players).toEqual([]);
    expect(s.hostId).toBeNull();
  });

  it('rejects actions from strangers', () => {
    expectError(() => reduce(lobby(), { type: 'disconnect', playerId: 'nope' }), 'not_in_game');
  });
});

describe('endGame', () => {
  it('returns to the lobby and resets scores', () => {
    let s = playing();
    s = reduce(s, { type: 'updateAnswers', playerId: 'h', answers: { Food: 'Apple' } });
    s = reduce(s, { type: 'tick', now: s.round!.endsAt + SUBMIT_GRACE_MS });
    expectError(() => reduce(s, { type: 'endGame', playerId: 'p2' }), 'not_host');
    s = reduce(s, { type: 'endGame', playerId: 'h' });
    expect(s.phase).toBe('lobby');
    expect(s.round).toBeNull();
    expect(s.totals).toEqual({ h: 0, p2: 0, p3: 0 });
    expect(s.usedLetters).toEqual([]);
  });
});

describe('purity', () => {
  it('does not mutate the previous state', () => {
    const before = lobby();
    const snapshot = JSON.parse(JSON.stringify(before));
    reduce(before, { type: 'start', playerId: 'h', now: T0, random: seq(0) });
    reduce(before, { type: 'leave', playerId: 'h' });
    expect(before).toEqual(snapshot);
  });
});

describe('vote to reject', () => {
  /** Round with letter A: Hana "Axyz" and Bob "Apple" for Food, Cat blank. */
  function results(): GameState {
    let s = playing();
    s = reduce(s, { type: 'updateAnswers', playerId: 'h', answers: { Food: 'Axyz' } });
    s = reduce(s, { type: 'updateAnswers', playerId: 'p2', answers: { Food: 'Apple' } });
    return reduce(s, { type: 'tick', now: s.round!.endsAt + SUBMIT_GRACE_MS });
  }
  const vote = (s: GameState, voter: string, target = 'h', category = 'Food') =>
    reduce(s, { type: 'voteReject', playerId: voter, targetId: target, category });

  it('one vote out of two others is not enough', () => {
    const s = vote(results(), 'p2');
    expect(s.round!.votes).toHaveLength(1);
    expect(s.round!.result!.scores.h.Food.points).toBe(10);
  });

  it('a majority of the other players rejects the answer and fixes totals', () => {
    let s = results();
    expect(s.totals.h).toBe(10);
    s = vote(vote(s, 'p2'), 'p3');
    expect(s.round!.result!.scores.h.Food).toMatchObject({ points: 0, rejected: true });
    expect(s.round!.result!.roundTotals.h).toBe(0);
    expect(s.totals.h).toBe(0);
    expect(s.totals.p2).toBe(10);
  });

  it('voting again takes the vote back and restores points', () => {
    let s = vote(vote(results(), 'p2'), 'p3');
    s = vote(s, 'p3');
    expect(s.round!.votes).toHaveLength(1);
    expect(s.totals.h).toBe(10);
    expect(s.round!.result!.scores.h.Food.rejected).toBe(false);
  });

  it('only counts connected players when deciding', () => {
    let s = vote(results(), 'p3');
    expect(s.round!.result!.scores.h.Food.rejected).toBe(false);
    s = reduce(s, { type: 'disconnect', playerId: 'p2' });
    // Recalculated on the next vote: now p3 is the only other voter, so 1 vote is a majority.
    s = vote(vote(s, 'p3'), 'p3');
    expect(s.round!.result!.scores.h.Food.rejected).toBe(true);
  });

  it("can't vote on your own, blank or unknown answers, or outside results", () => {
    const s = results();
    expectError(() => vote(s, 'h', 'h'), 'invalid_vote');
    expectError(() => vote(s, 'h', 'p3'), 'invalid_vote');
    expectError(() => vote(s, 'h', 'p2', 'Nope'), 'invalid_vote');
    expectError(() => vote(playing(), 'p2'), 'wrong_phase');
  });

  it('votes reset in the next round', () => {
    let s = vote(results(), 'p2');
    s = reduce(s, { type: 'start', playerId: 'h', now: T0 + 200_000, random: seq(0) });
    expect(s.round!.votes).toEqual([]);
  });
});
