export type PlayerId = string;

/** A function returning a number in [0, 1), like Math.random. Passed in so tests are repeatable. */
export type RandomFn = () => number;

export type GamePhase = 'lobby' | 'reveal' | 'playing' | 'scoring' | 'results';

export type CharacterId =
  'fox' | 'frog' | 'panda' | 'unicorn' | 'octopus' | 'tiger' | 'penguin' | 'alien';

export interface Player {
  id: PlayerId;
  name: string;
  character: CharacterId;
  connected: boolean;
  /** Joined while a round was in progress; plays from the next round. */
  spectating: boolean;
}

export interface Settings {
  roundSeconds: number;
  /** Enabled categories, in display order. */
  categories: string[];
  /** Include Q, U, V, X, Y, Z in the letter hat. */
  includeHardLetters: boolean;
}

/** One player's answers, keyed by category name. */
export type Answers = Record<string, string>;

/** Every player's answers for a round. */
export type AllAnswers = Record<PlayerId, Answers>;

export interface CategoryScore {
  answer: string;
  normalised: string;
  valid: boolean;
  /** How many players gave this same (valid) answer, including this player. 0 if invalid. */
  sharedWith: number;
  points: number;
  rejected: boolean;
}

export interface RoundResult {
  letter: string;
  categories: string[];
  scores: Record<PlayerId, Record<string, CategoryScore>>;
  roundTotals: Record<PlayerId, number>;
}

export interface Round {
  number: number;
  letter: string;
  categories: string[];
  /** Players taking part (not spectators). */
  participants: PlayerId[];
  /** Epoch ms when the letter reveal ends and typing starts. */
  revealEndsAt: number;
  /** Epoch ms when answers lock. */
  endsAt: number;
  stoppedBy: PlayerId | null;
  answers: AllAnswers;
  /** Players who have sent their final (locked) answers. */
  submitted: PlayerId[];
  result: RoundResult | null;
  /** Votes to reject answers, cast on the results screen. */
  votes: Vote[];
}

export interface Vote {
  voterId: PlayerId;
  targetId: PlayerId;
  category: string;
}

export interface GameState {
  code: string;
  phase: GamePhase;
  hostId: PlayerId | null;
  players: Player[];
  settings: Settings;
  round: Round | null;
  totals: Record<PlayerId, number>;
  usedLetters: string[];
}
