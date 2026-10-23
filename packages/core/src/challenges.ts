import type { Rejection } from './scoring';
import type { Challenge, GameState, PlayerId } from './types';

/**
 * Who gets a say on a challenge: participants who are still connected, except the
 * player whose answer is being challenged.
 */
export function challengeVoters(state: GameState, challenge: Challenge): PlayerId[] {
  const round = state.round;
  if (!round) return [];
  return round.participants.filter(
    (id) => id !== challenge.targetId && state.players.some((p) => p.id === id && p.connected),
  );
}

/**
 * Decides a pending challenge once the result is certain:
 * - more than half of the voters say "invalid" → rejected (the answer scores 0)
 * - otherwise, once "invalid" can no longer reach a majority → the answer stands.
 * A tie goes to the answer.
 */
export function decideChallenge(state: GameState, challenge: Challenge): Challenge['outcome'] {
  if (challenge.outcome !== 'pending') return challenge.outcome;
  const voters = challengeVoters(state, challenge);
  if (voters.length === 0) return 'stands';
  const invalid = voters.filter((id) => challenge.votes[id] === 'invalid').length;
  const valid = voters.filter((id) => challenge.votes[id] === 'valid').length;
  if (invalid > voters.length / 2) return 'rejected';
  if (valid >= voters.length / 2) return 'stands';
  return 'pending';
}

export function findChallenge(
  challenges: Challenge[],
  targetId: PlayerId,
  category: string,
): Challenge | undefined {
  return challenges.find((c) => c.targetId === targetId && c.category === category);
}

export function rejectionsFrom(challenges: Challenge[]): Rejection[] {
  return challenges
    .filter((c) => c.outcome === 'rejected')
    .map((c) => ({ playerId: c.targetId, category: c.category }));
}
