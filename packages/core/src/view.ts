import type { GameState, PlayerId } from './types';

/**
 * What one player is allowed to see. Until results, other players' answers are hidden
 * so nobody can copy. The shape matches GameState so clients can share types.
 */
export function toPlayerView(state: GameState, playerId: PlayerId | null): GameState {
  if (!state.round || state.phase === 'results') return state;
  const own = playerId ? state.round.answers[playerId] : undefined;
  return {
    ...state,
    round: { ...state.round, answers: own && playerId ? { [playerId]: own } : {} },
  };
}
