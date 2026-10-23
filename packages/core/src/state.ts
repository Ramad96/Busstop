import { allAnswersValid, sanitiseAnswers } from './answers';
import { decideChallenge, findChallenge, rejectionsFrom } from './challenges';
import { applyStopClock } from './clock';
import {
  CHARACTER_IDS,
  DEFAULT_SETTINGS,
  MAX_CATEGORIES,
  MAX_CATEGORY_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_ROUND_SECONDS,
  MAX_ROUNDS,
  MIN_ROUND_SECONDS,
  MIN_ROUNDS,
  REVEAL_MS,
  SUBMIT_GRACE_MS,
} from './constants';
import { pickLetter } from './letters';
import { scoreRound } from './scoring';
import type {
  Answers,
  Challenge,
  ChallengeVerdict,
  CharacterId,
  GameState,
  Player,
  PlayerId,
  RandomFn,
  Round,
  Settings,
} from './types';

export type GameErrorCode =
  | 'not_host'
  | 'wrong_phase'
  | 'not_in_game'
  | 'already_joined'
  | 'name_invalid'
  | 'name_taken'
  | 'character_invalid'
  | 'room_full'
  | 'invalid_settings'
  | 'answers_incomplete'
  | 'already_submitted'
  | 'not_participant'
  | 'invalid_challenge'
  | 'last_round';

export class GameError extends Error {
  constructor(
    public readonly code: GameErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export type Action =
  | { type: 'join'; playerId: PlayerId; name: string; character: CharacterId }
  | { type: 'leave'; playerId: PlayerId }
  | { type: 'disconnect'; playerId: PlayerId }
  | { type: 'reconnect'; playerId: PlayerId }
  | { type: 'updateSettings'; playerId: PlayerId; settings: Partial<Settings> }
  | { type: 'start'; playerId: PlayerId; now: number; random: RandomFn }
  | { type: 'tick'; now: number }
  | { type: 'updateAnswers'; playerId: PlayerId; answers: Answers }
  | { type: 'submitAnswers'; playerId: PlayerId; answers: Answers }
  | { type: 'stopClock'; playerId: PlayerId; answers: Answers; now: number }
  | { type: 'endGame'; playerId: PlayerId }
  | { type: 'newGame'; playerId: PlayerId }
  | { type: 'challenge'; playerId: PlayerId; targetId: PlayerId; category: string }
  | {
      type: 'voteChallenge';
      playerId: PlayerId;
      targetId: PlayerId;
      category: string;
      verdict: ChallengeVerdict;
    };

export interface NewPlayer {
  id: PlayerId;
  name: string;
  character: CharacterId;
}

export function createGame(
  code: string,
  host: NewPlayer,
  settings: Settings = DEFAULT_SETTINGS,
): GameState {
  const empty: GameState = {
    code,
    phase: 'lobby',
    hostId: null,
    players: [],
    settings: { ...settings, categories: [...settings.categories] },
    round: null,
    totals: {},
    usedLetters: [],
    history: [],
  };
  return reduce(empty, {
    type: 'join',
    playerId: host.id,
    name: host.name,
    character: host.character,
  });
}

export function validateName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
    throw new GameError('name_invalid', `Name must be 1–${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

export function validateSettings(settings: Settings): Settings {
  const { roundSeconds, includeHardLetters, totalRounds } = settings;
  if (
    typeof roundSeconds !== 'number' ||
    !Number.isInteger(roundSeconds) ||
    roundSeconds < MIN_ROUND_SECONDS ||
    roundSeconds > MAX_ROUND_SECONDS
  ) {
    throw new GameError(
      'invalid_settings',
      `Timer must be ${MIN_ROUND_SECONDS}–${MAX_ROUND_SECONDS} seconds`,
    );
  }
  if (
    typeof totalRounds !== 'number' ||
    !Number.isInteger(totalRounds) ||
    totalRounds < MIN_ROUNDS ||
    totalRounds > MAX_ROUNDS
  ) {
    throw new GameError('invalid_settings', `Rounds must be ${MIN_ROUNDS}–${MAX_ROUNDS}`);
  }
  if (typeof includeHardLetters !== 'boolean') {
    throw new GameError('invalid_settings', 'includeHardLetters must be true or false');
  }
  if (!Array.isArray(settings.categories)) {
    throw new GameError('invalid_settings', 'categories must be a list');
  }
  const categories: string[] = [];
  for (const raw of settings.categories) {
    if (typeof raw !== 'string') throw new GameError('invalid_settings', 'Bad category');
    const c = raw.trim().replace(/\s+/g, ' ');
    if (c.length === 0 || c.length > MAX_CATEGORY_LENGTH) {
      throw new GameError(
        'invalid_settings',
        `Categories must be 1–${MAX_CATEGORY_LENGTH} characters`,
      );
    }
    if (!categories.some((existing) => existing.toLowerCase() === c.toLowerCase())) {
      categories.push(c);
    }
  }
  if (categories.length === 0 || categories.length > MAX_CATEGORIES) {
    throw new GameError('invalid_settings', `Pick 1–${MAX_CATEGORIES} categories`);
  }
  return { roundSeconds, includeHardLetters, categories, totalRounds };
}

export function getPlayer(state: GameState, playerId: PlayerId): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

function requirePlayer(state: GameState, playerId: PlayerId): Player {
  const player = getPlayer(state, playerId);
  if (!player) throw new GameError('not_in_game', 'You are not in this game');
  return player;
}

function requireHost(state: GameState, playerId: PlayerId): void {
  requirePlayer(state, playerId);
  if (state.hostId !== playerId) throw new GameError('not_host', 'Only the host can do that');
}

function requirePhase(state: GameState, ...phases: GameState['phase'][]): void {
  if (!phases.includes(state.phase)) {
    throw new GameError('wrong_phase', `Can't do that during ${state.phase}`);
  }
}

function requireRound(state: GameState): Round {
  if (!state.round) throw new GameError('wrong_phase', 'No round in progress');
  return state.round;
}

function requireParticipant(round: Round, playerId: PlayerId): void {
  if (!round.participants.includes(playerId)) {
    throw new GameError('not_participant', "You're watching this round");
  }
}

/** Makes sure the host is a connected player; otherwise hands host to the next player in join order. */
function ensureHost(state: GameState): GameState {
  const host = state.hostId ? getPlayer(state, state.hostId) : undefined;
  if (host?.connected) return state;
  const next = state.players.find((p) => p.connected) ?? host ?? state.players[0];
  return { ...state, hostId: next ? next.id : null };
}

function updatePlayer(state: GameState, playerId: PlayerId, patch: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
  };
}

/** Re-scores the finished round (after challenges change) and fixes up totals and history. */
function rescore(state: GameState): GameState {
  const round = requireRound(state);
  const old = round.result;
  if (!old) return state;
  const allAnswers: Record<PlayerId, Answers> = {};
  for (const id of round.participants) allAnswers[id] = round.answers[id] ?? {};
  const result = scoreRound(allAnswers, round.categories, round.letter, {
    rejected: rejectionsFrom(round.challenges),
  });
  const totals = { ...state.totals };
  for (const id of Object.keys(totals)) {
    totals[id] += (result.roundTotals[id] ?? 0) - (old.roundTotals[id] ?? 0);
  }
  const history = state.history.map((h) =>
    h.number === round.number ? { ...h, roundTotals: result.roundTotals } : h,
  );
  return { ...state, totals, history, round: { ...round, result } };
}

/** Settles any pending challenges that are now decided, re-scoring if one was rejected. */
function resolveChallenges(state: GameState): GameState {
  const round = state.round;
  if (state.phase !== 'results' || !round || round.challenges.length === 0) return state;
  let changed = false;
  const challenges = round.challenges.map((c) => {
    const outcome = decideChallenge(state, c);
    if (outcome === c.outcome) return c;
    changed = true;
    return { ...c, outcome };
  });
  if (!changed) return state;
  return rescore({ ...state, round: { ...round, challenges } });
}

/** Challenges still open when play moves on: the answer stands. */
function closeChallenges(round: Round): Round {
  return {
    ...round,
    challenges: round.challenges.map((c) =>
      c.outcome === 'pending' ? { ...c, outcome: 'stands' } : c,
    ),
  };
}

function finishRound(state: GameState): GameState {
  const round = requireRound(state);
  const allAnswers: Record<PlayerId, Answers> = {};
  for (const id of round.participants) allAnswers[id] = round.answers[id] ?? {};
  const result = scoreRound(allAnswers, round.categories, round.letter);
  const totals = { ...state.totals };
  for (const [id, points] of Object.entries(result.roundTotals)) {
    totals[id] = (totals[id] ?? 0) + points;
  }
  const history = [
    ...state.history,
    {
      number: round.number,
      letter: round.letter,
      stoppedBy: round.stoppedBy,
      roundTotals: result.roundTotals,
    },
  ];
  return { ...state, phase: 'results', totals, history, round: { ...round, result } };
}

/** In scoring, once every connected participant has sent final answers, score straight away. */
function maybeFinishScoring(state: GameState): GameState {
  if (state.phase !== 'scoring' || !state.round) return state;
  const round = state.round;
  const waiting = round.participants.filter(
    (id) => getPlayer(state, id)?.connected && !round.submitted.includes(id),
  );
  return waiting.length === 0 ? finishRound(state) : state;
}

/** The next time the server needs to send a `tick`, or null if nothing is timed. */
export function nextDeadline(state: GameState): number | null {
  if (!state.round) return null;
  switch (state.phase) {
    case 'reveal':
      return state.round.revealEndsAt;
    case 'playing':
      return state.round.endsAt;
    case 'scoring':
      return state.round.endsAt + SUBMIT_GRACE_MS;
    default:
      return null;
  }
}

/** Pure state machine: returns the new state, or throws GameError for an invalid action. */
export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'join': {
      if (getPlayer(state, action.playerId)) {
        throw new GameError('already_joined', 'Already in this game');
      }
      if (state.players.length >= MAX_PLAYERS) throw new GameError('room_full', 'Game is full');
      const name = validateName(action.name);
      if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        throw new GameError('name_taken', 'That name is taken');
      }
      if (!CHARACTER_IDS.includes(action.character)) {
        throw new GameError('character_invalid', 'Pick a character');
      }
      const spectating = !['lobby', 'results', 'final'].includes(state.phase);
      const player: Player = {
        id: action.playerId,
        name,
        character: action.character,
        connected: true,
        spectating,
      };
      return ensureHost({
        ...state,
        players: [...state.players, player],
        totals: { ...state.totals, [player.id]: 0 },
      });
    }

    case 'leave': {
      requirePlayer(state, action.playerId);
      const totals = { ...state.totals };
      delete totals[action.playerId];
      let round = state.round;
      if (round) {
        const answers = { ...round.answers };
        delete answers[action.playerId];
        round = {
          ...round,
          answers,
          participants: round.participants.filter((id) => id !== action.playerId),
          submitted: round.submitted.filter((id) => id !== action.playerId),
        };
      }
      const next: GameState = {
        ...state,
        players: state.players.filter((p) => p.id !== action.playerId),
        totals,
        round,
        hostId: state.hostId === action.playerId ? null : state.hostId,
      };
      return resolveChallenges(maybeFinishScoring(ensureHost(next)));
    }

    case 'disconnect': {
      requirePlayer(state, action.playerId);
      const next = updatePlayer(state, action.playerId, { connected: false });
      return resolveChallenges(maybeFinishScoring(ensureHost(next)));
    }

    case 'reconnect': {
      requirePlayer(state, action.playerId);
      return ensureHost(updatePlayer(state, action.playerId, { connected: true }));
    }

    case 'updateSettings': {
      requireHost(state, action.playerId);
      requirePhase(state, 'lobby', 'results');
      const settings = validateSettings({ ...state.settings, ...action.settings });
      if (state.phase === 'results' && state.round && settings.totalRounds < state.round.number) {
        throw new GameError(
          'invalid_settings',
          `You've already played ${state.round.number} rounds`,
        );
      }
      return { ...state, settings };
    }

    case 'start': {
      requireHost(state, action.playerId);
      requirePhase(state, 'lobby', 'results');
      if (state.phase === 'results' && (state.round?.number ?? 0) >= state.settings.totalRounds) {
        throw new GameError('last_round', 'That was the last round – see the final scores');
      }
      const letter = pickLetter(state.settings, action.random, state.usedLetters);
      const players = state.players.map((p) => ({ ...p, spectating: false }));
      const revealEndsAt = action.now + REVEAL_MS;
      const round: Round = {
        number: (state.round?.number ?? 0) + 1,
        letter,
        categories: [...state.settings.categories],
        participants: players.map((p) => p.id),
        revealEndsAt,
        endsAt: revealEndsAt + state.settings.roundSeconds * 1000,
        stoppedBy: null,
        answers: {},
        submitted: [],
        result: null,
        challenges: [],
      };
      return {
        ...state,
        phase: 'reveal',
        players,
        round,
        usedLetters: [...state.usedLetters, letter],
      };
    }

    case 'tick': {
      let next = state;
      if (next.phase === 'reveal' && next.round && action.now >= next.round.revealEndsAt) {
        next = { ...next, phase: 'playing' };
      }
      if (next.phase === 'playing' && next.round && action.now >= next.round.endsAt) {
        next = maybeFinishScoring({ ...next, phase: 'scoring' });
      }
      if (
        next.phase === 'scoring' &&
        next.round &&
        action.now >= next.round.endsAt + SUBMIT_GRACE_MS
      ) {
        next = finishRound(next);
      }
      return next;
    }

    case 'updateAnswers': {
      requirePlayer(state, action.playerId);
      requirePhase(state, 'playing');
      const round = requireRound(state);
      requireParticipant(round, action.playerId);
      const answers = sanitiseAnswers(action.answers, round.categories);
      return {
        ...state,
        round: { ...round, answers: { ...round.answers, [action.playerId]: answers } },
      };
    }

    case 'submitAnswers': {
      requirePlayer(state, action.playerId);
      requirePhase(state, 'playing', 'scoring');
      const round = requireRound(state);
      requireParticipant(round, action.playerId);
      if (state.phase === 'playing') {
        return reduce(state, { ...action, type: 'updateAnswers' });
      }
      if (round.submitted.includes(action.playerId)) {
        throw new GameError('already_submitted', 'Answers already locked in');
      }
      const answers = sanitiseAnswers(action.answers, round.categories);
      return maybeFinishScoring({
        ...state,
        round: {
          ...round,
          answers: { ...round.answers, [action.playerId]: answers },
          submitted: [...round.submitted, action.playerId],
        },
      });
    }

    case 'stopClock': {
      requirePlayer(state, action.playerId);
      requirePhase(state, 'playing');
      const round = requireRound(state);
      requireParticipant(round, action.playerId);
      const answers = sanitiseAnswers(action.answers, round.categories);
      if (!allAnswersValid(answers, round.categories, round.letter)) {
        throw new GameError('answers_incomplete', 'Fill in every answer first');
      }
      const endsAt = applyStopClock(round.endsAt, action.now);
      return {
        ...state,
        round: {
          ...round,
          answers: { ...round.answers, [action.playerId]: answers },
          endsAt,
          stoppedBy: endsAt < round.endsAt ? action.playerId : round.stoppedBy,
        },
      };
    }

    case 'challenge': {
      requirePlayer(state, action.playerId);
      requirePhase(state, 'results');
      const round = requireRound(state);
      requireParticipant(round, action.playerId);
      const score = round.result?.scores[action.targetId]?.[action.category];
      if (action.targetId === action.playerId || !score || !score.valid) {
        throw new GameError('invalid_challenge', "You can't challenge that answer");
      }
      if (findChallenge(round.challenges, action.targetId, action.category)) {
        throw new GameError('invalid_challenge', 'That answer has already been challenged');
      }
      const challenge: Challenge = {
        targetId: action.targetId,
        category: action.category,
        challengerId: action.playerId,
        votes: { [action.playerId]: 'invalid' },
        outcome: 'pending',
      };
      return resolveChallenges({
        ...state,
        round: { ...round, challenges: [...round.challenges, challenge] },
      });
    }

    case 'voteChallenge': {
      requirePlayer(state, action.playerId);
      requirePhase(state, 'results');
      const round = requireRound(state);
      requireParticipant(round, action.playerId);
      const challenge = findChallenge(round.challenges, action.targetId, action.category);
      if (!challenge || challenge.outcome !== 'pending') {
        throw new GameError('invalid_challenge', 'That challenge is already settled');
      }
      if (action.targetId === action.playerId) {
        throw new GameError('invalid_challenge', "You can't vote on your own answer");
      }
      if (action.verdict !== 'valid' && action.verdict !== 'invalid') {
        throw new GameError('invalid_challenge', 'Vote valid or invalid');
      }
      const challenges = round.challenges.map((c) =>
        c === challenge ? { ...c, votes: { ...c.votes, [action.playerId]: action.verdict } } : c,
      );
      return resolveChallenges({ ...state, round: { ...round, challenges } });
    }

    case 'endGame': {
      requireHost(state, action.playerId);
      requirePhase(state, 'results');
      return { ...state, phase: 'final', round: state.round && closeChallenges(state.round) };
    }

    case 'newGame': {
      requireHost(state, action.playerId);
      requirePhase(state, 'final');
      const totals: Record<PlayerId, number> = {};
      for (const p of state.players) totals[p.id] = 0;
      return {
        ...state,
        phase: 'lobby',
        round: null,
        totals,
        history: [],
        usedLetters: [],
        players: state.players.map((p) => ({ ...p, spectating: false })),
      };
    }
  }
}
