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

describe('purity', () => {
  it('does not mutate the previous state', () => {
    const before = lobby();
    const snapshot = JSON.parse(JSON.stringify(before));
    reduce(before, { type: 'start', playerId: 'h', now: T0, random: seq(0) });
    reduce(before, { type: 'leave', playerId: 'h' });
    expect(before).toEqual(snapshot);
  });
});

/** Plays one round with letter A (random 0) to results, with the given Food answers. */
function playRound(s: GameState, food: Record<string, string>, now = T0): GameState {
  s = reduce(s, { type: 'start', playerId: s.hostId!, now, random: seq(0) });
  s = reduce(s, { type: 'tick', now: now + REVEAL_MS });
  for (const [id, answer] of Object.entries(food)) {
    s = reduce(s, { type: 'updateAnswers', playerId: id, answers: { Food: answer } });
  }
  return reduce(s, { type: 'tick', now: s.round!.endsAt + SUBMIT_GRACE_MS });
}

describe('rounds and the final scoreboard', () => {
  it('defaults to 3 rounds and validates the setting', () => {
    expect(lobby().settings.totalRounds).toBe(3);
    expectError(
      () =>
        reduce(lobby(), { type: 'updateSettings', playerId: 'h', settings: { totalRounds: 0 } }),
      'invalid_settings',
    );
    expectError(
      () =>
        reduce(lobby(), { type: 'updateSettings', playerId: 'h', settings: { totalRounds: 2.5 } }),
      'invalid_settings',
    );
  });

  it('records each round in the history, including who called BUSSTOP!', () => {
    let s = reduce(lobby(), { type: 'start', playerId: 'h', now: T0, random: seq(0) });
    s = reduce(s, { type: 'tick', now: T0 + REVEAL_MS });
    s = reduce(s, {
      type: 'stopClock',
      playerId: 'p2',
      answers: { Food: 'Apple', Country: 'Angola' },
      now: T0 + REVEAL_MS + 1000,
    });
    s = reduce(s, { type: 'tick', now: s.round!.endsAt + SUBMIT_GRACE_MS });
    expect(s.history).toEqual([
      { number: 1, letter: 'A', stoppedBy: 'p2', roundTotals: { h: 0, p2: 20, p3: 0 } },
    ]);
  });

  it('stops after the last round, then End game shows the final scoreboard', () => {
    let s = reduce(lobby(), {
      type: 'updateSettings',
      playerId: 'h',
      settings: { totalRounds: 2 },
    });
    s = playRound(s, { h: 'Apple' });
    s = playRound(s, { h: 'Bread' }, T0 + 200_000);
    expect(s.round!.number).toBe(2);
    expectError(
      () => reduce(s, { type: 'start', playerId: 'h', now: T0 + 400_000, random: seq(0) }),
      'last_round',
    );
    expectError(() => reduce(s, { type: 'endGame', playerId: 'p2' }), 'not_host');
    s = reduce(s, { type: 'endGame', playerId: 'h' });
    expect(s.phase).toBe('final');
    expect(s.history.map((h) => h.letter)).toEqual(['A', 'B']);
    expect(s.totals.h).toBe(20);
  });

  it('End game part-way through also goes to the final scoreboard', () => {
    let s = playRound(lobby(), { h: 'Apple' });
    s = reduce(s, { type: 'endGame', playerId: 'h' });
    expect(s.phase).toBe('final');
    expect(s.totals.h).toBe(10);
  });

  it("can't lower the rounds below what's been played", () => {
    let s = reduce(lobby(), {
      type: 'updateSettings',
      playerId: 'h',
      settings: { totalRounds: 3 },
    });
    s = playRound(s, { h: 'Apple' });
    s = playRound(s, { h: 'Bread' }, T0 + 200_000);
    expectError(
      () => reduce(s, { type: 'updateSettings', playerId: 'h', settings: { totalRounds: 1 } }),
      'invalid_settings',
    );
    expect(
      reduce(s, { type: 'updateSettings', playerId: 'h', settings: { totalRounds: 2 } }).settings
        .totalRounds,
    ).toBe(2);
  });

  it('New game from the final scoreboard resets everything', () => {
    let s = playRound(lobby(), { h: 'Apple' });
    s = reduce(s, { type: 'endGame', playerId: 'h' });
    expectError(() => reduce(s, { type: 'newGame', playerId: 'p2' }), 'not_host');
    s = reduce(s, { type: 'newGame', playerId: 'h' });
    expect(s.phase).toBe('lobby');
    expect(s.round).toBeNull();
    expect(s.history).toEqual([]);
    expect(s.totals).toEqual({ h: 0, p2: 0, p3: 0 });
    expect(s.usedLetters).toEqual([]);
    expect(reduce(s, { type: 'start', playerId: 'h', now: T0, random: seq(0) }).round!.number).toBe(
      1,
    );
  });

  it('players joining at the final scoreboard play the next game', () => {
    let s = playRound(lobby(), { h: 'Apple' });
    s = reduce(s, { type: 'endGame', playerId: 'h' });
    s = reduce(s, { type: 'join', playerId: 'late', name: 'Late', character: 'fox' });
    expect(s.players.find((p) => p.id === 'late')?.spectating).toBe(false);
  });
});

describe('challenge the word', () => {
  /** Hana "Axyz", Bob "Apple", Cat blank. */
  const results = () => playRound(lobby(), { h: 'Axyz', p2: 'Apple' });
  const challenge = (s: GameState, by: string, target = 'h', category = 'Food') =>
    reduce(s, { type: 'challenge', playerId: by, targetId: target, category });
  const vote = (s: GameState, by: string, verdict: 'valid' | 'invalid', target = 'h') =>
    reduce(s, { type: 'voteChallenge', playerId: by, targetId: target, category: 'Food', verdict });

  it('opens a challenge with the challenger voting "invalid"', () => {
    const s = challenge(results(), 'p2');
    expect(s.round!.challenges).toEqual([
      {
        targetId: 'h',
        category: 'Food',
        challengerId: 'p2',
        votes: { p2: 'invalid' },
        outcome: 'pending',
      },
    ]);
    expect(s.round!.result!.scores.h.Food.points).toBe(10);
  });

  it('a majority of the other players rejects the answer, fixing totals and history', () => {
    let s = challenge(results(), 'p2');
    s = vote(s, 'p3', 'invalid');
    expect(s.round!.challenges[0].outcome).toBe('rejected');
    expect(s.round!.result!.scores.h.Food).toMatchObject({ points: 0, rejected: true });
    expect(s.totals.h).toBe(0);
    expect(s.history[0].roundTotals.h).toBe(0);
  });

  it('a tie goes to the answer', () => {
    const s = vote(challenge(results(), 'p2'), 'p3', 'valid');
    expect(s.round!.challenges[0].outcome).toBe('stands');
    expect(s.totals.h).toBe(10);
  });

  it('the challenger loses nothing when the answer stands', () => {
    const s = vote(challenge(results(), 'p2'), 'p3', 'valid');
    expect(s.totals.p2).toBe(10);
  });

  it('settled challenges can no longer be voted on', () => {
    const s = vote(challenge(results(), 'p2'), 'p3', 'valid');
    expectError(() => vote(s, 'p2', 'invalid'), 'invalid_challenge');
  });

  it('voters can change their mind while it is open', () => {
    let s = lobby();
    s = reduce(s, { type: 'join', playerId: 'p4', name: 'Dan', character: 'fox' });
    s = reduce(s, { type: 'join', playerId: 'p5', name: 'Eve', character: 'fox' });
    s = playRound(s, { h: 'Axyz' });
    // 4 voters: p2 (challenger, invalid), p3, p4, p5.
    s = challenge(s, 'p2');
    s = vote(s, 'p3', 'valid');
    expect(s.round!.challenges[0].outcome).toBe('pending');
    s = vote(s, 'p3', 'invalid');
    expect(s.round!.challenges[0].outcome).toBe('pending');
    s = vote(s, 'p4', 'invalid');
    expect(s.round!.challenges[0].outcome).toBe('rejected');
  });

  it('only counts connected players, and settles when someone drops out', () => {
    let s = challenge(results(), 'p2');
    s = reduce(s, { type: 'disconnect', playerId: 'p3' });
    // Now p2 is the only voter, and has voted invalid.
    expect(s.round!.challenges[0].outcome).toBe('rejected');
  });

  it("can't challenge your own, blank, wrong-letter or already-challenged answers", () => {
    let s = playRound(lobby(), { h: 'Axyz', p2: 'Banana' });
    expectError(() => challenge(s, 'h', 'h'), 'invalid_challenge');
    expectError(() => challenge(s, 'h', 'p3'), 'invalid_challenge');
    expectError(() => challenge(s, 'h', 'p2'), 'invalid_challenge');
    expectError(() => challenge(s, 'h', 'h', 'Nope'), 'invalid_challenge');
    s = challenge(s, 'p2');
    expectError(() => challenge(s, 'p3'), 'invalid_challenge');
    expectError(() => vote(s, 'h', 'valid'), 'invalid_challenge');
  });

  it('only works on the results screen', () => {
    expectError(() => challenge(playing(), 'p2'), 'wrong_phase');
  });

  it('open challenges close (answer stands) when the game ends', () => {
    let s = challenge(results(), 'p2');
    s = reduce(s, { type: 'endGame', playerId: 'h' });
    expect(s.round!.challenges[0].outcome).toBe('stands');
    expect(s.totals.h).toBe(10);
  });

  it('challenges reset in the next round', () => {
    let s = challenge(results(), 'p2');
    s = reduce(s, { type: 'start', playerId: 'h', now: T0 + 200_000, random: seq(0) });
    expect(s.round!.challenges).toEqual([]);
  });
});
